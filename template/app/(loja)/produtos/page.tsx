import type { Metadata } from "next";
import { getPublishedContent } from "@/lib/editable/server";
import { metadadosDaRotaDoCodigo } from "@/lib/seo-das-rotas";
import { getCatalog, getTopTags } from "@/lib/queries";
import { buildTagMap, buildCategories, mapCatalogItems } from "@/lib/catalog-map";
import { resolveCombos } from "@/lib/enrichment/combos";
import { CatalogClient } from "@/components/catalog/catalog-client";
import { mockupOr } from "@/lib/mockup";
import { DataLayerReady } from "@/components/analytics/data-layer-ready";
import { dadosSeHouverSecoes } from "@/lib/paginas-dados";

export const revalidate = 300;
// Título "Catálogo" e a canônica; o lojista pode reescrever título, descrição e imagem no editor.
export async function generateMetadata(): Promise<Metadata> {
  return metadadosDaRotaDoCodigo(await getPublishedContent(), "/produtos");
}

export default async function ProdutosPage() {
  // Catálogo completo (a loja tem dezenas de produtos) — filtragem/ordenação/paginação é client-side.
  const [catalog, tags] = await Promise.all([
    mockupOr(getCatalog({ first: 100 }), { nodes: [] as any[] }, "produtos/getCatalog"),
    mockupOr(getTopTags(), [], "produtos/getTopTags"),
  ]);
  const tagMap = buildTagMap(tags as any[]);
  const bundles = resolveCombos((catalog.nodes ?? []).map((n: any) => n.product ?? n));
  const itens = mapCatalogItems(catalog.nodes ?? [], tagMap);
  // o que as seções que o lojista ADICIONAR ao catálogo mostram (foundation 18): /produtos é a dona do container
  const secoes = await dadosSeHouverSecoes(await getPublishedContent(), "catalogo");
  // EDITOR: /produtos é a dona do container "catalogo" (layout padrão: manda na ordem, oculta e copia
  // seções); /categoria/[tagSlug] reaproveita a mesma copy com layout={false}.
  return (
    <>
    <DataLayerReady pageType="category" products={itens.slice(0, 12).map((i) => ({ id: i.productId, name: i.title, price: i.price }))} />
    <CatalogClient
      items={itens}
      categories={buildCategories(tags as any[])}
      bundles={bundles}
      secoes={secoes}
    />
    </>
  );
}
