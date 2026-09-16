// Acesso a pedido COM verificação de posse (doc 09): cliente logado OU token do placeOrder (cookie).
import "server-only";
import { withStoreClient } from "./unbox/store";
import { getOrderToken } from "./session";
import { getCustomerClient } from "./customer-session";
import { orderStatusLabel, paymentStatusLabel, paymentSeal, fulfillmentStatusLabel, fulfillmentTypeLabel, trackingStatusLabel } from "./unbox/customer";
import { formatBRL } from "./format";
import { getCatalog, getProductBySlug } from "./queries";

// O resolver de `displayAmount` no contexto do cliente (customerOrderByReferenceId) é furado e às
// vezes devolve "R$NaN,undefined". Por isso formatamos SEMPRE a partir do `.amount` numérico.
const money = (amount: unknown): string | undefined =>
  typeof amount === "number" && !Number.isNaN(amount) ? formatBRL(amount) : undefined;

export interface ShapedOrderItem {
  title: string;
  variantTitle?: string;
  quantity: number;
  displayPrice?: string;
  displaySubtotal?: string;
  thumbnail?: string;
  slug?: string;
  /** dados p/ refazer o pedido (adicionar ao carrinho) */
  productId?: string;
  variantId?: string;
  price?: number;
}

export interface ShapedOrder {
  referenceId: string;
  status: string;
  statusLabel: string;
  paid: boolean;
  payment: {
    displayName?: string; captured?: boolean; cardBrand?: string; errorMessage?: string; statusLabel?: string; amount?: string;
    /** Selo do pedido, a partir do status do PAGAMENTO. Ausente quando a API não informou o status. */
    seal?: { label: string; tone: "ok" | "warn" | "bad" | "muted" };
  } | null;
  fulfillment: { status?: string; type?: string; trackingCode?: string }[];
  items: ShapedOrderItem[];
  address: ShapedAddress | null;
  invoiceIssued?: boolean;
  dispatched?: boolean;
  delivered?: boolean;
  total?: string;
  email?: string;
  createdAt?: string;
  /** Método de envio escolhido. Só com a seleção completa da API. */
  shipping?: { method?: string; carrier?: string; days?: number } | null;
  /** Rastreio: código, link da transportadora e a linha do tempo, do evento mais recente ao mais antigo. */
  tracking?: { code?: string; url?: string; events: { label: string; description?: string; at?: string }[] } | null;
  /** Quebra do total. null quando a API entregou só o total. */
  totals?: { subtotal?: string; shipping?: string; discount?: string } | null;
}

export interface ShapedAddress {
  fullName?: string;
  line?: string; // "Rua X, 123 · Bairro"
  cityRegion?: string; // "São Paulo/SP · 05724-003"
}

export interface ShapedOrderSummary {
  referenceId: string;
  status: string;
  statusLabel: string;
  createdAt?: string;
  recurring: boolean;
  dispatched: boolean;
  delivered: boolean;
  total?: string;
  itemCount: number;
  thumbnails: string[];
  firstTitles: string[];
  address: ShapedAddress | null;
}

function shapeAddress(a: any): ShapedAddress | null {
  if (!a) return null;
  const line = [a.address1, a.number].filter(Boolean).join(", ") + (a.neighborhood ? ` · ${a.neighborhood}` : "");
  const cityRegion = [a.city && a.region ? `${a.city}/${a.region}` : a.city || a.region, a.postal].filter(Boolean).join(" · ");
  return { fullName: a.fullName || undefined, line: line.trim() || undefined, cityRegion: cityRegion || undefined };
}

/** Resumo de um pedido para a LISTA: endereço, miniaturas, contagem e total. */
export function shapeOrderSummary(o: any): ShapedOrderSummary {
  const groups: any[] = o.fulfillmentGroups ?? [];
  const items: any[] = groups.flatMap((g: any) => g.items?.nodes ?? []);
  const address = shapeAddress(groups.find((g: any) => g.data?.shippingAddress)?.data?.shippingAddress);
  const itemsSum = items.reduce((s: number, it: any) => s + (it.price?.amount ?? 0) * (it.quantity ?? 1), 0);
  return {
    referenceId: o.referenceId,
    status: o.status,
    statusLabel: orderStatusLabel(o.status),
    createdAt: o.createdAt,
    recurring: !!o.recurringOrderId,
    dispatched: !!o.dispatched,
    delivered: !!o.delivered,
    total: money(o.summary?.total?.amount) ?? money(itemsSum > 0 ? itemsSum : undefined),
    itemCount: items.reduce((s: number, it: any) => s + (it.quantity ?? 1), 0),
    thumbnails: items.map((it: any) => it.thumbnail).filter(Boolean).slice(0, 4),
    firstTitles: items.map((it: any) => it.title).filter(Boolean).slice(0, 3),
    address,
  };
}

