// HEADER "clássico" — logo à esquerda, busca no centro, ações à direita e a nav de
// categorias numa faixa abaixo. É o header de loja de catálogo: prioriza encontrar produto.
//
// Quando usar: catálogo grande, muitas categorias, busca é o caminho principal.
// Quando NÃO usar: marca com poucos SKUs que quer respiro (veja "imersivo"/"centralizado").
import Link from "next/link";
import { BrandSearch } from "@/components/brand-search";
import { CartButton } from "@/components/cart-button";
import { AccountNav } from "@/components/account-nav";
import { HeaderBarMobile } from "../header-bar-mobile";
import type { ChromeVariantProps } from "../registry";

export function HeaderClassico({ data }: ChromeVariantProps) {
  const { shopName, categories } = data;

  return (
    <>
      <HeaderBarMobile data={data} />

      {/* desktop */}
      <div className="mx-auto hidden max-w-[var(--container-max,1240px)] items-center gap-7 px-6 py-3.5 md:flex">
        <Link href="/" aria-label={shopName} className="flex shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo do chrome: SVG de poucos KB. O next/image marcaria lazy num elemento que aparece em toda página (o preload scanner perde o recurso) e o reencode come o traço fino do lettering. Otimizar poucos KB não paga essas duas contas. */}
          <img src="/brand/logo.svg" alt={shopName} className="h-[52px] w-auto" />
        </Link>
        <BrandSearch className="flex-1" />
        <AccountNav />
        <CartButton withLabel />
      </div>

      {/* nav de categorias */}
      <div className="hidden border-t border-[var(--store-surface-2)] md:block">
        <div className="mx-auto flex max-w-[var(--container-max,1240px)] items-center gap-[26px] overflow-x-auto px-6">
          <CatLink href="/produtos" label="Todos" />
          {categories.map((c) => (
            <CatLink key={c.id} href={`/categoria/${encodeURIComponent(c.slug)}`} label={c.name} />
          ))}
        </div>
      </div>
    </>
  );
}

function CatLink({ href, label }: { href: string; label: string }) {
  const isOffer = /oferta/i.test(label);
  return (
    <Link
      href={href}
      className="shrink-0 whitespace-nowrap border-b-[3px] border-transparent py-3 text-sm font-medium no-underline hover:border-[var(--store-primary,#18181B)] hover:text-[var(--store-primary,#18181B)]"
      style={{ color: isOffer ? "var(--store-sale)" : "var(--store-ink-2)" }}
    >
      {label}
    </Link>
  );
}
