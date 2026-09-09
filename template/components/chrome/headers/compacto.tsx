// HEADER "compacto" — uma barra fina só: logo pequeno, categorias inline no MESMO eixo,
// busca em ícone e ações à direita. Densidade alta, pouca altura: sobra tela pra oferta.
//
// Quando usar: loja promocional//oferta, campanha, quem quer o produto o quanto antes.
// Quando NÃO usar: marca que precisa de respiro (veja "centralizado"/"imersivo").
//
// EDITOR: o escopo (`chrome.header`) vem da casca (components/site-header.tsx). O logo é o único
// ponto de marca desta variante (`logo`, o mesmo caminho da barra do celular). Busca, conta e
// carrinho são INTERFACE; as categorias são DADO do catálogo da Unbox: nada disso vira primitivo
// (README do editor, §8), e a nav de categorias sai do gate por `data-editor-ignore`.
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { CartButton } from "@/components/cart-button";
import { AccountNav } from "@/components/account-nav";
import { EditableImg } from "@/lib/editable";
import { HeaderBarMobile } from "../header-bar-mobile";
import type { ChromeVariantProps } from "../registry";

export function HeaderCompacto({ data }: ChromeVariantProps) {
  const { shopName, categories } = data;

  return (
    <>
      <HeaderBarMobile data={data} />

      {/* desktop — tudo numa linha */}
      <div className="mx-auto hidden max-w-[var(--container-max,1240px)] items-center gap-5 px-6 py-2.5 md:flex">
        <Link href="/" aria-label={shopName} className="flex shrink-0">
          {/* <img> puro (EditableImg), não next/image: logo do chrome é SVG de poucos KB, e o next/image
              marcaria lazy num elemento que aparece em toda página (o preload scanner perde o recurso) e
              o reencode come o traço fino do lettering. */}
          <EditableImg path="logo" fallback={{ src: "/brand/logo.svg", alt: shopName }} label="Logo" className="h-9 w-auto" />
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-5 overflow-x-auto" aria-label="Categorias" data-editor-ignore="">
          <NavLink href="/produtos" label="Todos" />
          {/* barra fina: mostra as principais e deixa o resto no menu/catálogo */}
          {categories.slice(0, 6).map((c) => (
            <NavLink key={c.id} href={`/categoria/${encodeURIComponent(c.slug)}`} label={c.name} />
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-4">
          <Link href="/busca" aria-label="Buscar" className="flex text-[var(--store-ink-2)] transition-colors hover:text-[var(--store-primary,#18181B)]">
            <MagnifyingGlass weight="bold" className="text-[21px]" />
          </Link>
          <AccountNav />
          <CartButton withLabel />
        </div>
      </div>
    </>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  const isOffer = /oferta/i.test(label);
  return (
    <Link
      href={href}
      className="shrink-0 whitespace-nowrap text-[13.5px] font-semibold uppercase tracking-[0.4px] no-underline transition-colors hover:text-[var(--store-primary,#18181B)]"
      style={{ color: isOffer ? "var(--store-sale)" : "var(--store-ink-2)" }}
    >
      {label}
    </Link>
  );
}
