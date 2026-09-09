import type { MetadataRoute } from "next";
import { loadAllCatalogItems } from "@/lib/dataloader";
import { getTopTags } from "@/lib/queries";

export const revalidate = 3600;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/produtos`, changeFrequency: "daily", priority: 0.9 },
  ];

  // produtos (paginado por offset até hasNextPage===false; só os visíveis — doc 10)
  let products: MetadataRoute.Sitemap = [];
  try {
    const items = await loadAllCatalogItems();
    products = items
      .map((n: any) => n.product)
      .filter((p: any) => p && p.isVisible !== false && p.slug)
      .map((p: any) => ({
        url: `${siteUrl}/produto/${encodeURIComponent(p.slug)}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
  } catch {
    /* falha de rede não deve quebrar o sitemap inteiro */
  }

  let categories: MetadataRoute.Sitemap = [];
  try {
    const tags = await getTopTags();
    categories = (tags as any[])
      .filter((t) => t.isVisible !== false && t.slug)
      .map((t) => ({ url: `${siteUrl}/categoria/${encodeURIComponent(t.slug)}`, changeFrequency: "weekly" as const, priority: 0.6 }));
  } catch {
    /* idem */
  }

  return [...base, ...categories, ...products];
}
