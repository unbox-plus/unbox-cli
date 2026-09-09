// RODAPÉ "minimal" — logo pequeno, uma linha de links e pagamento discreto. Muito ar.
// O rodapé some da atenção: quem chegou até aqui já decidiu, e a marca não quer ruído.
//
// Quando usar: catálogo curto, estética premium/minimal, poucas páginas institucionais.
// Quando NÃO usar: loja com muita navegação secundária ou muita informação legal (veja
// "colunas"). Os links legais continuam aqui — some o peso visual, nunca o acesso.
//
// EDITOR: o escopo (`chrome.footer`) vem da casca. O logo é caminho da seção; na linha de links,
// só "Todos os produtos" é link de MARCA (editável em `links.todos`); os outros nomeiam mecânica
// da loja ou página legal e ficam no código (README do editor, §8).
import Link from "next/link";
import { PaymentChips } from "@/components/product/pdp/payment-chips";
// Exports NOMEADOS: server component (ver components/site-footer.tsx).
import { EditableImg, EditableLink } from "@/lib/editable";
import type { ChromeVariantProps } from "../registry";

const LINKS: { chave?: string; label: string; href: string }[] = [
  { chave: "todos", label: "Todos os produtos", href: "/produtos" },
  { label: "Minha conta", href: "/conta" },
  { label: "Acompanhar pedido", href: "/conta/entrar" },
  { label: "Trocas e devoluções", href: "/devolucoes" },
  { label: "Termos", href: "/termos" },
  { label: "Privacidade", href: "/privacidade" },
];

const CLASSE_LINK = "no-underline transition-colors hover:text-[var(--store-chrome-text,#ffffff)]";

export function FooterMinimal({ data }: ChromeVariantProps) {
  const { shopName } = data;

  return (
    <div className="mx-auto flex max-w-[var(--container-max,1240px)] flex-col items-center gap-7 px-6 py-14 text-center">
      <Link href="/" aria-label={shopName} className="flex">
        {/* <img> puro (EditableImg), não next/image: logo do chrome é SVG de poucos KB em toda página. */}
        <EditableImg path="logo" fallback={{ src: "/brand/logo-chrome.svg", alt: shopName }} label="Logo do rodapé" className="h-12 w-auto" />
      </Link>

      <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[13px] text-[var(--store-chrome-muted)]" aria-label="Rodapé">
        {LINKS.map((l) =>
          l.chave ? (
            <EditableLink key={l.label} path={`links.${l.chave}`} fallback={{ href: l.href, label: l.label }} label={`Link: ${l.label}`} className={CLASSE_LINK}>
              {l.label}
            </EditableLink>
          ) : (
            <Link key={l.label} href={l.href} className={CLASSE_LINK} data-editor-ignore="">{l.label}</Link>
          ),
        )}
      </nav>

      <div className="opacity-80">
        <PaymentChips />
      </div>
    </div>
  );
}
