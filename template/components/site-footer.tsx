// CASCA do rodapé. Não desenha layout: busca os dados, escolhe a variante da receita
// (components/chrome/chrome-recipe.ts) e é dona do elemento <footer>.
//
// Duas coisas ficam AQUI de propósito, fora do alcance das variantes:
//  1. o elemento <footer class="store-layout site-chrome"> — `.site-chrome` esconde o chrome
//     no checkout e a regra `footer.site-chrome` zera a margem em páginas full-bleed;
//  2. a barra inferior com <PoweredByUnbox /> — contrato da plataforma, verificado pelo
//     prebuild (scripts/check-unbox-brand.mjs procura essa tag NESTE arquivo). Mantendo o
//     selo na casca, nenhuma variante nova consegue derrubá-lo.
//
// Pra mudar o rodapé desta loja: troque `footer` em components/chrome/chrome-recipe.ts.
import { getShopData } from "@/lib/queries";
import { mockupOr } from "@/lib/mockup";
import { PoweredByUnbox } from "@/components/powered-by-unbox";
import { FOOTERS, type ChromeData } from "@/components/chrome/registry";
import { chromeRecipe } from "@/components/chrome/chrome-recipe";

export async function SiteFooter() {
  const shop = await mockupOr(getShopData(), null, "chrome/getShopData");
  const shopName = shop?.name ?? "Minha Loja";
  const data: ChromeData = { shopName, categories: [] };

  const Footer = FOOTERS[chromeRecipe.footer];

  return (
    <footer className="store-layout site-chrome mt-12 bg-[var(--store-chrome-bg,#18181B)] text-[var(--store-chrome-text,#ffffff)]">
      <Footer data={data} />

      {/* barra inferior — fixa em todas as variantes (contrato Unbox) */}
      <div className="border-t border-[var(--store-chrome-line,rgba(255,255,255,.1))]">
        <div className="mx-auto max-w-[var(--container-max,1240px)] px-6 py-[18px] text-xs text-[var(--store-chrome-muted)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>© {new Date().getFullYear()} {shopName}. Todos os direitos reservados.</span>
            {/* TODO: adicionar CNPJ e endereço da empresa */}
            {/* obrigatório (contrato Unbox) — o build falha sem isso, não remova */}
            <PoweredByUnbox className="text-[var(--store-chrome-muted)]" />
          </div>
        </div>
      </div>
    </footer>
  );
}
