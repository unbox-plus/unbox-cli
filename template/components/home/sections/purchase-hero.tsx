"use client";

// HERO DE COMPRA — o bloco de conversão principal (padrão das lojas Unbox de produção):
// galeria + título + seletor de quantidade com tiers + vantagens + garantia, como SEÇÃO
// de home (âncora #comprar) ou topo de landing. Produto e preço REAIS (data.featured).
// Tiers em QUANTITY_TIERS (lib/store-config.ts) — só prometa o que o backend cumpre.
// CTA → /carrinho/oferta (passo 2: escolher produtos/variantes + frequência).
//
// EDITOR: é copy da marca e vira caminho da seção: o chapéu (`chapeu`, quando a receita traz), o
// texto (`texto`), o botão (`cta`, um Slot: o <button> tem ícone ao lado e precisa continuar o
// mesmo elemento), as vantagens (LISTA `vantagens.vantagem-N`, com etiqueta, texto e ícone) e as
// duas linhas da garantia (`garantia.chapeu`, `garantia.titulo`). Fica fora do editor, e fora do
// gate por `data-editor-ignore`, o que é DADO ou MECÂNICA (README do editor, §8): foto, nome e preço
// do produto, os tiers de quantidade (configuração comercial), os cálculos de desconto e a frase do
// CDC (texto legal). Para o lojista o topo é BANNER ou "bloco de compra", nunca "hero".
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, CreditCard, Truck, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Editable, EditableScope } from "@/lib/editable";
import { Stars } from "./stars";
import { QUANTITY_TIERS } from "@/lib/store-config";
import { formatBRL } from "@/lib/format";
import type { SectionComponentProps } from "./registry";
import { Foto } from "@/components/ui/foto";

type Perk = { tag: string; text: string; icon?: string };
const PERK_ICONS: Record<string, React.ComponentType<any>> = { shield: ShieldCheck, card: CreditCard, truck: Truck };


