// Normaliza o `cart` cru da Unbox (createCart.cart / anonymousCartByCartId) numa forma única
// e estável para a UI. Mantém o preço/total SEMPRE como displayAmount do servidor (autoritativo).

export interface UiCartItem {
  id: string;            // cartItemId (node._id) — usado em update/remove
  productId: string;
  variantId: string;
  title: string;
  variantTitle?: string;
  quantity: number;
  unitPrice: number;
  displayUnitPrice: string;
  thumbnail?: string;
  isRecurring?: boolean;
  isBonus: boolean;      // isDiscountedBonusItem (brinde) — R$0, excluído do placeOrder
}

export interface UiShippingAddress {
  fullName: string;
  taxPayerId: string;
  phone: string;
  address1: string;
  address2?: string;
  number: string;
  neighborhood: string;
  city: string;
  region: string;
  postal: string;
}

// Placeholders gravados pela cotação de frete antes do endereço estar completo (ver
// quoteAddress() em checkout-client.tsx) — nunca são endereço real, filtrar ao ler de volta.
const QUOTE_PLACEHOLDERS = new Set(["Cotação", "—", "0", "00000000000"]);

function cleanAddressField(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  return QUOTE_PLACEHOLDERS.has(s) ? "" : s;
}

/** Endereço de entrega já gravado no carrinho (se houver), com placeholders de cotação removidos. */
export function extractShippingAddress(cart: any): UiShippingAddress | null {
  const fg = cart?.checkout?.fulfillmentGroups ?? [];
  const raw = fg.find((g: any) => g.data?.shippingAddress)?.data?.shippingAddress;
  if (!raw) return null;
  const addr: UiShippingAddress = {
    fullName: cleanAddressField(raw.fullName),
    taxPayerId: cleanAddressField(raw.taxPayerId),
    phone: cleanAddressField(raw.phone),
    address1: cleanAddressField(raw.address1),
    address2: cleanAddressField(raw.address2),
    number: cleanAddressField(raw.number),
    neighborhood: cleanAddressField(raw.neighborhood),
    city: cleanAddressField(raw.city),
    region: cleanAddressField(raw.region),
    postal: cleanAddressField(raw.postal),
  };
  // Se sobrou só CEP/cidade/UF (da cotação) e nada do resto, não é um endereço "salvo" de verdade.
  const hasSubstance = addr.address1 || addr.fullName || addr.number;
  return hasSubstance ? addr : null;
}

export interface UiCart {
  cartId: string;
  totalItemQuantity: number;
  expiresAt?: string;
  email?: string;
  shippingAddress?: UiShippingAddress | null;
  recurringItemsFrequencyId?: string | null;
  hasRecurring: boolean;
  /** Frequência de assinatura escolhida (resolvida do cookie + política da loja). */
  recurringFrequencyId?: string;
  recurringFrequencyTitle?: string;
  items: UiCartItem[];
  discounts: Array<{ id: string; code?: string; displayAmount?: string }>;
  fulfillmentGroupIds: string[];
  selectedShipping?: { methodId: string; displayName?: string; displayAmount?: string } | null;
  summary: {
    itemTotal?: string;
    discountTotal?: string;
    shippingTotal?: string;
    taxTotal?: string;
    total?: string;
    totalAmount?: number;
  };
  cartEvents: Array<{ type: string; data?: any }>;
}

export function normalizeCart(cart: any, extraEvents: any[] = []): UiCart | null {
  if (!cart) return null;
  const edges = cart.items?.edges ?? [];
  const items: UiCartItem[] = edges.map((e: any) => {
    const n = e.node;
    return {
      id: n._id,
      productId: n.productConfiguration?.productId,
      variantId: n.productConfiguration?.productVariantId,
      title: n.title,
      variantTitle: n.variantTitle,
      quantity: n.quantity,
      unitPrice: n.price?.amount ?? 0,
      displayUnitPrice: n.price?.displayAmount ?? "—",
      thumbnail: n.thumbnail || undefined,
      isRecurring: n.isRecurring ?? false,
      isBonus: n.isDiscountedBonusItem === true,
    };
  });

  const fg = cart.checkout?.fulfillmentGroups ?? [];
  const selected = fg.find((g: any) => g.selectedFulfillmentOption)?.selectedFulfillmentOption;
  const summary = cart.checkout?.summary ?? {};

  return {
    cartId: cart._id,
    totalItemQuantity: cart.totalItemQuantity ?? items.reduce((s, i) => s + i.quantity, 0),
    expiresAt: cart.expiresAt,
    email: cart.email || undefined,
    shippingAddress: extractShippingAddress(cart),
    recurringItemsFrequencyId: cart.recurringItemsFrequencyId ?? null,
    hasRecurring: items.some((i) => i.isRecurring),
    items,
    discounts: (cart.appliedDiscounts ?? cart.discounts ?? []).map((d: any) => ({
      id: d._id, code: d.code, displayAmount: d.amount?.displayAmount,
    })),
    fulfillmentGroupIds: fg.map((g: any) => g._id),
    selectedShipping: selected
      ? {
          methodId: selected.fulfillmentMethod?._id,
          displayName: selected.fulfillmentMethod?.displayName ?? selected.fulfillmentMethod?.name,
          displayAmount: selected.price?.displayAmount,
        }
      : null,
    summary: {
      itemTotal: summary.itemTotal?.displayAmount,
      discountTotal: summary.discountTotal?.displayAmount,
      shippingTotal: summary.fulfillmentTotal?.displayAmount,
      taxTotal: summary.taxTotal?.displayAmount,
      total: summary.total?.displayAmount,
      totalAmount: summary.total?.amount,
    },
    cartEvents: [...(cart.cartEvents ?? []), ...extraEvents],
  };
}
