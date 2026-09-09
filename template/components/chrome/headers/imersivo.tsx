// HEADER "imersivo" — barra mínima de altura fixa: menu em drawer (também no desktop),
// logo centralizado, carrinho e conta discretos. Muito respiro, nenhuma faixa de anúncio.
//
// O diferencial: quando a página abre com um hero de imagem full-bleed
// (variante `imagem-imersiva` da seção hero), o header fica TRANSPARENTE sobre a foto e vira
// sólido depois de ~80px de rolagem. Em catálogo, PDP, conta e busca ele é sólido desde o
// topo — a regra vive em app/globals.css e depende de o hero marcar `.hero-imersivo`, então
// a degradação é automática: sem foto, header sólido.
//
// Quando usar: marca com fotografia boa, catálogo curto, posicionamento premium.
// Quando NÃO usar: catálogo grande (a navegação fica toda no drawer) ou loja sem foto real.
//
// EDITOR: o escopo (`chrome.header`) vem da casca (components/site-header.tsx). O logo é o único
// ponto de marca desta variante (`logo`, o mesmo caminho da barra do celular: aqui as duas usam
// logo-chrome.svg, o legível sobre a cor do chrome). Menu, busca, conta e carrinho são INTERFACE:
// ficam fora dos primitivos (README do editor, §8).
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { CartButton } from "@/components/cart-button";
import { AccountNav } from "@/components/account-nav";
import { MobileNav } from "@/components/mobile-nav";
import { EditableImg } from "@/lib/editable";
import { SolidOnScroll } from "../solid-on-scroll";
import { HeaderBarMobile } from "../header-bar-mobile";
import type { ChromeVariantProps } from "../registry";

export function HeaderImersivo({ data }: ChromeVariantProps) {
  const { shopName, categories } = data;

  return (
    // .chrome-bar + data-solid: a pintura (transparente ↔ sólido) é decidida no CSS.
    <SolidOnScroll className="bg-[var(--store-chrome-bg,#18181B)] text-[var(--store-chrome-text,#ffffff)] transition-colors duration-200">
      <HeaderBarMobile data={data} tone="over" />

      {/* desktop — altura travada em --chrome-h: se crescer, o hero sobe errado */}
      <div className="mx-auto hidden h-[var(--chrome-h,76px)] max-w-[var(--container-max,1240px)] grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 md:grid">
        <div className="justify-self-start">
          <MobileNav
            categories={categories}
            shopName={shopName}
            triggerClassName="text-[var(--store-chrome-text,#ffffff)]"
          />
        </div>

        <Link href="/" aria-label={shopName} className="flex justify-self-center">
          {/* logo-chrome.svg = o logo que o CLI garante legível sobre a cor de chrome — e o
              estado transparente usa um véu NA COR do chrome, então vale nos dois estados.
              <img> puro (EditableImg), não next/image: SVG de poucos KB em toda página. */}
          <EditableImg path="logo" fallback={{ src: "/brand/logo-chrome.svg", alt: shopName }} label="Logo" className="max-h-[calc(var(--chrome-h,76px)-28px)] w-auto" />
        </Link>

        <div className="flex items-center gap-5 justify-self-end">
          <Link href="/busca" aria-label="Buscar" className="flex text-[var(--store-chrome-text,#ffffff)] opacity-90 transition-opacity hover:opacity-100">
            <MagnifyingGlass weight="bold" className="text-[21px]" />
          </Link>
          <AccountNav tone="chrome" />
          <CartButton tone="chrome" />
        </div>
      </div>
    </SolidOnScroll>
  );
}
