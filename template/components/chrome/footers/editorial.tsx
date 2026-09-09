// RODAPÉ "editorial" — um parágrafo de marca (manifesto curto) ocupando a coluna larga,
// links em colunas discretas e redes sociais. Fecha a página com voz, não com selos.
//
// Quando usar: marca com história pra contar, clube/assinatura, tom de revista.
// Quando NÃO usar: loja de conversão pura (veja "conversao").
import Link from "next/link";
import { PaymentChips } from "@/components/product/pdp/payment-chips";
import type { ChromeVariantProps } from "../registry";

export function FooterEditorial({ data }: ChromeVariantProps) {
  const { shopName } = data;

  return (
    <div className="mx-auto grid max-w-[var(--container-max,1240px)] gap-10 px-6 py-12 lg:grid-cols-[1.6fr_1fr_1fr]">
      <div className="max-w-[420px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo do chrome: SVG de poucos KB. O next/image marcaria lazy num elemento que aparece em toda página (o preload scanner perde o recurso) e o reencode come o traço fino do lettering. Otimizar poucos KB não paga essas duas contas. */}
        <img src="/brand/logo-chrome.svg" alt={shopName} className="h-14 w-auto" />
        {/* TODO: troque pelo manifesto REAL da marca (1 parágrafo, voz do briefing). */}
        <p className="mt-5 text-[14px] leading-[1.65] text-[var(--store-chrome-muted)]">
          Uma curadoria feita com calma, pensada pra durar. Cada item aqui passou por escolha,
          teste e uso real antes de chegar até você.
        </p>
        <div className="mt-6 flex flex-wrap gap-4 text-[13px] text-[var(--store-chrome-muted)]">
          {/* TODO: trocar pelas redes REAIS da marca (do briefing/rodapé do site atual). */}
          <span>Instagram</span>
          <span>YouTube</span>
          <span>Newsletter</span>
        </div>
      </div>

      <FooterCol title="Loja" links={[
        { label: "Todos os produtos", href: "/produtos" },
        { label: "Buscar", href: "/busca" },
        { label: "Minha conta", href: "/conta" },
      ]} />

      <div>
        <FooterCol title="Institucional" links={[
          { label: "Trocas e devoluções", href: "/devolucoes" },
          { label: "Termos", href: "/termos" },
          { label: "Privacidade", href: "/privacidade" },
        ]} />
        <div className="mt-7">
          <div className="font-display mb-3 text-sm font-bold">Pague com</div>
          <PaymentChips />
        </div>
      </div>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <div className="font-display mb-3 text-[12px] font-bold uppercase tracking-[1.4px]">{title}</div>
      <div className="flex flex-col gap-2.5 text-[13px] text-[var(--store-chrome-muted)]">
        {links.map((l) => (
          <Link key={l.label} href={l.href} className="no-underline hover:text-[var(--store-chrome-text,#ffffff)]">{l.label}</Link>
        ))}
      </div>
    </div>
  );
}
