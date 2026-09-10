// RODAPÉ "conversão" — captura de e-mail em destaque no topo, links enxutos e meios de
// pagamento com peso. O rodapé como última chance de conversão, não como mapa do site.
//
// Quando usar: loja promocional/campanha, onde a lista de e-mail vale mais que a navegação.
// Quando NÃO usar: catálogo grande que precisa de navegação secundária (veja "colunas").
//
// EDITOR: o escopo (`chrome.footer`) vem da casca. A captura tem título, texto e o texto do botão
// editáveis (`captura.*`); campo e placeholder do formulário são INTERFACE e ficam fora (README
// do editor, §8). Nas colunas, link de marca (com `chave`) é editável em `<coluna>.<chave>`; link
// de interface fica no código. O título de cada coluna é editável.
import Link from "next/link";
import { PaymentChips } from "@/components/product/pdp/payment-chips";
// Exports NOMEADOS: server component (ver components/site-footer.tsx).
import { EditableImg, EditableLink, EditableText } from "@/lib/editable";
import { CapturaBotao } from "./captura-botao";
import { NEWSLETTER_ACTION } from "@/lib/newsletter";
import type { ChromeVariantProps } from "../registry";

export function FooterConversao({ data }: ChromeVariantProps) {
  const { shopName } = data;

  return (
    <>
      {/* Captura de e-mail: só existe com destino real (NEXT_PUBLIC_NEWSLETTER_ACTION). Sem ele,
          a faixa inteira some — inclusive a borda, senão fica uma tira vazia no topo do rodapé. */}
      {NEWSLETTER_ACTION && (
        <div className="border-b border-[var(--store-chrome-line,rgba(255,255,255,.1))]">
          <div className="mx-auto flex max-w-[var(--container-max,1240px)] flex-wrap items-center gap-6 px-6 py-10">
            <div className="min-w-[260px] flex-1">
              <EditableText as="div" path="captura.titulo" fallback="Receba as novidades antes" label="Título da captura de e-mail" className="font-display text-[24px] font-extrabold leading-[1.15] text-[var(--store-chrome-text,#ffffff)]" />
              <EditableText as="p" path="captura.texto" fallback="Ofertas e lançamentos direto no seu e-mail." label="Texto da captura de e-mail" className="mt-1.5 text-[14px] text-[var(--store-chrome-muted)]" />
            </div>
            <form method="post" action={NEWSLETTER_ACTION} className="flex w-full max-w-[440px] items-center gap-1.5 rounded-full bg-white p-1.5">
              <input type="email" name="email" required placeholder="Seu melhor e-mail" aria-label="Seu e-mail" className="h-11 min-w-0 flex-1 rounded-full bg-transparent px-4 text-sm text-[var(--store-ink)] outline-none" />
              <CapturaBotao />
            </form>
          </div>
        </div>
      )}

      {/* links + pagamento */}
      <div className="mx-auto grid max-w-[var(--container-max,1240px)] gap-8 px-6 py-9 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr]">
        <FooterCol path="coluna-comprar" title="Comprar" links={[
          { chave: "todos", label: "Todos os produtos", href: "/produtos" },
          { chave: "ofertas", label: "Ofertas", href: "/produtos" },
          { label: "Buscar", href: "/busca" },
        ]} />
        <FooterCol path="coluna-ajuda" title="Ajuda" links={[
          { label: "Acompanhar pedido", href: "/conta/entrar" },
          { label: "Trocas e devoluções", href: "/devolucoes" },
          { label: "Termos", href: "/termos" },
        ]} />
        <div>
          <EditableText as="div" path="pagamento.titulo" fallback="Pague com" label="Título das formas de pagamento" className="font-display mb-3 text-sm font-bold" />
          <PaymentChips />
          {/* <img> puro (EditableImg), não next/image: logo do chrome é SVG de poucos KB em toda página. */}
          <EditableImg path="logo" fallback={{ src: "/brand/logo-chrome.svg", alt: shopName }} label="Logo do rodapé" className="mt-6 h-11 w-auto opacity-90" />
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
