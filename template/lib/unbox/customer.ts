// UnboxCustomerClient — operações da ÁREA DO CLIENTE final.
// Usa o token do cliente (obtido via UnboxClient.customerSignIn). NÃO precisa da API key
// da loja — pode rodar num BFF/Route Handler com o token vindo de um cookie httpOnly.

import { UnboxError, comEnderecoDoGrupo } from "./client";
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

  async gql<T = any>(query: string, variables: Record<string, any> = {}): Promise<T> {
    const res = await fetch(this.gqlUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.token}` },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors?.length) throw new UnboxError(json.errors.map((e: any) => e.message).join(" | "), json.errors);
    return json.data as T;
  }

  // --------------------------------------------------------------------- conta
  async me(): Promise<any> {
    const q = `query($s:String!){ currentCustomerAccount(shopId:$s){
      _id email isFirstAccess reuseDataBetweenShops metafields{receiveNewOrderEmail}
      addressBooks{_id alias fullName postal address1 number neighborhood city region isShippingDefault isBillingDefault}
      lastAddressUsed{_id postal address1 city region} }}`;
    const d = await this.gql<{ currentCustomerAccount: any }>(q, { s: this.shopId });
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
  // ⚠️ NÃO pedimos displayStatus: o resolver da Unbox lança
  //    "Cannot read properties of undefined (reading 'status')" e, por ser non-null,
  //    derruba a query inteira. Use `status` (enum) + orderStatusLabel() para o rótulo.
  async orders(opts: { first?: number; filters?: any } = {}): Promise<any> {
    const q = (endereco: string) => `query($shopId:ID!,$first:ConnectionLimitInt,$filters:CustomerOrderFilterInput){
      customerOrders(shopId:$shopId,first:$first,filters:$filters,sortBy:_id,sortOrder:desc){
        totalCount shippingMethods pageInfo{hasNextPage endCursor}
        nodes{_id referenceId status createdAt
          recurringOrderId dispatched delivered isBoletoPaid invoiceIssued
          summary{total{amount displayAmount}}
          fulfillmentGroups{
            ${endereco}
            items{nodes{_id title quantity thumbnail price{amount displayAmount}}}
          }} }}`;
    // ⚠️ totalItemQuantity removido: dispara "reading 'shop'" no resolver de customerOrders (bug Unbox).
    const d = await comEnderecoDoGrupo((endereco) => this.gql<{ customerOrders: any }>(q(endereco), { shopId: this.shopId, first: opts.first ?? 20, filters: opts.filters }));
    return d.customerOrders;
  }

  async order(referenceId: string): Promise<any> {
    // Seleção validada ao vivo. Notas do schema (customer context):
    //   payments.data → PaymentData (objeto) fica FORA. fulfillmentGroups.data é a união
    //   OrderFulfillmentGroupData: entra pelo comEnderecoDoGrupo, que repete a consulta sem o
    //   campo se o servidor não resolver o tipo. trackingUrl NÃO existe (use trackingCode).
    const q = (endereco: string) => `query($referenceId:ID!,$shopId:ID!){
      customerOrderByReferenceId(referenceId:$referenceId,shopId:$shopId){
        _id referenceId status email createdAt
        summary{total{amount displayAmount}}
        discounts{code label discount discountMethod}
        payments{displayName mode processor isCaptured cardBrand captureErrorMessage amount{amount displayAmount}}
        fulfillmentGroups{
          status type trackingCode
          ${endereco}
          items{nodes{_id title variantTitle quantity thumbnail productSlug price{amount displayAmount} subtotal{displayAmount} productConfiguration{productId productVariantId}}}
        }
        recurringOrderId generatedNewRecurringOrder }}`;
    const d = await comEnderecoDoGrupo((endereco) => this.gql<{ customerOrderByReferenceId: any }>(q(endereco), { referenceId, shopId: this.shopId }));
    return d.customerOrderByReferenceId;
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
