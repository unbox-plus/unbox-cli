// Regras do que o cliente pode mudar nos itens de uma assinatura. Puro (sem server-only) para ser testável.
// Chave = produto: trocar a variante de um produto que já estava, com a mesma quantidade, não é
// remover nem adicionar e sempre passa.
export type SubscriptionItem = { productId: string; variantId: string | null; quantity: number };
export type CustomerActions = {
  canChangeProductQuantity?: boolean;
  canRemoveProducts?: boolean;
  canAddProducts?: boolean;
};

const porProduto = (items: SubscriptionItem[]) => {
  const m = new Map<string, number>();
  for (const i of items) m.set(i.productId, (m.get(i.productId) ?? 0) + i.quantity);
  return m;
};

/** Mensagem de recusa, ou null se a mudança é permitida. */
export function checkItemsChange(current: SubscriptionItem[], next: SubscriptionItem[], actions: CustomerActions): string | null {
  const antes = porProduto(current);
  const depois = porProduto(next);
  for (const [id, qty] of depois) {
    if (!antes.has(id)) {
      if (!actions.canAddProducts) return "Esta loja não permite adicionar produtos à assinatura.";
    } else if (antes.get(id) !== qty && !actions.canChangeProductQuantity) {
      return "Esta loja não permite alterar a quantidade dos produtos da assinatura.";
    }
  }
  for (const id of antes.keys()) {
    if (!depois.has(id) && !actions.canRemoveProducts) return "Esta loja não permite remover produtos da assinatura.";
  }
  return null;
}

/** Chave do mapa de nomes (produto + variação) da tela de assinatura. */
export const nameKey = (it: { productId: string; variantId?: string | null }) => `${it.productId}:${it.variantId ?? ""}`;
