"use client";

// Home = renderer da RECEITA (components/home/home-recipe.ts): mapeia cada entrada da
// receita pro componente registrado em sections/registry.ts. Pra mudar o layout da home
// (ordem, variantes, props), edite a RECEITA — não este arquivo nem o JSX das seções.
import { homeRecipe } from "@/components/home/home-recipe";
import { SECTIONS, withIds, type HomeData } from "@/components/home/sections/registry";
import { catalogoDaHome } from "@/components/home/sections/catalogo";
import { Editable } from "@/lib/editable";
import type { CatalogProductItem, CatalogCategory } from "@/components/catalog/catalog-client";
import type { ResolvedCombo } from "@/lib/enrichment/combos";
// só o TIPO (lib/vitrine.ts é `server-only`; `import type` some na compilação)
import type { VitrinesResolvidas } from "@/lib/vitrine";

export function CombosHome({
  combos,
  featured,
  bundles = [],
  categories = [],
  combosTitle,
  freeShipLabel,
  vitrines,
  layoutEditavel = true,
}: {
  combos: CatalogProductItem[];
  featured: CatalogProductItem | null;
  bundles?: ResolvedCombo[];
  categories?: CatalogCategory[];
  combosTitle: string;
  freeShipLabel: string | null;
  /**
   * Vitrines que o SERVIDOR já resolveu, por caminho. Omitido = nenhuma escolha do lojista valeu
   * (ou a página nem leu o documento): toda vitrine mostra os produtos do código.
   */
  vitrines?: VitrinesResolvidas;
  /** `false` em página que REAPROVEITA a receita: a copy editada vale, a ordem da home não manda ali. */
  layoutEditavel?: boolean;
}) {
  const data: HomeData = { combos, featured, bundles, categories, combosTitle, freeShipLabel, vitrines };
  return (
    <div className="store-layout full-bleed bg-white text-[var(--store-ink)]">
      {/* O título do hero é o h1 da home. Sem hero na receita, um h1 invisível com o nome da loja. */}
      {!homeRecipe.some((e) => e.section === "hero") && <h1 className="sr-only">{process.env.NEXT_PUBLIC_SITE_NAME ?? "Loja"}</h1>}
      {/* EDITOR: cada entrada da receita vira seção com id estável (withIds: o que a receita declara,
          senão IDENTIDADE_PADRAO do registry); o container aplica a ordem e as ocultas que o lojista
          publicou. Sem documento, renderiza a receita na ordem do código.
          `catalogo` = os tipos que ESTA loja sabe instanciar quando o lojista clica em "adicionar
          seção" (components/home/sections/catalogo.ts). É o único lugar onde essa lista existe: o
          editor não tem catálogo próprio. Não precisa de guarda por `layoutEditavel`: o próprio
          container ignora catálogo e seções criadas quando `layout` é false (uma página que reusa
          este container só para reaproveitar componentes não pode ganhar seção nova). */}
      <Editable.Sections container="home" layout={layoutEditavel} catalogo={catalogoDaHome(data)}>
        {withIds(homeRecipe).map((entry) => {
          const Section = SECTIONS[entry.section];
          return (
            <Editable.Section key={entry.id} id={entry.id} kind={entry.kind} label={entry.label}>
              <Section data={data} variant={entry.variant} sectionProps={entry.props} />
            </Editable.Section>
          );
        })}
      </Editable.Sections>
    </div>
  );
}
