"use client";

// Abas da PDP, "modo de uso" e FAQ. REGRA DESTE ARQUIVO: nada aqui tem conteúdo default.
// Cada bloco só renderiza com dado real vindo do enriquecimento (lib/enrichment/products.json)
// ou da Unbox. A versão anterior trazia passos de uso de um produto de alimentação cravados no
// código, uma aba nutricional que aparecia com traços em loja de qualquer ramo, e um FAQ inventado
// (validade de 24 meses, devolução em 30 dias). Tudo isso vazou para lojas entregues.
// Um campo vazio declarado é melhor que um campo plausível inventado.
import * as React from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";

export interface KV { k: string; v: string }

export function ProductTabs({
  descHtml,
  infoHtml,
  specItems,
  nutriItems,
  nutriBase,
  usageSteps,
}: {
  descHtml?: string | null;
  infoHtml?: string | null;
  /** Ficha técnica (composição, medidas, origem...). Vazio = a aba não existe. */
  specItems: KV[];
  /** Tabela nutricional — só para alimento/suplemento com dado real. Vazio = a aba não existe. */
  nutriItems: KV[];
  /** Base da tabela nutricional, ex.: "100 g" ou "porção de 30 g". */
  nutriBase?: string | null;
  /** Passos de uso do produto, do enriquecimento. Vazio = o bloco não existe. */
  usageSteps?: string[] | null;
}) {
  // As abas existem em função do dado, não o contrário.
  const tabs: { label: string; render: () => React.ReactNode }[] = [
    {
      label: "Descrição",
      render: () => (
        <div className={`grid gap-10 ${usageSteps?.length ? "lg:grid-cols-[1.4fr_1fr]" : ""}`}>
          <div className="text-[15px] leading-[1.75] text-[var(--store-ink-2)]">
            {descHtml ? (
              <div className="richtext" dangerouslySetInnerHTML={{ __html: descHtml }} />
            ) : (
              <p className="m-0 text-[var(--store-muted)]">
                Descrição completa ainda não cadastrada. Preencha <code>lib/enrichment/products.json</code> ou a descrição do produto no painel Unbox.
              </p>
            )}
          </div>
          {usageSteps && usageSteps.length > 0 && (
            <div className="rounded-lg border border-[var(--store-line)] bg-[var(--store-surface)] p-5">
              <div className="font-display mb-3.5 text-sm font-bold">Modo de uso</div>
              <div className="flex flex-col gap-3.5">
                {usageSteps.map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--store-primary-soft,#F1F1F3)] text-[13px] font-extrabold text-[var(--store-primary,#18181B)]">{i + 1}</div>
                    <div className="text-[13.5px] leading-[1.5] text-[var(--store-ink-2)]">{s}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
  ];

  if (specItems.length > 0 || infoHtml) {
    tabs.push({
      label: "Características",
      render: () => (
        <div className="grid max-w-[720px] gap-x-10 gap-y-3 sm:grid-cols-2">
          {specItems.map((sp) => (
            <div key={sp.k} className="flex justify-between gap-6 border-b border-[var(--store-surface-2)] py-3 text-sm">
              <span className="shrink-0 text-[var(--store-muted)]">{sp.k}</span>
              <span className="text-right font-bold text-[var(--store-ink)]">{sp.v}</span>
            </div>
          ))}
          {infoHtml && <div className="richtext sm:col-span-2" dangerouslySetInnerHTML={{ __html: infoHtml }} />}
        </div>
      ),
    });
  }

  if (nutriItems.length > 0) {
    tabs.push({
      label: "Informação nutricional",
      render: () => (
        <div className="max-w-[520px] overflow-hidden rounded-lg border border-[var(--store-line)]">
          <div className="font-display bg-[var(--store-chrome-bg,#18181B)] px-[18px] py-[13px] text-sm font-bold text-white">
            Informação nutricional{nutriBase ? ` · ${nutriBase}` : ""}
          </div>
          {nutriItems.map((nu) => (
            <div key={nu.k} className="flex justify-between gap-6 border-b border-[var(--store-surface-2)] px-[18px] py-3 text-sm">
              <span className="shrink-0 text-[var(--store-ink-2)]">{nu.k}</span>
              <span className="text-right font-bold">{nu.v}</span>
            </div>
          ))}
        </div>
      ),
    });
  }

  const [tab, setTab] = React.useState(0);
  const atual = tabs[Math.min(tab, tabs.length - 1)];

  return (
    <div>
      {tabs.length > 1 && (
        <div className="flex gap-1 border-b-[1.5px] border-[var(--store-line)]">
          {tabs.map((t, i) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setTab(i)}
              className="font-display relative cursor-pointer border-none bg-transparent px-3 py-3.5 text-[13px] font-bold sm:px-5 sm:text-[15px]"
              style={{ color: tab === i ? "var(--store-primary,#18181B)" : "var(--store-muted)" }}
            >
              {t.label}
              {tab === i && <span className="absolute inset-x-0 -bottom-[1.5px] h-[3px] rounded bg-[var(--store-primary,#18181B)]" />}
            </button>
          ))}
        </div>
      )}
      <div className="px-0.5 py-6.5 pt-6">{atual.render()}</div>
    </div>
  );
}

/** FAQ do produto — SÓ com perguntas reais do enriquecimento. Sem itens, não renderiza nada. */
export function FaqList({ items }: { items?: { question: string; answer: string }[] | null }) {
  const [open, setOpen] = React.useState<number>(0);
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="overflow-hidden rounded-xl border border-[var(--store-line)] bg-white">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent px-4 py-[15px] text-left text-sm font-semibold text-[var(--store-ink)]"
            >
              {f.question}
              <CaretDown weight="bold" className="shrink-0 text-[15px] text-[var(--store-primary,#18181B)] transition-transform" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)" }} />
            </button>
            {isOpen && <div className="px-4 pb-[15px] text-[13.5px] leading-[1.6] text-[var(--store-ink-2)]">{f.answer}</div>}
          </div>
        );
      })}
    </div>
  );
}
