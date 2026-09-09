// HEADER "equilibrado" — uma barra só, em três pesos: categorias à ESQUERDA, logo ao
// CENTRO e as três ações (busca, conta, carrinho) em ícone à DIREITA.
//
// É o meio-termo entre o "compacto" (tudo à esquerda, denso) e o "centralizado" (duas
// linhas, editorial): mantém o logo como eixo da página sem gastar uma segunda faixa,
// e as ações viram ícone puro pra não competir com a marca.
//
// Quando usar: catálogo curto/médio (2 a 6 categorias cabem na esquerda), marca que quer
// o logo no centro mas sem o peso de duas linhas.
// Quando NÃO usar: muitas categorias (elas empurram o logo pra fora do centro — aí use
// "classico" ou "compacto").
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

export function HeaderEquilibrado({ data }: ChromeVariantProps) {
  const { shopName, categories } = data;

  return (
    <>
      <HeaderBarMobile data={data} />

      {/* desktop — grid de 3 colunas iguais mantém o logo no centro ÓTICO da barra,
          independente de quantas categorias existem à esquerda. */}
      <div className="mx-auto hidden max-w-[var(--container-max,1240px)] grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 py-3 md:grid">
        <nav className="flex min-w-0 items-center gap-6 overflow-x-auto justify-self-start" aria-label="Categorias" data-editor-ignore="">
          <NavLink href="/produtos" label="Todos" />
          {/* barra de uma linha: as principais aqui, o resto no catálogo */}
          {categories.slice(0, 4).map((c) => (
            <NavLink key={c.id} href={`/categoria/${encodeURIComponent(c.slug)}`} label={c.name} />
          ))}
        </nav>

        <Link href="/" aria-label={shopName} className="flex justify-self-center">
          {/* <img> puro (EditableImg), não next/image: logo do chrome é SVG de poucos KB, e o next/image
              marcaria lazy num elemento que aparece em toda página (o preload scanner perde o recurso) e
              o reencode come o traço fino do lettering. */}
          <EditableImg path="logo" fallback={{ src: "/brand/logo.svg", alt: shopName }} label="Logo" className="h-[46px] w-auto" />
        </Link>

        <div className="flex items-center gap-5 justify-self-end">
          <Link href="/busca" aria-label="Buscar" className="flex text-[var(--store-ink)] transition-colors hover:text-[var(--store-primary,#18181B)]">
            <MagnifyingGlass className="text-[22px]" />
          </Link>
          <AccountNav iconOnly />
          <CartButton />
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
      className="shrink-0 whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.6px] no-underline transition-colors hover:text-[var(--store-primary,#18181B)]"
      style={{ color: isOffer ? "var(--store-sale)" : "var(--store-ink-2)" }}
    >
      {label}
    </Link>
  );
}
