// RODAPÉ "minimal" — logo pequeno, uma linha de links e pagamento discreto. Muito ar.
// O rodapé some da atenção: quem chegou até aqui já decidiu, e a marca não quer ruído.
//
// Quando usar: catálogo curto, estética premium/minimal, poucas páginas institucionais.
// Quando NÃO usar: loja com muita navegação secundária ou muita informação legal (veja
// "colunas"). Os links legais continuam aqui — some o peso visual, nunca o acesso.
import Link from "next/link";
import { PaymentChips } from "@/components/product/pdp/payment-chips";
import type { ChromeVariantProps } from "../registry";

const LINKS = [
  { label: "Todos os produtos", href: "/produtos" },
  { label: "Minha conta", href: "/conta" },
  { label: "Acompanhar pedido", href: "/conta/entrar" },
  { label: "Trocas e devoluções", href: "/devolucoes" },
  { label: "Termos", href: "/termos" },
  { label: "Privacidade", href: "/privacidade" },
];

export function FooterMinimal({ data }: ChromeVariantProps) {
  const { shopName } = data;

  return (
    <div className="mx-auto flex max-w-[var(--container-max,1240px)] flex-col items-center gap-7 px-6 py-14 text-center">
      <Link href="/" aria-label={shopName} className="flex">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo do chrome: SVG de poucos KB. O next/image marcaria lazy num elemento que aparece em toda página (o preload scanner perde o recurso) e o reencode come o traço fino do lettering. Otimizar poucos KB não paga essas duas contas. */}
        <img src="/brand/logo-chrome.svg" alt={shopName} className="h-12 w-auto" />
      </Link>

      <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[13px] text-[var(--store-chrome-muted)]" aria-label="Rodapé">
        {LINKS.map((l) => (
          <Link key={l.label} href={l.href} className="no-underline transition-colors hover:text-[var(--store-chrome-text,#ffffff)]">{l.label}</Link>
        ))}
      </nav>

      <div className="opacity-80">
        <PaymentChips />
      </div>
    </div>
  );
}
