import {
  Truck, LockSimple, SealCheck, Star,
} from "@phosphor-icons/react/dist/ssr";
import { PaymentChips } from "@/components/product/pdp/payment-chips";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/store-config";

// Selo de frete grátis só entra quando há regra real configurada em lib/store-config.
const TRUST = [
  ...(FREE_SHIPPING_THRESHOLD != null ? [{ icon: Truck, title: `Frete grátis acima de R$${FREE_SHIPPING_THRESHOLD}`, sub: "para todo o Brasil" }] : []),
  // Só o que o template consegue afirmar: SSL é fato; 7 dias é o art. 49 do CDC, vale para
  // toda loja online no Brasil. "Expressa em 1–2 dias" e "devolução em 30 dias" eram inventados
  // — e o segundo contradizia a própria página /devolucoes da loja.
  { icon: LockSimple, title: "Compra 100% segura", sub: "criptografia SSL" },
  { icon: SealCheck, title: "Troca em 7 dias", sub: "arrependimento garantido por lei (CDC)" },
];

export function TrustStrip() {
  return (
    <div className={`grid grid-cols-2 rounded-2xl border border-[var(--store-line)] bg-white ${TRUST.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
      {TRUST.map((t, i) => (
        <div key={t.title} className="flex items-center gap-3.5 px-[22px] py-5" style={{ borderRight: i < TRUST.length - 1 ? "1px solid var(--store-surface-2)" : "none" }}>
          <t.icon className="text-[26px] text-[var(--store-primary,#18181B)]" />
          <div>
            <div className="text-[13.5px] font-bold text-[var(--store-ink)]">{t.title}</div>
            <div className="mt-0.5 text-xs text-[var(--store-muted)]">{t.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SecurityBar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl bg-[var(--store-chrome-bg)] px-8 py-[22px]">
      <div className="flex items-center gap-[18px]">
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[var(--store-primary,#18181B)]">
          <LockSimple weight="fill" className="text-[25px] text-white" />
        </span>
        <div>
          <div className="font-display text-lg font-bold text-white">Compra 100% Segura</div>
          <div className="mt-0.5 text-[13.5px] text-[var(--store-chrome-muted)]">Seus dados protegidos do início ao fim.</div>
        </div>
      </div>
      <div className="flex items-center gap-[22px]">
        <span className="font-display text-[15px] font-semibold text-white max-md:hidden">Pague como preferir</span>
        <span className="h-[34px] w-px bg-white/20 max-md:hidden" />
        <PaymentChips size="md" />
      </div>
    </div>
  );
}

export interface ReviewItem { author: string; stars: number; comment: string; verified?: boolean }

/**
 * Avaliações do produto — SÓ com dado real. Sem reviews, não renderiza (o chamador também
 * esconde o card). Não existe nota default, contagem default nem depoimento default: a
 * foundation publicava "4,9 · 25.347 avaliações" e "Cliente A/B/C" com selo de verificação em
 * loja recém-aberta, e isso foi ao ar. A distribuição por estrela é calculada das reviews.
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
      <h2 className="font-display mb-[18px] text-[21px] font-extrabold italic leading-tight text-[var(--store-primary,#18181B)]">Quem comprou, recomenda</h2>
      <div className="flex items-center gap-3.5">
        <span className="font-display text-[44px] font-extrabold leading-none text-[var(--store-ink)]">{avg}</span>
        <span className="flex text-2xl text-[#B45309]" aria-label={`${avg} de 5`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} weight={average >= i - 0.25 ? "fill" : "regular"} />)}</span>
      </div>
      <div className="mt-2.5 mb-[18px] text-[13px] text-[var(--store-muted)]">Baseado em {ratingCount.toLocaleString("pt-BR")} {ratingCount === 1 ? "avaliação" : "avaliações"}</div>
      <div className="flex flex-col gap-2.5">
        {dist.map((r) => (
          <div key={r.n} className="flex items-center gap-2.5 text-[12.5px] text-[var(--store-muted)]">
            <span className="w-2.5">{r.n}</span>
            <Star weight="fill" className="text-[11px] text-[#B45309]" />
            <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-[var(--store-surface-2)]"><div className="h-full rounded-full bg-[#B45309]" style={{ width: r.pct }} /></div>
            <span className="w-[34px] text-right">{r.pct}</span>
          </div>
        ))}
      </div>
      <div className="my-[22px] h-px bg-[var(--store-surface-2)]" />
      <div className="flex flex-col gap-4">
        {list.map((rv, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="font-display flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[var(--store-chrome-bg)] text-sm font-extrabold text-white">{rv.initial}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[13.5px] font-bold">{rv.name}</span>
                <span className="flex text-[10px] text-[#B45309]">{[1, 2, 3, 4, 5].map((i) => <Star key={i} weight={rv.stars >= i - 0.25 ? "fill" : "regular"} />)}</span>
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

