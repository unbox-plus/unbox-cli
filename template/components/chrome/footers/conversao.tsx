// RODAPÉ "conversão" — captura de e-mail em destaque no topo, links enxutos e meios de
// pagamento com peso. O rodapé como última chance de conversão, não como mapa do site.
//
// Quando usar: loja promocional/campanha, onde a lista de e-mail vale mais que a navegação.
// Quando NÃO usar: catálogo grande que precisa de navegação secundária (veja "colunas").
import Link from "next/link";
import { PaymentChips } from "@/components/product/pdp/payment-chips";
import type { ChromeVariantProps } from "../registry";

export function FooterConversao({ data }: ChromeVariantProps) {
  const { shopName } = data;

  return (
    <>
      {/* captura — TODO: ligar o form ao provedor de e-mail da marca */}
      <div className="border-b border-[var(--store-chrome-line,rgba(255,255,255,.1))]">
        <div className="mx-auto flex max-w-[var(--container-max,1240px)] flex-wrap items-center gap-6 px-6 py-10">
          <div className="min-w-[260px] flex-1">
            {/* TODO: personalize a oferta de boas-vindas */}
            <div className="font-display text-[24px] font-extrabold leading-[1.15]">Receba as novidades antes</div>
            <p className="mt-1.5 text-[13.5px] text-[var(--store-chrome-muted)]">Ofertas e lançamentos direto no seu e-mail.</p>
          </div>
          <form className="flex w-full max-w-[440px] items-center gap-1.5 rounded-full bg-white p-1.5">
            <input type="email" placeholder="Seu melhor e-mail" aria-label="Seu e-mail" className="h-11 min-w-0 flex-1 rounded-full bg-transparent px-4 text-sm text-[var(--store-ink)] outline-none" />
            <button type="submit" className="font-display h-11 shrink-0 rounded-full bg-[var(--store-cta,#D97706)] px-6 text-[14px] font-extrabold tracking-[0.5px] text-[var(--store-cta-fg,#1C1207)]">QUERO</button>
          </form>
        </div>
      </div>

      {/* links + pagamento */}
      <div className="mx-auto grid max-w-[var(--container-max,1240px)] gap-8 px-6 py-9 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr]">
        <FooterCol title="Comprar" links={[
          { label: "Todos os produtos", href: "/produtos" },
          { label: "Ofertas", href: "/produtos" },
          { label: "Buscar", href: "/busca" },
        ]} />
        <FooterCol title="Ajuda" links={[
          { label: "Acompanhar pedido", href: "/conta/entrar" },
          { label: "Trocas e devoluções", href: "/devolucoes" },
          { label: "Termos", href: "/termos" },
        ]} />
        <div>
          <div className="font-display mb-3 text-sm font-bold">Pague com</div>
          <PaymentChips />
          {/* eslint-disable-next-line @next/next/no-img-element -- logo do chrome: SVG de poucos KB. O next/image marcaria lazy num elemento que aparece em toda página (o preload scanner perde o recurso) e o reencode come o traço fino do lettering. Otimizar poucos KB não paga essas duas contas. */}
          <img src="/brand/logo-chrome.svg" alt={shopName} className="mt-6 h-11 w-auto opacity-90" />
        </div>
      </div>
    </>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <div className="font-display mb-3 text-sm font-bold">{title}</div>
      <div className="flex flex-col gap-2.5 text-[13px] text-[var(--store-chrome-muted)]">
        {links.map((l) => (
          <Link key={l.label} href={l.href} className="no-underline hover:text-[var(--store-chrome-text,#ffffff)]">{l.label}</Link>
        ))}
      </div>
    </div>
  );
}