/**
 * O TEXTO QUE A API JÁ FORMATOU ("R$ 157,24"), quando o número não vem. A consulta deixou de pedir
 * `payments.amount.amount` (ver lib/unbox/customer.ts), então o valor do pagamento chega só assim. O
 * formato é conferido porque `displayAmount` no contexto de cliente já devolveu "R$NaN,undefined".
 */
function textoDeDinheiro(v: unknown): string | undefined {
  return typeof v === "string" && /^R\$\s?[\d.]+,\d{2}$/.test(v.trim()) ? v.trim() : undefined;
}

export function shapeOrder(o: any): ShapedOrder {
  const pmt = o.payments?.[0];
  const groups: any[] = o.fulfillmentGroups ?? [];
  const items: ShapedOrderItem[] = groups.flatMap((g: any) =>
    (g.items?.nodes ?? []).map((it: any): ShapedOrderItem => {
      const unit = it.price?.amount;
      return {
        title: it.title,
        variantTitle: it.variantTitle ?? undefined,
        quantity: it.quantity,
        displayPrice: money(unit),
        displaySubtotal: typeof unit === "number" ? money(unit * (it.quantity ?? 1)) : undefined,
        thumbnail: it.thumbnail ?? undefined,
        slug: it.productSlug ?? undefined,
        productId: it.productConfiguration?.productId ?? undefined,
        variantId: it.productConfiguration?.productVariantId ?? undefined,
        price: typeof unit === "number" ? unit : undefined,
      };
    }),
  );
  const itemsSum = items.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0);
  return {
    referenceId: o.referenceId,
    status: o.status,
    statusLabel: orderStatusLabel(o.status),
    paid: o.status === "PROCESSING" || o.status === "COMPLETED" || pmt?.isCaptured === true,
    payment: pmt
      ? {
          displayName: pmt.displayName,
          captured: pmt.isCaptured,
          cardBrand: pmt.cardBrand,
          errorMessage: pmt.captureErrorMessage,
          statusLabel: pmt.status?.status ? paymentStatusLabel(pmt.status.status) : undefined,
          amount: money(pmt.amount?.amount) ?? textoDeDinheiro(pmt.amount?.displayAmount),
          seal: paymentSeal(pmt.status?.status),
        }
      : null,
    // o valor cru ("new", "SHIPPING") não é texto para cliente; o que ainda não tem rótulo aparece cru
    fulfillment: groups.map((g: any) => ({
      status: fulfillmentStatusLabel(g.status) ?? g.status,
      type: fulfillmentTypeLabel(g.type) ?? g.type,
      trackingCode: g.trackingCode,
    })),
    items,
    address: shapeAddress(groups.find((g: any) => g.data?.shippingAddress)?.data?.shippingAddress),
    invoiceIssued: o.invoiceIssued,
    dispatched: o.dispatched,
    delivered: o.delivered,
    total: money(o.summary?.total?.amount) ?? money(pmt?.amount?.amount) ?? textoDeDinheiro(pmt?.amount?.displayAmount) ?? money(itemsSum > 0 ? itemsSum : undefined),
    email: o.email,
    createdAt: o.createdAt ?? undefined,
    shipping: shapeShipping(groups),
    tracking: shapeTracking(groups, o.createdAt),
    totals: shapeTotals(o.summary),
  };
}

/** Método de envio do primeiro grupo que tiver um escolhido. `label` é o nome comercial ("Sedex"). */
function shapeShipping(groups: any[]): ShapedOrder["shipping"] {
  const m = groups.find((g: any) => g?.selectedFulfillmentOption?.fulfillmentMethod)?.selectedFulfillmentOption?.fulfillmentMethod;
  if (!m) return null;
  const days = typeof m.daysToDeliver === "number" ? m.daysToDeliver : undefined;
  if (!m.label && !m.carrier && days == null) return null;
  return { method: m.label || undefined, carrier: m.carrier || undefined, days };
}

/**
 * Linha do tempo do rastreio. `event.value` é o estado ATUAL e pode não estar repetido em
 * `event.history`: entra na frente, e o que se repete (mesmo status no mesmo instante) sai.
 *
 * Sem rastreio da transportadora ainda, o primeiro passo vem do status do GRUPO de entrega
 * ("Preparando o pedido"), como a conta hospedada da Unbox mostra. É informação real sobre o pedido,
 * não um marcador inventado; e só aparece quando o status tem rótulo.
 */
