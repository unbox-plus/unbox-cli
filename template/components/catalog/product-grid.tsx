"use client";

// Grade de produtos reutilizável (com add-to-cart) usando o card padrão do catálogo.
import * as React from "react";
import { useCart } from "@/components/cart/cart-provider";
import { ProductGridCard } from "@/components/catalog/product-grid-card";
import type { CatalogProductItem } from "@/components/catalog/catalog-client";

export function ProductGrid({ items }: { items: CatalogProductItem[] }) {
  const { add } = useCart();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function quickAdd(p: CatalogProductItem) {
    if (!p.productId || !p.variantId || p.soldOut) return;
    setBusyId(p.variantId);
    await add({ productId: p.productId, variantId: p.variantId, price: p.price, quantity: 1, thumbnail: p.imageUrl ?? undefined, title: p.title });
    setBusyId(null);
  }

  return (
    <div className="grid grid-cols-2 gap-[18px] sm:grid-cols-3 lg:grid-cols-4">
      {items.map((p) => (
        <ProductGridCard key={p.slug} p={p} onAdd={() => quickAdd(p)} busy={busyId === p.variantId} />
      ))}
    </div>
  );
}
