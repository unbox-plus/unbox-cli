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
//
// O PRODUTO É ESCOLHA DO LOJISTA (foundation 18): clicar na foto abre o mesmo seletor da vitrine
// (`Editable.Vitrine`, caminho `<container>.<id>.vitrine`), e vale o PRIMEIRO produto com preço da escolha.
// Sem escolha, o de sempre (`data.featured`). Como toda escolha do documento, ela tem versão por público. O
// botão leva o produto ao passo 2 (`&produto=<endereço>`), que o põe primeiro e já com a quantidade: sem isso,
// o bloco venderia um produto e o passo 2 mostraria outros. Na prévia, os produtos da escolha chegam pelo 4º
// argumento do primitivo, como na vitrine (product-showcase.tsx).
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, CreditCard, Truck, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { CAMPO_VITRINE, Editable, EditableScope, joinPath, useEditableContext, type VitrineProdutoResolvido, type VitrineValue } from "@/lib/editable";
import type { CatalogProductItem } from "@/components/catalog/catalog-client";
import { Stars } from "./stars";
import { QUANTITY_TIERS } from "@/lib/store-config";
import { formatBRL } from "@/lib/format";
import type { SectionComponentProps } from "./registry";
import { Foto } from "@/components/ui/foto";

type Perk = { tag: string; text: string; icon?: string };
const PERK_ICONS: Record<string, React.ComponentType<any>> = { shield: ShieldCheck, card: CreditCard, truck: Truck };

/** o que o bloco mostra do produto, venha ele da escolha do lojista ou do destaque do código */
interface ProdutoDoBloco {
  titulo: string;
  slug: string;
  imagem: string | null;
  preco: number;
}
const doCatalogo = (p: CatalogProductItem): ProdutoDoBloco => ({ titulo: p.title, slug: p.slug, imagem: p.imageUrl, preco: p.price });
// produto sem preço (sem variante com preço no painel) não vai para um bloco de compra: a conta das quantidades
// daria "R$ 0,00", que é mentira
const daEscolha = (p: VitrineProdutoResolvido): ProdutoDoBloco | null => (p.preco == null ? null : { titulo: p.titulo, slug: p.slug, imagem: p.imagem, preco: p.preco });

/** a moldura do bloco SEM produto, só no editor: é onde o lojista clica para escolher (fora do site ela não existe) */
const MOLDURA_SEM_PRODUTO: React.CSSProperties = {
  padding: "40px 24px",
  borderRadius: 16,
  border: "2px dashed #D1D5DB",
  background: "#FAFAFA",
  color: "#374151",
  textAlign: "center",
  font: "500 14px/1.5 system-ui, sans-serif",
  cursor: "pointer",
};


export function PurchaseHeroSection({ data, sectionProps = {} }: SectionComponentProps) {
  const router = useRouter();
  // o MESMO caminho que o primitivo registra lá embaixo: derivado do escopo da seção, nunca escrito à mão (o id
  // de um bloco adicionado só existe em tempo de execução, `novo-bloco-de-compra-2`)
  const ctx = useEditableContext();
  const caminho = joinPath(ctx.scope, CAMPO_VITRINE);
  const doServidor = data.vitrines?.[caminho] ?? null;
  const featured = data.featured;
  // a escolha que o CÓDIGO representa: o produto que o bloco destaca hoje (é o estado que o painel mostra antes
  // do primeiro clique). Pelo productId, que é estável; o slug fica de reserva, como na vitrine.
  const fallback: VitrineValue = { modo: "produtos", produtos: featured ? [featured.productId || featured.slug] : [] };
  // A ÂNCORA: `#comprar` é a do bloco da receita (o id de seção `compra`), para onde os botões "comprar" da página
  // levam. Um bloco ADICIONADO ganha a dele (`comprar-<id da seção>`): dois `id="comprar"` na mesma página seriam
  // HTML inválido, e o link iria para qualquer um dos dois.
  const secao = ctx.scope[ctx.scope.length - 1] ?? "";
  const ancora = !secao || secao === "compra" ? "comprar" : `comprar-${secao}`;
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

  return (
    <Editable.Vitrine path={CAMPO_VITRINE} label="Produto do bloco de compra" fallback={fallback}>
      {(_escolha, attrs, ref, previa) => {
        // a prévia (rascunho de agora) ganha do que o servidor resolveu (documento publicado); vale o primeiro com preço
        const resolvidos = previa?.produtos ?? doServidor;
        const escolhido = resolvidos?.map(daEscolha).find((p): p is ProdutoDoBloco => p !== null) ?? null;
        const product = escolhido ?? (featured ? doCatalogo(featured) : null);
        if (!product) {
          // sem produto nenhum (nem escolhido, nem do código): fora do site. No editor fica a moldura, para o
          // lojista clicar e escolher o produto
          if (!ctx.editing) return null;
          return (
            <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[42px] sm:px-6">
              <div ref={ref as React.Ref<HTMLDivElement>} {...attrs} style={MOLDURA_SEM_PRODUTO}>
                <b>Bloco de compra sem produto.</b> Clique aqui para escolher o produto dele. Sem produto, ele não aparece no site.
              </div>
            </div>
          );
        }
        return (
          <BlocoComProduto
            ancora={ancora}
            product={product}
            attrs={attrs}
            fotoRef={ref}
            sel={sel}
            setSel={setSel}
            busy={busy}
            onComprar={(quantidade) => { setBusy(true); router.push(`/carrinho/oferta?quantity=${quantidade}&produto=${encodeURIComponent(product.slug)}`); }}
            tagline={tagline}
            description={description}
            ctaLabel={ctaLabel}
            sacEmail={sacEmail}
            perks={perks}
            rating={rating}
          />
        );
      }}
    </Editable.Vitrine>
  );
}

