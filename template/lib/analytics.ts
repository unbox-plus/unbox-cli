"use client";

// ═══════════════════════════════════════════════════════════════════════════════════════
// analytics.ts — a camada ÚNICA de tracking da loja. Não existe outra; se você achar um
// segundo lugar empurrando no dataLayer, é bug.
//
// Cada evento sai por até quatro canais, no mesmo disparo:
//   1. window.dataLayer — SEMPRE, em formato de OBJETO. É o que o GTM lê. Serve ao container
//      central da Unbox (GTM-PZLT336) e a qualquer container da loja (inclusive server-side
//      via Stape). O objeto carrega o formato GA4 padrão (`ecommerce.items` com `item_id`) E,
//      na compra, as chaves que o container central lê (`ecommerce.purchase.*` e as clássicas
//      `transactionId`/`transactionTotal`), porque ele foi construído em três gerações e lê
//      as três. Medido no JS do container, não suposição.
//   2. gtag('event') — só se existir (loja com NEXT_PUBLIC_GA_ID, GA4 direto sem GTM). Antes
//      este canal tinha PRIORIDADE e o dataLayer só era usado na ausência dele: bastava ligar
//      o GA4 próprio para o GTM central ficar cego a todo o e-commerce.
//   3. fbq('track') — Meta Pixel, com eventID para dedupe com a CAPI.
//   4. POST /api/capi — Meta Conversions API, server-side, mesmo eventID.
//
// Regras que vieram de um relatório de cliente (She Talks, ago/2026) sobre a loja nativa da
// Unbox, e que esta foundation cumpre:
//   • `value` é sempre NÚMERO (nunca "R$23,34"). Um único campo de valor.
//   • `discount` por item vem do carrinho; a soma dos itens fecha com o valor.
//   • UMA estrutura para todos os eventos: `ecommerce.items[{item_id, ...}]`.
//   • purchase dispara UMA vez (dedupe em localStorage) e SÓ quando o pedido está PAGO — quem
//     decide é o chamador (order.paid). Pix pendente nunca é venda.
//   • Dados de cliente para correspondência (em, ph, fn, ln, zp, external_id) saem daqui JÁ
//     HASHEADOS (SHA-256) — no dataLayer, no Pixel e na CAPI. Texto aberto não entra no
//     dataLayer, porque qualquer tag de qualquer container o lê.
//   • dataLayerReady { pageType, products[] } no carregamento de produto/carrinho/checkout/
//     confirmação: é o que alimenta o remarketing do Google Ads no container central.
//
// Não há page_view manual no dataLayer: os containers têm listener de History Change e
// contariam em dobro. O page_view de SPA vai só pro gtag direto, que não tem esse listener.
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface TrackItem {
  id: string;
  name: string;
  variant?: string;
  price?: number;
  /** desconto unitário já aplicado (cupom/promoção). Preço de tabela = price + discount. */
  discount?: number;
  quantity?: number;
  category?: string;
  listName?: string;
  index?: number;
}

/** Dados do cliente. Entram em TEXTO ABERTO aqui e saem hasheados de todos os canais. */
export interface TrackUser {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  zip?: string;
  /** id estável do cliente na Unbox; sem ele, o e-mail hasheado faz o papel */
  customerId?: string;
}

export type PageType = "home" | "category" | "product" | "cart" | "checkout" | "purchase" | "search" | "other";

type Win = Window & { gtag?: (...a: any[]) => void; fbq?: (...a: any[]) => void; dataLayer?: any[] };

const CURRENCY = "BRL";

