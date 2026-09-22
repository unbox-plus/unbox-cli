import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalog, getTopTags } from "@/lib/queries";
import { buildTagMap, buildCategories, mapCatalogItems } from "@/lib/catalog-map";
import { CatalogClient } from "@/components/catalog/catalog-client";
import { mockupOr } from "@/lib/mockup";
import { DataLayerReady } from "@/components/analytics/data-layer-ready";
import { getPublishedContent } from "@/lib/editable/server";
import { dadosSeHouverSecoes } from "@/lib/paginas-dados";

export const revalidate = 300;

async function findTag(slug: string, tags: any[]) {
  const decoded = decodeURIComponent(slug);
  return (tags as any[]).find((t) => t.slug === decoded);
}

export async function generateMetadata({ params }: { params: Promise<{ tagSlug: string }> }): Promise<Metadata> {
  const { tagSlug } = await params;
  const tags = await mockupOr(getTopTags(), [], "categoria/getTopTags");
  const tag = await findTag(tagSlug, tags as any[]);
  if (!tag) return { title: "Categoria" };
  return { title: tag.displayTitle || tag.name, description: tag.description ?? undefined, alternates: { canonical: `/categoria/${encodeURIComponent(tag.slug)}` } };
}

export default async function CategoryPage({ params }: { params: Promise<{ tagSlug: string }> }) {
  const { tagSlug } = await params;
  const [catalog, tags] = await Promise.all([
    mockupOr(getCatalog({ first: 100 }), ({ nodes: [] as any[] }), "categoria/getCatalog"),
    mockupOr(getTopTags(), [], "categoria/getTopTags"),
  ]);
  const tag = await findTag(tagSlug, tags as any[]);
  if (!tag) notFound();

  const tagMap = buildTagMap(tags as any[]);
  const itens = mapCatalogItems(catalog.nodes ?? [], tagMap);
  // EDITOR: a categoria ESPELHA o container "catalogo" de /produtos (é a mesma página com um filtro): a mesma
  // ordem, as mesmas ocultas e as mesmas seções que o lojista adicionou lá (foundation 18), sem mandar em nada
  // disso. `layout="espelho"` faz o manifesto desta página sair com `semLayout`, e o painel explica que a lista se
  // edita em /produtos. Os dados das seções adicionadas só viajam no HTML quando há alguma.
  const secoes = await dadosSeHouverSecoes(await getPublishedContent(), "catalogo");
  return (
    <>
    <DataLayerReady pageType="category" products={itens.slice(0, 12).map((i) => ({ id: i.productId, name: i.title, price: i.price }))} />
    <CatalogClient
      items={itens}
      categories={buildCategories(tags as any[])}
      initialCategory={tag.displayTitle || tag.name}
      layout="espelho"
      secoes={secoes}
    />
    </>
  );
}
