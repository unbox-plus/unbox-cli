"use client";

import { ShoppingCartSimple } from "@phosphor-icons/react/dist/ssr";
import { useCart } from "@/components/cart/cart-provider";

export function CartButton({
  withLabel = false,
  /** "ink" = sobre fundo claro (padrão). "chrome" = sobre a cor de chrome (header sobreposto). */
  tone = "ink",
}: {
  withLabel?: boolean;
  tone?: "ink" | "chrome";
}) {
  const { count, setOpen } = useCart();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Abrir carrinho"
      className={`relative flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-2 border-none bg-transparent text-[15px] font-medium ${
        tone === "chrome" ? "text-[var(--store-chrome-text,#ffffff)]" : "text-[var(--store-ink)]"
      }`}
    >
      <span className="relative flex">
        <ShoppingCartSimple className={withLabel ? "text-[23px]" : "text-[25px]"} />
        {count > 0 && (
          <span className="absolute -right-2 -top-2 flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-white bg-[var(--store-sale)] px-1 text-[11px] font-extrabold text-white">
            {count}
          </span>
        )}
      </span>
      {withLabel && <span className="max-md:hidden">Carrinho</span>}
    </button>
  );
}
