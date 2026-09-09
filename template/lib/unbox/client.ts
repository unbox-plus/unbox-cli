// UnboxClient — SDK headless da Unbox para Next.js / Vercel (server-side).
// Zero dependências: usa fetch nativo (Node 18+, Edge Runtime).
//
// ⚠️ Este client guarda a API key e o token de loja — use APENAS no servidor
//    (Route Handlers, Server Actions, RSC). Nunca instancie no browser.
//
// DOIS ENDPOINTS (transição para a API pública de PARCEIROS):
// - partners.unbox.com.br/graphql — nova API pública. Uma api key por PARCEIRO (vale para
//   todas as lojas dele); a loja específica autentica por user/senha no signIn. Com
//   `partnerApiKey` configurada, vão para cá: signIn, VITRINE COMPLETA (catalogItems,
//   catalogItemProductBySlug, byId via productIdsOrERPCodes, shopBySlug), tags, cupons
//   (leitura), pedido por referenceId, parcelas, inventário (simpleInventory),
//   subscribeWebhook e createCartByTemplate — tudo validado ao vivo contra o gateway.
// - core.unbox.com.br/graphql — segue atendendo o que a API de parceiros ainda não expõe:
//   carrinho/checkout/placeOrder, CEP, OTP, área do cliente e availablePaymentMethods.
//   Conforme a Unbox publicar as escritas, cada método ganha o mesmo roteamento condicional.
// Peculiaridades do gateway (validadas ao vivo): args opcionais não aceitam null (montar
// query só com args presentes); unions exigem __typename; Authorization aceita token puro
// E Bearer (a doc pública diz só puro — na prática ambos passam).

import type {
  UnboxConfig, AddressInput, CartItemInput, CartResult,
  PlaceOrderParams, FulfillmentOption, CatalogProduct, Connection,
  PaymentLinkConstraints, DeviceInput, SimpleInventoryInfo,
} from "./types";

const DEFAULTS = {
  apiBaseUrl: "https://api.unbox.com.br",
  gqlUrl: "https://core.unbox.com.br/graphql",
  // API pública de PARCEIROS — gateway na frente do core. Uma api key por parceiro
  // (vale p/ todas as lojas dele); a loja é autenticada pelo user/senha no signIn.
  partnerGqlUrl: "https://partners.unbox.com.br/graphql",
  language: "pt-BR",
};

/** Bloco do endereço de entrega dentro de `fulfillmentGroups`. É uma UNIÃO
 *  (`OrderFulfillmentGroupData`), e o servidor precisa resolver o tipo concreto em runtime.
 *  Medido: o front nativo da Unbox lê `data.shippingAddress` na conta do cliente (funciona lá),
 *  e a consulta por `referenceId` falhou em produção com "must resolve to an Object type".
 *  Como a falha derruba a consulta INTEIRA e não só o campo, quem consulta pede o endereço e,
 *  se o servidor não conseguir resolver, repete sem ele: a loja mostra o endereço onde a API
 *  entrega e a página do pedido nunca deixa de abrir. */
export const BLOCO_ENDERECO_GRUPO =
  "data{ ... on ShippingOrderFulfillmentGroupData { shippingAddress{fullName address1 number neighborhood city region postal} } }";

function ehUniaoNaoResolvida(e: unknown): boolean {
  const msgs = e instanceof UnboxError
    ? [e.message, ...(e.errors ?? []).map((x: any) => x?.message ?? "")].join(" ")
    : String(e);
  return /must resolve to an Object type|Could not determine the exact type|Can't resolve/i.test(msgs);
}

/** Roda `exec` com o bloco de endereço; só repete sem ele se o erro for a união não resolvida. */
export async function comEnderecoDoGrupo<T>(exec: (blocoEndereco: string) => Promise<T>): Promise<T> {
  try {
    return await exec(BLOCO_ENDERECO_GRUPO);
  } catch (e) {
    if (!ehUniaoNaoResolvida(e)) throw e;
    console.warn("[unbox] fulfillmentGroups.data não resolveu no servidor: repetindo a consulta sem o endereço de entrega.");
    return await exec("");
  }
}

/** Código do erro lançado quando a Unbox não respondeu dentro do prazo (ver gql()). */
export const UNBOX_TIMEOUT = "TIMEOUT";
export function isUnboxTimeout(e: unknown): boolean {
  return e instanceof UnboxError && e.message === UNBOX_TIMEOUT;
}

/** placeOrder cria pedido + cobra cartão/gera Pix: passa por antifraude e adquirente e pode
 *  levar bem mais que os 15 s do timeout padrão. Abortar no cliente NÃO aborta no servidor —
 *  o pedido pode nascer depois que a loja já desistiu, e a tela liberava "Pagar" de novo
 *  (cobrança dupla, caso real). Prazo próprio, longo, e erro distinguível (UNBOX_TIMEOUT). */
export const PLACE_ORDER_TIMEOUT_MS = 90_000;

export class UnboxError extends Error {
  errors: any[];
  constructor(message: string, errors: any[] = []) {
    super(message);
    this.name = "UnboxError";
    this.errors = errors;
  }
}

/** Erro que indica formato de Authorization rejeitado (gateway de parceiros). */
function isAuthSchemeError(errors: any[]): boolean {
  const msg = errors.map((e: any) => `${e.errorType ?? ""} ${e.message ?? ""}`).join(" ").toUpperCase();
  return /UNAUTHORIZED|NOT AUTHORIZED|ACCESS_DENIED|UNAUTHENTICATED|INVALID TOKEN|401|403/.test(msg);
}

export class UnboxClient {
  apiKey: string;
  shopId: string;
  apiBaseUrl: string;
  gqlUrl: string;
  partnerApiKey: string;
  partnerGqlUrl: string;
  captchaBypass: string;
  language: string;
  timeoutMs: number;
  token: string | null = null;
  /** Formato do Authorization no gateway de parceiros. A doc oficial (docs.unbox.com.br)
   *  manda o token PURO, sem "Bearer " ("prefixá-lo quebra a autenticação") — por isso o
   *  default é "raw". O fallback pra "bearer" fica só como defesa se o gateway mudar. */
  private partnerAuthScheme: "bearer" | "raw" = "raw";

