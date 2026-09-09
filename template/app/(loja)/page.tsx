import type { Metadata } from "next";
import { getCatalog, getTopTags } from "@/lib/queries";
import { buildTagMap, buildCategories, mapCatalogItems } from "@/lib/catalog-map";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/store-config";
import { resolveCombos } from "@/lib/enrichment/combos";
import { CombosHome } from "@/components/home/combos-home";
import { mockupOr } from "@/lib/mockup";
import { DataLayerReady } from "@/components/analytics/data-layer-ready";
import { ldJson } from "@/lib/json-ld";

// Canonical por página: o layout raiz não declara (seria herdado por todas as rotas).
export const metadata: Metadata = { alternates: { canonical: "/" } };

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
// Mesmo literal do app/layout.tsx: o create-unbox-store reescreve "Minha Loja" com o nome real.
const SITE_NAME = "Minha Loja";

export const revalidate = 300; // ISR — catálogo público e estável

const isCombo = (s: string) => /kit|combo/i.test(s);

export default async function HomePage() {
  const [catalog, tags] = await Promise.all([
    mockupOr(getCatalog({ first: 100 }), { nodes: [] as any[] }, "home/getCatalog"),
    mockupOr(getTopTags(), [], "home/getTopTags"),
  ]);
  const tagMap = buildTagMap(tags as any[]);
  const items = mapCatalogItems(catalog.nodes ?? [], tagMap);

  // Combos reais: categoria "Kits & Combos" → senão produtos em oferta (compareAtPrice) → senão destaques.
  let combos = items.filter((it) => it.categories.some(isCombo));
  let title = "Nossos Combos em Destaque";
  if (combos.length < 2) {
    const deals = items.filter((it) => it.oldPrice != null);
    if (deals.length >= 2) { combos = deals; title = "Ofertas em destaque"; }
    else { combos = items.slice(0, 8); title = "Destaques"; }
  }
  combos = combos.slice(0, 10);
  const featured = combos[0] ?? items[0] ?? null;

  // Kits temáticos (combos de linha, edição de data…) montados a partir do products.json.
  const bundles = resolveCombos((catalog.nodes ?? []).map((n: any) => n.product ?? n));

  // Organization + WebSite: dá à marca uma entidade citável (busca e resposta de IA) e liga a
  // busca interna ao Google (SearchAction). Só fatos deriváveis: nome, URL, logo, busca.
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "Organization", name: SITE_NAME, url: siteUrl, logo: `${siteUrl}/brand/logo.svg` },
    {
      "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: siteUrl,
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/busca?q={search_term_string}` }, "query-input": "required name=search_term_string" },
    },
  ];

  return (
    <>
    {/* dataLayerReady: é o ÚNICO gatilho de tipo de página do container central (medido: ele não
        tem gatilho de `page_view`). Sem isto, a home fica invisível pro remarketing do Ads. */}
    <DataLayerReady pageType="home" products={combos.slice(0, 6).map((c) => ({ id: c.productId, name: c.title, price: c.price }))} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(jsonLd) }} />
    <CombosHome
      combos={combos}
      featured={featured}
      bundles={bundles}
      categories={buildCategories(tags as any[])}
      combosTitle={title}
      freeShipLabel={FREE_SHIPPING_THRESHOLD != null ? `R$${FREE_SHIPPING_THRESHOLD}` : null}
    />
    </>
  );
}
