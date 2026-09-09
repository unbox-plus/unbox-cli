import { Truck, Lightning, LockSimple, SealCheck, Star } from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
// EDITOR: este arquivo é server component (sem "use client"): exportações NOMEADAS, nunca `Editable.*` (README §4).
import { EditableIcon, EditableSection, EditableSections, EditableText } from "@/lib/editable";
import { PaymentChips } from "@/components/product/pdp/payment-chips";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/store-config";

// Os selos são uma LISTA editável (README do editor §3: `Sections nested` + `Section item`), com id por
// PAPEL e não por posição: o selo de frete só existe com FREE_SHIPPING_THRESHOLD, e um id posicional
// deslizaria (o texto que o lojista escreveu no selo 2 apareceria no selo 1) quando a regra mudasse.
// Selo de frete grátis só entra quando há regra real configurada em lib/store-config.
//
// Só o que o template consegue afirmar: SSL é fato; o prazo é calculado pela cotação real; 7 dias é o
// art. 49 do CDC, vale para toda loja online no Brasil. "Expressa em 1 a 2 dias" e "devolução em 30
// dias" eram inventados, e o segundo contradizia a própria página /devolucoes da loja.
const TRUST = [
  ...(FREE_SHIPPING_THRESHOLD != null
    ? [{ id: "frete", label: "Selo de frete grátis", icon: Truck, title: `Frete grátis acima de R$${FREE_SHIPPING_THRESHOLD}`, sub: "para todo o Brasil" }]
    : []),
  { id: "entrega", label: "Selo de entrega", icon: Lightning, title: "Entrega para todo o Brasil", sub: "prazo calculado no carrinho" },
  { id: "seguranca", label: "Selo de compra segura", icon: LockSimple, title: "Compra 100% segura", sub: "criptografia SSL" },
  { id: "arrependimento", label: "Selo de devolução", icon: SealCheck, title: "Troca em 7 dias", sub: "arrependimento garantido por lei (CDC)" },
];

