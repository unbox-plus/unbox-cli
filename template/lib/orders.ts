// Acesso a pedido COM verificação de posse (doc 09): cliente logado OU token do placeOrder (cookie).
import "server-only";
import { withStoreClient } from "./unbox/store";
import { getOrderToken } from "./session";
import { getCustomerClient } from "./customer-session";
import { orderStatusLabel, paymentStatusLabel } from "./unbox/customer";
import { formatBRL } from "./format";

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
  payment: { displayName?: string; captured?: boolean; cardBrand?: string; errorMessage?: string; statusLabel?: string; amount?: string } | null;
  fulfillment: { status?: string; type?: string; trackingCode?: string }[];
  items: ShapedOrderItem[];
  address: ShapedAddress | null;
  invoiceIssued?: boolean;
  dispatched?: boolean;
  delivered?: boolean;
  total?: string;
  email?: string;
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
          amount: money(pmt.amount?.amount),
        }
      : null,
    fulfillment: groups.map((g: any) => ({
      status: g.status,
      type: g.type,
      trackingCode: g.trackingCode,
    })),
    items,
    address: shapeAddress(groups.find((g: any) => g.data?.shippingAddress)?.data?.shippingAddress),
    invoiceIssued: o.invoiceIssued,
    dispatched: o.dispatched,
    delivered: o.delivered,
    total: money(o.summary?.total?.amount) ?? money(pmt?.amount?.amount) ?? money(itemsSum > 0 ? itemsSum : undefined),
    email: o.email,
  };
}

/** Retorna o pedido se o solicitante tiver posse; senão null. */
export async function getOwnedOrder(referenceId: string): Promise<ShapedOrder | null> {
  const customer = await getCustomerClient();
  if (customer) {
    try {
      const o = await customer.order(referenceId);
      if (o) return shapeOrder(o);
    } catch {
      /* cai para o token de guest */
    }
  }
  const token = await getOrderToken(referenceId);
  if (!token) return null;
  const o = await withStoreClient((c) => c.getOrder(referenceId, token));
  return o ? shapeOrder(o) : null;
}
