"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Truck, MapPin, ShieldCheck, ArrowsClockwise, Package, Tag, Lightning,
  ProhibitInset, GrainsSlash, Leaf, SealCheck, Star, StarHalf, ShoppingCartSimple, GlobeHemisphereWest,
} from "@phosphor-icons/react/dist/ssr";
import { useCart } from "@/components/cart/cart-provider";
import { trackViewItem } from "@/lib/analytics";
import { formatBRL, maskCep, onlyDigits } from "@/lib/format";
import { PaymentChips } from "@/components/product/pdp/payment-chips";
import { FREE_SHIPPING_THRESHOLD, PIX_DISCOUNT_PCT } from "@/lib/store-config";
import { goToCheckout } from "@/lib/checkout-nav";
// EDITOR: módulo de cliente ("use client"): aqui o namespace `Editable.*` é a forma de uso (README §4).
import { Editable } from "@/lib/editable";

export interface PdpVariant {
  id: string;
  label: string;
  price: number | null;
  displayPrice: string;
  oldPrice: number | null;
}

/** Tamanho da MESMA família (outro produto Unbox). Selecionar = navegar para o slug. */
export interface PdpSizeOption {
  slug: string;
  label: string; // tamanho, ex.: "250 g", "500 ml", "M"
  displayPrice: string;
  isSoldOut: boolean;
  isCurrent: boolean;
}

/** Produto RELACIONADO (outra família da mesma linha) p/ navegar — ver RELATED_GROUPS. */
export interface PdpRelatedOption {
  slug: string;
  label: string; // nome do produto
  sublabel?: string; // tamanho, quando houver
  displayPrice: string;
  imageUrl?: string | null;
  isSoldOut: boolean;
  isCurrent: boolean;
}

export interface PdpSubscription {
  percentOff: number | null;
  frequencies: { id: string; title: string; note?: string }[];
}

const FREE_SHIP_THRESHOLD = FREE_SHIPPING_THRESHOLD;
const PIX_FACTOR = 1 - PIX_DISCOUNT_PCT / 100;

/** Selo (benefício) derivado dos atributos REAIS do enriquecimento — só os positivos, no máx. 4. */
export interface PdpBenefit { icon: string; label: string; flag?: string }

const BENEFIT_ICONS: Record<string, React.ComponentType<any>> = {
  "no-msg": ProhibitInset,
  "no-gluten": GrainsSlash,
  vegan: Leaf,
  imported: GlobeHemisphereWest,
};
// NÃO existe selo default. A foundation mostrava "Sem MSG · Sem glúten · Ingredientes naturais"
// em todo produto sem enriquecimento — afirmação de alimento aparecendo em loja de cosmético,
// roupa ou eletrônico, e inventada mesmo em loja de alimento. Sem dado, sem selo.

// EDITOR: a PDP é um MOLDE (um valor para todos os produtos). Aqui dentro, nome, preço, variantes,
// tamanhos, assinatura, quantidade, frete e os botões de compra são DADO do catálogo ou MECÂNICA da
// loja, e ficam fora do editor (`data-editor-ignore`, README do editor §8). O que é copy da marca
// vira primitivo: o chapéu acima do nome, os selos de confiança abaixo do botão e o "Pague com:".
// Os selos são uma lista editável com id por PAPEL (não por posição), como os da faixa de confiança.
const SELOS = [
  { id: "selo-seguranca", label: "Selo de compra segura", icon: ShieldCheck, texto: "Compra 100% segura" },
  { id: "selo-troca", label: "Selo de troca", icon: ArrowsClockwise, texto: "Troca garantida" },
  { id: "selo-entrega", label: "Selo de entrega", icon: Package, texto: "Entrega para todo o Brasil" },
];

