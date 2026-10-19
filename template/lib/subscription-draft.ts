// Rascunho da edição de itens da assinatura. Puro (sem React, sem server-only) para ser testável.
// O cliente mexe no rascunho; só no Salvar a lista completa vai ao servidor. Item removido continua no
// rascunho (marcado) até salvar, para poder ser desfeito; item novo fica depois dos salvos.
import { nameKey } from "./subscription-items";

/** Os itens escolhidos dentro de um kit (cada um com a quantidade): o que vai em `productKitItemsConfigurations`. */
export type KitPick = { productId: string; productVariantId: string; quantity: number };
export type KitSelection = { productKitId: string; picks: KitPick[] };
export type SavedItem = { productId: string; variantId: string; quantity: number; kit?: KitSelection };
export type DraftItem = SavedItem & { removed?: boolean; isNew?: boolean };

export const createDraft = (saved: SavedItem[]): DraftItem[] => saved.map((i) => ({ ...i }));

const at = (d: DraftItem[], i: number, patch: Partial<DraftItem>) => d.map((x, j) => (j === i ? { ...x, ...patch } : x));

export const setQuantity = (d: DraftItem[], i: number, quantity: number) => at(d, i, { quantity: Math.max(1, Math.floor(quantity)) });
export const swapVariant = (d: DraftItem[], i: number, variantId: string) => at(d, i, { variantId });
export const removeItem = (d: DraftItem[], i: number) => at(d, i, { removed: true });
export const undoRemove = (d: DraftItem[], i: number) => at(d, i, { removed: false });
/** Mesmo produto e variante que já estão no rascunho não entram de novo: devolve o rascunho como veio. */
export const addItem = (d: DraftItem[], item: SavedItem): DraftItem[] =>
  d.some((x) => nameKey(x) === nameKey(item)) ? d : [...d, { ...item, isNew: true }];

export const activeItems = (d: DraftItem[]) => d.filter((x) => !x.removed);
/** O último item ativo não pode sair: a assinatura precisa de pelo menos 1 produto. */
export const isLastActive = (d: DraftItem[], i: number) => !d[i].removed && activeItems(d).length === 1;
/** Lista completa que vai ao servidor: sem os removidos e sem as marcas do rascunho. */
export const toPayload = (d: DraftItem[]): SavedItem[] =>
  activeItems(d).map(({ productId, variantId, quantity, kit }) => ({ productId, variantId, quantity, ...(kit ? { kit } : {}) }));

/** Assinatura dos itens escolhidos no kit, para comparar duas listas (a ordem não conta). */
const kitKey = (k?: KitSelection) => (k ? "#" + k.picks.map((p) => `${p.productVariantId}x${p.quantity}`).sort().join(",") : "");
const norm = (l: SavedItem[]) => l.map((i) => `${nameKey(i)}=${i.quantity}${kitKey(i.kit)}`).sort().join("|");
/** Há mudança em relação ao salvo? Trocar a variante e voltar para a original conta como sem mudança. */
export const isDirty = (saved: SavedItem[], d: DraftItem[]) => norm(saved) !== norm(toPayload(d));

/** Mensagem de erro do rascunho, ou null se pode salvar. */
export function validateDraft(d: DraftItem[]): string | null {
  const p = toPayload(d);
  if (p.length === 0) return "A assinatura precisa de pelo menos 1 produto.";
  if (p.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)) return "A quantidade mínima é 1.";
  if (new Set(p.map(nameKey)).size !== p.length) return "Há um produto repetido na lista.";
  return null;
}

/** Quantas alterações o cliente fez, contadas por produto: trocar a variante de um produto conta 1 (não remoção + adição). */
export function changeCount(saved: SavedItem[], d: DraftItem[]): number {
  const lines = (l: SavedItem[], id: string) => l.filter((i) => i.productId === id).map((i) => `${i.variantId}=${i.quantity}${kitKey(i.kit)}`).sort().join("|");
  const now = toPayload(d);
  const ids = new Set([...saved, ...now].map((i) => i.productId));
  let n = 0;
  for (const id of ids) if (lines(saved, id) !== lines(now, id)) n++;
  return n;
}
