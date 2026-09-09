import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalog, getTopTags } from "@/lib/queries";
import { buildTagMap, buildCategories, mapCatalogItems } from "@/lib/catalog-map";
import { CatalogClient } from "@/components/catalog/catalog-client";
import { mockupOr } from "@/lib/mockup";
import { DataLayerReady } from "@/components/analytics/data-layer-ready";

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
  // EDITOR: a categoria REAPROVEITA o container "catalogo" de /produtos (mesma faixa de confiança, mesmo
  // cabeçalho de kits, mesmo aviso de lista vazia) sem mandar na ordem dele: `layout={false}` faz o
  // manifesto desta página sair com `semLayout`, e o painel explica que a ordem se edita em /produtos.
  return (
    <>
    <DataLayerReady pageType="category" products={itens.slice(0, 12).map((i) => ({ id: i.productId, name: i.title, price: i.price }))} />
    <CatalogClient
      items={itens}
      categories={buildCategories(tags as any[])}
      initialCategory={tag.displayTitle || tag.name}
      layout={false}
    />
    </>
  );
}