export function PurchaseHeroSection({ data, sectionProps = {} }: SectionComponentProps) {
  const router = useRouter();
  const product = data.featured;
  const {
    tagline = "",
    description = "",
    ctaLabel = "2. Escolher os produtos",
    sacEmail = "",
  } = sectionProps as Record<string, string>;
  // Sem perks na receita, o bloco de perks some (nada de "envio com rastreio" por default).
  const perks = (sectionProps.perks as Perk[] | undefined) ?? [];
  const rating = typeof sectionProps.rating === "number" ? (sectionProps.rating as number) : null;

  const defaultIdx = Math.max(0, QUANTITY_TIERS.findIndex((t) => t.selected) !== -1
    ? QUANTITY_TIERS.findIndex((t) => t.selected)
    : Math.floor((QUANTITY_TIERS.length - 1) / 2));
  const [sel, setSel] = React.useState(defaultIdx);
  const [busy, setBusy] = React.useState(false);

  if (!product) return null;
  const tier = QUANTITY_TIERS[sel];
  const unit = product.price;
  const unitOff = unit * (1 - tier.offPct / 100);
  const totalFull = unit * tier.quantity;
  const total = unitOff * tier.quantity;
  const anyOff = QUANTITY_TIERS.some((t) => t.offPct > 0);

  return (
    <div id="comprar" className="mx-auto max-w-[var(--container-max,1240px)] scroll-mt-24 px-4 pt-[42px] sm:px-6">
      <div className="grid gap-9 lg:grid-cols-[1.02fr_0.98fr]">
        {/* galeria (foto do produto: dado do catálogo) */}
        <div className="lg:sticky lg:top-24 lg:self-start" data-editor-ignore="">
          <div className="overflow-hidden rounded-2xl bg-[var(--store-surface-2)]">
            {product.imageUrl
              ? <Foto src={product.imageUrl} alt={product.title} width={1200} height={1200} sizes="(min-width: 1024px) 600px, 100vw" priority className="aspect-square w-full object-contain p-8" />
              : <img src="/brand/ph/photo-a.svg" alt="" className="aspect-square w-full object-cover" />}
          </div>
          <Link href={`/produto/${encodeURIComponent(product.slug)}`} className="mt-3 inline-block text-[13.5px] font-semibold text-[var(--store-primary,#18181B)] underline underline-offset-2">Ver página do produto</Link>
        </div>

        {/* compra */}
        <div>
          <div className="flex items-center gap-2">
            <Stars n={rating} className="text-[16px] text-[var(--store-cta-dark)]" />
            {tagline && <Editable.Text path="chapeu" fallback={tagline} label="Chapéu acima do nome do produto" className="text-[12.5px] font-extrabold uppercase tracking-[0.8px] text-[var(--store-primary,#18181B)]" />}
          </div>
          <h2 className="font-display mt-2.5" data-editor-ignore="">{product.title}</h2>
          {description && <Editable.Text as="p" path="texto" fallback={description} label="Texto do bloco de compra" multiline className="mt-2.5 text-[15px] leading-[1.55] text-[var(--store-muted)]" />}

          <div className="mt-5 store-card rounded-2xl p-5">
            {/* tiers, desconto e totais: configuração comercial e cálculo, fora do editor */}
            <div data-editor-ignore="">
              {anyOff && (
                <>
                  <div className="text-[13.5px] font-extrabold text-[var(--store-ink)]">🔥 Desconto acumulado</div>
                  {tier.offPct > 0 && (
                    <div className="mt-2 rounded-lg bg-[var(--store-cta-soft,#FDF0DC)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--store-cta-fg,#1C1207)]">
                      📦 Você desbloqueou {tier.offPct}% OFF! Economia de {formatBRL(totalFull - total)}
                    </div>
                  )}
                </>
              )}
              <div className={`${anyOff ? "mt-4" : ""} text-[13px] font-bold text-[var(--store-ink)]`}>1. Selecione a quantidade</div>
              <div className="mt-2.5 grid gap-2.5">
                {QUANTITY_TIERS.map((t, i) => {
                  const u = unit * (1 - t.offPct / 100);
                  return (
                    <button key={t.quantity} type="button" onClick={() => setSel(i)}
                      className={`flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-colors ${i === sel ? "border-[var(--store-cta,#D97706)] bg-white shadow-sm" : "border-[var(--store-line-2)] bg-white hover:border-[var(--store-primary,#18181B)]/50"}`}>
                      <span className="flex items-center gap-3">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${i === sel ? "bg-[var(--store-cta,#D97706)]" : "border-2 border-[var(--store-faint)]"}`}>
                          {i === sel && <span className="text-[11px] font-black text-[var(--store-cta-fg,#1C1207)]">✓</span>}
                        </span>
                        <span>
                          <span className="font-display flex items-center gap-2 text-[15px] font-extrabold">
                            {t.quantity} {t.quantity === 1 ? "unidade" : "unidades"}
                            {t.badge && <span className="rounded-full bg-[var(--store-surface-2)] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.4px] text-[var(--store-muted)]">{t.badge}</span>}
                          </span>
                          <span className="mt-0.5 block text-[12.5px] font-semibold text-[var(--store-muted)]">{formatBRL(u)}/unidade{t.perks.length > 0 ? ` · ${t.perks.join(" + ")}` : ""}</span>
                        </span>
                      </span>
                      <span className="text-right">
                        {t.offPct > 0 && <span className="mr-2 rounded-full bg-[var(--store-cta-soft,#FDF0DC)] px-2 py-0.5 text-[11px] font-extrabold text-[var(--store-cta-fg,#1C1207)]">{t.offPct}%OFF</span>}
                        {t.offPct > 0 && <span className="block text-[11.5px] text-[var(--store-faint)] line-through">{formatBRL(unit * t.quantity)}</span>}
                        <span className="font-display text-[16px] font-extrabold text-[var(--store-ink)]">{formatBRL(u * t.quantity)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* vantagens: lista editável (o invólucro do item é display:contents; a célula do grid é o card) */}
            {perks.length > 0 && (
              <div className="mt-5 grid grid-cols-3 gap-2.5">
                <EditableScope path="vantagens">
                  <Editable.Sections nested>
                    {perks.map((p, i) => {
                      const Icon = PERK_ICONS[p.icon ?? ""] ?? ShieldCheck;
                      return (
                        <Editable.Section key={i} item id={`vantagem-${i + 1}`} label={`Vantagem ${i + 1}`}>
                          <div className="overflow-hidden rounded-xl border border-[var(--store-line-2)] text-center">
                            <Editable.Text as="div" path="etiqueta" fallback={p.tag} label="Etiqueta da vantagem" className="bg-[var(--store-chrome-bg,#18181B)] px-1 py-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.5px] text-[var(--store-chrome-text,#ffffff)]" />
                            <div className="flex flex-col items-center gap-1.5 px-2 py-3">
                              <Editable.Icon path="icone" label="Ícone da vantagem" size={22} className="text-[22px] text-[var(--store-primary,#18181B)]">
                                <Icon weight="fill" />
                              </Editable.Icon>
                              <Editable.Text path="texto" fallback={p.text} label="Texto da vantagem" className="text-[11px] font-semibold leading-[1.3] text-[var(--store-ink-2)]" />
                            </div>
                          </div>
                        </Editable.Section>
                      );
                    })}
                  </Editable.Sections>
                </EditableScope>
              </div>
            )}

            {/* resumo + CTA */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2" data-editor-ignore="">
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--store-primary-soft,#F1F1F3)] px-3 py-1 text-[12px] font-bold text-[var(--store-primary,#18181B)]">{formatBRL(unitOff)}/unidade</span>
                {tier.offPct > 0 && <span className="rounded-full bg-[var(--store-cta-soft,#FDF0DC)] px-3 py-1 text-[12px] font-extrabold text-[var(--store-cta-fg,#1C1207)]">{tier.offPct}%OFF</span>}
              </span>
              <span className="text-right">
                {tier.offPct > 0 && <span className="mr-2 text-[12.5px] text-[var(--store-faint)] line-through">De {formatBRL(totalFull)}</span>}
                <span className="font-display text-[19px] font-extrabold">{formatBRL(total)}</span>
              </span>
            </div>
            <Editable.Slot path="cta" type="text" fallback={ctaLabel} label="Botão de compra">
              {(v, attrs, ref, estilo) => (
                <button ref={ref} {...attrs} type="button" disabled={busy} onClick={() => { setBusy(true); router.push(`/carrinho/oferta?quantity=${tier.quantity}`); }}
                  className="font-display mt-3.5 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--store-cta,#D97706)] py-4 text-[15.5px] font-extrabold uppercase tracking-[0.5px] text-[var(--store-cta-fg,#1C1207)] transition-colors hover:bg-[var(--store-cta-dark,#B45309)] disabled:opacity-60" style={estilo}>
                  {busy ? "Preparando..." : v} <ArrowRight weight="bold" />
                </button>
              )}
            </Editable.Slot>
          </div>

          <div className="mt-4 flex items-start gap-3.5 rounded-2xl border-2 border-dashed border-[var(--store-cta,#D97706)]/60 bg-[var(--store-surface)] px-5 py-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--store-primary-soft,#F1F1F3)] text-[var(--store-primary,#18181B)]">
              <Editable.Icon path="garantia.icone" label="Ícone da garantia" size={22} className="text-[22px]">
                <ShieldCheck weight="fill" />
              </Editable.Icon>
            </span>
            <div className="text-[13px] leading-[1.5] text-[var(--store-muted)]">
              <Editable.Text as="span" path="garantia.chapeu" fallback="Seu pedido está protegido por" label="Linha acima da garantia" className="block text-[11.5px]" />
              <Editable.Text as="span" path="garantia.titulo" fallback="Compra segura e troca fácil" label="Título da garantia" className="font-display block text-[15px] font-extrabold text-[var(--store-ink)]" />
              {/* texto legal (CDC): fora do editor por regra (§8) */}
              <span data-editor-ignore="">Arrependimento em até 7 dias após o recebimento (CDC).{sacEmail ? ` Fale com ${sacEmail}.` : ""}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
