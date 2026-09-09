"use client";

import * as React from "react";
import { ArrowsClockwise, Spinner } from "@phosphor-icons/react/dist/ssr";
import { useCart } from "@/components/cart/cart-provider";

export interface ReorderItem {
  productId: string;
  variantId: string;
  price: number;
  quantity: number;
  title?: string;
  thumbnail?: string;
}

export function ReorderButton({ items }: { items: ReorderItem[] }) {
  const { add, setOpen } = useCart();
  const [busy, setBusy] = React.useState(false);

  if (items.length === 0) return null;

  async function reorder() {
    setBusy(true);
    try {
      for (const it of items) {
        await add(
          { productId: it.productId, variantId: it.variantId, price: it.price, quantity: it.quantity, title: it.title, thumbnail: it.thumbnail },
          { silent: true },
        );
      }
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={reorder}
      disabled={busy}
      className="font-display inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--store-primary,#18181B)] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[var(--store-primary-dark,#09090B)] disabled:opacity-60"
    >
      {busy ? <Spinner className="animate-spin" /> : <ArrowsClockwise weight="bold" />} Refazer pedido
    </button>
  );
}