// ------------------------------------------------------------------ utilitários
function genEventId(): string {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch { /* ignora */ }
  return `e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function sha256(value?: string): Promise<string | undefined> {
  const v = (value ?? "").trim().toLowerCase();
  if (!v || typeof crypto === "undefined" || !crypto.subtle) return undefined;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Telefone p/ Meta: só dígitos, com DDI 55 quando ausente. */
function normPhone(phone?: string): string | undefined {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return undefined;
  return d.length <= 11 ? `55${d}` : d;
}

/** CEP p/ Meta: só dígitos (o Meta normaliza os 5 primeiros; mandamos os 8). */
function normZip(zip?: string): string | undefined {
  const d = (zip ?? "").replace(/\D/g, "");
  return d || undefined;
}

/** Nome sem acento, minúsculo — é assim que o Meta espera antes do hash. */
function normName(name?: string): string | undefined {
  const n = (name ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return n || undefined;
}

export interface HashedUser { em?: string; ph?: string; fn?: string; ln?: string; zp?: string; external_id?: string }

/** Hasheia os campos de correspondência. Retorna só o que existir. */
export async function hashUser(u?: TrackUser): Promise<HashedUser | undefined> {
  if (!u) return undefined;
  const [em, ph, fn, ln, zp, ext] = await Promise.all([
    sha256(u.email),
    sha256(normPhone(u.phone)),
    sha256(normName(u.firstName)),
    sha256(normName(u.lastName)),
    sha256(normZip(u.zip)),
    // external_id: id da Unbox quando logado; senão o e-mail hasheado faz o papel de id estável
    sha256(u.customerId || u.email),
  ]);
  const out: HashedUser = {};
  if (em) out.em = em; if (ph) out.ph = ph; if (fn) out.fn = fn; if (ln) out.ln = ln; if (zp) out.zp = zp;
  if (ext) out.external_id = ext;
  return Object.keys(out).length ? out : undefined;
}

let brandCache: string | undefined;
function brand(): string | undefined {
  if (brandCache !== undefined) return brandCache || undefined;
  try {
    brandCache = (document.querySelector('meta[property="og:site_name"]') as HTMLMetaElement | null)?.content ?? "";
  } catch { brandCache = ""; }
  return brandCache || undefined;
}

function round2(n: number) { return Math.round(n * 100) / 100; }

/** Item no formato GA4. Só chaves com valor — o GTM não gosta de `undefined` em variável. */
function gaItem(it: TrackItem) {
  const o: Record<string, any> = { item_id: it.id, item_name: it.name, quantity: it.quantity ?? 1 };
  const b = brand(); if (b) o.item_brand = b;
  if (it.variant) o.item_variant = it.variant;
  if (it.category) o.item_category = it.category;
  if (it.listName) o.item_list_name = it.listName;
  if (it.index != null) o.index = it.index;
  if (it.price != null) o.price = round2(it.price);
  if (it.discount) o.discount = round2(it.discount);
  return o;
}

/** Item no formato próprio da Unbox (`products[]` do dataLayerReady, lido pelo container central). */
function unboxProduct(it: TrackItem) {
  const price = it.price ?? 0;
  return {
    id: it.id,
    name: it.name,
    price: round2(price),
    originalPrice: round2(price + (it.discount ?? 0)),
    available: true,
    quantity: it.quantity ?? 1,
  };
}

function metaContents(items: TrackItem[]) {
  return {
    content_type: "product",
    content_ids: items.map((it) => it.id),
    contents: items.map((it) => ({ id: it.id, quantity: it.quantity ?? 1, item_price: it.price })),
  };
}

function sumValue(items: TrackItem[]) {
  return round2(items.reduce((s, it) => s + (it.price ?? 0) * (it.quantity ?? 1), 0));
}

function dlPush(obj: Record<string, any>) {
  const w = window as Win;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ ecommerce: null }); // limpa o objeto anterior — senão o GTM mistura eventos
  w.dataLayer.push(obj);
}

const ECOMM_PAGETYPE: Record<PageType, string> = {
  home: "home", category: "category", product: "product", cart: "cart",
  checkout: "cart", purchase: "purchase", search: "searchresults", other: "other",
};

// ------------------------------------------------------------------ o disparo
interface FireOpts {
  gaEvent: string;
  /** sem metaEvent = evento só de GA/GTM (listagem, seleção, remoção...) */
  metaEvent?: string;
  items: TrackItem[];
  value?: number;
  coupon?: string;
  transactionId?: string;
  shipping?: number;
  tax?: number;
  /** chaves extras dentro de `ecommerce` (ex.: shipping_tier, payment_type, item_list_name) */
  gaExtra?: Record<string, any>;
  user?: TrackUser;
  /** força o id do evento (purchase usa o id do pedido → dedupe com o servidor) */
  eventId?: string;
  pageType?: PageType;
}

async function fire(o: FireOpts) {
  if (typeof window === "undefined") return;
  const w = window as Win;
  const eventId = o.eventId ?? genEventId();
  const value = o.value != null ? round2(o.value) : sumValue(o.items);
  const hashed = await hashUser(o.user);

  // 1) dataLayer — sempre, formato objeto, GA4 + chaves do container central
  try {
    const ecommerce: Record<string, any> = { currency: CURRENCY, value, items: o.items.map(gaItem), ...o.gaExtra };
    if (o.coupon) ecommerce.coupon = o.coupon;
    if (o.transactionId) ecommerce.transaction_id = o.transactionId;
    if (o.shipping != null) ecommerce.shipping = round2(o.shipping);
    if (o.tax != null) ecommerce.tax = round2(o.tax);

    const payload: Record<string, any> = { event: o.gaEvent, ecommerce };
    if (o.pageType) { payload.pageType = o.pageType; payload.ecomm_pagetype = ECOMM_PAGETYPE[o.pageType]; }
    if (hashed) payload.user_data = hashed;

    if (o.gaEvent === "purchase" && o.transactionId) {
      // O container central da Unbox lê a compra em `ecommerce.purchase.*` (formato Universal
      // Analytics) e nas chaves clássicas `transaction*`. Sem isto, a compra chega vazia lá.
      ecommerce.purchase = {
        transaction_id: o.transactionId,
        value,
        shipping: o.shipping != null ? round2(o.shipping) : undefined,
        items: ecommerce.items,
      };
      payload.transactionId = o.transactionId;
      payload.transactionTotal = value;
      if (o.shipping != null) payload.transactionShipping = round2(o.shipping);
      payload.transactionProducts = o.items.map(unboxProduct);
    }
    dlPush(payload);
  } catch { /* nunca quebra a UI */ }

  // 2) gtag direto — só GA4 sem GTM
  try {
    if (typeof w.gtag === "function") {
      const p: Record<string, any> = { currency: CURRENCY, value, items: o.items.map(gaItem), ...o.gaExtra };
      if (o.coupon) p.coupon = o.coupon;
      if (o.transactionId) p.transaction_id = o.transactionId;
      if (o.shipping != null) p.shipping = round2(o.shipping);
      if (o.tax != null) p.tax = round2(o.tax);
      w.gtag("event", o.gaEvent, p);
    }
  } catch { /* ignora */ }

  if (!o.metaEvent) return;

  // 3) Meta Pixel — com eventID p/ dedupe com a CAPI (e com o servidor, na compra)
  try {
    const mp: Record<string, any> = { currency: CURRENCY, value, ...metaContents(o.items) };
    if (o.transactionId) mp.order_id = o.transactionId;
    if (typeof w.fbq === "function") w.fbq("track", o.metaEvent, mp, { eventID: eventId });
  } catch { /* ignora */ }

  // 4) CAPI — mesmo eventID; só hash sai daqui
  try {
    void fetch("/api/capi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        eventId,
        eventName: o.metaEvent,
        value,
        currency: CURRENCY,
        orderId: o.transactionId,
        contents: o.items.map((it) => ({ id: it.id, quantity: it.quantity ?? 1, item_price: it.price })),
        sourceUrl: window.location.href,
        ...(hashed ?? {}),
      }),
    }).catch(() => {});
  } catch { /* ignora */ }
}

// ------------------------------------------------------------------ eventos públicos

/** Tipo da página + produtos em vista. Dispare UMA vez por carregamento (ver <DataLayerReady/>). */
export function trackPageType(pageType: PageType, products: TrackItem[] = []) {
  if (typeof window === "undefined") return;
  try {
    const payload: Record<string, any> = { event: "dataLayerReady", pageType, ecomm_pagetype: ECOMM_PAGETYPE[pageType] };
    if (products.length) {
      payload.products = products.map(unboxProduct);
      payload.ecomm_prodid = products.map((p) => p.id);
      payload.ecomm_totalvalue = sumValue(products);
    }
    dlPush(payload);
  } catch { /* ignora */ }
}

export function trackViewItemList(items: TrackItem[], listName: string) {
  const withList = items.map((it, i) => ({ ...it, listName, index: it.index ?? i }));
  void fire({ gaEvent: "view_item_list", items: withList, gaExtra: { item_list_name: listName } });
}

export function trackSelectItem(item: TrackItem, listName: string) {
  void fire({ gaEvent: "select_item", items: [{ ...item, listName }], gaExtra: { item_list_name: listName } });
}

export function trackViewItem(item: TrackItem) {
  void fire({ gaEvent: "view_item", metaEvent: "ViewContent", items: [item] });
}

export function trackAddToCart(item: TrackItem) {
  void fire({ gaEvent: "add_to_cart", metaEvent: "AddToCart", items: [item], pageType: "cart" });
}

export function trackRemoveFromCart(item: TrackItem) {
  void fire({ gaEvent: "remove_from_cart", items: [item] });
}

export function trackViewCart(items: TrackItem[], value?: number) {
  void fire({ gaEvent: "view_cart", items, value });
}

export function trackBeginCheckout(items: TrackItem[], value?: number, coupon?: string, user?: TrackUser) {
  void fire({ gaEvent: "begin_checkout", metaEvent: "InitiateCheckout", items, value, coupon, user });
}

export function trackAddShippingInfo(items: TrackItem[], value: number | undefined, shippingTier: string, coupon?: string) {
  void fire({ gaEvent: "add_shipping_info", items, value, coupon, gaExtra: { shipping_tier: shippingTier } });
}

export function trackAddPaymentInfo(items: TrackItem[], value: number | undefined, paymentType: string, coupon?: string, user?: TrackUser) {
  void fire({ gaEvent: "add_payment_info", metaEvent: "AddPaymentInfo", items, value, coupon, gaExtra: { payment_type: paymentType }, user });
}

const PURCHASE_KEY = "store_purchase_fired";

/**
 * Compra concluída. Dispara UMA vez por transação (dedupe em localStorage), e o chamador só
 * chama quando o pedido está PAGO. O eventID é derivado do id do pedido: o servidor (webhook
 * de pagamento → CAPI) usa o mesmo, e o Meta conta uma vez mesmo que os dois disparem.
 */
export function trackPurchase(p: {
  transactionId: string;
  items: TrackItem[];
  value?: number;
  coupon?: string;
  shipping?: number;
  tax?: number;
  user?: TrackUser;
}) {
  if (!p.transactionId) return;
  try {
    const fired: string[] = JSON.parse(localStorage.getItem(PURCHASE_KEY) || "[]");
    if (fired.includes(p.transactionId)) return;
    localStorage.setItem(PURCHASE_KEY, JSON.stringify([...fired.slice(-49), p.transactionId]));
  } catch { /* sem localStorage: segue e dispara */ }
  void fire({
    gaEvent: "purchase",
    metaEvent: "Purchase",
    items: p.items,
    value: p.value,
    coupon: p.coupon,
    shipping: p.shipping,
    tax: p.tax,
    transactionId: p.transactionId,
    eventId: purchaseEventId(p.transactionId),
    user: p.user,
    pageType: "purchase",
  });
}

/** Mesmo id no browser e no servidor → dedupe na Meta. Exportado para o webhook usar. */
export function purchaseEventId(transactionId: string) {
  return `purchase-${transactionId}`;
}
