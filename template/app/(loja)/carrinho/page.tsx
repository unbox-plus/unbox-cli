"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Trash2, Tag, ArrowRight } from "@/lib/icons";
import { useCart } from "@/components/cart/cart-provider";
import { QuantityStepper } from "@/components/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/empty-state";
import { formatBRL } from "@/lib/format";
import { goToCheckout } from "@/lib/checkout-nav";
import { trackViewCart, trackPageType } from "@/lib/analytics";

export default function CarrinhoPage() {
  const router = useRouter();
  const { cart, updateQty, remove, applyCoupon, removeCoupon, appliedCoupon, loading } = useCart();
  const [code, setCode] = React.useState("");
  const items = cart?.items ?? [];
  const hasDiscount = !!appliedCoupon || (!!cart?.summary.discountTotal && cart.summary.discountTotal !== "R$0,00");

  // dataLayerReady(cart) + view_cart — uma vez por carregamento com item dentro.
  const trackedRef = React.useRef(false);
  React.useEffect(() => {
    if (trackedRef.current || !cart?.items?.length) return;
    trackedRef.current = true;
    const list = cart.items.filter((i) => !i.isBonus).map((i) => ({ id: i.productId, name: i.title, variant: i.variantTitle, price: i.unitPrice, quantity: i.quantity }));
    trackPageType("cart", list);
    trackViewCart(list, cart.summary.totalAmount);
  }, [cart]);

  if (!cart || items.length === 0) {
    return (
      <EmptyState tituloComo="h1" title="Seu carrinho está vazio" description="Que tal explorar nossos produtos?">
        <Button nativeButton={false} render={<Link href="/produtos" />}>Ver produtos</Button>
      </EmptyState>
    );
  }

  return (
    <div>
      <h1 className="mb-6">Seu carrinho</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Itens */}
        <ul className="divide-y rounded-xl border">
          {items.map((it) => (
            <li key={it.id} className="flex gap-4 p-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                {it.thumbnail ? (
                  <Image src={it.thumbnail} alt={it.title} fill sizes="80px" className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">sem foto</div>
                )}
              </div>
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{it.title}</p>
                    {it.variantTitle && <p className="text-sm text-muted-foreground">{it.variantTitle}</p>}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {it.isRecurring && (
                        <Badge variant="outline">
                          Assinatura{cart.recurringFrequencyTitle ? ` · ${cart.recurringFrequencyTitle}` : ""}
                        </Badge>
                      )}
                      {it.isBonus && <Badge>🎁 Brinde</Badge>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium tabular-nums">{it.isBonus ? "Grátis" : it.displayUnitPrice}</p>
                    {!it.isBonus && <p className="text-xs text-muted-foreground">cada</p>}
                  </div>
                </div>
                {!it.isBonus && (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <QuantityStepper value={it.quantity} onChange={(q) => updateQty(it.id, q)} disabled={loading} />
                      <Button variant="ghost" size="sm" onClick={() => remove(it.id)} disabled={loading}>
                        <Trash2 /> Remover
                      </Button>
                    </div>
                    {it.quantity > 1 && (
                      <span className="text-sm font-medium tabular-nums">{formatBRL(it.unitPrice * it.quantity)}</span>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* Resumo */}
        <aside className="h-fit rounded-xl border p-5">
          <h4 className="mb-3">Resumo</h4>

          {/* Cupom */}
          <form
            className="mb-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (code.trim() && (await applyCoupon(code.trim()))) setCode("");
            }}
          >
            {hasDiscount ? (
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                <span className="flex items-center gap-1.5">
                  <Tag className="size-3.5" /> {appliedCoupon?.code ?? "Desconto aplicado"}
                </span>
                {appliedCoupon?.discountId && (
                  <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => removeCoupon()}>
                    remover
                  </button>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Cupom de desconto" aria-label="Cupom" />
                <Button type="submit" variant="outline" disabled={loading || !code.trim()}>Aplicar</Button>
              </div>
            )}
          </form>

          <Separator className="my-3" />
          <dl className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={cart.summary.itemTotal} />
            {cart.summary.discountTotal && cart.summary.discountTotal !== "R$0,00" && (
              <Row label="Desconto" value={`- ${cart.summary.discountTotal}`} accent />
            )}
            <Row label="Frete" value={cart.summary.shippingTotal ?? "calculado no checkout"} />
          </dl>
          <Separator className="my-3" />
          <div className="flex items-center justify-between text-base font-semibold">
            <span>Total</span>
            <span>{cart.summary.total ?? "—"}</span>
          </div>

          <Button className="mt-4 w-full" size="lg" onClick={() => goToCheckout(router)}>
            Finalizar compra <ArrowRight />
          </Button>
          <Button variant="ghost" className="mt-2 w-full" nativeButton={false} render={<Link href="/produtos" />}>
            Continuar comprando
          </Button>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value?: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums ${accent ? "font-medium text-[var(--store-primary)]" : ""}`}>{value ?? "—"}</dd>
    </div>
  );
}
