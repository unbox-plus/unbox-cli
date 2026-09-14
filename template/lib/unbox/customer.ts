// UnboxCustomerClient — operações da ÁREA DO CLIENTE final.
// Usa o token do cliente (obtido via UnboxClient.customerSignIn). NÃO precisa da API key
// da loja — pode rodar num BFF/Route Handler com o token vindo de um cookie httpOnly.

import { UnboxError, comEnderecoDoGrupo } from "./client";
import { comSelecaoEnxuta, normalizarMiniaturas, IMAGENS_DO_ITEM, RESUMO_DETALHADO, ENVIO_E_RASTREIO } from "./pedido";
import type { AddressInput } from "./types";

const RECURRING_FIELDS = `
  _id referenceId shopId createdAt updatedAt customerAccountId unboxPayCustomerId
  status{value createdAt} frequency{_id title periodicity interval}
  pricingPolicy{type value}
  cyclesInformation{cycleCount skipNextCycle lastCycleDate nextCycleDate}
  items{productId variantId productERPCode variantERPCode quantity skipNextCycle}
  unboxPayCustomerCreditCard{first4Digits last4Digits expirationMonth expirationYear holderName}
  shippingAddressBook{_id fullName postal address1 number neighborhood city region}
  discount{discountId code} totalAmount{amount displayAmount}`;

/** Formato do Authorization que a API aceitou, memorizado por instância do servidor. É propriedade
 *  da API, não do cliente, então vale para todas as sessões depois de medido uma vez. */
let esquemaAceito: "bearer" | "raw" | null = null;

export class UnboxCustomerClient {
  gqlUrl: string;
  shopId: string;
  token: string;
  language: string;

  constructor(opts: { token: string; shopId: string; gqlUrl?: string; language?: string }) {
    this.token = opts.token;
    this.shopId = opts.shopId;
    this.gqlUrl = opts.gqlUrl ?? "https://core.unbox.com.br/graphql";
    this.language = opts.language ?? "pt-BR";
  }

