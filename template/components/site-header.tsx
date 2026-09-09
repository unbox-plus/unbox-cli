// CASCA do header. Não desenha layout: busca os dados, escolhe a variante da receita
// (components/chrome/chrome-recipe.ts) e é dona do elemento <header>.
//
// Por que a casca é dona do <header>: as classes `store-layout site-chrome` são contrato —
// `.site-chrome` é o que esconde o chrome no checkout (app/globals.css). Se cada variante
// renderizasse o próprio wrapper, uma variante nova que esquecesse a classe faria o header
// da loja aparecer no checkout, sem erro de build. Aqui isso é impossível.
//
// EDITOR: a casca também é dona da SEÇÃO do editor. O cabeçalho vive no container "chrome" e é
// `fixed`: o lojista edita o conteúdo (logo), mas não tira o cabeçalho do lugar nem o oculta. Toda
// variante herda o escopo `chrome.header` daqui, então trocar de variante na receita não muda o
// caminho do logo (`chrome.header.logo`) que o lojista já editou.
//
// Pra mudar o header desta loja: troque `header` em components/chrome/chrome-recipe.ts.
// Variante nova: arquivo em components/chrome/headers/ + registry + agents/PADROES.md.
import { getShopData, getTopTags } from "@/lib/queries";
import { MiniCart } from "@/components/cart/mini-cart";
import type { NavCategory } from "@/components/mobile-nav";
import { AnnounceBar } from "@/components/chrome/announce-bar";
import { HEADERS, HEADER_SHELL, type ChromeData } from "@/components/chrome/registry";
import { chromeRecipe } from "@/components/chrome/chrome-recipe";
import { mockupOr } from "@/lib/mockup";
// Exports NOMEADOS: este arquivo é server component e não consegue usar `Editable.*`
// (o objeto vem de um módulo "use client" e chega como undefined).
import { EditableSection } from "@/lib/editable";

export async function SiteHeader() {
  const [shop, tags] = await Promise.all([mockupOr(getShopData(), null, "chrome/getShopData"), mockupOr(getTopTags(), [], "chrome/getTopTags")]);
  const categories: NavCategory[] = (tags ?? [])
    .filter((t: any) => t.isVisible !== false)
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    .map((t: any) => ({ id: t._id, name: t.displayTitle || t.name, slug: t.slug }));
  const shopName = shop?.name ?? "Minha Loja";
  const data: ChromeData = { shopName, categories };

  const Header = HEADERS[chromeRecipe.header];
  const modo = HEADER_SHELL[chromeRecipe.header];

  // No modo sobreposto a PINTURA é da variante (.chrome-bar) + das regras de globals.css:
  // a casca só posiciona. No sólido, a casca pinta como sempre.
  const base = "store-layout site-chrome sticky top-0 z-50";
  const skin =
    modo === "solido"
      ? " border-b border-[var(--store-line)] bg-[var(--store-surface,#ffffff)] shadow-[0_1px_0_rgba(0,0,0,.02)]"
      : "";

  return (
    <>
      {/* No modo sobreposto o header flutua sobre o hero — uma barra sólida acima quebraria o efeito. */}
      {modo === "solido" && <AnnounceBar />}

      {/* header fixo — é filho direto do body, então gruda na página inteira.
          data-chrome: as regras do modo sobreposto em globals.css exigem que a variante
          escolhida CONCORDE (senão um header claro ficaria transparente sobre a foto). */}
      <EditableSection id="header" kind="cabecalho" container="chrome" fixed label="Cabeçalho">
        <header data-chrome={chromeRecipe.header} className={base + skin}>
          <Header data={data} />
        </header>
      </EditableSection>

      <MiniCart />
    </>
  );
}
