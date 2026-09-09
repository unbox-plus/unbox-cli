// RODAPÉ "editorial" — um parágrafo de marca (manifesto curto) ocupando a coluna larga,
// links em colunas discretas e redes sociais. Fecha a página com voz, não com selos.
//
// Quando usar: marca com história pra contar, clube/assinatura, tom de revista.
// Quando NÃO usar: loja de conversão pura (veja "conversao").
//
// EDITOR: o escopo (`chrome.footer`) vem da casca. Logo e manifesto são caminhos da seção; as
// redes são uma LISTA editável (`redes.rede-N`, só o nome: a foundation não sabe a URL de rede
// nenhuma, e o briefing é quem a traz). Nas colunas, link de marca (com `chave`) é editável em
// `<coluna>.<chave>`; link de interface fica no código. O título de cada coluna é editável.
import Link from "next/link";
import { PaymentChips } from "@/components/product/pdp/payment-chips";
// Exports NOMEADOS: server component (ver components/site-footer.tsx).
import { EditableImg, EditableLink, EditableScope, EditableSection, EditableSections, EditableText } from "@/lib/editable";
import type { ChromeVariantProps } from "../registry";

// TODO: trocar pelas redes REAIS da marca (do briefing/rodapé do site atual).
const REDES = ["Instagram", "YouTube", "Newsletter"];

export function FooterEditorial({ data }: ChromeVariantProps) {
  const { shopName } = data;

  return (
    <div className="mx-auto grid max-w-[var(--container-max,1240px)] gap-10 px-6 py-12 lg:grid-cols-[1.6fr_1fr_1fr]">
      <div className="max-w-[420px]">
        {/* <img> puro (EditableImg), não next/image: logo do chrome é SVG de poucos KB em toda página. */}
        <EditableImg path="logo" fallback={{ src: "/brand/logo-chrome.svg", alt: shopName }} label="Logo do rodapé" className="h-14 w-auto" />
        {/* TODO: troque pelo manifesto REAL da marca (1 parágrafo, voz do briefing). */}
        <EditableText
          as="p"
          path="manifesto"
          fallback="Uma curadoria feita com calma, pensada pra durar. Cada item aqui passou por escolha, teste e uso real antes de chegar até você."
          label="Manifesto da marca"
          multiline
          className="mt-5 text-[14px] leading-[1.65] text-[var(--store-chrome-muted)]"
        />
        <div className="mt-6 flex flex-wrap gap-4 text-[13px] text-[var(--store-chrome-muted)]">
          {/* lista editável: o invólucro do item é display:contents, o <span> segue sendo o filho do flex */}
          <EditableScope path="redes">
            <EditableSections nested>
              {REDES.map((r, i) => (
                <EditableSection key={r} item id={`rede-${i + 1}`} label={`Rede ${i + 1}`}>
                  <EditableText path="texto" fallback={r} label="Nome da rede" />
                </EditableSection>
              ))}
            </EditableSections>
          </EditableScope>
        </div>
      </div>

      <FooterCol path="coluna-loja" title="Loja" links={[
        { chave: "todos", label: "Todos os produtos", href: "/produtos" },
        { label: "Buscar", href: "/busca" },
        { label: "Minha conta", href: "/conta" },
      ]} />

      <div>
        <FooterCol path="coluna-institucional" title="Institucional" links={[
          { label: "Trocas e devoluções", href: "/devolucoes" },
          { label: "Termos", href: "/termos" },
          { label: "Privacidade", href: "/privacidade" },
        ]} />
        <div className="mt-7">
          <EditableText as="div" path="pagamento.titulo" fallback="Pague com" label="Título das formas de pagamento" className="font-display mb-3 text-sm font-bold" />
          <PaymentChips />
        </div>
      </div>
    </div>
  );
}

type LinkDoRodape = {
  /** caminho do link no editor (`<coluna>.<chave>`); sem ele o link é de interface e fica no código */
  chave?: string;
  label: string;
  href: string;
};

const CLASSE_LINK = "no-underline hover:text-[var(--store-chrome-text,#ffffff)]";

function FooterCol({ path, title, links }: { path: string; title: string; links: LinkDoRodape[] }) {
  return (
    <div>
      <EditableText as="div" path={`${path}.titulo`} fallback={title} label={`Título da coluna: ${title}`} className="font-display mb-3 text-[12px] font-bold uppercase tracking-[1.4px]" />
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
