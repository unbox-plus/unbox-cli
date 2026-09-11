// CASCA do rodapé. Não desenha layout: busca os dados, escolhe a variante da receita
// (components/chrome/chrome-recipe.ts) e é dona do elemento <footer>.
//
// Três coisas ficam AQUI de propósito, fora do alcance das variantes:
//  1. o elemento <footer class="store-layout site-chrome"> — `.site-chrome` esconde o chrome
//     no checkout e a regra `footer.site-chrome` zera a margem em páginas full-bleed;
//  2. a barra inferior com <PoweredByUnbox /> — contrato da plataforma, verificado pelo
//     prebuild (scripts/check-unbox-brand.mjs procura essa tag NESTE arquivo). Mantendo o
//     selo na casca, nenhuma variante nova consegue derrubá-lo;
//  3. <LinksDoConteudo /> — o único caminho, navegando, até as páginas, os artigos e as
//     listagens que o lojista publicou. Na casca porque trocar a receita do chrome não pode
//     deixar dezenas de URLs órfãs de novo (o porquê está em components/paginas/links-do-conteudo.tsx).
//
// EDITOR: a casca é dona da SEÇÃO do editor. O rodapé vive no container "chrome" e é `fixed`, como
// o cabeçalho e a faixa: o lojista edita o conteúdo, mas o rodapé não sai do lugar nem se oculta.
// Toda variante herda o escopo `chrome.footer` daqui. A linha de direitos é texto de marca (o
// lojista muda o ano e a razão social); o "Powered by Unbox" é contratual: fora dos primitivos por
// regra (README do editor, §8) e fora do gate por `data-editor-ignore`.
//
// Pra mudar o rodapé desta loja: troque `footer` em components/chrome/chrome-recipe.ts.
import { getShopData } from "@/lib/queries";
import { mockupOr } from "@/lib/mockup";
import { PoweredByUnbox } from "@/components/powered-by-unbox";
import { LinksDoConteudo } from "@/components/paginas/links-do-conteudo";
import { FOOTERS, type ChromeData } from "@/components/chrome/registry";
import { chromeRecipe } from "@/components/chrome/chrome-recipe";
// Exports NOMEADOS: este arquivo é server component e não consegue usar `Editable.*`
// (o objeto vem de um módulo "use client" e chega como undefined).
import { EditableSection, EditableText } from "@/lib/editable";

export async function SiteFooter() {
  const shop = await mockupOr(getShopData(), null, "chrome/getShopData");
  const shopName = shop?.name ?? "Minha Loja";
  const data: ChromeData = { shopName, categories: [] };

  const Footer = FOOTERS[chromeRecipe.footer];

  return (
    <EditableSection id="footer" kind="rodape" container="chrome" fixed label="Rodapé">
      <footer className="store-layout site-chrome mt-12 bg-[var(--store-chrome-bg,#18181B)] text-[var(--store-chrome-text,#ffffff)]">
        <Footer data={data} />

        {/* as páginas do lojista: derivado, não editável (ver o cabeçalho) */}
        <LinksDoConteudo />

        {/* barra inferior — fixa em todas as variantes (contrato Unbox) */}
        <div className="border-t border-[var(--store-chrome-line,rgba(255,255,255,.1))]">
          <div className="mx-auto max-w-[var(--container-max,1240px)] px-6 py-[18px] text-xs text-[var(--store-chrome-muted)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <EditableText
                path="direitos"
                fallback={`© ${new Date().getFullYear()} ${shopName}. Todos os direitos reservados.`}
                label="Linha de direitos autorais"
              />
              {/* TODO: adicionar CNPJ e endereço da empresa */}
              {/* obrigatório (contrato Unbox) — o build falha sem isso, não remova */}
              <span data-editor-ignore="" style={{ display: "contents" }}>
                <PoweredByUnbox className="text-[var(--store-chrome-muted)]" />
              </span>
            </div>
          </div>
        </div>
      </footer>
    </EditableSection>
  );
}