  private async enviar(query: string, variables: Record<string, any>, esquema: "bearer" | "raw"): Promise<any> {
    const res = await fetch(this.gqlUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: esquema === "bearer" ? `Bearer ${this.token}` : this.token },
      body: JSON.stringify({ query, variables }),
    });
    return res.json().catch(() => ({ errors: [{ message: `resposta que não é JSON (HTTP ${res.status})` }] }));
  }

  /**
   * FORMATO DO AUTHORIZATION. O cliente de LOJA já alterna entre `Bearer <token>` e o token cru
   * (client.ts), porque a API aceita ora um, ora outro. Aqui era `Bearer` fixo. E quando o formato
   * é recusado a resposta não é 401: vem como erro de resolver, sem nada que diga "autenticação".
   * Por isso, enquanto o formato não foi medido, qualquer erro numa CONSULTA repete no outro formato,
   * e o que funcionar fica memorizado.
   *
   * MUTAÇÃO NUNCA REPETE. `customerTogglePauseRecurringOrder` é um interruptor: executado duas vezes,
   * volta ao estado de antes, e a pessoa vê "pausada" numa assinatura que continua ativa. Sem formato
   * medido, uma consulta leve mede antes, e só então a mutação vai, uma vez.
   */
  async gql<T = any>(query: string, variables: Record<string, any> = {}): Promise<T> {
    const mutacao = /^\s*mutation\b/.test(query);
    if (mutacao && !esquemaAceito) {
      await this.gql(`query($shopId:String!){ currentCustomerAccount(shopId:$shopId){ _id } }`, { shopId: this.shopId }).catch(() => null);
    }
    const primeiro = esquemaAceito ?? "bearer";
    let json = await this.enviar(query, variables, primeiro);
    if (!json.errors?.length) {
      esquemaAceito = primeiro;
    } else if (!esquemaAceito && !mutacao) {
      const outro = primeiro === "bearer" ? "raw" : "bearer";
      const segunda = await this.enviar(query, variables, outro);
      if (!segunda.errors?.length) {
        esquemaAceito = outro;
        console.warn(`[unbox] cliente logado: a API aceitou o Authorization no formato "${outro}", e ele fica memorizado`);
        json = segunda;
      }
    }
    if (json.errors?.length) throw new UnboxError(json.errors.map((e: any) => e.message).join(" | "), json.errors);
    return json.data as T;
  }

  // --------------------------------------------------------------------- conta
  async me(): Promise<any> {
    // A VARIÁVEL PRECISA SE CHAMAR `shopId`. O backend descobre a loja da requisição procurando uma
    // chave com esse nome literal nas variables (getShopIdFromRequestUseCase → searchValueFromObject).
    // Com `$s`, o mesmo valor chega no mesmo argumento e mesmo assim o contexto da loja fica vazio: o
    // resolver de addressBooks estoura em `shop._id` e a consulta inteira cai. O efeito visível era o
    // cabeçalho mostrando "Entrar" para quem estava logado. O gate do prebuild cobra o nome.
    const q = `query($shopId:String!){ currentCustomerAccount(shopId:$shopId){
      _id email isFirstAccess reuseDataBetweenShops metafields{receiveNewOrderEmail}
      addressBooks{_id alias fullName postal address1 number neighborhood city region isShippingDefault isBillingDefault}
      lastAddressUsed{_id postal address1 city region} }}`;
    const d = await this.gql<{ currentCustomerAccount: any }>(q, { shopId: this.shopId });
    return d.currentCustomerAccount;
  }

  /** Atualiza preferências da conta (ex.: receiveNewOrderEmail, reuseDataBetweenShops). */
  async updateAccount(input: { receiveNewOrderEmail?: boolean; reuseDataBetweenShops?: boolean }): Promise<any> {
    const q = `mutation($i:UpdateCustomerAccountInput!){ updateCustomerAccount(input:$i){
      _id reuseDataBetweenShops metafields{receiveNewOrderEmail} }}`;
    const d = await this.gql<{ updateCustomerAccount: any }>(q, { i: { shopId: this.shopId, ...input } });
    return d.updateCustomerAccount;
  }

  // -------------------------------------------------------------------- pedidos
  // Campos que já custaram a consulta inteira (resolver que lança, e o campo é non-null):
  //   · displayStatus      → "reading 'status'"   (use `status` + orderStatusLabel())
  //   · totalItemQuantity  → "reading 'shop'"
  //   · shippingMethods    → "reading '0'"
  //   · summary sem payments → "reading '0'"
  // O último é o mais traiçoeiro. O resolver de `summary` lê `payments[0]?.summary`, e a projeção do
  // banco só traz `payments` quando a consulta PEDE `payments`. Pedir o total sem pedir o pagamento é
  // GraphQL válido que apaga a resposta: o cliente logado via a conta sem nenhum pedido. Por isso
  // `payments` vai junto de `summary` em toda seleção abaixo, mesmo onde a tela não usa o pagamento.
  async orders(opts: { first?: number; filters?: any } = {}): Promise<any> {
    const completa = (endereco: string) => `query($shopId:ID!,$first:ConnectionLimitInt,$filters:CustomerOrderFilterInput){
      customerOrders(shopId:$shopId,first:$first,filters:$filters,sortBy:_id,sortOrder:desc){
        totalCount pageInfo{hasNextPage endCursor}
        nodes{_id referenceId status createdAt
          recurringOrderId dispatched delivered isBoletoPaid invoiceIssued
          payments{amount{amount displayAmount}}
          summary{total{amount displayAmount}}
          fulfillmentGroups{
            ${endereco}
            items{nodes{_id title quantity productSlug ${IMAGENS_DO_ITEM} price{amount displayAmount}}}
          }} }}`;
    // Enxuta: só o que a lista lê, sem endereço e sem argumento opcional (a ordem padrão da API já é
    // a data de criação, da mais nova para a mais antiga).
    const enxuta = `query($shopId:ID!,$first:ConnectionLimitInt){
      customerOrders(shopId:$shopId,first:$first){
        totalCount
        nodes{_id referenceId status createdAt recurringOrderId dispatched delivered
          payments{amount{amount displayAmount}}
          summary{total{amount displayAmount}}
          fulfillmentGroups{items{nodes{_id title quantity productSlug ${IMAGENS_DO_ITEM} price{amount displayAmount}}}}
        } }}`;
    const d = await comSelecaoEnxuta(
      "customerOrders",
      () => comEnderecoDoGrupo((endereco) => this.gql<{ customerOrders: any }>(completa(endereco), { shopId: this.shopId, first: opts.first ?? 20, filters: opts.filters })),
      () => this.gql<{ customerOrders: any }>(enxuta, { shopId: this.shopId, first: opts.first ?? 20 }),
    );
    for (const o of d.customerOrders?.nodes ?? []) normalizarMiniaturas(o);
    return d.customerOrders;
  }

  async order(referenceId: string): Promise<any> {
    // Notas do schema (contexto de cliente):
    //   · payments.data (PaymentData) fica FORA.
    //   · fulfillmentGroups.data é a união OrderFulfillmentGroupData: entra pelo comEnderecoDoGrupo,
    //     que repete a consulta sem o campo se o servidor não resolver o tipo.
    //   · `trackingUrl` não existe em Order, mas `fulfillmentGroups.tracking` é OrderTrackingData
    //     { code, url, event }: tem o link da transportadora e o histórico (`event.value` é o estado
    //     atual, `event.history` os anteriores).
    //   · FulfillmentMethod: `displayName` e `name` são String! no schema e voltam null nos dados
    //     ("Cannot return null for non-nullable field"), derrubando a consulta. Só os anuláveis.
    const selecao = (endereco: string, rica: boolean) => `query($referenceId:ID!,$shopId:ID!){
      customerOrderByReferenceId(referenceId:$referenceId,shopId:$shopId){
        _id referenceId status email createdAt
        summary{total{amount displayAmount}${rica ? RESUMO_DETALHADO : ""}}
        discounts{code label discount discountMethod}
        payments{displayName mode processor isCaptured cardBrand captureErrorMessage amount{amount displayAmount}${rica ? " status{status}" : ""}}
        fulfillmentGroups{
          status type trackingCode
          ${rica ? ENVIO_E_RASTREIO : ""}
          ${endereco}
          items{nodes{_id title variantTitle quantity ${IMAGENS_DO_ITEM} productSlug price{amount displayAmount} subtotal{displayAmount} productConfiguration{productId productVariantId}}}
        }
        recurringOrderId generatedNewRecurringOrder }}`;
    const vars = { referenceId, shopId: this.shopId };
    const d = await comSelecaoEnxuta(
      "customerOrderByReferenceId",
      () => comEnderecoDoGrupo((endereco) => this.gql<{ customerOrderByReferenceId: any }>(selecao(endereco, true), vars)),
      () => comEnderecoDoGrupo((endereco) => this.gql<{ customerOrderByReferenceId: any }>(selecao(endereco, false), vars)),
    );
    return normalizarMiniaturas(d.customerOrderByReferenceId);
  }

  // ----------------------------------------------------------------- assinaturas
  async subscriptions(opts: { first?: number; status?: string[] } = {}): Promise<any> {
    const q = `query($filters:CustomerRecurringOrdersFilterInput,$first:ConnectionLimitInt){
      customerRecurringOrders(filters:$filters,first:$first){
        totalCount nodes{_id referenceId shopId createdAt unboxPayCustomerId} }}`;
    const d = await this.gql<{ customerRecurringOrders: any }>(q, { first: opts.first ?? 10, filters: { status: opts.status, shopIds: [this.shopId] } });
    return d.customerRecurringOrders;
  }

  async subscription(referenceId: string): Promise<any> {
    const q = `query($referenceId:String!){ customerRecurringOrderByReferenceId(referenceId:$referenceId){${RECURRING_FIELDS}} }`;
    const d = await this.gql<{ customerRecurringOrderByReferenceId: any }>(q, { referenceId });
    return d.customerRecurringOrderByReferenceId;
  }

  async subscriptionCycles(recurringOrderId: string, first = 20): Promise<any> {
    const q = `query($filters:RecurringOrderCyclesFilterInput!,$first:ConnectionLimitInt){
      customerRecurringOrderCycles(filters:$filters,first:$first){
        totalCount nodes{_id cycleIndex completedAt skipped attemptingRetry manuallyRetried createdAt} }}`;
    const d = await this.gql<{ customerRecurringOrderCycles: any }>(q, { filters: { recurringOrderId }, first });
    return d.customerRecurringOrderCycles;
  }

  /** Pausar/retomar assinatura (toggle — valida ao vivo: customerTogglePauseRecurringOrder). */
  pause(recurringOrderId: string) {
    return this.gql(`mutation($id:String!){customerTogglePauseRecurringOrder(recurringOrderId:$id){${RECURRING_FIELDS}}}`, { id: recurringOrderId });
  }
  /** Adiar / pular o próximo ciclo. */
  skipNextCycle(recurringOrderId: string) {
    return this.gql(`mutation($id:String!){customerSkipNextRecurringOrderCycle(recurringOrderId:$id){${RECURRING_FIELDS}}}`, { id: recurringOrderId });
  }
  /** Cancelar assinatura. */
  cancel(recurringOrderId: string) {
    return this.gql(`mutation($id:String!){customerCancelRecurringOrder(recurringOrderId:$id){${RECURRING_FIELDS}}}`, { id: recurringOrderId });
  }
  /** Trocar itens/quantidade. */
  updateItems(recurringOrderId: string, items: Array<{ productId: string; variantId: string; quantity: number; skipNextCycle?: boolean }>) {
    const q = `mutation($i:UpdateRecurringOrderItemsInput){customerUpdateRecurringOrderItems(input:$i){${RECURRING_FIELDS}}}`;
    return this.gql(q, { i: { recurringOrderId, recurringOrderItems: items.map((x) => ({ ...x, skipNextCycle: x.skipNextCycle ?? false })) } });
  }
  /** Trocar cartão da assinatura. */
  updateCard(recurringOrderId: string, card: { holderName: string; cardNumber: string; expirationMonth: string; expirationYear: string; securityCode: string }) {
    const q = `mutation($i:UpdateRecurringOrderCreditCardInput!){customerUpdateRecurringOrderCreditCard(input:$i){${RECURRING_FIELDS}}}`;
    return this.gql(q, { i: { recurringOrderId, creditCardData: card } });
  }
  /** Trocar endereço de entrega da assinatura. */
  updateAddress(recurringOrderId: string, shippingAddress: AddressInput) {
    const q = `mutation($i:UpdateRecurringOrderShippingAddressInput!){customerUpdateRecurringOrderShippingAddress(input:$i){
      _id postal address1 number neighborhood city region fullName }}`;
    return this.gql(q, { i: { recurringOrderId, shippingAddress: { country: "BR", ...shippingAddress } } });
  }

  // ------------------------------------------------------------------ endereços
  /**
   * Busca endereços por ID. ⚠️ `customerAddressBooks` exige ao menos 1 id (não aceita lista vazia).
   * Para a LISTA COMPLETA do cliente, use `me().addressBooks` (vem em currentCustomerAccount).
   */
  async addressBooks(ids: string[]): Promise<any[]> {
    if (!ids?.length) throw new UnboxError("customerAddressBooks exige ao menos 1 id — use me().addressBooks para a lista completa");
    const q = `query($i:AddressBooksInput!){ customerAddressBooks(input:$i){
      _id alias fullName postal address1 address2 number neighborhood city region taxPayerId phone
      isShippingDefault isBillingDefault }}`;
    const d = await this.gql<{ customerAddressBooks: any[] }>(q, { i: { addressBooksIds: ids, shopId: this.shopId } });
    return d.customerAddressBooks;
  }

  /** Cria/atualiza um endereço do cliente (upsert). Sem `_id` cria; com `_id` atualiza. */
  async upsertAddress(address: AddressInput & { _id?: string; alias?: string; isShippingDefault?: boolean; isBillingDefault?: boolean }): Promise<any> {
    const q = `mutation($i:UpsertCustomerAddressBookInput!){ upsertCustomerAddressBook(input:$i){
      _id alias fullName postal address1 number neighborhood city region isShippingDefault isBillingDefault }}`;
    const d = await this.gql<{ upsertCustomerAddressBook: any }>(q, { i: { shopId: this.shopId, addressBook: { country: "BR", ...address } } });
    return d.upsertCustomerAddressBook;
  }

  /** Remove endereços do address book pelos ids. */
  async deleteAddresses(ids: string[]): Promise<any> {
    const q = `mutation($i:DeleteCustomerAddressBooksInput!){ deleteCustomerAddressBooks(input:$i){ _id } }`;
    const d = await this.gql<{ deleteCustomerAddressBooks: any }>(q, { i: { shopId: this.shopId, addressBooksIds: ids } });
    return d.deleteCustomerAddressBooks;
  }
}

