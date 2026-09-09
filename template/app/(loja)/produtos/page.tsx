import type { Metadata } from "next";
import { getCatalog, getTopTags } from "@/lib/queries";
import { buildTagMap, buildCategories, mapCatalogItems } from "@/lib/catalog-map";
import { resolveCombos } from "@/lib/enrichment/combos";
import { CatalogClient } from "@/components/catalog/catalog-client";
import { mockupOr } from "@/lib/mockup";
import { DataLayerReady } from "@/components/analytics/data-layer-ready";

export const revalidate = 300;
export const metadata: Metadata = { title: "Catálogo", alternates: { canonical: "/produtos" } };

export default async function ProdutosPage() {
  // Catálogo completo (a loja tem dezenas de produtos) — filtragem/ordenação/paginação é client-side.
  const [catalog, tags] = await Promise.all([
    mockupOr(getCatalog({ first: 100 }), { nodes: [] as any[] }, "produtos/getCatalog"),
    mockupOr(getTopTags(), [], "produtos/getTopTags"),
  ]);
  const tagMap = buildTagMap(tags as any[]);
  const bundles = resolveCombos((catalog.nodes ?? []).map((n: any) => n.product ?? n));
  const itens = mapCatalogItems(catalog.nodes ?? [], tagMap);
  return (
    <>
    <DataLayerReady pageType="category" products={itens.slice(0, 12).map((i) => ({ id: i.productId, name: i.title, price: i.price }))} />
    <CatalogClient
      items={itens}
      categories={buildCategories(tags as any[])}
      bundles={bundles}
    />
    </>
  );
}
