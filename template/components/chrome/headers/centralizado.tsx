// HEADER "centralizado" — logo grande no centro, ações nas pontas e a navegação
// centralizada abaixo. Simetria e ar: o logo vira o eixo da página, não um item de canto.
//
// Quando usar: marca editorial/de assinatura, catálogo curado, wordmark bonito.
// Quando NÃO usar: catálogo grande onde a busca é o caminho principal (veja "classico").
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { CartButton } from "@/components/cart-button";
import { AccountNav } from "@/components/account-nav";
import { HeaderBarMobile } from "../header-bar-mobile";
import type { ChromeVariantProps } from "../registry";

export function HeaderCentralizado({ data }: ChromeVariantProps) {
  const { shopName, categories } = data;

  return (
    <>
      <HeaderBarMobile data={data} />

      {/* desktop — linha 1: ações · logo · ações */}
      <div className="mx-auto hidden max-w-[var(--container-max,1240px)] grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 py-5 md:grid">
        <div className="flex items-center gap-4 justify-self-start">
          <Link href="/busca" aria-label="Buscar" className="flex text-[var(--store-ink-2)] transition-colors hover:text-[var(--store-primary,#18181B)]">
            <MagnifyingGlass weight="bold" className="text-[21px]" />
          </Link>
        </div>

        <Link href="/" aria-label={shopName} className="flex justify-self-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo do chrome: SVG de poucos KB. O next/image marcaria lazy num elemento que aparece em toda página (o preload scanner perde o recurso) e o reencode come o traço fino do lettering. Otimizar poucos KB não paga essas duas contas. */}
          <img src="/brand/logo.svg" alt={shopName} className="h-[58px] w-auto" />
        </Link>

        <div className="flex items-center gap-5 justify-self-end">
          <AccountNav />
          <CartButton />
        </div>
      </div>

      {/* desktop — linha 2: navegação centralizada */}
      <div className="hidden border-t border-[var(--store-surface-2)] md:block">
        <nav className="mx-auto flex max-w-[var(--container-max,1240px)] items-center justify-center gap-8 overflow-x-auto px-6" aria-label="Categorias">
          <NavLink href="/produtos" label="Todos" />
          {categories.map((c) => (
            <NavLink key={c.id} href={`/categoria/${encodeURIComponent(c.slug)}`} label={c.name} />
          ))}
        </nav>
      </div>
    </>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  const isOffer = /oferta/i.test(label);
  return (
    <Link
      href={href}
      className="shrink-0 whitespace-nowrap py-3 text-[12.5px] font-semibold uppercase tracking-[1.2px] no-underline transition-colors hover:text-[var(--store-primary,#18181B)]"
      style={{ color: isOffer ? "var(--store-sale)" : "var(--store-ink-2)" }}
    >
      {label}
    </Link>
  );
}
