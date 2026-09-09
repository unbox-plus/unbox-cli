// Barra do header no MOBILE — compartilhada pelas variantes de header.
//
// Por que compartilhada: no celular o espaço é o mesmo pra todo mundo (hambúrguer · logo ·
// busca · carrinho) e a percepção de "loja diferente" vem do desktop e do conteúdo. Cada
// variante que quiser um mobile próprio pode não usar este componente — mas o default evita
// quadruplicar o trabalho e o risco de uma variante esquecer o acesso ao menu ou ao carrinho.
//
// EDITOR: o logo é o MESMO caminho do logo do desktop (`logo`, relativo à seção header): trocar
// uma vez troca os dois. Busca, menu e carrinho são INTERFACE da loja, não copy: ficam fora dos
// primitivos (README do editor, §8). O aviso de frete do celular é caminho próprio do cabeçalho
// (`frete-celular`), separado do aviso da faixa do desktop: são duas seções diferentes, e o
// painel mostra cada um com o nome do lugar onde aparece.
import Link from "next/link";
import { Truck, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/store-config";
import { CartButton } from "@/components/cart-button";
import { MobileNav } from "@/components/mobile-nav";
// Exports NOMEADOS: server component (ver components/site-header.tsx).
import { EditableIcon, EditableImg, EditableText } from "@/lib/editable";
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
          {/* <img> puro (EditableImg), não next/image: logo do chrome é SVG de poucos KB, e o next/image
              marcaria lazy num elemento que aparece em toda página (o preload scanner perde o recurso) e
              o reencode come o traço fino do lettering. */}
          <EditableImg path="logo" fallback={{ src: over ? "/brand/logo-chrome.svg" : "/brand/logo.svg", alt: shopName }} label="Logo" className="h-10 w-auto" />
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/busca" aria-label="Buscar" className={`flex ${over ? "text-[var(--store-chrome-text,#ffffff)]" : "text-[var(--store-ink)]"}`}><MagnifyingGlass className="text-[24px]" /></Link>
          <CartButton tone={over ? "chrome" : "ink"} />
        </div>
      </div>
      {!over && FREE_SHIPPING_THRESHOLD != null && (
        <div className="flex items-center justify-center gap-2 bg-[var(--store-chrome-bg,#18181B)] px-4 py-2.5 text-sm font-semibold text-[var(--store-chrome-text,#ffffff)]">
          <EditableIcon path="frete-celular-icone" label="Ícone do aviso de frete (celular)" size={17} className="text-[17px] text-[var(--store-cta,#D97706)]">
            <Truck weight="bold" />
          </EditableIcon>
          {/* o valor (R$X) é configuração da loja, não copy: fica fora do primitivo */}
          <span><EditableText path="frete-celular" fallback="Frete Grátis acima de" label="Aviso de frete (celular)" /> <b>R${FREE_SHIPPING_THRESHOLD}</b></span>
        </div>
      )}
    </div>
  );
}