/**
 * Rótulos PT-BR para Order.status (workaround do displayStatus quebrado na Unbox).
 * Valores conforme OrderStatusEnum do schema: PENDING, PROCESSING, COMPLETED, CANCELED, FAILED, REFUNDED.
 */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Aguardando pagamento",
  PROCESSING: "Em processamento",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
  FAILED: "Falhou",
  REFUNDED: "Reembolsado",
};
export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

/** Rótulos PT-BR para PaymentStatusEnum. */
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  CREATED: "Criado",
  PENDING: "Aguardando pagamento",
  AUTHORIZED: "Autorizado",
  CAPTURED: "Capturado",
  PAID: "Pago",
  CANCELED: "Cancelado",
  REFUNDED: "Reembolsado",
  EXPIRED: "Expirado",
  CHARGED_BACK: "Estornado (chargeback)",
};
export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] ?? status;
}

// ── STATUS QUE CHEGAM AO CLIENTE ─────────────────────────────────────────────────────────────
// Valor cru não é texto para cliente ("SHIPPING · new" chegou a aparecer na página do pedido). Todo
// mapa abaixo devolve undefined para o que ainda não conhece, e quem exibe cai no valor original: um
// status novo da API aparece cru, mas aparece. Sumir com ele esconderia justamente a novidade.

