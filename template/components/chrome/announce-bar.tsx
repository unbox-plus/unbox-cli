// Barra de anúncio (desktop) — fica ACIMA do header e rola pra fora.
// Compartilhada por todas as variantes de header: o conteúdo é comercial (frete/brinde),
// não estrutura de marca, e a regra de honestidade tem que valer igual em todas.
//
// Só renderiza quando há promessa REAL configurada em lib/store-config (defaults zerados =
// a barra inteira some). A casca não a renderiza no modo "sobreposto" (header transparente).
import { Truck } from "@phosphor-icons/react/dist/ssr";
import { FREE_SHIPPING_THRESHOLD, GIFT_TIERS } from "@/lib/store-config";

export function AnnounceBar() {
  if (FREE_SHIPPING_THRESHOLD == null && GIFT_TIERS.length === 0) return null;

  return (
    <div className="store-layout site-chrome hidden items-stretch bg-[var(--store-chrome-bg,#18181B)] text-[13px] font-semibold text-[var(--store-chrome-text,#ffffff)] md:flex">
      <div className="flex flex-1 items-center justify-center gap-2 px-4 py-[9px]">
        <Truck weight="bold" className="text-base text-[var(--store-cta,#D97706)]" />
        {FREE_SHIPPING_THRESHOLD != null && (
          <span className="text-[var(--store-surface-2)]">Frete Grátis acima de <span className="text-[var(--store-chrome-text,#ffffff)]">R${FREE_SHIPPING_THRESHOLD}</span></span>
        )}
        {GIFT_TIERS.length > 0 && (
          <span className="text-[var(--store-chrome-muted)]">{FREE_SHIPPING_THRESHOLD != null ? "· e ganhe" : "Ganhe"} brindes exclusivos</span>
        )}
      </div>
      {/* TODO: adicionar badge de cupom/promoção da marca */}
    </div>
  );
}