export function BuyBox({
  productId,
  title,
  shortDescription,
  imageUrl,
  variants,
  benefits,
  sizeOptions = [],
  relatedTitle,
  relatedOptions = [],
  subscription,
  minQty,
  maxQty,
  isSoldOut,
  ratingAverage,
  ratingCount,
}: {
  productId: string;
  title: string;
  shortDescription?: string | null;
  imageUrl?: string;
  variants: PdpVariant[];
  benefits?: PdpBenefit[];
  sizeOptions?: PdpSizeOption[];
  relatedTitle?: string;
  relatedOptions?: PdpRelatedOption[];
  subscription: PdpSubscription | null;
  minQty: number;
  maxQty: number | null;
  isSoldOut: boolean;
  /** nota média REAL (reviews do enriquecimento). Sem ela o bloco de avaliação não aparece. */
  ratingAverage?: number;
  ratingCount?: number;
}) {
  const router = useRouter();
  const { add, setOpen, open: cartOpen } = useCart();

  const sellable = variants.filter((v) => v.price != null);
  // Cada produto tem uma única variante ("Quantidade: 1 un"); o tamanho é outro produto (sizeOptions).
  const [variantId] = React.useState(sellable[0]?.id ?? variants[0]?.id);
  const [qty, setQty] = React.useState(Math.max(1, minQty || 1));
  const [sub, setSub] = React.useState(false);
  const [freqId, setFreqId] = React.useState(subscription?.frequencies[0]?.id);
  const [busy, setBusy] = React.useState(false);


  // view_item / ViewContent — uma vez por produto exibido.
  React.useEffect(() => {
    trackViewItem({ id: productId, name: title, variant: sellable[0]?.label, price: sellable[0]?.price ?? undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  // benefits vindo do enriquecimento (positivos); se ausente, usa o fallback genérico. Máx. 4.
  const benefitList = benefits ?? [];
  // Só existe desconto de assinatura se a política de preço do backend disser quanto. Sem
  // isso, pct = null: assinar custa o preço normal e nenhum "-N%" aparece.
  const pct = subscription?.percentOff ?? null;
  const canBuy = !isSoldOut && variant?.price != null;

  const base = variant?.price ?? 0;
  // Preço "DE" só quando existe compareAtPrice REAL do backend — sem fabricar desconto.
  const old = variant?.oldPrice ?? null;
  const eff = sub && pct != null ? base * (1 - pct / 100) : base;
  const pix = Math.floor(eff * PIX_FACTOR * 100) / 100;
  const hasRealDiscount = old != null && old > pix;
  const savings = hasRealDiscount ? old - pix : 0;
  const savingsPct = hasRealDiscount ? Math.round((1 - pix / old) * 100) : 0;
  const lineTotal = eff * qty;
  // Régua de frete grátis só existe quando há regra real configurada (threshold null = some tudo).
  const remaining = FREE_SHIP_THRESHOLD != null ? Math.max(0, FREE_SHIP_THRESHOLD - lineTotal) : 0;
  const shipPct = FREE_SHIP_THRESHOLD != null ? Math.min(100, Math.round((lineTotal / FREE_SHIP_THRESHOLD) * 100)) : 0;

  async function handleAdd(thenCheckout = false) {
    if (!canBuy || !variant) return false;
    setBusy(true);
    const ok = await add({
      productId,
      variantId: variant.id,
      price: variant.price ?? 0,
      quantity: qty,
      thumbnail: imageUrl,
      title,
      isRecurring: sub && !!subscription,
      recurringItemsFrequencyId: sub && subscription ? freqId : undefined,
    });
    setBusy(false);
    if (ok && thenCheckout) {
      setOpen(false);
      void goToCheckout(router);
    }
    return ok;
  }

  return (
    <div>
      <Editable.Text as="div" path="chapeu" fallback="PRODUTO" label="Chapéu acima do nome do produto" className="text-xs font-extrabold tracking-[1.5px] text-[var(--store-primary,#18181B)]" />
      {/* nome do produto: dado do catálogo */}
      <h1 data-editor-ignore className="font-display mt-2 mb-2.5 text-[27px] font-extrabold leading-[1.12] text-[var(--store-ink)] sm:text-[34px]">
        {title}
      </h1>

      {/* rating — SÓ com avaliação real. A foundation não exibe nota, contagem nem contador de
          vendas sem dado: os valores fixos que existiam aqui foram ao ar em loja real e saíram. */}
      {ratingAverage != null && ratingCount != null && ratingCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3.5" data-editor-ignore>
          <div className="flex items-center gap-1.5">
            <span className="flex items-center text-[17px] text-[var(--store-cta-dark)]" aria-label={`${ratingAverage.toFixed(1)} de 5`}>
              {[1, 2, 3, 4, 5].map((i) =>
                ratingAverage >= i - 0.25 ? <Star key={i} weight="fill" /> : ratingAverage >= i - 0.75 ? <StarHalf key={i} weight="fill" /> : <Star key={i} weight="regular" />,
              )}
            </span>
            <b className="text-[15px]">{ratingAverage.toFixed(1).replace(".", ",")}</b>
            <a href="#avaliacoes" className="text-sm font-semibold text-[var(--store-primary,#18181B)] no-underline">({ratingCount.toLocaleString("pt-BR")} {ratingCount === 1 ? "avaliação" : "avaliações"})</a>
          </div>
        </div>
      )}

      {shortDescription && (
        <p className="mb-4 text-[15px] leading-[1.6] text-[var(--store-ink-2)]" data-editor-ignore>{shortDescription}</p>
      )}

      {/* benefit icons — atributos POSITIVOS do enriquecimento (máx. 4) */}
      {benefitList.length > 0 && (
        <div className="mb-[22px] grid gap-2" style={{ gridTemplateColumns: `repeat(${benefitList.length}, minmax(0,1fr))` }} data-editor-ignore>
          {benefitList.map((b, i) => {
            const Icon = BENEFIT_ICONS[b.icon] ?? SealCheck;
            return (
              <div key={i} className="flex flex-col items-center gap-2 text-center">
                <span className="relative inline-flex">
                  <Icon className="text-[34px] text-[var(--store-primary,#18181B)]" />
                  {b.flag && (
                    <span className="absolute -bottom-1 -right-1.5 text-[16px] not-italic leading-none drop-shadow-sm">{b.flag}</span>
                  )}
                </span>
                <span className="text-[13px] font-semibold text-[var(--store-ink-2)]">{b.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* price: dado e mecânica, fora do editor */}
      {savings > 0 && (
        <div data-editor-ignore className="mb-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[var(--store-sale-soft)] px-3 py-1.5 text-[13px] font-extrabold text-[var(--store-sale)]">
          <Tag weight="fill" /> Economize {formatBRL(savings)} (-{savingsPct}%)
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3" data-editor-ignore>
        <span className="font-display text-[33px] font-extrabold leading-none text-[var(--store-primary,#18181B)] sm:text-[40px]">{formatBRL(pix)}</span>
        {hasRealDiscount && <span className="mb-1.5 text-[18px] text-[var(--store-faint)] line-through">{formatBRL(old)}</span>}
        {PIX_DISCOUNT_PCT > 0 && (
          <span className="mb-1.5 rounded-md bg-[var(--store-primary-soft,#F1F1F3)] px-2.5 py-1 text-[13px] font-extrabold text-[var(--store-primary,#18181B)]">no Pix · {PIX_DISCOUNT_PCT}% OFF</span>
        )}
      </div>
      <div className="mt-2 text-sm text-[var(--store-ink-2)]" data-editor-ignore>
        <b>3x de {formatBRL(eff / 3)}</b> sem juros ou <b className="text-base text-[var(--store-ink)]">{formatBRL(eff)}</b> no crédito.
      </div>

      {/* Não existe "apenas N unidades": era um contador que descia sozinho enquanto a pessoa lia a
          página, sem ler estoque nenhum — dark pattern e afirmação falsa. Se o catálogo expuser
          quantidade real um dia, é ela que entra aqui, e só ela. */}

      {/* size selector — produtos da MESMA família (cada tamanho é uma página própria) */}
      {sizeOptions.length > 1 && (
        <div className="mt-6" data-editor-ignore>
          <div className="mb-2.5 text-sm font-bold text-[var(--store-ink-2)]">Escolha o tamanho</div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {sizeOptions.map((o) => {
              const sel = o.isCurrent;
              const cls =
                "rounded-xl border-2 px-1.5 py-4 text-center text-[var(--store-ink)] no-underline transition-colors";
              const style = {
                background: sel ? "var(--store-primary-soft,#F1F1F3)" : "var(--store-surface)",
                borderColor: sel ? "var(--store-primary,#18181B)" : "var(--store-line-2)",
                ...(o.isSoldOut && !sel ? { opacity: 0.5 } : {}),
              } as React.CSSProperties;
              const inner = (
                <>
                  <div className="text-[15px] font-bold">{o.label}</div>
                  <div className="mt-1 text-sm font-bold" style={{ color: sel ? "var(--store-primary,#18181B)" : "var(--store-ink-2)" }}>
                    {o.isSoldOut ? "Esgotado" : o.displayPrice}
                  </div>
                </>
              );
              return sel ? (
                <div key={o.slug} aria-current="true" className={`${cls} cursor-default`} style={style}>
                  {inner}
                </div>
              ) : (
                <Link key={o.slug} href={`/produto/${o.slug}`} prefetch={false} scroll={false} className={`${cls} cursor-pointer block`} style={style}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* related selector — produtos DIFERENTES da mesma linha (RELATED_GROUPS), p/ navegar entre eles */}
      {relatedOptions.length > 1 && (
        <div className="mt-6" data-editor-ignore>
          <div className="mb-2.5 text-sm font-bold text-[var(--store-ink-2)]">{relatedTitle ?? "Veja também"}</div>
          <div className="grid grid-cols-2 gap-2.5">
            {relatedOptions.map((o) => {
              const sel = o.isCurrent;
              const cls = "flex items-center gap-3 rounded-xl border-2 p-2.5 text-left text-[var(--store-ink)] no-underline transition-colors";
              const style = {
                background: sel ? "var(--store-primary-soft,#F1F1F3)" : "var(--store-surface)",
                borderColor: sel ? "var(--store-primary,#18181B)" : "var(--store-line-2)",
                ...(o.isSoldOut && !sel ? { opacity: 0.5 } : {}),
              } as React.CSSProperties;
              const inner = (
                <>
                  <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                    {o.imageUrl && <Image src={o.imageUrl} alt={o.label} fill sizes="48px" className="object-contain" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold leading-[1.2] line-clamp-2">{o.label}</span>
                    <span className="mt-0.5 block text-[12.5px] font-bold" style={{ color: sel ? "var(--store-primary,#18181B)" : "var(--store-ink-2)" }}>
                      {o.isSoldOut ? "Esgotado" : o.displayPrice}{o.sublabel ? ` · ${o.sublabel}` : ""}
                    </span>
                  </span>
                </>
              );
              return sel ? (
                <div key={o.slug} aria-current="true" className={`${cls} cursor-default`} style={style}>{inner}</div>
              ) : (
                <Link key={o.slug} href={`/produto/${o.slug}`} prefetch={false} scroll={false} className={`${cls} cursor-pointer`} style={style}>{inner}</Link>
              );
            })}
          </div>
        </div>
      )}

      {/* subscription */}
      {subscription && (
        <div className="mt-[22px] flex flex-col gap-2.5" data-editor-ignore>
          <button
            type="button"
            onClick={() => setSub(false)}
            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border-[1.5px] px-4 py-3.5 text-left"
            style={{ background: !sub ? "var(--store-primary-soft,#F1F1F3)" : "var(--store-surface)", borderColor: !sub ? "var(--store-primary,#18181B)" : "var(--store-line-2)" }}
          >
            <span className="flex items-center gap-2.5">
              <Radio on={!sub} />
              <span className="text-sm font-bold">Compra única</span>
            </span>
            <span className="text-[15px] font-extrabold">{formatBRL(base)}</span>
          </button>
          <button
            type="button"
            onClick={() => setSub(true)}
            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border-[1.5px] px-4 py-3.5 text-left"
            style={{ background: sub ? "var(--store-primary-soft,#F1F1F3)" : "var(--store-surface)", borderColor: sub ? "var(--store-primary,#18181B)" : "var(--store-line-2)" }}
          >
            <span className="flex items-center gap-2.5">
              <Radio on={sub} />
              <span className="flex flex-col items-start">
                <span className="flex items-center gap-[7px] text-sm font-bold">
                  Assinar e economizar
                  {pct != null && <span className="rounded-full bg-[var(--store-primary,#18181B)] px-[7px] py-0.5 text-[10px] font-extrabold text-white">-{pct}%</span>}
                </span>
                <span className="text-[11.5px] text-[var(--store-muted)]">Entrega recorrente · cancele quando quiser</span>
              </span>
            </span>
            <span className="text-[15px] font-extrabold text-[var(--store-primary,#18181B)]">{formatBRL(pct != null ? base * (1 - pct / 100) : base)}</span>
          </button>

          {sub && subscription.frequencies.length > 0 && (
            <div className="mt-0.5 rounded-xl border border-[var(--store-line)] bg-[var(--store-bg)] p-3.5">
              <div className="mb-2.5 text-[12.5px] font-bold text-[var(--store-ink-2)]">Frequência de entrega</div>
              {subscription.frequencies.length > 1 && (
                <p className="mb-2.5 text-[11.5px] leading-[1.4] text-[var(--store-muted)]">A frequência vale para todos os itens assinados deste pedido.</p>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                {subscription.frequencies.map((f) => {
                  const on = f.id === freqId;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFreqId(f.id)}
                      className="cursor-pointer rounded-md border-[1.5px] px-3 py-3 text-left text-[var(--store-ink)]"
                      style={{ background: on ? "var(--store-primary-soft,#F1F1F3)" : "var(--store-surface)", borderColor: on ? "var(--store-primary,#18181B)" : "var(--store-line-2)" }}
                    >
                      <span className="flex items-center gap-2">
                        <Radio on={on} />
                        <span className="text-[13.5px] font-bold">{f.title}</span>
                      </span>
                      {f.note && <span className="mt-[5px] block text-[11.5px] text-[var(--store-muted)]">{f.note}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* qty + CTA: mecânica de compra ("Adicionar ao carrinho" não é copy, README §8) */}
      <div className="mt-5 flex items-stretch gap-3" data-editor-ignore>
        <div className="flex items-center overflow-hidden rounded-xl border-[1.5px] border-[var(--store-line-2)] bg-white">
          <button type="button" onClick={() => setQty((q) => Math.max(minQty || 1, q - 1))} className="h-[58px] w-[46px] cursor-pointer border-none bg-transparent text-xl text-[var(--store-ink-2)]">−</button>
          <span className="w-[42px] text-center text-base font-extrabold">{qty}</span>
          <button type="button" onClick={() => setQty((q) => (maxQty ? Math.min(maxQty, q + 1) : q + 1))} className="h-[58px] w-[46px] cursor-pointer border-none bg-transparent text-xl text-[var(--store-ink-2)]">+</button>
        </div>
        <button
          type="button"
          onClick={() => handleAdd(false)}
          disabled={!canBuy || busy}
          className="font-display flex h-[58px] flex-1 cursor-pointer items-center justify-center rounded-xl bg-[var(--store-primary,#18181B)] text-[15px] font-bold tracking-[0.5px] text-white shadow-[var(--store-shadow-cta)] transition-colors hover:bg-[var(--store-primary-dark,#09090B)] disabled:opacity-60"
        >
          {isSoldOut ? "ESGOTADO" : sub ? "ASSINAR" : "ADICIONAR AO CARRINHO"}
        </button>
      </div>
      <button
        type="button"
        onClick={() => handleAdd(true)}
        disabled={!canBuy || busy}
        data-editor-ignore
        className="font-display mt-[11px] flex h-[54px] w-full cursor-pointer items-center justify-center rounded-xl bg-[var(--store-cta,#D97706)] text-[15px] font-extrabold tracking-[0.5px] text-[var(--store-cta-fg,#1C1207)] transition-colors hover:bg-[var(--store-cta-dark,#B45309)] disabled:opacity-60"
      >
        COMPRAR AGORA
      </button>

      {/* free shipping progress — só renderiza com regra real de frete grátis configurada */}
      {FREE_SHIP_THRESHOLD != null && (
        <div className="mt-4 rounded-xl border border-[var(--store-line)] bg-white px-[15px] py-[13px]" data-editor-ignore>
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--store-ink-2)]">
            <Truck weight="bold" className="text-[17px] text-[var(--store-primary,#18181B)]" />
            {remaining > 0 ? (
              <span>Faltam <b className="text-[var(--store-sale)]">{formatBRL(remaining)}</b> para você ganhar <b>Frete Grátis</b></span>
            ) : (
              <span>Você ganhou <b className="text-[var(--store-primary,#18181B)]">Frete Grátis</b>!</span>
            )}
          </div>
          <div className="mt-[9px] h-[7px] overflow-hidden rounded-full bg-[var(--store-surface-2)]">
            <div className="h-full rounded-full bg-gradient-to-r from-[var(--store-primary,#18181B)] to-[var(--store-primary)]" style={{ width: `${shipPct}%` }} />
          </div>
        </div>
      )}

      {/* shipping calculator */}
      <ShippingCalc productId={productId} variantId={variant?.id ?? ""} price={variant?.price ?? null} />

      {/* mini trust: selos de confiança são copy da marca, lista editável com id por papel */}
      <div className="mt-4 flex flex-wrap gap-[18px] text-[12.5px] font-semibold text-[var(--store-ink-2)]">
        <Editable.Sections nested>
          {SELOS.map((s) => (
            <Editable.Section key={s.id} item id={s.id} label={s.label}>
              <span className="flex items-center gap-1.5">
                <Editable.Icon path="icone" label="Ícone do selo" size={17} className="text-[17px] text-[var(--store-primary,#18181B)]">
                  <s.icon />
                </Editable.Icon>
                <Editable.Text path="texto" fallback={s.texto} label="Texto do selo" />
              </span>
            </Editable.Section>
          ))}
        </Editable.Sections>
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs text-[var(--store-muted)]">
        <Editable.Text path="pagamento" fallback="Pague com:" label="Texto antes das bandeiras" className="font-semibold" />
        {/* bandeiras: selo de terceiro, fora do editor (o próprio componente se marca) */}
        <PaymentChips />
      </div>

      {/* sticky add-to-cart bar — escondida quando o carrinho lateral está aberto */}
      {!cartOpen && <StickyBar
        title={title}
        imageUrl={imageUrl}
        qty={qty}
        total={formatBRL(pix * qty)}
        pixOff={PIX_DISCOUNT_PCT}
        onInc={() => setQty((q) => (maxQty ? Math.min(maxQty, q + 1) : q + 1))}
        onDec={() => setQty((q) => Math.max(minQty || 1, q - 1))}
        onAdd={() => handleAdd(false)}
        disabled={!canBuy || busy}
      />}
    </div>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <span
      className="inline-block h-[18px] w-[18px] shrink-0 rounded-full border-2"
      style={{
        borderColor: on ? "var(--store-primary,#18181B)" : "var(--store-faint)",
        background: on ? "radial-gradient(var(--store-primary,#18181B) 0 38%, var(--store-surface) 42%)" : "var(--store-surface)",
      }}
    />
  );
}

function ShippingCalc({ productId, variantId, price }: { productId: string; variantId: string; price: number | null }) {
  const [cep, setCep] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [options, setOptions] = React.useState<any[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOptions(null);
    if (onlyDigits(cep).length !== 8) {
      setError("Informe um CEP válido (8 dígitos).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, variantId, price, postal: onlyDigits(cep) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Falha ao calcular o frete.");
      setOptions(data.options ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // calculadora de frete: formulário e resultado da cotação, mecânica da loja
  return (
    <div className="mt-3 rounded-xl border border-[var(--store-line)] bg-white px-[15px] py-3.5" data-editor-ignore>
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--store-ink-2)]">
          <MapPin weight="bold" className="text-[17px] text-[var(--store-primary,#18181B)]" /> Calcular frete e prazo
        </div>
        <a href="https://buscacepinter.correios.com.br/" target="_blank" rel="noreferrer" className="text-xs font-semibold text-[var(--store-muted)] no-underline">Não sei meu CEP</a>
      </div>
      <form onSubmit={submit} className="mt-2.5 flex gap-2.5">
        <input
          value={cep}
          onChange={(e) => setCep(maskCep(e.target.value))}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          aria-label="CEP"
          className="h-11 min-w-0 flex-1 rounded-md border border-[var(--store-line-2)] bg-white px-3.5 text-sm font-semibold text-[var(--store-ink)] outline-none"
        />
        <button type="submit" disabled={loading} className="font-display h-11 shrink-0 cursor-pointer rounded-md bg-[var(--store-chrome-bg)] px-5 text-[13.5px] font-bold text-white disabled:opacity-60">
          {loading ? "..." : "Calcular"}
        </button>
      </form>
      {error && <p className="mt-2 text-[13px] text-[var(--store-sale)]" role="alert">{error}</p>}
      {options && options.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {options.map((o, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border border-[var(--store-surface-2)] px-3.5 py-[11px]">
              <div className="flex items-center gap-2.5">
                <Lightning weight="bold" className="text-[17px] text-[var(--store-cta,#D97706)]" />
                <div>
                  <div className="text-[13px] font-bold text-[var(--store-ink)]">{o.displayName}</div>
                  {o.days != null && <div className="text-[11.5px] text-[var(--store-muted)]">Receba em {o.days} dia(s)</div>}
                </div>
              </div>
              <span className="text-[13.5px] font-extrabold text-[var(--store-primary,#18181B)]">{o.price}</span>
            </div>
          ))}
        </div>
      )}
      {options && options.length === 0 && <p className="mt-2 text-[13px] text-[var(--store-muted)]">Sem opções para este CEP.</p>}
    </div>
  );
}

function StickyBar({
  title, imageUrl, qty, total, pixOff, onInc, onDec, onAdd, disabled,
}: {
  title: string; imageUrl?: string; qty: number; total: string; pixOff: number;
  onInc: () => void; onDec: () => void; onAdd: () => void; disabled: boolean;
}) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      const nearBottom = window.innerHeight + y > document.body.scrollHeight - 340;
      setShow(y > 600 && !nearBottom);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // barra fixa de compra: nome, total e botão são dado e mecânica
  return (
    <div
      data-editor-ignore
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4 transition-all duration-300 ease-out max-md:bottom-[78px]"
      style={{ transform: show ? "translateY(0)" : "translateY(140%)", opacity: show ? 1 : 0 }}
    >
      <div className="pointer-events-auto flex w-full max-w-[680px] items-center gap-[18px] rounded-xl border border-[var(--store-line)] bg-white px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,.16)] max-md:gap-3 max-md:px-3 max-md:py-2.5">
        <div className="relative h-[58px] w-[58px] shrink-0 overflow-hidden rounded-xl border border-[var(--store-line)] bg-[var(--store-line)] max-md:h-[52px] max-md:w-[52px]">
          {imageUrl && <Image src={imageUrl} alt="" fill sizes="58px" className="object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display truncate text-base font-bold leading-[1.15] text-[var(--store-ink)] max-md:text-[14.5px]">{title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="font-display text-[15px] font-extrabold text-[var(--store-primary,#18181B)]">{total}</span>
            {pixOff > 0 && (
              <span className="rounded bg-[var(--store-primary-soft,#F1F1F3)] px-1.5 py-0.5 text-[10px] font-extrabold text-[var(--store-primary,#18181B)]">no Pix · {pixOff}% OFF</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center overflow-hidden rounded-md border-[1.5px] border-[var(--store-line-2)] bg-white">
          <button type="button" onClick={onDec} className="h-[46px] w-10 cursor-pointer border-none bg-transparent text-[19px] text-[var(--store-ink-2)]">−</button>
          <span className="w-[34px] text-center text-[15px] font-extrabold">{qty}</span>
          <button type="button" onClick={onInc} className="h-[46px] w-10 cursor-pointer border-none bg-transparent text-[19px] text-[var(--store-ink-2)]">+</button>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          className="font-display flex h-[50px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[var(--store-primary,#18181B)] px-[34px] text-[15px] font-bold tracking-[0.4px] text-white shadow-[var(--store-shadow-cta)] transition-colors hover:bg-[var(--store-primary-dark,#09090B)] disabled:opacity-60 max-md:px-[18px]">
          <ShoppingCartSimple weight="bold" />ADICIONAR
        </button>
      </div>
    </div>
  );
}
