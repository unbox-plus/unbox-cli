"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  X, Trash, ShoppingCartSimple, Repeat, Gift, LockSimple, SealCheck, Truck, CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { useCart } from "@/components/cart/cart-provider";
import { formatBRL, parseBRL } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD, GIFT_TIERS, PIX_DISCOUNT_PCT } from "@/lib/store-config";
import { goToCheckout } from "@/lib/checkout-nav";

// null/vazio = promoção não existe → o bloco correspondente NÃO renderiza (ver store-config).
const FREE_SHIP = FREE_SHIPPING_THRESHOLD;
const LADDER_MAX = GIFT_TIERS.length > 0 ? Math.max(...GIFT_TIERS.map((t) => t.threshold)) : null;

export function MiniCart() {
  const router = useRouter();
  const { cart, open, setOpen, updateQty, remove, count, appliedCoupon, applyCoupon, removeCoupon, loading } = useCart();
  const items = cart?.items ?? [];
  const hasItems = items.length > 0;
  // Base do progresso e do total = SUBTOTAL de produtos (não o total do servidor, que pode incluir
  // frete). O frete é decidido no checkout — no carrinho mostramos só produtos (− desconto).
  const net = parseBRL(cart?.summary.itemTotal) ?? cart?.summary.totalAmount ?? 0;
  const discountAmount = parseBRL(cart?.summary.discountTotal) ?? 0;
  // Desconto Pix (5%): mesma regra do checkout (Pix é o pagamento padrão; indisponível p/ assinatura).
  // Calculado sobre o subtotal de produtos, consistente com a PDP/checkout.
  const pixEligible = !cart?.hasRecurring;
  const pixDiscount = pixEligible ? Math.round(net * PIX_DISCOUNT_PCT) / 100 : 0;
  const drawerTotal = formatBRL(Math.max(0, net - discountAmount - pixDiscount));

  const [code, setCode] = React.useState("");
  const remaining = FREE_SHIP != null ? Math.max(0, FREE_SHIP - net) : 0;
  const shipPct = FREE_SHIP != null ? Math.min(100, Math.round((net / FREE_SHIP) * 100)) : 0;
  const ladderPct = LADDER_MAX != null ? Math.min(100, Math.round((net / LADDER_MAX) * 100)) : 0;
  const reached = GIFT_TIERS.filter((t) => net >= t.threshold);
  const current = reached.length ? reached[reached.length - 1] : null;
  const next = GIFT_TIERS.find((t) => net < t.threshold) ?? null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" showCloseButton={false} className="store-layout w-screen max-w-full gap-0 bg-[var(--store-surface)] p-0 sm:w-[440px] sm:max-w-[440px]">
        {/* header */}
        <div className="flex shrink-0 items-center justify-between px-[22px] pb-3 pt-[18px]">
          <SheetTitle className="font-display text-[21px] font-extrabold text-[var(--store-ink)]">
            Seu Carrinho {count > 0 && <span className="text-sm font-semibold text-[var(--store-muted)]">({count})</span>}
          </SheetTitle>
          <SheetClose
            render={<button aria-label="Fechar" className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[var(--store-line)] bg-white" />}
          >
            <X weight="bold" className="text-base text-[var(--store-ink)]" />
          </SheetClose>
        </div>
        <SheetDescription className="sr-only">Itens no seu carrinho</SheetDescription>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-[22px] pb-4">
          {!hasItems ? (
            <div className="px-5 py-16 text-center text-[var(--store-muted)]">
              <ShoppingCartSimple className="mx-auto text-5xl text-[var(--store-faint)]" />
              <div className="mt-3.5 text-base font-bold text-[var(--store-ink-2)]">Seu carrinho está vazio</div>
              <div className="mt-1 text-[13.5px]">Adicione produtos para continuar.</div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--store-line)] bg-white">
              {items.map((it) => (
                <div key={it.id} className="flex gap-3.5 border-b border-[var(--store-surface-2)] p-4">
                  <div className="relative h-20 w-[72px] shrink-0 overflow-hidden rounded-md border border-[var(--store-line)] bg-[var(--store-line)]">
                    {it.thumbnail && <Image src={it.thumbnail} alt={it.title} fill sizes="72px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2.5">
                      <div>
                        <div className="text-[14.5px] font-bold leading-tight text-[var(--store-ink)]">{it.title}</div>
                        {it.variantTitle && <div className="mt-0.5 text-xs text-[var(--store-muted)]">{it.variantTitle}</div>}
                        {it.isRecurring && (
                          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--store-primary-soft,#F1F1F3)] px-2 py-[3px] text-[10px] font-extrabold tracking-[0.3px] text-[var(--store-primary,#18181B)]">
                            <Repeat weight="fill" />ASSINATURA{cart?.recurringFrequencyTitle ? ` · ${cart.recurringFrequencyTitle}` : ""}
                          </span>
                        )}
                      </div>
                      <div className="font-display whitespace-nowrap text-base font-extrabold text-[var(--store-ink)]">
                        {it.isBonus ? "GRÁTIS" : formatBRL(it.unitPrice)}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      {it.isBonus ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--store-primary-soft,#F1F1F3)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--store-primary,#18181B)]"><Gift weight="fill" />Brinde</span>
                      ) : (
                        <div className="flex items-center overflow-hidden rounded-sm border-[1.5px] border-[var(--store-line-2)]">
                          <button type="button" disabled={loading} onClick={() => updateQty(it.id, Math.max(1, it.quantity - 1))} className="h-[34px] w-[34px] cursor-pointer border-none bg-transparent text-[17px] text-[var(--store-ink-2)] disabled:cursor-not-allowed disabled:opacity-50">−</button>
                          <span className="w-[30px] text-center text-sm font-extrabold">{it.quantity}</span>
                          <button type="button" disabled={loading} onClick={() => updateQty(it.id, it.quantity + 1)} className="h-[34px] w-[34px] cursor-pointer border-none bg-transparent text-[17px] text-[var(--store-ink-2)] disabled:cursor-not-allowed disabled:opacity-50">+</button>
                        </div>
                      )}
                      {!it.isBonus && (
                        <button type="button" disabled={loading} onClick={() => remove(it.id)} aria-label="Remover" className="flex cursor-pointer items-center border-none bg-transparent p-1.5 text-[var(--store-muted)] disabled:cursor-not-allowed disabled:opacity-50">
                          <Trash className="text-lg" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* gift ladder — só com promoção de brinde REAL configurada (GIFT_TIERS) */}
              {GIFT_TIERS.length > 0 && LADDER_MAX != null && (
              <div className="bg-[var(--store-surface)] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[13.5px] font-extrabold text-[var(--store-ink)]"><Gift weight="fill" className="text-[17px] text-[var(--store-primary,#18181B)]" />Brinde do pedido</span>
                  <span className="text-[11.5px] font-bold text-[var(--store-muted)]">1 brinde por pedido</span>
                </div>
                <div className="relative mx-1.5 mb-7 h-2 rounded-full bg-[var(--store-surface-2)]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[var(--store-primary,#18181B)] to-[var(--store-primary)] transition-all" style={{ width: `${ladderPct}%` }} />
                  {GIFT_TIERS.map((t) => {
                    const on = net >= t.threshold;
                    return (
                      <div key={t.threshold} className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${(t.threshold / LADDER_MAX) * 100}%` }}>
                        <span className="h-4 w-4 rounded-full border-2 border-white shadow-[0_0_0_1px_var(--store-line-2)]" style={{ background: on ? "var(--store-primary,#18181B)" : "var(--store-line-2)" }} />
                        <span className="absolute top-5 whitespace-nowrap text-[10.5px] font-extrabold" style={{ color: on ? "var(--store-primary,#18181B)" : "var(--store-muted)" }}>R$ {t.threshold}</span>
                      </div>
                    );
                  })}
                </div>
                {current ? (
                  <div className="flex items-center gap-2.5 rounded-md border border-[var(--store-primary-soft)] bg-white px-3 py-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[var(--store-primary-soft,#F1F1F3)]"><Gift weight="fill" className="text-xl text-[var(--store-primary,#18181B)]" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-extrabold text-[var(--store-primary,#18181B)]">{current.name}</div>
                      <div className="text-[11.5px] text-[var(--store-ink-2)]">Seu brinde atual · liberado em R$ {current.threshold}</div>
                    </div>
                    <span className="flex items-center gap-1 whitespace-nowrap text-[11.5px] font-extrabold text-[var(--store-primary,#18181B)]"><CheckCircle weight="fill" />GRÁTIS</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-md border border-dashed border-[var(--store-line-2)] bg-white px-3 py-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[var(--store-surface-2)]"><Gift className="text-xl text-[var(--store-faint)]" /></span>
                    <div className="min-w-0 flex-1 text-[12.5px] text-[var(--store-muted)]">Nenhum brinde ainda. Continue para desbloquear o primeiro.</div>
                  </div>
                )}
                {next && (
                  <div className="mt-2.5 flex items-center gap-2.5 rounded-md border border-dashed border-[var(--store-line-2)] bg-[var(--store-surface)] px-3 py-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[var(--store-surface-2)]"><LockSimple className="text-lg text-[var(--store-faint)]" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-[var(--store-ink-2)]">Próximo brinde</div>
                      <div className="text-[11.5px] text-[var(--store-muted)]">Adicione mais <b className="text-[var(--store-sale)]">{formatBRL(next.threshold - net)}</b> para desbloquear</div>
                    </div>
                    <span className="whitespace-nowrap text-[11px] font-extrabold text-[var(--store-faint)]">R$ {next.threshold}</span>
                  </div>
                )}
              </div>
              )}
            </div>
          )}
        </div>

        {/* footer */}
        {hasItems && (
          <div className="shrink-0 border-t border-[var(--store-line)] bg-white px-[22px] pb-[max(16px,env(safe-area-inset-bottom))] pt-3.5">
            {/* coupon */}
            {appliedCoupon ? (
              <div className="mb-3 flex items-center justify-between gap-2.5 rounded-md border border-[var(--store-primary-soft)] bg-[var(--store-primary-soft,#F1F1F3)] px-3.5 py-2.5">
                <span className="flex min-w-0 items-center gap-2.5">
                  <SealCheck weight="fill" className="shrink-0 text-lg text-[var(--store-primary,#18181B)]" />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-extrabold text-[var(--store-primary,#18181B)]">Cupom {appliedCoupon.code?.toUpperCase()} aplicado</span>
                    {cart?.summary.discountTotal && <span className="block text-xs text-[var(--store-ink-2)]">Você economizou {cart.summary.discountTotal}</span>}
                  </span>
                </span>
                <button type="button" onClick={() => removeCoupon()} className="flex shrink-0 cursor-pointer items-center gap-1 border-none bg-transparent text-[12.5px] font-bold text-[var(--store-sale)]"><Trash className="text-[15px]" />Remover</button>
              </div>
            ) : (
              <div className="mb-3 flex gap-2.5">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Tem um cupom de desconto?"
                  className="h-[46px] min-w-0 flex-1 rounded-md border border-[var(--store-line-2)] bg-white px-4 text-sm outline-none"
                />
                <button type="button" disabled={loading || !code.trim()} onClick={() => applyCoupon(code.trim())} className="font-display h-[46px] shrink-0 cursor-pointer rounded-md bg-[var(--store-chrome-bg)] px-6 text-sm font-bold text-white disabled:opacity-60">Aplicar</button>
              </div>
            )}

            {/* summary */}
            <div className="mb-3.5 flex flex-col gap-2 text-sm text-[var(--store-ink-2)]">
              <div className="flex justify-between"><span>Subtotal ({count})</span><span className="font-semibold text-[var(--store-ink)]">{cart?.summary.itemTotal ?? cart?.summary.total ?? "—"}</span></div>
              {cart?.summary.discountTotal && (
                <div className="flex justify-between"><span>Desconto</span><span className="font-bold text-[var(--store-primary,#18181B)]">- {cart.summary.discountTotal}</span></div>
              )}
              {pixDiscount > 0 && (
                <div className="flex justify-between"><span>Desconto Pix ({PIX_DISCOUNT_PCT}%)</span><span className="font-bold text-[var(--store-primary,#18181B)]">- {formatBRL(pixDiscount)}</span></div>
              )}
              {/* régua de frete grátis — só com FREE_SHIPPING_THRESHOLD real configurado */}
              {FREE_SHIP != null && (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span>Frete</span>
                  <span className="text-xs font-bold text-[var(--store-primary,#18181B)]">{remaining > 0 ? `Faltam ${formatBRL(remaining)} para Frete Grátis` : "Você ganhou Frete Grátis!"}</span>
                </div>
                <div className="mt-1.5 h-[7px] overflow-hidden rounded-full bg-[var(--store-surface-2)]"><div className="h-full rounded-full bg-gradient-to-r from-[var(--store-primary,#18181B)] to-[var(--store-primary)] transition-all" style={{ width: `${shipPct}%` }} /></div>
              </div>
              )}
              <div className="my-0.5 h-px bg-[var(--store-line)]" />
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-extrabold text-[var(--store-ink)]">Total</span>
                <div className="text-right">
                  <span className="font-display text-xl font-extrabold text-[var(--store-primary,#18181B)]">{drawerTotal}</span>
                  {pixDiscount > 0 && <div className="text-[11px] font-semibold text-[var(--store-muted)]">no Pix · economia de {formatBRL(pixDiscount)}</div>}
                </div>
              </div>
              <div className="text-[11px] text-[var(--store-muted)]">Frete calculado no checkout</div>
            </div>

            <button type="button" onClick={() => { setOpen(false); void goToCheckout(router); }} className="font-display flex h-[54px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border-none bg-[var(--store-cta,#D97706)] text-base font-extrabold tracking-[0.4px] text-[var(--store-cta-fg,#1C1207)] transition-colors hover:bg-[var(--store-cta-dark,#B45309)]">
              <LockSimple weight="fill" className="text-lg" />FINALIZAR COMPRA
            </button>
            <div className="mt-3.5 flex justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-[var(--store-ink)]"><LockSimple className="text-[15px] text-[var(--store-primary,#18181B)]" />100% Segura</span>
              <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-[var(--store-ink)]"><SealCheck className="text-[15px] text-[var(--store-primary,#18181B)]" />CDC</span>
              <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-[var(--store-ink)]"><Truck className="text-[15px] text-[var(--store-primary,#18181B)]" />Troca em 7 dias</span>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
