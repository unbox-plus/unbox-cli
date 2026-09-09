// Landing de OFERTA — mesma seção purchase-hero usada na home (componente do registry),
// com a pilha de convencimento por receita (components/landing/landing-recipe.ts) abaixo.
// A página existe como deep-link de campanha; nas receitas dos presets o hero de compra
// pode entrar DIRETO na home (âncora #comprar), que é o padrão das lojas de produção.
import type { Metadata } from "next";
import { getCatalog, getTopTags } from "@/lib/queries";
import { buildTagMap, buildCategories, mapCatalogItems } from "@/lib/catalog-map";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/store-config";
import { resolveCombos } from "@/lib/enrichment/combos";
import { landingRecipe } from "@/components/landing/landing-recipe";
import { SECTIONS, type HomeData } from "@/components/home/sections/registry";
import { PurchaseHeroSection } from "@/components/home/sections/purchase-hero";
import { mockupOr } from "@/lib/mockup";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Oferta especial",
  description: "Leve mais, aproveite mais. Monte seu pedido com condições especiais.",
  alternates: { canonical: "/oferta" },
};

const isCombo = (s: string) => /kit|combo/i.test(s);

export default async function OfertaPage() {
  const [catalog, tags] = await Promise.all([
    mockupOr(getCatalog({ first: 100 }), { nodes: [] as any[] }, "oferta/getCatalog"),
    mockupOr(getTopTags(), [], "oferta/getTopTags"),
  ]);
  const tagMap = buildTagMap(tags as any[]);
  const items = mapCatalogItems(catalog.nodes ?? [], tagMap);

  let combos = items.filter((it) => it.categories.some(isCombo));
  if (combos.length < 2) {
    const deals = items.filter((it) => it.oldPrice != null);
    combos = deals.length >= 2 ? deals : items.slice(0, 8);
  }
  combos = combos.slice(0, 10);

  const data: HomeData = {
    combos,
    featured: combos[0] ?? items[0] ?? null,
    bundles: resolveCombos((catalog.nodes ?? []).map((n: any) => n.product ?? n)),
    categories: buildCategories(tags as any[]),
    combosTitle: "Destaques",
    freeShipLabel: FREE_SHIPPING_THRESHOLD != null ? `R$${FREE_SHIPPING_THRESHOLD}` : null,
  };

  return (
    <div className="store-layout full-bleed bg-white text-[var(--store-ink)]">
      <h1 className="sr-only">Oferta especial</h1>
      <PurchaseHeroSection data={data} />
      {landingRecipe.map((entry, i) => {
        const Section = SECTIONS[entry.section];
        return <Section key={`${entry.section}-${i}`} data={data} variant={entry.variant} sectionProps={entry.props} />;
      })}
      <div className="pb-14" />
    </div>
  );
}
