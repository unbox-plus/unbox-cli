// EDITOR: a pilha de seções da landing /oferta dentro do container PRÓPRIO dela ("oferta").
//
// São os mesmos componentes da home, com copy desta página de propósito (é uma campanha). Renderizadas
// SOLTAS, como app/(loja)/oferta/page.tsx fazia, as seções aparecem na tela mas nada dentro delas é
// editável: os caminhos cairiam na raiz do documento (foundation 11: a raiz não se grava), e o gate
// reprova a página por `semContainer`. `withIds` dá a cada entrada da receita a mesma identidade
// estável que a home usa (IDENTIDADE_PADRAO do registry).
//
// Uso na página (server component; este arquivo também é, por isso as exportações NOMEADAS):
//
//   <div className="store-layout full-bleed bg-white text-[var(--store-ink)]">
//     <h1 className="sr-only">Oferta especial</h1>
//     <OfertaSections data={data} />
//     <div className="pb-14" />
//   </div>
//
// A rota tem de estar em CONTAINERS_POR_ROTA (lib/rotas-editaveis.ts) como `"/oferta": ["oferta"]`:
// é o que o editor lê para saber em que página cada seção aparece, e o que o gate confere.
import { landingRecipe } from "@/components/landing/landing-recipe";
import { SECTIONS, withIds, type HomeData } from "@/components/home/sections/registry";
import { PurchaseHeroSection } from "@/components/home/sections/purchase-hero";
import { EditableSection, EditableSections } from "@/lib/editable";

export function OfertaSections({ data }: { data: HomeData }) {
  return (
    <EditableSections container="oferta">
      <EditableSection id="compra" kind="produto-em-destaque" label="Bloco de compra">
        <PurchaseHeroSection data={data} />
      </EditableSection>
      {withIds(landingRecipe).map((entry) => {
        const Section = SECTIONS[entry.section];
        return (
          <EditableSection key={entry.id} id={entry.id} kind={entry.kind} label={entry.label}>
            <Section data={data} variant={entry.variant} sectionProps={entry.props} />
          </EditableSection>
        );
      })}
    </EditableSections>
  );
}
