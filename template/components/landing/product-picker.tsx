"use client";

// Passo 2 do funil (/carrinho/oferta) — tela split no padrão das lojas Unbox de produção:
// imagem da marca à esquerda (desktop), à direita logo + confiança, escolha de produtos
// com stepper, frequência de envio (assinatura REAL da política da loja vs compra única)
// e CTA que só libera quando a quantidade alvo fecha. Envia tudo num único POST /api/cart
// → /checkout. Tela .checkout-root (o CSS global esconde o chrome do site).
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CaretLeft, Minus, Plus, CheckCircle, ShieldCheck, Truck, LockSimple } from "@phosphor-icons/react/dist/ssr";
import { formatBRL } from "@/lib/format";
import { goToCheckout } from "@/lib/checkout-nav";
import { PoweredByUnbox } from "@/components/powered-by-unbox";
import type { CatalogProductItem } from "@/components/catalog/catalog-client";

export interface PickerSubscription {
  percentOff: number | null;
  frequencies: { id: string; title: string; note?: string }[];
}

export function ProductPicker({
  products,
  shopName,
  subscription,
  recurrableIds = [],
  sideImage = "/brand/hero-desktop.svg",
  tagline = "escolha o que combina com você",
}: {
  products: CatalogProductItem[];
  shopName: string;
  subscription: PickerSubscription | null;
  recurrableIds?: string[];
  sideImage?: string;
  tagline?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const target = Math.max(1, Math.min(12, Number(params.get("quantity")) || 1));
  const [qty, setQty] = React.useState<Record<string, number>>(() =>
    products[0]?.variantId ? { [products[0].variantId]: target } : {},
  );
  const [mode, setMode] = React.useState<"assinatura" | "unica">(subscription ? "assinatura" : "unica");
  const [freqId, setFreqId] = React.useState(subscription?.frequencies[0]?.id ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const picked = Object.values(qty).reduce((a, b) => a + b, 0);
  const remaining = target - picked;
  // assinatura só vale pros produtos que a permitem; o desconto REAL vem da política da loja
  const pct = subscription?.percentOff ?? 0;
  const factor = mode === "assinatura" && pct ? 1 - pct / 100 : 1;
  const isRecurrable = (p: CatalogProductItem) => recurrableIds.includes(p.productId ?? "");
  const totalFull = products.reduce((acc, p) => acc + (qty[p.variantId ?? ""] ?? 0) * p.price, 0);
  const total = products.reduce((acc, p) => {
    const n = qty[p.variantId ?? ""] ?? 0;
    const f = mode === "assinatura" && pct && isRecurrable(p) ? 1 - pct / 100 : 1;
    return acc + n * p.price * f;
  }, 0);
  const perUnit = picked > 0 ? total / picked : products[0]?.price ?? 0;

  function bump(p: CatalogProductItem, d: number) {
    if (!p.variantId || p.soldOut) return;
    setQty((q) => {
      const cur = q[p.variantId!] ?? 0;
      if (d > 0 && picked >= target) return q;
      return { ...q, [p.variantId!]: Math.max(0, cur + d) };
    });
  }

  async function checkout() {
    setBusy(true);
    setError(null);
    try {
      const assinatura = mode === "assinatura" && !!subscription;
      const items = products
        .filter((p) => (qty[p.variantId ?? ""] ?? 0) > 0 && p.productId && p.variantId)
        .map((p) => ({
          productId: p.productId,
          productVariantId: p.variantId,
          price: p.price,
          quantity: qty[p.variantId!],
          thumbnail: p.imageUrl ?? "",
          isRecurring: assinatura && isRecurrable(p),
        }));
      const body: Record<string, unknown> = { items };
      if (assinatura && freqId && items.some((it) => it.isRecurring)) body.recurringItemsFrequencyId = freqId;
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Não foi possível montar o carrinho.");
      // goToCheckout: o SERVIDOR decide o destino (interno ou hosted) e monta a URL com
      // ?id=&token= do carrinho — contrato da recuperação. push("/checkout") cru perderia
      // os params e quebraria no modo hosted (rota removida).
      await goToCheckout(router);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="checkout-root store-layout min-h-screen bg-[var(--store-surface)]">
      {/* progresso full-width */}
      <div className="sticky top-0 z-10 border-b border-[var(--store-line)] bg-[var(--store-surface)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[var(--container-max,1240px)] items-center justify-center gap-2.5 px-4 py-3.5 text-[13px] font-bold">
          <span className="flex items-center gap-1.5 text-[var(--store-ink)]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--store-cta,#D97706)] text-[12px] text-[var(--store-cta-fg,#1C1207)]">1</span> quantidade</span>
          <span className="h-[2px] w-10 rounded bg-[var(--store-cta,#D97706)]" />
          <span className="flex items-center gap-1.5 text-[var(--store-ink)]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--store-cta,#D97706)] text-[12px] text-[var(--store-cta-fg,#1C1207)]">2</span> escolha</span>
          <span className="h-[2px] w-10 rounded bg-[var(--store-line-2)]" />
          <span className="flex items-center gap-1.5 text-[var(--store-faint)]"><span className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--store-faint)] text-[12px]">✓</span> pagamento</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.1fr]">
        {/* painel visual (desktop) */}
        <div className="relative hidden min-h-[calc(100vh-49px)] lg:block">
          <img src={sideImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        </div>

        {/* conteúdo */}
        <div className="mx-auto w-full max-w-[680px] px-4 py-7 sm:px-8">
          <button type="button" onClick={() => router.back()} className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--store-muted)] hover:text-[var(--store-ink)]"><CaretLeft weight="bold" />voltar</button>

          <div className="mt-4 flex items-center gap-3.5">
            <img src="/brand/logo.svg" alt={shopName} className="h-10 w-auto" />
            <div>
              <div className="font-display text-[15px] font-extrabold leading-tight">{tagline}</div>
              <div className="mt-1 flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px] font-semibold text-[var(--store-muted)]">
                <span className="flex items-center gap-1"><ShieldCheck weight="fill" className="text-[var(--store-primary,#18181B)]" />Compra segura</span>
                <span className="flex items-center gap-1"><Truck weight="fill" className="text-[var(--store-primary,#18181B)]" />Entrega em todo o Brasil</span>
                <span className="flex items-center gap-1"><LockSimple weight="fill" className="text-[var(--store-primary,#18181B)]" />Checkout seguro</span>
              </div>
            </div>
          </div>

          {/* O h1 é invisível de propósito, como o de /checkout e /oferta: esta tela é o passo 2 de
              três (a barra de progresso acima conta 1 quantidade · 2 escolha · 3 pagamento), e o
              passo 1 vive em outra página. Sem ele a página não tinha h1 nenhum e começava em
              "2." — e os dois passos, que são irmãos da mesma lista, estavam em níveis
              diferentes com o mesmo tamanho na tela. */}
          <h1 className="sr-only">Monte seu pedido</h1>
          <h3 className="font-display mt-6">2. Selecione os produtos</h3>
          <p className="mt-0.5 text-[13.5px] text-[var(--store-muted)]">
            {remaining > 0 ? `Escolha mais ${remaining} ${remaining === 1 ? "item" : "itens"} pra completar seu pedido.` : "Tudo escolhido! Revise abaixo e siga pro pagamento."}
          </p>

          <div className="mt-4 flex flex-col gap-3">
            {products.map((p) => {
              const n = qty[p.variantId ?? ""] ?? 0;
              return (
                <div key={p.slug} className={`relative flex items-center gap-3.5 rounded-2xl border-2 bg-white p-3.5 ${n > 0 ? "border-[var(--store-cta,#D97706)]" : "border-[var(--store-line-2)]"} ${p.soldOut ? "opacity-50" : ""}`}>
                  {p.badge && <span className="absolute -top-2.5 right-4 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.4px]" style={{ background: p.badge.bg, color: p.badge.fg }}>{p.badge.label}</span>}
                  <div className="flex h-[62px] w-[62px] flex-none items-center justify-center overflow-hidden rounded-xl bg-[var(--store-surface-2)]">
                    {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-contain p-1" /> : <span className="font-display text-[20px] font-extrabold text-[var(--store-primary,#18181B)]/30">{p.title[0]}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    {p.weight && <div className="text-[11.5px] text-[var(--store-muted)]">{p.weight}</div>}
                    <div className="font-display truncate text-[15px] font-extrabold">{p.title}</div>
                    <Link href={`/produto/${encodeURIComponent(p.slug)}`} className="text-[12px] font-semibold text-[var(--store-muted)] underline underline-offset-2">ver produto</Link>
                  </div>
                  {n > 0 ? (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => bump(p, -1)} aria-label={`Tirar ${p.title}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--store-chrome-bg,#18181B)] text-[var(--store-chrome-text,#ffffff)]"><Minus weight="bold" /></button>
                      <span className="font-display w-6 text-center text-[16px] font-extrabold">{n}</span>
                      <button type="button" onClick={() => bump(p, 1)} disabled={remaining <= 0} aria-label={`Adicionar ${p.title}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--store-chrome-bg,#18181B)] text-[var(--store-chrome-text,#ffffff)] disabled:opacity-40"><Plus weight="bold" /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => bump(p, 1)} disabled={p.soldOut || remaining <= 0} className="font-display rounded-full bg-[var(--store-chrome-bg,#18181B)] px-5 py-2.5 text-[13px] font-extrabold text-[var(--store-chrome-text,#ffffff)] disabled:opacity-40">Adicionar +</button>
                  )}
                </div>
              );
            })}
          </div>

          {/* frequência de envio — só com política de assinatura REAL na loja */}
          {subscription && (
            <>
              <h3 className="font-display mt-7">3. Selecione a frequência de envio</h3>
              <div className="mt-3 flex flex-col gap-3">
                <button type="button" onClick={() => setMode("assinatura")} className={`rounded-2xl border-2 px-5 py-4 text-left ${mode === "assinatura" ? "border-[var(--store-chrome-bg,#18181B)] bg-white" : "border-[var(--store-line-2)] bg-white"}`}>
                  <span className="flex items-center justify-between">
                    <span className="flex items-center gap-2.5">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${mode === "assinatura" ? "border-[var(--store-chrome-bg,#18181B)]" : "border-[var(--store-faint)]"}`}>{mode === "assinatura" && <span className="h-2.5 w-2.5 rounded-full bg-[var(--store-chrome-bg,#18181B)]" />}</span>
                      <span className="font-display text-[16px] font-extrabold">Assinatura {subscription.frequencies.length === 1 ? subscription.frequencies[0].title : ""}</span>
                    </span>
                    {pct ? <span className="font-display text-[15px] font-extrabold text-[var(--store-ink)]">{formatBRL((products[0]?.price ?? 0) * (1 - pct / 100))}<span className="text-[12px] font-semibold text-[var(--store-muted)]">/unidade</span></span> : null}
                  </span>
                  {mode === "assinatura" && (
                    <span className="mt-2.5 flex flex-col gap-1.5 text-[13px] font-semibold text-[var(--store-ink-2)]">
                      {pct ? <span className="flex items-center gap-1.5"><CheckCircle weight="fill" className="text-[var(--store-primary,#18181B)]" />Economize {formatBRL(totalFull - total)} <span className="rounded-full bg-[var(--store-cta-soft,#FDF0DC)] px-2 py-0.5 text-[11px] font-extrabold text-[var(--store-cta-fg,#1C1207)]">{pct}% OFF</span></span> : null}
                      <span className="flex items-center gap-1.5"><CheckCircle weight="fill" className="text-[var(--store-primary,#18181B)]" />Escolha quando quer receber</span>
                      <span className="flex items-center gap-1.5"><CheckCircle weight="fill" className="text-[var(--store-primary,#18181B)]" />Pause ou modifique quando quiser</span>
                      {subscription.frequencies.length > 1 && (
                        <span className="mt-1 block text-[11.5px] font-medium leading-[1.4] text-[var(--store-muted)]">A frequência vale para todos os itens assinados deste pedido.</span>
                      )}
                      {subscription.frequencies.length > 1 && (
                        <span className="mt-1 flex flex-wrap gap-2">
                          {subscription.frequencies.map((f) => (
                            <button key={f.id} type="button" onClick={(e) => { e.stopPropagation(); setFreqId(f.id); }} className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold ${freqId === f.id ? "border-[var(--store-chrome-bg,#18181B)] bg-[var(--store-chrome-bg,#18181B)] text-[var(--store-chrome-text,#ffffff)]" : "border-[var(--store-line-2)] bg-white text-[var(--store-ink-2)]"}`}>{f.title}</button>
                          ))}
                        </span>
                      )}
                    </span>
                  )}
                </button>
                <button type="button" onClick={() => setMode("unica")} className={`flex items-center justify-between rounded-2xl border-2 px-5 py-4 text-left ${mode === "unica" ? "border-[var(--store-chrome-bg,#18181B)] bg-white" : "border-[var(--store-line-2)] bg-white"}`}>
                  <span className="flex items-center gap-2.5">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${mode === "unica" ? "border-[var(--store-chrome-bg,#18181B)]" : "border-[var(--store-faint)]"}`}>{mode === "unica" && <span className="h-2.5 w-2.5 rounded-full bg-[var(--store-chrome-bg,#18181B)]" />}</span>
                    <span className="font-display text-[16px] font-extrabold">Compra Única</span>
                  </span>
                  <span className="font-display text-[15px] font-extrabold">{formatBRL(products[0]?.price ?? 0)}<span className="text-[12px] font-semibold text-[var(--store-muted)]">/unidade</span></span>
                </button>
              </div>
            </>
          )}

          {error && <p className="mt-4 rounded-xl bg-[var(--store-sale-soft)] px-4 py-3 text-[13.5px] font-semibold text-[var(--store-sale)]">{error}</p>}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              {picked > 0 && <span className="rounded-full bg-[var(--store-primary-soft,#F1F1F3)] px-3 py-1 text-[12px] font-bold text-[var(--store-primary,#18181B)]">{formatBRL(perUnit)}/unidade</span>}
              {mode === "assinatura" && pct > 0 && <span className="rounded-full bg-[var(--store-cta-soft,#FDF0DC)] px-3 py-1 text-[12px] font-extrabold text-[var(--store-cta-fg,#1C1207)]">{pct}%OFF</span>}
            </span>
            <span className="text-right">
              {total < totalFull && <span className="mr-2 text-[12.5px] text-[var(--store-faint)] line-through">De {formatBRL(totalFull)}</span>}
              <span className="font-display text-[20px] font-extrabold">{formatBRL(total)}</span>
            </span>
          </div>

          <button type="button" onClick={checkout} disabled={busy || remaining > 0 || picked === 0}
            className="font-display mt-4 w-full rounded-full bg-[var(--store-cta,#D97706)] py-4 text-[15.5px] font-extrabold tracking-[0.3px] text-[var(--store-cta-fg,#1C1207)] transition-colors hover:bg-[var(--store-cta-dark,#B45309)] disabled:bg-[var(--store-faint)] disabled:text-white">
            {busy ? "Preparando o pagamento..." : remaining > 0 ? `Selecione mais ${remaining} ${remaining === 1 ? "pacote" : "pacotes"} →` : "Ir pro pagamento →"}
          </button>

          <div className="mt-4 mb-8 flex items-start gap-3.5 rounded-2xl border-2 border-dashed border-[var(--store-cta,#D97706)]/60 bg-white px-5 py-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--store-primary-soft,#F1F1F3)] text-[var(--store-primary,#18181B)]"><ShieldCheck weight="fill" className="text-[22px]" /></span>
            <div className="text-[13px] leading-[1.5] text-[var(--store-muted)]">
              <span className="block text-[11.5px]">Seu pedido está protegido por</span>
              <span className="font-display block text-[15px] font-extrabold text-[var(--store-ink)]">Compra segura e troca fácil</span>
              Arrependimento em até 7 dias após o recebimento (CDC).
            </div>
          </div>
        </div>
      </div>

      {/* mini rodapé da marca */}
      <footer className="bg-[var(--store-chrome-bg,#18181B)]">
        <div className="mx-auto flex max-w-[var(--container-max,1240px)] flex-wrap items-center justify-between gap-3 px-6 py-5 text-[12.5px] font-semibold text-[var(--store-chrome-muted)]">
          <span className="font-display text-[15px] font-extrabold text-[var(--store-chrome-text,#ffffff)]">{shopName}</span>
          <span className="flex items-center gap-5">
            <Link href="/privacidade" className="no-underline hover:text-[var(--store-chrome-text,#ffffff)]">Política de Privacidade</Link>
            <Link href="/termos" className="no-underline hover:text-[var(--store-chrome-text,#ffffff)]">Termos de Uso</Link>
            {/* obrigatório (contrato Unbox) — não remova */}
            <PoweredByUnbox />
          </span>
        </div>
      </footer>
    </div>
  );
}
