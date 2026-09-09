// Monta carrinho a partir de um link: ?produtos=SKU:qtd,SKU:qtd  (SKUs do products.json).
// A Unbox usa productId/variantId, não SKU — então resolvemos o SKU → família (products.json) →
// produto comprável do catálogo (mesma família + peso mais próximo), como fazemos em combos/tamanhos.
import { getEnrichmentBySku, getEnrichmentByName, parseSize } from "./enrichment";
import { resolveProductPrice } from "./format";

export interface LinkCartItem { productId: string; productVariantId: string; price: number; quantity: number }

/** "320:2,60745:1" → [{sku:"320",qty:2},{sku:"60745",qty:1}] */
export function parseProdutosParam(param: string): { sku: string; qty: number }[] {
  return param
    .split(",")
    .map((p) => {
      const [sku, q] = p.split(":");
      return { sku: (sku ?? "").trim(), qty: Math.max(1, parseInt(q ?? "1", 10) || 1) };
    })
    .filter((x) => x.sku);
}

/** Resolve SKUs (products.json) para itens compráveis do catálogo. Ignora os que não casam. */
export function resolveSkusToItems(skuQtys: { sku: string; qty: number }[], catalogProducts: any[]): LinkCartItem[] {
  const byFamily = new Map<string, any[]>();
  for (const cp of catalogProducts) {
    if (!cp?.title) continue;
    const e = getEnrichmentByName(cp.title);
    if (!e) continue;
    const arr = byFamily.get(e.familyCode) ?? [];
    arr.push(cp);
    byFamily.set(e.familyCode, arr);
  }

  const out: LinkCartItem[] = [];
  for (const { sku, qty } of skuQtys) {
    const e = getEnrichmentBySku(sku);
    if (!e) continue;
    const fam = byFamily.get(e.familyCode);
    if (!fam || !fam.length) continue;
    const target = e.weight?.value ?? 0;
    // escolhe o produto da família com peso mais próximo do SKU pedido
    const pick = fam.reduce((best, cp) => {
      const w = parseSize(cp.title)?.value ?? 0;
      const bw = parseSize(best.title)?.value ?? 0;
      return Math.abs(w - target) < Math.abs(bw - target) ? cp : best;
    });
    const v0 = pick.variants?.[0];
    const rp = resolveProductPrice(pick);
    if (!v0?._id || rp.price == null) continue;
    out.push({ productId: pick.productId, productVariantId: v0._id, price: rp.price, quantity: qty });
  }
  return out;
}