export function TrustStrip() {
  return (
    <div className={`grid grid-cols-2 rounded-2xl border border-[var(--store-line)] bg-white ${TRUST.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
      <EditableSections nested>
        {TRUST.map((t, i) => (
          <EditableSection key={t.id} item id={t.id} label={t.label}>
            {/* o invólucro da seção é display:contents: este div continua sendo o item da grade */}
            <div className="flex items-center gap-3.5 px-[22px] py-5" style={{ borderRight: i < TRUST.length - 1 ? "1px solid var(--store-surface-2)" : "none" }}>
              <EditableIcon path="icone" label="Ícone do selo" size={26} className="text-[26px] text-[var(--store-primary,#18181B)]">
                <t.icon />
              </EditableIcon>
              <div>
                <EditableText as="div" path="titulo" fallback={t.title} label="Título do selo" className="text-[13.5px] font-bold text-[var(--store-ink)]" />
                <EditableText as="div" path="texto" fallback={t.sub} label="Texto do selo" className="mt-0.5 text-xs text-[var(--store-muted)]" />
              </div>
            </div>
          </EditableSection>
        ))}
      </EditableSections>
    </div>
  );
}

export function SecurityBar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl bg-[var(--store-chrome-bg)] px-8 py-[22px]">
      <div className="flex items-center gap-[18px]">
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[var(--store-primary,#18181B)]">
          <EditableIcon path="icone" label="Ícone de compra segura" size={25} className="text-[25px] text-white">
            <LockSimple weight="fill" />
          </EditableIcon>
        </span>
        <div>
          <EditableText as="div" path="titulo" fallback="Compra 100% Segura" label="Título" className="font-display text-lg font-bold text-white" />
          <EditableText as="div" path="texto" fallback="Seus dados protegidos do início ao fim." label="Texto de apoio" className="mt-0.5 text-[13.5px] text-[var(--store-chrome-muted)]" />
        </div>
      </div>
      <div className="flex items-center gap-[22px]">
        <EditableText as="span" path="pagamento" fallback="Pague como preferir" label="Texto ao lado das bandeiras" className="font-display text-[15px] font-semibold text-white max-md:hidden" />
        <span className="h-[34px] w-px bg-white/20 max-md:hidden" />
        {/* bandeiras de pagamento: selo de terceiro, fora do editor (o próprio componente se marca) */}
        <PaymentChips size="md" />
      </div>
    </div>
  );
}

export interface ReviewItem { author: string; stars: number; comment: string; verified?: boolean }

/**
 * Avaliações do produto: SÓ com dado real. Sem reviews, não renderiza (o chamador também
 * esconde o card). Não existe nota default, contagem default nem depoimento default: a
 * foundation publicava "4,9 · 25.347 avaliações" e "Cliente A/B/C" com selo de verificação em
 * loja recém-aberta, e isso foi ao ar. A distribuição por estrela é calculada das reviews.
 *
 * EDITOR: só o TÍTULO é copy do molde. Nota, contagem, barras e depoimentos são dado das avaliações e
 * ficam fora (`data-editor-ignore`, README §8).
 */
export function ReviewsCard({ ratingCount, average, reviews }: {
  ratingCount: number;
  average: number;
  reviews: ReviewItem[];
}) {
  if (!reviews.length || !ratingCount) return null;
  const avg = average.toFixed(1).replace(".", ",");
  const dist = [5, 4, 3, 2, 1].map((n) => {
    const q = reviews.filter((r) => Math.round(r.stars) === n).length;
    return { n: String(n), pct: `${Math.round((q / reviews.length) * 100)}%` };
  });
  const list = reviews.slice(0, 6).map((r) => ({ initial: (r.author.trim()[0] || "?").toUpperCase(), name: r.author, quip: r.comment, stars: r.stars, verified: r.verified }));
  return (
    <div className="rounded-xl border border-[var(--store-line)] bg-white p-7 p-[28px]">
      <EditableText as="h2" path="titulo" fallback="Quem comprou, recomenda" label="Título das avaliações" className="font-display mb-[18px] text-[21px] font-extrabold italic leading-tight text-[var(--store-primary,#18181B)]" />
      <div className="flex items-center gap-3.5" data-editor-ignore>
        <span className="font-display text-[44px] font-extrabold leading-none text-[var(--store-ink)]">{avg}</span>
        <span className="flex text-2xl text-[var(--store-cta-dark)]" aria-label={`${avg} de 5`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} weight={average >= i - 0.25 ? "fill" : "regular"} />)}</span>
      </div>
      <div className="mt-2.5 mb-[18px] text-[13px] text-[var(--store-muted)]" data-editor-ignore>Baseado em {ratingCount.toLocaleString("pt-BR")} {ratingCount === 1 ? "avaliação" : "avaliações"}</div>
      <div className="flex flex-col gap-2.5" data-editor-ignore>
        {dist.map((r) => (
          <div key={r.n} className="flex items-center gap-2.5 text-[12.5px] text-[var(--store-muted)]">
            <span className="w-2.5">{r.n}</span>
            <Star weight="fill" className="text-[11px] text-[var(--store-cta-dark)]" />
            <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-[var(--store-surface-2)]"><div className="h-full rounded-full bg-[var(--store-cta-dark)]" style={{ width: r.pct }} /></div>
            <span className="w-[34px] text-right">{r.pct}</span>
          </div>
        ))}
      </div>
      <div className="my-[22px] h-px bg-[var(--store-surface-2)]" />
      <div className="flex flex-col gap-4" data-editor-ignore>
        {list.map((rv, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="font-display flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[var(--store-chrome-bg)] text-sm font-extrabold text-white">{rv.initial}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[13.5px] font-bold">{rv.name}</span>
                <span className="flex text-[10px] text-[var(--store-cta-dark)]">{[1, 2, 3, 4, 5].map((i) => <Star key={i} weight={rv.stars >= i - 0.25 ? "fill" : "regular"} />)}</span>
                {rv.verified && <span className="text-[11px] font-semibold text-[var(--store-primary,#18181B)]">· compra verificada</span>}
              </div>
              <div className="mt-0.5 text-[13px] leading-snug text-[var(--store-ink-2)]">{rv.quip}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * OS ATRIBUTOS DE QUALIDADE DO PRODUTO: o que a marca afirma sobre o que vende (feito à mão, produção em
 * pequenos lotes, garantia). Nasce VAZIO de propósito: a foundation não sabe o que o produto tem, e um
 * atributo plausível inventado aqui iria ao ar como afirmação da marca (foi assim na v0.15.6, e o cartão
 * saiu). Quem preenche é o briefing, só com o que a marca sustenta. Sem itens, o cartão não renderiza e
 * o FAQ ocupa a linha inteira.
 *
 * EDITOR: a PDP é um MOLDE (um valor para todos os produtos), e estes atributos são o que o lojista muda
 * quando o catálogo cresce; por isso cada um é item de lista editável (ícone, título e texto), com o id
 * posicional da foundation (`item-1`, `item-2`...). Apagar um item do meio NO CÓDIGO desliza os ids
 * seguintes (README do editor, §6): prefira ocultar pelo painel.
 */
export const QUALIDADE: readonly { icon: PhosphorIcon; title: string; sub: string }[] = [];

export function QualidadeCard() {
  if (QUALIDADE.length === 0) return null;
  return (
    <div className="rounded-xl border border-[var(--store-line)] bg-white p-7 p-[28px]">
      <EditableText as="h2" path="titulo" fallback="Qualidade que você sente" label="Título do bloco de qualidade" className="font-display mb-[22px] text-[21px] font-extrabold italic leading-tight text-[var(--store-primary,#18181B)]" />
      <div className="flex flex-col gap-5">
        <EditableSections nested>
          {QUALIDADE.map((q, i) => (
            <EditableSection key={q.title} item id={`item-${i + 1}`} label={`Atributo ${i + 1}`}>
              <div className="flex items-start gap-3.5">
                <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-xl bg-[var(--store-primary-soft,#F1F1F3)]">
                  <EditableIcon path="icone" label="Ícone do atributo" size={26} className="text-[26px] text-[var(--store-primary,#18181B)]">
                    <q.icon />
                  </EditableIcon>
                </span>
                <div>
                  <EditableText as="div" path="titulo" fallback={q.title} label="Título do atributo" className="text-[15px] font-bold text-[var(--store-ink)]" />
                  <EditableText as="div" path="texto" fallback={q.sub} label="Texto do atributo" className="mt-0.5 text-[13.5px] leading-snug text-[var(--store-muted)]" />
                </div>
              </div>
            </EditableSection>
          ))}
        </EditableSections>
      </div>
    </div>
  );
}