/** Status do GRUPO de entrega (`OrderFulfillmentGroup.status`). É String livre no schema: os valores
 *  vêm do workflow do backend, com e sem o prefixo `coreOrderWorkflow/`. */
export const FULFILLMENT_STATUS_LABELS: Record<string, string> = {
  new: "Preparando o pedido",
  created: "Preparando o pedido",
  processing: "Em separação",
  picked: "Separado",
  packed: "Embalado",
  labeled: "Etiqueta emitida",
  shipped: "Enviado",
  completed: "Entregue",
  canceled: "Cancelado",
};
export function fulfillmentStatusLabel(status?: string | null): string | undefined {
  if (!status) return undefined;
  const limpo = status.replace(/^coreOrderWorkflow\//, "").trim().toLowerCase();
  return FULFILLMENT_STATUS_LABELS[limpo];
}

/** `FulfillmentType` do schema: SHIPPING e NONE. */
export const FULFILLMENT_TYPE_LABELS: Record<string, string> = {
  SHIPPING: "Entrega",
  NONE: "Sem entrega",
};
export function fulfillmentTypeLabel(type?: string | null): string | undefined {
  return type ? FULFILLMENT_TYPE_LABELS[type] : undefined;
}

/** `TrackingEventStatusEnum`: os eventos do histórico de rastreio. */
export const TRACKING_STATUS_LABELS: Record<string, string> = {
  POSTED: "Postado",
  IN_TRANSIT: "Em trânsito",
  NOT_DELIVERED: "Não entregue",
  DELIVERED: "Entregue",
  AWAITING_WITHDRAWAL: "Aguardando retirada",
  PENDING: "Pendente",
  BOUND: "A caminho",
  LATE: "Atrasado",
  NOT_POSTED: "Ainda não postado",
  SUSPENDED_DELIVERY: "Entrega suspensa",
};
export function trackingStatusLabel(status?: string | null): string | undefined {
  return status ? TRACKING_STATUS_LABELS[status] : undefined;
}

/**
 * SELO DO PEDIDO: o status do PAGAMENTO, não o do pedido. "Pedido pago" diz ao cliente o que ele quer
 * saber; "Em processamento" não diz. Cobre os dois enums: `CustomerPaymentStatusEnum` (PAID, PENDING,
 * CANCELED, na conta do cliente) e `PaymentStatusEnum` (o do pedido lido com o token da loja).
 */
export const PAYMENT_SEAL_LABELS: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "muted" }> = {
  PAID: { label: "Pedido pago", tone: "ok" },
  CAPTURED: { label: "Pedido pago", tone: "ok" },
  AUTHORIZED: { label: "Pagamento autorizado", tone: "ok" },
  PENDING: { label: "Aguardando pagamento", tone: "warn" },
  CREATED: { label: "Aguardando pagamento", tone: "warn" },
  CANCELED: { label: "Pagamento cancelado", tone: "bad" },
  EXPIRED: { label: "Pagamento expirado", tone: "bad" },
  FAILED: { label: "Pagamento recusado", tone: "bad" },
  REFUNDED: { label: "Reembolsado", tone: "muted" },
  CHARGED_BACK: { label: "Estornado", tone: "muted" },
};
export function paymentSeal(status?: string | null) {
  return status ? PAYMENT_SEAL_LABELS[status] : undefined;
}

/** Rótulos PT-BR para RecurringOrderStatusEnum (assinatura). */
export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  CANCELED: "Cancelada",
  ERROR: "Com erro",
};
export function subscriptionStatusLabel(status: string): string {
  return SUBSCRIPTION_STATUS_LABELS[status] ?? status;
}