function shapeTracking(groups: any[], createdAt?: string): ShapedOrder["tracking"] {
  const g = groups.find((x: any) => x?.tracking?.code || x?.tracking?.url || x?.trackingCode);
  if (!g) {
    const rotulo = fulfillmentStatusLabel(groups[0]?.status);
    return rotulo && createdAt ? { events: [{ label: rotulo, at: createdAt }] } : null;
  }
  const tr = g.tracking;
  const brutos = [tr?.event?.value, ...(tr?.event?.history ?? []).map((h: any) => h?.value)].filter(Boolean);
  const vistos = new Set<string>();
  const events = brutos
    .map((e: any) => ({ label: trackingStatusLabel(e.status) ?? String(e.status ?? ""), description: e.description || undefined, at: e.createdAt || undefined }))
    .filter((e) => {
      const chave = `${e.label}|${e.at}`;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    })
    .sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")));
  return { code: tr?.code || g.trackingCode || undefined, url: tr?.url || undefined, events };
}

/** Subtotal, frete e descontos, formatados do número (o `displayAmount` não é confiável aqui). */
function shapeTotals(summary: any): ShapedOrder["totals"] {
  const subtotal = money(summary?.itemTotal?.amount);
  const shipping = money(summary?.fulfillmentTotal?.amount);
  const descontos = summary?.discountTotal?.amount;
  const discount = typeof descontos === "number" && descontos > 0 ? money(descontos) : undefined;
  if (!subtotal && !shipping && !discount) return null;
  return { subtotal, shipping, discount };
}

/**
 * IMAGEM DO ITEM VEM DO CATÁLOGO. O pedido guarda a foto do momento da compra, e na prática ela vem
 * vazia; a conta hospedada da Unbox busca no catálogo. Casa pelo `productSlug` e nunca sobrescreve a
 * imagem que o pedido trouxe (é a que a pessoa viu ao comprar). A página do catálogo é a mesma que a
 * loja já tem em cache; o que não estiver nela é buscado por slug, também em cache.
 */
export async function completarImagensDoCatalogo(itens: { slug?: string; thumbnail?: string }[]): Promise<void> {
  const faltando = itens.filter((it) => !it.thumbnail && it.slug);
  if (!faltando.length) return;
  const porSlug = new Map<string, string>();
  try {
    const pagina = await getCatalog({ first: 100 });
    for (const n of pagina?.nodes ?? []) {
      const p = n?.product ?? n;
      if (p?.slug && p.imageUrls?.[0]) porSlug.set(p.slug, p.imageUrls[0]);
    }
    const fora = [...new Set(faltando.map((it) => it.slug!).filter((slug) => !porSlug.has(slug)))].slice(0, 12);
    const avulsos = await Promise.all(fora.map((slug) => getProductBySlug(slug).catch(() => null)));
    for (const p of avulsos) if (p?.slug && p.imageUrls?.[0]) porSlug.set(p.slug, p.imageUrls[0]);
  } catch (e) {
    // sem catálogo a página segue com o ícone no lugar da foto: adorno, não motivo para derrubar o pedido
    console.warn("[unbox] pedido: não deu para buscar as imagens no catálogo:", e instanceof Error ? e.message : e);
  }
  for (const it of faltando) {
    const img = porSlug.get(it.slug!);
    if (img) it.thumbnail = img;
  }
}

/** Retorna o pedido se o solicitante tiver posse; senão null. */
export async function getOwnedOrder(referenceId: string): Promise<ShapedOrder | null> {
  const customer = await getCustomerClient();
  if (customer) {
    try {
      const o = await customer.order(referenceId);
      if (o) return comImagens(shapeOrder(o));
    } catch (e) {
      // Cai para o token de quem comprou sem conta, mas deixa registrado: sem esta linha, uma conta
      // que não abre pedido nenhum parecia só "pedido de outra pessoa".
      console.error(JSON.stringify({ tag: "[api-erro]", rota: "pedido/cliente-logado", referenceId, erro: (e instanceof Error ? e.message : String(e)).slice(0, 500), quando: new Date().toISOString() }));
    }
  }
  const token = await getOrderToken(referenceId);
  if (!token) return null;
  const o = await withStoreClient((c) => c.getOrder(referenceId, token));
  return o ? comImagens(shapeOrder(o)) : null;
}

async function comImagens(order: ShapedOrder): Promise<ShapedOrder> {
  await completarImagensDoCatalogo(order.items);
  return order;
}
