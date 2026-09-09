"use client";

// Home = renderer da RECEITA (components/home/home-recipe.ts): mapeia cada entrada da
// receita pro componente registrado em sections/registry.ts. Pra mudar o layout da home
// (ordem, variantes, props), edite a RECEITA — não este arquivo nem o JSX das seções.
import { homeRecipe } from "@/components/home/home-recipe";
import { SECTIONS, type HomeData } from "@/components/home/sections/registry";
import type { CatalogProductItem, CatalogCategory } from "@/components/catalog/catalog-client";
import type { ResolvedCombo } from "@/lib/enrichment/combos";

export function CombosHome({
  combos,
  featured,
  bundles = [],
  categories = [],
  combosTitle,
  freeShipLabel,
}: {
  combos: CatalogProductItem[];
  featured: CatalogProductItem | null;
  bundles?: ResolvedCombo[];
  categories?: CatalogCategory[];
  combosTitle: string;
  freeShipLabel: string | null;
}) {
  const data: HomeData = { combos, featured, bundles, categories, combosTitle, freeShipLabel };
  return (
    <div className="store-layout full-bleed bg-white text-[var(--store-ink)]">
      {/* O título do hero é o h1 da home. Sem hero na receita, um h1 invisível com o nome da loja. */}
      {!homeRecipe.some((e) => e.section === "hero") && <h1 className="sr-only">{process.env.NEXT_PUBLIC_SITE_NAME ?? "Loja"}</h1>}
      {homeRecipe.map((entry, i) => {
        const Section = SECTIONS[entry.section];
        return <Section key={`${entry.section}-${i}`} data={data} variant={entry.variant} sectionProps={entry.props} />;
      })}
    </div>
  );
}
