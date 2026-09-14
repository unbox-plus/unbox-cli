// Mapeia o catálogo cru da Unbox para os itens do catálogo da loja (client-side filtering).
import { resolveProductPrice, parseBRL } from "@/lib/format";
import type { CatalogProductItem, CatalogCategory } from "@/components/catalog/catalog-client";

export function buildTagMap(tags: any[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of tags ?? []) if (t?.isVisible !== false) m.set(t._id, t.displayTitle || t.name);
  return m;
}

export function buildCategories(tags: any[]): CatalogCategory[] {
  return (tags ?? [])
    .filter((t: any) => t?.isVisible !== false)
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    .map((t: any): CatalogCategory => ({ name: t.displayTitle || t.name, slug: t.slug }));
}

/**
 * Os itens do catálogo que as VITRINES do documento citam, para o card resolver o produto contra o
 * CATÁLOGO e não contra `combos`.
 *
 * `combos` é recorte editorial (kits, senão ofertas, senão os 8 primeiros, cortado em 10). Um produto
 * escolhido na vitrine e fora desse recorte virava card sem variante e sem preço antigo: sem botão de
 * comprar, com estoque no painel. A disponibilidade exibida ficava amarrada a estar em promoção.
 *
 * Só os citados, e não o catálogo inteiro: a home é componente de cliente, e cem produtos a mais
 * viajariam no HTML de toda visita.
 */
export function catalogoDasVitrines(items: CatalogProductItem[], vitrines: Record<string, { id: string; slug: string }[]> | undefined): CatalogProductItem[] {
  const citados = new Set<string>();
  for (const lista of Object.values(vitrines ?? {})) for (const p of lista) { citados.add(p.id); citados.add(p.slug); }
  if (!citados.size) return [];
  return items.filter((it) => (it.productId && citados.has(it.productId)) || citados.has(it.slug));
}

export function mapCatalogItems(nodes: any[], tagMap: Map<string, string>): CatalogProductItem[] {
  return (nodes ?? [])
    .map((n: any) => n.product ?? n)
    .filter((p: any) => p?.slug)
    .map((p: any): CatalogProductItem => {
      const v0 = p.variants?.[0];
      const rp = resolveProductPrice(p);
      const price = v0?.pricing?.[0]?.price ?? rp.price ?? 0;
      const displayOld = v0?.pricing?.[0]?.compareAtPrice?.displayAmount ?? rp.compareAt ?? null;
      const oldPrice = parseBRL(displayOld);
      const hasOld = oldPrice != null && oldPrice > price;
      const offPct = hasOld && oldPrice ? Math.round((1 - price / oldPrice) * 100) : null;
      const categories = ((p.tagIds ?? []) as string[]).map((id) => tagMap.get(id)).filter(Boolean) as string[];
      return {
        slug: p.slug,
        title: p.title,
        weight: v0?.title ?? "",
        categories,
        price,
        displayPrice: rp.displayPrice,
        oldPrice: hasOld ? oldPrice : null,
        displayOld: hasOld ? displayOld : null,
        offPct,
        imageUrl: p.imageUrls?.[0] ?? null,
        productId: p.productId,
        variantId: v0?._id ?? null,
        badge: p.isSoldOut
          ? { label: "ESGOTADO", bg: "var(--store-surface-2)", fg: "var(--store-muted)" }
          : hasOld
            ? { label: "OFERTA", bg: "var(--store-sale-soft)", fg: "var(--store-sale)" }
            : p.isLowQuantity
              ? { label: "ÚLTIMAS", bg: "var(--store-cta-soft)", fg: "var(--store-cta-dark)" }
              : null,
        soldOut: !!p.isSoldOut,
      };
    });
}
