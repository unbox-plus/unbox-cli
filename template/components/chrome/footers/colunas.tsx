// RODAPÉ "colunas" — trust strip + 4 colunas (marca, catálogo, ajuda, pagamento).
// É o rodapé de loja completa: cobre navegação secundária e reforço de confiança.
//
// A barra inferior (© + selo Powered by Unbox) NÃO está aqui: ela é da casca
// (components/site-footer.tsx), porque é contrato da plataforma e não pode variar.
//
// EDITOR: o escopo (`chrome.footer`) vem da casca. Os selos são uma LISTA editável (`selo-N`, com
// ícone e texto: o lojista troca, reordena, oculta e duplica). Dois tipos de link nas colunas, pela
// regra §8 do README do editor. LINK DE MARCA (tem `chave`): o rótulo é uma frase da marca e o
// lojista o batiza ("Todos os produtos", "Kits & Combos"): rótulo e destino editáveis em
// `<coluna>.<chave>`. LINK DE INTERFACE (sem `chave`): nomeia uma mecânica da loja ou uma página
// legal ("Buscar", "Minha conta", "Termos"): fica no código. O título de cada coluna é editável.
import Link from "next/link";
import { Truck, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { PaymentChips } from "@/components/product/pdp/payment-chips";
// Exports NOMEADOS: server component (ver components/site-footer.tsx).
import { EditableIcon, EditableImg, EditableLink, EditableSection, EditableSections, EditableText } from "@/lib/editable";
import type { ChromeVariantProps } from "../registry";

// Âncoras de confiança: só o que a foundation PODE afirmar (SSL e o prazo do CDC). Prazo de
// entrega, garantia e atendimento são promessas do lojista: entram pelo briefing, com lastro.
const TRUST = [
  { icon: ShieldCheck, text: "Compra segura (SSL)" },
  { icon: Truck, text: "Troca em 7 dias · CDC" },
];

export function FooterColunas({ data }: ChromeVariantProps) {
  const { shopName } = data;

  return (
    <>
      {/* trust — lista editável: o invólucro do item é display:contents, então quem continua
          sendo a célula do grid é o próprio <div> do selo */}
      <div className="mx-auto grid max-w-[var(--container-max,1240px)] grid-cols-2 gap-x-6 border-b border-[var(--store-chrome-line,rgba(255,255,255,.1))] px-6 py-8 ">
        <EditableSections nested>
          {TRUST.map((t, i) => (
            <EditableSection key={t.text} item id={`selo-${i + 1}`} label={`Selo de confiança ${i + 1}`}>
              <div className="flex items-center gap-3.5 py-1.5">
                {/* a className fica no ícone (é ela que dá o tamanho e a cor); o `size` é o
                    tamanho da imagem que o lojista subir no lugar */}
                <EditableIcon path="icone" label="Ícone do selo" size={28} className="text-[28px] text-[var(--store-cta,#D97706)]">
                  <t.icon />
                </EditableIcon>
                <EditableText as="div" path="texto" fallback={t.text} label="Texto do selo" className="text-[13px] leading-snug text-[var(--store-chrome-muted)]" />
              </div>
            </EditableSection>
          ))}
        </EditableSections>
      </div>

      {/* colunas */}
      <div className="mx-auto grid max-w-[var(--container-max,1240px)] gap-8 px-6 py-9 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          {/* logo-chrome.svg = versão do logo legível sobre o chrome (o CLI troca conforme o
              estilo: chrome escuro usa o logo branco, chrome claro usa o logo normal).
              <img> puro (EditableImg), não next/image: SVG de poucos KB em toda página. */}
          <EditableImg path="logo" fallback={{ src: "/brand/logo-chrome.svg", alt: shopName }} label="Logo do rodapé" className="mb-3.5 h-16 w-auto" />
          {/* TODO: tagline da marca (EditableText path="frase", como a loja piloto) */}
        </div>
        <FooterCol path="coluna-catalogo" title="Catálogo" links={[
          { chave: "todos", label: "Todos os produtos", href: "/produtos" },
          { label: "Buscar", href: "/busca" },
          { chave: "combos", label: "Kits & Combos", href: "/produtos" },
          { chave: "ofertas", label: "Ofertas", href: "/produtos" },
        ]} />
        <FooterCol path="coluna-ajuda" title="Ajuda" links={[
          { label: "Acompanhar pedido", href: "/conta/entrar" },
          { label: "Trocas e devoluções", href: "/devolucoes" },
          { label: "Termos", href: "/termos" },
          { label: "Minha conta", href: "/conta" },
        ]} />
        <div>
          <EditableText as="div" path="pagamento.titulo" fallback="Pague com" label="Título das formas de pagamento" className="font-display mb-3 text-sm font-bold" />
          {/* As bandeiras são selo de terceiro (interface de pagamento), não imagem da marca: não viram
              primitivo. O `data-editor-ignore` mora no próprio componente (payment-chips.tsx). */}
          <PaymentChips />
        </div>
      </div>
    </>
  );
}

type LinkDoRodape = {
  /** caminho do link no editor (`<coluna>.<chave>`); sem ele o link é de interface e fica no código */
  chave?: string;
  label: string;
  href: string;
};

const CLASSE_LINK = "no-underline hover:text-[var(--store-chrome-text,#ffffff)]";

/** `path` = prefixo dos caminhos no editor; o título da coluna e os links de marca (com `chave`) são editáveis. */
function FooterCol({ path, title, links }: { path: string; title: string; links: LinkDoRodape[] }) {
  return (
    <div>
      <EditableText as="div" path={`${path}.titulo`} fallback={title} label={`Título da coluna: ${title}`} className="font-display mb-3 text-sm font-bold" />
      <div className="flex flex-col gap-2.5 text-[13px] text-[var(--store-chrome-muted)]">
        {links.map((l) =>
          l.chave ? (
            <EditableLink key={l.label} path={`${path}.${l.chave}`} fallback={{ href: l.href, label: l.label }} label={`Link: ${l.label}`} className={CLASSE_LINK}>
              {l.label}
            </EditableLink>
          ) : (
            <Link key={l.label} href={l.href} className={CLASSE_LINK} data-editor-ignore="">{l.label}</Link>
          ),
        )}
      </div>
    </div>
  );
}