  constructor(cfg: UnboxConfig) {
    this.apiKey = cfg.apiKey;
    this.shopId = cfg.shopId;
    this.apiBaseUrl = cfg.apiBaseUrl ?? DEFAULTS.apiBaseUrl;
    this.gqlUrl = cfg.gqlUrl ?? DEFAULTS.gqlUrl;
    this.partnerApiKey = cfg.partnerApiKey ?? "";
    this.partnerGqlUrl = cfg.partnerGqlUrl ?? DEFAULTS.partnerGqlUrl;
    this.captchaBypass = cfg.captchaBypass ?? "";
    this.language = cfg.language ?? DEFAULTS.language;
    this.timeoutMs = cfg.timeoutMs ?? 15000;
  }

  /** true = api key de PARCEIRO configurada → signIn e leituras com paridade vão pra
   *  API de parceiros; carrinho/checkout/cliente seguem no core (escritas ainda não
   *  existem lá). Sem a key, comportamento 100% igual ao anterior (só core). */
  get usesPartnerApi(): boolean { return Boolean(this.partnerApiKey); }

  // -------------------------------------------------------------------- auth
  /**
   * Autentica com user/senha DA LOJA e guarda o access_token (JWT, ~24h).
   * - Modo parceiro: mutation `signIn` na API de parceiros (x-api-key do parceiro +
   *   x-captcha-verification opcional). O token retornado é o mesmo JWT do core — o
   *   gateway de parceiros é um proxy do core — e vale nos dois endpoints.
   * - Modo antigo: REST /auth/signin com a api key da loja.
   */
  async signIn(username: string, password: string): Promise<string> {
    if (this.usesPartnerApi) return this.signInPartner(username, password);
    const res = await fetch(`${this.apiBaseUrl}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new UnboxError(`signin HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    if (!data.access_token) throw new UnboxError("signin sem access_token");
    this.token = data.access_token;
    return data.access_token as string;
  }

  /** signIn via API de parceiros (mutation GQL). Não exige token prévio.
   *  Doc oficial: o signIn EXIGE x-captcha-verification (UNBOX_CAPTCHA_BYPASS). */
  private async signInPartner(username: string, password: string): Promise<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": this.partnerApiKey,
    };
    if (this.captchaBypass) headers["x-captcha-verification"] = this.captchaBypass;
    const q = `mutation($i:SignInInput!){ signIn(input:$i){ access_token id_token } }`;
    const res = await fetch(this.partnerGqlUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: q, variables: { i: { username, password } } }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const json = await res.json();
    if (json.errors?.length) {
      const hint = this.captchaBypass ? "" : " (x-captcha-verification ausente — preencha UNBOX_CAPTCHA_BYPASS, obrigatório no signIn de parceiros)";
      throw new UnboxError(`signIn (partner): ${json.errors.map((e: any) => e.message).join(" | ")}${hint}`, json.errors);
    }
    const token = json.data?.signIn?.access_token;
    if (!token) throw new UnboxError("signIn (partner) sem access_token");
    this.token = token;
    return token as string;
  }

  setToken(token: string) { this.token = token; }

  // ------------------------------------------------------------- GraphQL (low)
  async gql<T = any>(
    query: string,
    variables: Record<string, any> = {},
    opts: { token?: string; captcha?: boolean; timeoutMs?: number } = {},
  ): Promise<T> {
    const token = opts.token ?? this.token;
    if (!token) throw new UnboxError("sem token: chame signIn() ou passe opts.token");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    // placeOrder, customerOTPRequest, customerPasswordlessSignIn.
    // ⚠️ ORDEM IMPORTA: o header x-captcha-verification foi feito pro UNBOX_CAPTCHA_BYPASS
    // (segredo de 64 chars). Mandar a api key (da2-...) no lugar faz o backend repassá-la ao
    // reCAPTCHA Enterprise, que devolve MALFORMED → o cliente vê CAPTCHA_MALFORMED_ERROR no
    // meio do pagamento (caso real em produção). A key só entra como último recurso se não houver bypass.
    if (opts.captcha) headers["x-captcha-verification"] = this.captchaBypass || this.apiKey;
    let res: Response;
    try {
      res = await fetch(this.gqlUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? this.timeoutMs),
      });
    } catch (e: any) {
      // Timeout vira um UnboxError reconhecível (código TIMEOUT). Quem chama decide o que fazer:
      // em leitura, tanto faz; em placeOrder, é a diferença entre "tente de novo" e "NÃO pague de novo".
      if (e?.name === "TimeoutError" || e?.name === "AbortError") throw new UnboxError(UNBOX_TIMEOUT, [{ message: UNBOX_TIMEOUT }]);
      throw e;
    }
    const json = await res.json();
    if (json.errors?.length) {
      throw new UnboxError(json.errors.map((e: any) => e.message).join(" | "), json.errors);
    }
    return json.data as T;
  }

  // ------------------------------------------------------ GraphQL (partner, low)
  /**
   * Chamada à API de PARCEIROS. Headers: x-api-key (key do parceiro) + Authorization
   * (token do signIn — o gateway repassa ao core, que resolve a loja pelo JWT; por isso
   * nenhuma query de parceiro pede shopId). O formato do Authorization não é documentado:
   * tentamos `Bearer <jwt>` e, se vier erro de auth, refazemos UMA vez com o token cru,
   * memorizando o formato que funcionou para as próximas chamadas.
   */
  async gqlPartner<T = any>(query: string, variables: Record<string, any> = {}): Promise<T> {
    if (!this.token) throw new UnboxError("sem token: chame signIn() ou passe setToken()");
    const attempt = async (scheme: "bearer" | "raw"): Promise<{ json: any }> => {
      const res = await fetch(this.partnerGqlUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.partnerApiKey,
          // Doc oficial: token PURO no Authorization (sem "Bearer ").
          Authorization: scheme === "raw" ? String(this.token) : `Bearer ${this.token}`,
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      return { json: await res.json() };
    };
    let { json } = await attempt(this.partnerAuthScheme);
    if (json.errors?.length && isAuthSchemeError(json.errors)) {
      const other = this.partnerAuthScheme === "raw" ? "bearer" : "raw";
      const retry = await attempt(other);
      if (!retry.json.errors?.length || !isAuthSchemeError(retry.json.errors)) {
        this.partnerAuthScheme = other; // memoriza o formato aceito
        json = retry.json;
      }
    }
    if (json.errors?.length) {
      throw new UnboxError(json.errors.map((e: any) => e.message).join(" | "), json.errors);
    }
    return json.data as T;
  }

  // ------------------------------------------------------------------- catálogo
  /** Seleção de produto compartilhada entre core e partner (schemas idênticos aqui). */
  private static CATALOG_PRODUCT_FIELDS = `
          _id productId title slug productType isVisible isSoldOut isBackorder isLowQuantity recurrenceAllowed imageUrls
          minOrderQuantity maxOrderQuantity tagIds
          pricing{displayPrice price minPrice maxPrice}
          variants{_id title sku pricing{price displayPrice compareAtPrice{displayAmount}}}`;

  async getCatalog(opts: {
    first?: number; offset?: number; searchText?: string; tagIds?: string[];
    sortBy?: string; sortOrder?: "asc" | "desc";
  } = {}): Promise<Connection<{ product: CatalogProduct }>> {
    // Partner: sem shopIds (loja vem do JWT). Diferenças do gateway (validadas ao vivo):
    // 1) args opcionais NÃO podem ir nulos (o resolver rejeita sortOrder:null, que o core
    //    tolerava) → montamos a query só com os args realmente presentes;
    // 2) o union CatalogItem exige __typename na seleção pra resolver o tipo.
    if (this.usesPartnerApi) {
      const decl = ["$first:Int", "$offset:Int"];
      const args = ["first:$first", "offset:$offset"];
      const vars: Record<string, any> = { first: opts.first ?? 24, offset: opts.offset ?? 0 };
      const opt = (name: string, type: string, value: any) => {
        if (value === undefined || value === null) return;
        decl.push(`$${name}:${type}`); args.push(`${name}:$${name}`); vars[name] = value;
      };
      opt("searchText", "String", opts.searchText);
      opt("tagIds", "[ID]", opts.tagIds);
      opt("sortBy", "CatalogItemSortByField", opts.sortBy);
      opt("sortOrder", "SortOrder", opts.sortOrder);
      const q = `query(${decl.join(",")}){
        catalogItems(${args.join(",")}){
          totalCount pageInfo{hasNextPage endCursor}
          nodes{__typename ... on CatalogItemProduct{ _id shortDescription product{${UnboxClient.CATALOG_PRODUCT_FIELDS}
          }}}
        }}`;
      const d = await this.gqlPartner<{ catalogItems: any }>(q, vars);
      return d.catalogItems;
    }
    const q = `query($s:[ID]!,$first:Int,$offset:Int,$searchText:String,$tagIds:[ID],$sortBy:CatalogItemSortByField,$sortOrder:SortOrder){
      catalogItems(shopIds:$s,first:$first,offset:$offset,searchText:$searchText,tagIds:$tagIds,sortBy:$sortBy,sortOrder:$sortOrder){
        totalCount pageInfo{hasNextPage endCursor}
        nodes{... on CatalogItemProduct{ _id shortDescription product{${UnboxClient.CATALOG_PRODUCT_FIELDS}
        }}}
      }}`;
    const d = await this.gql<{ catalogItems: any }>(q, {
      s: [this.shopId], first: opts.first ?? 24, offset: opts.offset ?? 0,
      searchText: opts.searchText, tagIds: opts.tagIds,
      sortBy: opts.sortBy, sortOrder: opts.sortOrder,
    });
    return d.catalogItems;
  }

  private static PDP_PRODUCT_FIELDS = `_id productId title pageTitle slug description additionalInformation productType
          sku isVisible isSoldOut isBackorder isLowQuantity recurrenceAllowed
          minOrderQuantity maxOrderQuantity imageUrls videoUrls tagIds metaDescription
          pricing{displayPrice price minPrice maxPrice}
          variants{_id title sku pricing{price displayPrice compareAtPrice{displayAmount}}}`;

  async getProductBySlug(productSlug: string): Promise<any> {
    // Partner: mesma query sem shopId (loja vem do JWT). Validado ao vivo no gateway.
    if (this.usesPartnerApi) {
      const q = `query($productSlug:String!){
        catalogItemProductBySlug(productSlug:$productSlug,filterSoldOutVariants:false){
          _id shortDescription cardDescription publishedUrl
          product{ ${UnboxClient.PDP_PRODUCT_FIELDS} }}}`;
      const d = await this.gqlPartner<{ catalogItemProductBySlug: any }>(q, { productSlug });
      return d.catalogItemProductBySlug;
    }
    const q = `query($shopId:ID!,$productSlug:String!){
      catalogItemProductBySlug(shopId:$shopId,productSlug:$productSlug,filterSoldOutVariants:false){
        _id shortDescription cardDescription publishedUrl
        product{ ${UnboxClient.PDP_PRODUCT_FIELDS} }}}`;
    const d = await this.gql<{ catalogItemProductBySlug: any }>(q, { shopId: this.shopId, productSlug });
    return d.catalogItemProductBySlug;
  }

  /** PDP por productId — fallback/deep link (catalogItemProductById). */
  async getProductById(productId: string): Promise<any> {
    // Partner: catalogItemProductById NÃO existe no gateway; equivalente validado ao vivo:
    // catalogItems(productIdsOrERPCodes:[id], first:1) — devolve o mesmo CatalogItemProduct.
    if (this.usesPartnerApi) {
      const q = `query($ids:[String]){
        catalogItems(productIdsOrERPCodes:$ids,first:1){
          nodes{__typename ... on CatalogItemProduct{ _id shortDescription publishedUrl
            product{ ${UnboxClient.PDP_PRODUCT_FIELDS} }}}}}`;
      const d = await this.gqlPartner<{ catalogItems: any }>(q, { ids: [productId] });
      return d.catalogItems?.nodes?.[0] ?? null;
    }
    const q = `query($shopId:ID!,$productId:ID!){
      catalogItemProductById(shopId:$shopId,productId:$productId,filterSoldOutVariants:false){
        _id shortDescription publishedUrl
        product{ ${UnboxClient.PDP_PRODUCT_FIELDS} }}}`;
    const d = await this.gql<{ catalogItemProductById: any }>(q, { shopId: this.shopId, productId });
    return d.catalogItemProductById;
  }

  // isTopLevel omitido = sem filtro (igual à vitrine padrão da Unbox). Forçar `true` esconde
  // categorias reais e visíveis marcadas isTopLevel:false no admin (ex.: "Acessórios") — 404
  // em /categoria/<slug> mesmo com o produto corretamente vinculado à categoria.
  async getTags(isTopLevel?: boolean): Promise<any[]> {
    // Partner: mesma query, sem shopId (a loja vem do JWT). Campos idênticos (validado
    // por introspecção no schema de parceiros).
    if (this.usesPartnerApi) {
      const q = `query($isTopLevel:Boolean){
        tags(isTopLevel:$isTopLevel,shouldIncludeInvisible:false,shouldIncludeDeleted:false,first:100){
          nodes{_id name displayTitle slug description isTopLevel isVisible position subTagIds featuredProductIds}
        }}`;
      const d = await this.gqlPartner<{ tags: any }>(q, { isTopLevel });
      return d.tags.nodes;
    }
    const q = `query($shopId:ID!,$isTopLevel:Boolean){
      tags(shopId:$shopId,isTopLevel:$isTopLevel,shouldIncludeInvisible:false,shouldIncludeDeleted:false,first:100){
        nodes{_id name displayTitle slug description isTopLevel isVisible position subTagIds featuredProductIds}
      }}`;
    const d = await this.gql<{ tags: any }>(q, { shopId: this.shopId, isTopLevel });
    return d.tags.nodes;
  }

  // ----------------------------------------------------------------------- loja
  /** Dados da loja: promoções (shopSales), política de assinatura, settings, pagamentos. */
  async getShop(slug: string): Promise<any> {
    // Partner: shopBySlug() SEM argumentos (a loja vem do JWT; o `slug` recebido é ignorado).
    // O gateway não expõe allowGuestCheckout nem settings.maxInstallments — omitidos aqui;
    // o app já tem defaults (maxInstallments ?? 12) e allowGuestCheckout não é consumido.
    if (this.usesPartnerApi) {
      const q = `query{ shopBySlug{
        _id name slug acceptsBoleto acceptsCreditCard
        settings{allowAnonymousRecurringOrders allowLegalPersonSales showOutOfStockCatalogs}
        shopSales{_id code label description discountMethod enabled createdAt
          calculation{__typename ... on CalculationFreeItemByTier { tiers { cartSubtotalGTE catalogProductVariant { _id title } } }}}
        recurringOrdersPolicy{_id enabled keepOrderPricingPolicy
          allowedFrequencies{_id title periodicity interval}
          pricingPolicy{type value}
          customerActions{canSkipCycle canPause canChangeFrequency canChangeAddress canAddProducts canRemoveProducts canChangeProductQuantity}}
      }}`;
      const d = await this.gqlPartner<{ shopBySlug: any }>(q);
      return d.shopBySlug;
    }
    const q = `query($slug:String!){ shopBySlug(slug:$slug){
      _id name slug acceptsBoleto acceptsCreditCard allowGuestCheckout
      settings{maxInstallments allowAnonymousRecurringOrders allowLegalPersonSales showOutOfStockCatalogs}
      shopSales{_id code label description discountMethod enabled createdAt
        calculation{__typename ... on CalculationFreeItemByTier { tiers { cartSubtotalGTE catalogProductVariant { _id title } } }}}
      recurringOrdersPolicy{_id enabled keepOrderPricingPolicy
        allowedFrequencies{_id title periodicity interval}
        pricingPolicy{type value}
        customerActions{canSkipCycle canPause canChangeFrequency canChangeAddress canAddProducts canRemoveProducts canChangeProductQuantity}}
    }}`;
    const d = await this.gql<{ shopBySlug: any }>(q, { slug });
    return d.shopBySlug;
  }

  async getPaymentMethods(): Promise<any[]> {
    const q = `query($s:ID!){availablePaymentMethods(shopId:$s){name displayName isEnabled canRefund pluginName}}`;
    const d = await this.gql<{ availablePaymentMethods: any[] }>(q, { s: this.shopId });
    return d.availablePaymentMethods;
  }

  // ------------------------------------------------------------------ promoções
  async listDiscountCodes(first = 50): Promise<Connection<any>> {
    // Partner: discountCodes sem shopId (loja vem do JWT); nodes do tipo Discount, com os
    // mesmos campos que o app consome.
    if (this.usesPartnerApi) {
      const q = `query($first:Int){ discountCodes(first:$first){
        totalCount nodes{_id code label description enabled discountMethod calculation{__typename}} }}`;
      const d = await this.gqlPartner<{ discountCodes: any }>(q, { first });
      return d.discountCodes;
    }
    const q = `query($s:ID!,$first:ConnectionLimitInt){ discountCodes(shopId:$s,first:$first){
      totalCount nodes{_id code label description enabled discountMethod calculation{__typename}} }}`;
    const d = await this.gql<{ discountCodes: any }>(q, { s: this.shopId, first });
    return d.discountCodes;
  }

  // -------------------------------------------------------------------- carrinho
  // ⚠️ Schema LIVE: `recurringItemsFrequencyId` NÃO existe em CreateCartInput/AddCartItemsInput
  //    (diverge da doc — vale o live). Itens de assinatura marcam-se só com `isRecurring:true`;
  //    a FREQUÊNCIA vai no placeOrder (orderRecurrence.recurringItemsFrequencyId).
  async createCart(items: CartItemInput[]): Promise<CartResult> {
    const q = `mutation($i:CreateCartInput!){ createCart(input:$i){
      token
      cart{ _id totalItemQuantity expiresAt
        items{edges{node{_id productConfiguration{productId productVariantId} title variantTitle quantity thumbnail price{amount displayAmount} isRecurring isDiscountedBonusItem}}}
        checkout{fulfillmentGroups{_id} summary{itemTotal{displayAmount} total{amount displayAmount}}}}
      incorrectPriceFailures{productConfiguration{productId} providedPrice{amount} currentPrice{amount}}
      minOrderQuantityFailures{minOrderQuantity quantity}
      maxOrderQuantityFailures{maxOrderQuantity quantity} }}`;
    const d = await this.gql<{ createCart: any }>(q, { i: {
      shopId: this.shopId,
      items: items.map((it) => ({
        price: { amount: it.price, currencyCode: it.currencyCode ?? "BRL" },
        productConfiguration: { productId: it.productId, productVariantId: it.productVariantId },
        quantity: it.quantity,
        isRecurring: it.isRecurring ?? false,
        thumbnail: it.thumbnail ?? "",
      })),
    } });
    const r = d.createCart;
    // Obs.: o servidor SOBRESCREVE o preço com o do catálogo; incorrectPriceFailures vem vazio na
    // prática (ver types.ts). Mantido só como aviso defensivo — quantidade min/max sim pode falhar.
    if (r.incorrectPriceFailures?.length) console.warn("[unbox] incorrectPriceFailures:", r.incorrectPriceFailures);
    return {
      cartId: r.cart._id, cartToken: r.token, cart: r.cart,
      incorrectPriceFailures: r.incorrectPriceFailures,
      minOrderQuantityFailures: r.minOrderQuantityFailures,
      maxOrderQuantityFailures: r.maxOrderQuantityFailures,
    };
  }

  /** Adiciona itens a um carrinho existente (exige cartId + cartToken). isRecurring marca assinatura. */
  async addCartItems(cartId: string, cartToken: string, items: CartItemInput[]): Promise<any> {
    const q = `mutation($i:AddCartItemsInput!){ addCartItems(input:$i){
      cart{ _id totalItemQuantity items{edges{node{_id productConfiguration{productId productVariantId} title variantTitle quantity price{amount displayAmount} isRecurring isDiscountedBonusItem}}} }
      cartEvents{type data}
      minOrderQuantityFailures{minOrderQuantity quantity} maxOrderQuantityFailures{maxOrderQuantity quantity} }}`;
    const d = await this.gql<{ addCartItems: any }>(q, { i: {
      cartId, cartToken,
      items: items.map((it) => ({
        price: { amount: it.price, currencyCode: it.currencyCode ?? "BRL" },
        productConfiguration: { productId: it.productId, productVariantId: it.productVariantId },
        quantity: it.quantity, isRecurring: it.isRecurring ?? false, thumbnail: it.thumbnail ?? "",
      })),
    } });
    return d.addCartItems;
  }

  /** Altera a quantidade de um item do carrinho (cartItemId = node._id do item). */
  async updateItemQuantity(cartId: string, cartToken: string, cartItemId: string, quantity: number): Promise<any> {
    const q = `mutation($i:UpdateCartItemsQuantityInput!){ updateCartItemsQuantity(input:$i){
      cart{ _id totalItemQuantity } cartEvents{type data} }}`;
    const d = await this.gql<{ updateCartItemsQuantity: any }>(q, { i: { cartId, cartToken, items: [{ cartItemId, quantity }] } });
    return d.updateCartItemsQuantity;
  }

  /** Remove itens do carrinho (cartItemIds = node._id dos itens). */
  async removeCartItems(cartId: string, cartToken: string, cartItemIds: string[]): Promise<any> {
    const q = `mutation($i:RemoveCartItemsInput!){ removeCartItems(input:$i){
      cart{ _id totalItemQuantity } cartEvents{type data} }}`;
    const d = await this.gql<{ removeCartItems: any }>(q, { i: { cartId, cartToken, cartItemIds } });
    return d.removeCartItems;
  }

  /**
   * Recarrega um carrinho anônimo (rehidratar a sessão). Retorna o cart completo: itens,
   * brindes, resumo com descontos, e o endereço de entrega já gravado (se houver).
   */
  async getCart(cartId: string, cartToken: string): Promise<any> {
    const q = `query($cartId:ID!,$cartToken:String!){ anonymousCartByCartId(cartId:$cartId,cartToken:$cartToken){
      _id email expiresAt referenceId recurringItemsFrequencyId totalItemQuantity
      items(first:100){ totalCount edges{node{
        _id productConfiguration{productId productVariantId} title variantTitle quantity addedAt
        thumbnail price{amount displayAmount} isRecurring isDiscountedBonusItem }}}
      checkout{
        fulfillmentGroups{_id selectedFulfillmentOption{fulfillmentMethod{_id displayName name} price{displayAmount}}
          data{shippingAddress{fullName taxPayerId phone address1 address2 number neighborhood city region postal}}}
        summary{itemTotal{displayAmount} discountTotal{displayAmount} fulfillmentTotal{displayAmount} taxTotal{displayAmount} total{amount displayAmount}}} }}`;
    const d = await this.gql<{ anonymousCartByCartId: any }>(q, { cartId, cartToken });
    return d.anonymousCartByCartId;
  }

  /**
   * Grava o e-mail no carrinho anônimo (etapa de contato do checkout, antes do placeOrder).
   * Habilita recuperação de CARRINHO ABANDONADO: o e-mail fica associado ao cart no servidor
   * mesmo se o cliente não finalizar (capturado do storefront oficial — setEmailOnAnonymousCart).
   */
  async setEmailOnCart(cartId: string, cartToken: string, email: string): Promise<any> {
    const q = `mutation($i:SetEmailOnAnonymousCartInput!){ setEmailOnAnonymousCart(input:$i){
      cart{_id email} }}`;
    const d = await this.gql<{ setEmailOnAnonymousCart: any }>(q, { i: { cartId, cartToken, email } });
    return d.setEmailOnAnonymousCart;
  }

  async setShippingAddress(cartId: string, cartToken: string, address: AddressInput): Promise<string> {
    const q = `mutation($i:SetShippingAddressOnCartInput!){ setShippingAddressOnCart(input:$i){
      cart{checkout{fulfillmentGroups{_id}}} }}`;
    const d = await this.gql<{ setShippingAddressOnCart: any }>(q, {
      i: { cartId, cartToken, address: { country: "BR", ...address } },
    });
    return d.setShippingAddressOnCart.cart.checkout.fulfillmentGroups[0]._id;
  }

  /** Retorna TODOS os fulfillmentGroups do carrinho (suporte a N grupos de entrega). */
  async getFulfillmentGroupIds(cartId: string, cartToken: string): Promise<string[]> {
    const q = `query($cartId:ID!,$cartToken:String!){ anonymousCartByCartId(cartId:$cartId,cartToken:$cartToken){
      checkout{fulfillmentGroups{_id}} }}`;
    const d = await this.gql<{ anonymousCartByCartId: any }>(q, { cartId, cartToken });
    return (d.anonymousCartByCartId?.checkout?.fulfillmentGroups ?? []).map((g: any) => g._id);
  }

  /** Cota o frete de UM grupo. OBRIGATÓRIO após setShippingAddress (senão options vem vazio). */
  async quoteShipping(cartId: string, cartToken: string, fulfillmentGroupId: string): Promise<FulfillmentOption[]> {
    const q = `mutation($i:UpdateFulfillmentOptionsForGroupInput!){ updateFulfillmentOptionsForGroup(input:$i){
      cart{checkout{fulfillmentGroups{_id availableFulfillmentOptions{
        price{amount displayAmount} discountPrice{displayAmount}
        fulfillmentMethod{_id name displayName daysToDeliver}}}}} }}`;
    const d = await this.gql<{ updateFulfillmentOptionsForGroup: any }>(q, { i: { cartId, cartToken, fulfillmentGroupId } });
    const groups = d.updateFulfillmentOptionsForGroup.cart.checkout.fulfillmentGroups;
    const fg = groups.find((g: any) => g._id === fulfillmentGroupId) ?? groups[0];
    return fg.availableFulfillmentOptions ?? [];
  }

  async applyDiscount(cartId: string, cartToken: string, discountCode: string): Promise<any> {
    const q = `mutation($i:ApplyDiscountCodeToCartInput!){ applyDiscountCodeToCart(input:$i){
      cart{_id checkout{summary{discountTotal{displayAmount} total{amount displayAmount}}}} cartEvents{type data} }}`;
    const d = await this.gql<{ applyDiscountCodeToCart: any }>(q, { i: { cartId, token: cartToken, shopId: this.shopId, discountCode } });
    return d.applyDiscountCodeToCart;
  }

  /**
   * Resolve o discount._id a partir do CÓDIGO do cupom (necessário p/ removeDiscountCodeFromCart,
   * já que o Cart lido não expõe os ids de desconto aplicados). Casa por code (case-insensitive).
   */
  async findDiscountIdByCode(code: string): Promise<string | null> {
    const list = await this.listDiscountCodes(100);
    const match = (list.nodes as any[]).find((d) => (d.code ?? "").toLowerCase() === code.toLowerCase());
    return match?._id ?? null;
  }

  /** Remove um cupom do carrinho. Usa o discountId (= discount._id), NÃO o code. */
  async removeDiscount(cartId: string, cartToken: string, discountId: string): Promise<any> {
    const q = `mutation($i:RemoveDiscountCodeFromCartInput!){ removeDiscountCodeFromCart(input:$i){
      cart{checkout{summary{discountTotal{displayAmount} total{amount displayAmount}}}} cartEvents{type data} }}`;
    const d = await this.gql<{ removeDiscountCodeFromCart: any }>(q, { i: { cartId, token: cartToken, shopId: this.shopId, discountId } });
    return d.removeDiscountCodeFromCart;
  }

  /** Seleciona o frete de UM grupo e devolve o estado final (itens + total) p/ o placeOrder. */
  async selectShipping(cartId: string, cartToken: string, fulfillmentGroupId: string, fulfillmentMethodId: string): Promise<any> {
    const q = `mutation($i:SelectFulfillmentOptionForGroupInput!){ selectFulfillmentOptionForGroup(input:$i){
      cart{
        items{edges{node{productConfiguration{productId productVariantId} title variantTitle price{amount} quantity addedAt thumbnail isDiscountedBonusItem}}}
        checkout{summary{itemTotal{displayAmount} discountTotal{displayAmount} fulfillmentTotal{displayAmount} total{amount displayAmount}}}} }}`;
    const d = await this.gql<{ selectFulfillmentOptionForGroup: any }>(q, { i: { cartId, cartToken, fulfillmentGroupId, fulfillmentMethodId } });
    return d.selectFulfillmentOptionForGroup.cart;
  }

  /**
   * Monta os `items` do placeOrder a partir do carrinho final. INCLUI brindes/itens promocionais:
   * a Unbox exige que os itens do fulfillmentGroup batam EXATAMENTE com os do carrinho no servidor
   * (senão FULFILLMENT_GROUP_AND_CART_ITEMS_DO_NOT_MATCH_ERROR). O valor cobrado é o total
   * autoritativo do servidor (payment.amount = summary.total), então incluir brindes não cobra a mais.
   */
  buildOrderItems(cart: any): PlaceOrderParams["items"] {
    return cart.items.edges
      .map((e: any) => e.node)
      .map((n: any) => ({
        addedAt: n.addedAt,
        price: n.price.amount,
        productConfiguration: n.productConfiguration,
        quantity: n.quantity,
        thumbnail: n.thumbnail ?? "",
        // ESSENCIAIS p/ casar com o carrinho — sem eles a Unbox lança
        // FULFILLMENT_GROUP_AND_CART_ITEMS_DO_NOT_MATCH (validado contra um pedido real).
        isRecurring: n.isRecurring ?? false,
        isDiscountedBonusItem: n.isDiscountedBonusItem ?? false,
      }));
  }

  /**
   * "Calcule o frete" para a PDP (fora do checkout). Cria um carrinho efêmero com 1 item,
   * grava o endereço (só CEP basta na prática p/ cotar) e cota o frete. Compõe primitivas
   * já validadas ao vivo — não depende de createShipmentQuote (schema não confirmado).
   */
  async quoteShippingForProduct(item: CartItemInput, postal: string): Promise<FulfillmentOption[]> {
    const cart = await this.createCart([item]);
    const addr: AddressInput = {
      fullName: "Cotação", taxPayerId: "", postal, address1: "—", number: "0",
      neighborhood: "—", city: "—", region: "SP", phone: "00000000000",
    };
    const fgId = await this.setShippingAddress(cart.cartId, cart.cartToken, addr);
    return this.quoteShipping(cart.cartId, cart.cartToken, fgId);
  }

  // -------------------------------------------------------------------- checkout
  /** Opções de parcelamento (sem juros) para um valor — usado no cartão de crédito (não assinatura). */
  async getInstallments(amount: number): Promise<Array<{ installment: number; amount: number }>> {
    // Partner: input sem shopId (loja vem do JWT); resposta com os mesmos campos.
    if (this.usesPartnerApi) {
      const q = `query($amount:Float!){ getInstallments(input:{amount:$amount}){ installments{installment amount} } }`;
      const d = await this.gqlPartner<{ getInstallments: { installments: any[] } }>(q, { amount });
      return (d.getInstallments?.installments ?? []).map((i: any) => ({ installment: i.installment, amount: i.amount }));
    }
    const q = `query($shopId:ID!,$amount:Float!){ getInstallments(input:{shopId:$shopId,amount:$amount}){ installments } }`;
    const d = await this.gql<{ getInstallments: { installments: any[] } }>(q, { shopId: this.shopId, amount });
    return (d.getInstallments?.installments ?? []).map((i: any) => ({ installment: i.installment, amount: i.amount }));
  }

  /** Cria o pedido (REAL). Envia x-captcha-verification automaticamente. */
  async placeOrder(p: PlaceOrderParams): Promise<any> {
    // country é obrigatório (String!) tanto no shippingAddress quanto no billingAddress.
    const address = { country: "BR", ...p.address };
    const payment = p.payment.type === "pix"
      ? { amount: p.total, method: "unboxpay_pix", data: { paymentType: "pix" }, billingAddress: address }
      : {
          amount: p.total, method: "unboxpay_credit", billingAddress: address,
          data: {
            cardHolder: p.payment.card.cardHolder, cardNumber: p.payment.card.cardNumber,
            expirationMonth: p.payment.card.expirationMonth, expirationYear: p.payment.card.expirationYear,
            securityCode: p.payment.card.securityCode, installments: p.payment.card.installments ?? 1,
            paymentType: "credit",
          },
        };
    // device (antifraude/3DS) é OBRIGATÓRIO e vai no NÍVEL RAIZ do PlaceOrderInput
    // (irmão de order/payments). Sem navegador (scripts), o fallback é { type: "API" }.
    const device: DeviceInput = p.device ?? { type: "API" };
    const input: any = {
      order: {
        cartId: p.cartId, currencyCode: "BRL", email: p.email, shopId: this.shopId,
        fulfillmentGroups: [{
          type: "SHIPPING", shopId: this.shopId, totalPrice: p.total,
          selectedFulfillmentMethodId: p.fulfillmentMethodId,
          data: { shippingAddress: address }, items: p.items,
        }],
      },
      payments: [payment],
      device,
    };
    if (p.recurrence) input.orderRecurrence = { createNewRecurringOrder: true, recurringItemsFrequencyId: p.recurrence.recurringItemsFrequencyId };

    const q = `mutation($i:PlaceOrderInput!){ placeOrder(input:$i){
      token orders{_id referenceId status summary{total{amount displayAmount}}
        recurringOrderId generatedNewRecurringOrder
        payments{method{name} status{status} captureErrorMessage
          data{... on UnboxPayPaymentData{qrCode paymentRecord redirectUrl numberOfInstallments}}}} }}`;
    const d = await this.gql<{ placeOrder: any }>(q, { i: input }, { captcha: true, timeoutMs: PLACE_ORDER_TIMEOUT_MS });
    return d.placeOrder;
  }

  /**
   * Acompanhar pedido pelo referenceId.
   * ⚠️ SEGURANÇA: com o token de LOJA, isto retorna QUALQUER pedido só pelo referenceId (validado ao
   * vivo) — referenceId é curto e adivinhável. NUNCA exponha esta chamada ao browser sem o BFF antes
   * verificar a POSSE do pedido: compare o `token` do placeOrder (guardado em cookie httpOnly) ou use
   * o token do cliente logado (`UnboxCustomerClient.order`). Ver docs 09-seguranca.
   */
  async getOrder(referenceId: string, token?: string): Promise<any> {
    // Partner: orderByReferenceId(id) NÃO aceita o token de posse — a verificação de posse
    // do pedido é (e sempre foi) responsabilidade do BFF (lib/orders.ts getOwnedOrder, via
    // cookie httpOnly). Diferença de shape: OrderItem tem imageURLs em vez de thumbnail —
    // normalizamos aqui pra manter o contrato do app.
    if (this.usesPartnerApi) {
      const q = (endereco: string) => `query($id:ID!){
        orderByReferenceId(id:$id){
          _id referenceId status email
          summary{total{amount displayAmount}}
          payments{displayName mode processor isCaptured cardBrand captureErrorMessage amount{amount displayAmount}}
          fulfillmentGroups{
            status type trackingCode
            ${endereco}
            items{nodes{_id title variantTitle quantity imageURLs{thumbnail small medium large original} productSlug price{amount displayAmount} subtotal{displayAmount} productConfiguration{productId productVariantId}}}
          }
          invoiceIssued dispatched delivered
          recurringOrderId }}`;
      const d = await comEnderecoDoGrupo((endereco) => this.gqlPartner<{ orderByReferenceId: any }>(q(endereco), { id: referenceId }));
      const order = d.orderByReferenceId;
      for (const g of order?.fulfillmentGroups ?? []) {
        for (const n of g?.items?.nodes ?? []) {
          // imageURLs é um OBJETO de tamanhos (ImageSizes), não uma lista: `?.[0]` vinha vazio.
          const img = n?.imageURLs;
          if (n && n.thumbnail === undefined) n.thumbnail = img?.thumbnail ?? img?.small ?? img?.medium ?? img?.original ?? "";
        }
      }
      return order;
    }
    // Seleção conservadora: fora displayStatus e payments.data (resolvedores que quebram a
    // consulta inteira) e trackingUrl (não existe neste contexto: use trackingCode). O endereço
    // do grupo entra pelo comEnderecoDoGrupo, que repete sem ele se a união não resolver.
    const q = (endereco: string) => `query($id:ID!,$shopId:ID,$token:String){
      orderByReferenceId(id:$id,shopId:$shopId,token:$token){
        _id referenceId status email
        summary{total{amount displayAmount}}
        payments{displayName mode processor isCaptured cardBrand captureErrorMessage amount{amount displayAmount}}
        fulfillmentGroups{
          status type trackingCode
          ${endereco}
          items{nodes{_id title variantTitle quantity thumbnail productSlug price{amount displayAmount} subtotal{displayAmount} productConfiguration{productId productVariantId}}}
        }
        invoiceIssued dispatched delivered
        recurringOrderId }}`;
    const d = await comEnderecoDoGrupo((endereco) => this.gql<{ orderByReferenceId: any }>(q(endereco), { id: referenceId, shopId: this.shopId, token }));
    return d.orderByReferenceId;
  }

  // -------------------------------------------------------- conta do cliente (OTP)
  /** Storefront pede OTP por e-mail (contexto de loja). Exige x-captcha-verification (= UNBOX_CAPTCHA_BYPASS). */
  async requestCustomerOtp(email: string): Promise<boolean> {
    const q = `mutation($i:CustomerOTPRequestInput!){ customerOTPRequest(input:$i){success} }`;
    const d = await this.gql<{ customerOTPRequest: { success: boolean } }>(q, { i: { email, shopId: this.shopId } }, { captcha: true });
    return d.customerOTPRequest.success;
  }

  /** Troca o OTP pelo token DO CLIENTE (use-o no UnboxCustomerClient). */
  async customerSignIn(email: string, otp: string): Promise<{ accessToken: string; firstAccess: boolean }> {
    const q = `mutation($i:CustomerPasswordlessSignInInput){ customerPasswordlessSignIn(input:$i){
      accessToken idToken firstAccess newShopSignIn }}`;
    const d = await this.gql<{ customerPasswordlessSignIn: any }>(q, { i: { email, otp, shopId: this.shopId } }, { captcha: true });
    return { accessToken: d.customerPasswordlessSignIn.accessToken, firstAccess: d.customerPasswordlessSignIn.firstAccess };
  }

  async customerAccountExists(email: string): Promise<boolean> {
    const q = `query($i:HasCustomerAccountInput){ hasCustomerAccount(input:$i){result} }`;
    const d = await this.gql<{ hasCustomerAccount: { result: boolean } }>(q, { i: { email, shopId: this.shopId } });
    return d.hasCustomerAccount.result;
  }

  async getAddressByPostalCode(postalCode: string): Promise<any> {
    const q = `query($i:getAddressByPostalCodeInput!){ getAddressByPostalCode(input:$i){
      address1 neighborhood city region cityCode }}`;
    const d = await this.gql<{ getAddressByPostalCode: any }>(q, { i: { shopId: this.shopId, postalCode: postalCode.replace(/\D/g, "") } });
    return d.getAddressByPostalCode;
  }

  // --------------------------------------------------------------- payment links
  /**
   * Cria um Payment Link hospedado pela Unbox (bom para WhatsApp / compartilhar carrinho).
   * ⚠️ Operação de loja (admin-ish) — derivada da doc 07/10; rode sob demanda. Retorna o
   * PaymentLink; a página pública é montada via getPublicPaymentLink(referenceId).
   */
  async createPaymentLink(input: {
    items: Array<{ productId: string; productVariantId: string; quantity: number }>;
    constraints?: PaymentLinkConstraints;
    customerData?: Record<string, { value: string; editable: boolean }>;
  }): Promise<any> {
    const q = `mutation($i:CreatePaymentLinkInput!){ createPaymentLink(input:$i){
      _id referenceId status constraints{expirationDate usageLimit} }}`;
    const d = await this.gql<{ createPaymentLink: any }>(q, { i: {
      shopId: this.shopId,
      items: input.items,
      constraints: input.constraints,
      metadata: input.customerData ? { customerData: input.customerData } : undefined,
    } });
    return d.createPaymentLink;
  }

  /** Lê um payment link público (para montar a página de pagamento). discountCode é aplicado aqui. */
  async getPublicPaymentLink(paymentLinkId: string, discountCode?: string): Promise<any> {
    const q = `query($id:ID!,$shopId:ID!,$discountCode:String){ publicPaymentLink(paymentLinkId:$id,shopId:$shopId,discountCode:$discountCode){
      _id referenceId status }}`;
    const d = await this.gql<{ publicPaymentLink: any }>(q, { id: paymentLinkId, shopId: this.shopId, discountCode });
    return d.publicPaymentLink;
  }

  /** Cria um carrinho real a partir de um cart template (campanhas / "compre de novo"). */
  async createCartByTemplate(cartTemplateId: string): Promise<CartResult> {
    const q = `mutation($i:CreateCartByTemplateInput!){ createCartByTemplate(input:$i){
      token cart{ _id totalItemQuantity checkout{summary{total{amount displayAmount}}} } }}`;
    // Escrita já publicada na API de parceiros (CreateCartPayload tem a mesma shape).
    const d = this.usesPartnerApi
      ? await this.gqlPartner<{ createCartByTemplate: any }>(q, { i: { shopId: this.shopId, cartTemplateId } })
      : await this.gql<{ createCartByTemplate: any }>(q, { i: { shopId: this.shopId, cartTemplateId } });
    const r = d.createCartByTemplate;
    return { cartId: r.cart._id, cartToken: r.token, cart: r.cart };
  }

  // -------------------------------------------------------------------- webhooks
  /** ⚠️ EFEITO REAL: cria uma assinatura de webhook na loja. Rode sob demanda (script). */
  async subscribeWebhook(eventType: string, endpoint: string): Promise<any> {
    const q = `mutation($i:SubscribeToWebhookInput){ subscribeToWebhook(input:$i){
      _id eventType endpoint secret createdAt }}`;
    // Mesma mutation nos dois endpoints — uma das poucas ESCRITAS já publicadas na API de
    // parceiros (junto com createCartByTemplate e os CRUDs de cupom).
    const d = this.usesPartnerApi
      ? await this.gqlPartner<{ subscribeToWebhook: any }>(q, { i: { eventType, endpoint } })
      : await this.gql<{ subscribeToWebhook: any }>(q, { i: { eventType, endpoint } });
    return d.subscribeToWebhook;
  }

  // ------------------------------------------------------------------ inventário
  /** Inventário de uma variante (API de parceiros — simpleInventory). Exige partnerApiKey. */
  async getSimpleInventory(productId: string, productVariantId: string): Promise<SimpleInventoryInfo | null> {
    if (!this.usesPartnerApi) throw new UnboxError("getSimpleInventory exige UNBOX_PARTNER_API_KEY (API de parceiros)");
    const q = `query($pc:ProductConfigurationInput!){ simpleInventory(productConfiguration:$pc){
      _id canBackorder inventoryInStock inventoryReserved isEnabled lowInventoryWarningThreshold
      productConfiguration{productId productVariantId} }}`;
    const d = await this.gqlPartner<{ simpleInventory: SimpleInventoryInfo | null }>(q, { pc: { productId, productVariantId } });
    return d.simpleInventory ?? null;
  }
}