/** o bloco desenhado, com o produto já decidido (a escolha do lojista ou o destaque do código) */
function BlocoComProduto({ ancora, product, attrs, fotoRef, sel, setSel, busy, onComprar, tagline, description, ctaLabel, sacEmail, perks, rating }: {
  ancora: string;
  product: ProdutoDoBloco;
  /** os atributos do seletor de produto (`Editable.Vitrine`): vão na foto, que é onde o lojista clica para trocar */
  attrs: Record<string, string | undefined>;
  fotoRef: React.RefCallback<Element>;
  sel: number;
  setSel: (i: number) => void;
  busy: boolean;
  onComprar: (quantidade: number) => void;
  tagline: string;
  description: string;
  ctaLabel: string;
  sacEmail: string;
  perks: Perk[];
  rating: number | null;
}) {
  const tier = QUANTITY_TIERS[sel];
  const unit = product.preco;
  const unitOff = unit * (1 - tier.offPct / 100);
  const totalFull = unit * tier.quantity;
  const total = unitOff * tier.quantity;
  const anyOff = QUANTITY_TIERS.some((t) => t.offPct > 0);

  return (
    <div id={ancora} className="mx-auto max-w-[var(--container-max,1240px)] scroll-mt-24 px-4 pt-[42px] sm:px-6">
      <div className="grid gap-9 lg:grid-cols-[1.02fr_0.98fr]">
        {/* galeria (foto do produto: dado do catálogo). A FOTO é o seletor do produto no editor: clicar nela abre a
            escolha (o primitivo só põe atributos de seleção; em produção o HTML é o mesmo) */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div ref={fotoRef as React.Ref<HTMLDivElement>} {...attrs} className="overflow-hidden rounded-2xl bg-[var(--store-surface-2)]">
            {product.imagem
              ? <Foto src={product.imagem} alt={product.titulo} width={1200} height={1200} sizes="(min-width: 1024px) 600px, 100vw" priority className="aspect-square w-full object-contain p-8" />
              : <img src="/brand/ph/photo-a.svg" alt="" className="aspect-square w-full object-cover" />}
          </div>
          <Link href={`/produto/${encodeURIComponent(product.slug)}`} data-editor-ignore="" className="mt-3 inline-block text-[13.5px] font-semibold text-[var(--store-primary,#18181B)] underline underline-offset-2">Ver página do produto</Link>
        </div>

        {/* compra */}
        <div>
          <div className="flex items-center gap-2">
            <Stars n={rating} className="text-[16px] text-[var(--store-cta-dark)]" />
            {tagline && <Editable.Text path="chapeu" fallback={tagline} label="Chapéu acima do nome do produto" className="text-[12.5px] font-extrabold uppercase tracking-[0.8px] text-[var(--store-primary,#18181B)]" />}
          </div>
          <h2 className="font-display mt-2.5" data-editor-ignore="">{product.titulo}</h2>
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
                <button ref={ref} {...attrs} type="button" disabled={busy} onClick={() => onComprar(tier.quantity)}
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
