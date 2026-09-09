// Barra do header no MOBILE — compartilhada pelas variantes de header.
//
// Por que compartilhada: no celular o espaço é o mesmo pra todo mundo (hambúrguer · logo ·
// busca · carrinho) e a percepção de "loja diferente" vem do desktop e do conteúdo. Cada
// variante que quiser um mobile próprio pode não usar este componente — mas o default evita
// quadruplicar o trabalho e o risco de uma variante esquecer o acesso ao menu ou ao carrinho.
import Link from "next/link";
import { Truck, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/store-config";
import { CartButton } from "@/components/cart-button";
import { MobileNav } from "@/components/mobile-nav";
import type { ChromeData } from "./registry";

export function HeaderBarMobile({
  data,
  /** "solid" = sobre fundo claro (padrão). "over" = sobreposto a uma foto: cores de chrome,
   *  logo legível sobre o chrome e SEM a faixa de frete (ela quebraria a altura fixa). */
  tone = "solid",
}: {
  data: ChromeData;
  tone?: "solid" | "over";
}) {
  const { shopName, categories } = data;
  const over = tone === "over";

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <MobileNav
          categories={categories}
          shopName={shopName}
          triggerClassName={over ? "text-[var(--store-chrome-text,#ffffff)]" : "text-[var(--store-ink)] md:hidden"}
        />
        <Link href="/" aria-label={shopName} className="flex">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo do chrome: SVG de poucos KB. O next/image marcaria lazy num elemento que aparece em toda página (o preload scanner perde o recurso) e o reencode come o traço fino do lettering. Otimizar poucos KB não paga essas duas contas. */}
          <img src={over ? "/brand/logo-chrome.svg" : "/brand/logo.svg"} alt={shopName} className="h-10 w-auto" />
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/busca" aria-label="Buscar" className={`flex ${over ? "text-[var(--store-chrome-text,#ffffff)]" : "text-[var(--store-ink)]"}`}><MagnifyingGlass className="text-[24px]" /></Link>
          <CartButton tone={over ? "chrome" : "ink"} />
        </div>
      </div>
      {!over && FREE_SHIPPING_THRESHOLD != null && (
        <div className="flex items-center justify-center gap-2 bg-[var(--store-chrome-bg,#18181B)] px-4 py-2.5 text-sm font-semibold text-[var(--store-chrome-text,#ffffff)]">
          <Truck weight="bold" className="text-[17px] text-[var(--store-cta,#D97706)]" />
          <span>Frete Grátis acima de <b>R${FREE_SHIPPING_THRESHOLD}</b></span>
        </div>
      )}
    </div>
  );
}
