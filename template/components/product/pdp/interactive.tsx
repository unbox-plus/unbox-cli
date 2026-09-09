"use client";

// Abas da PDP, "modo de uso" e FAQ. REGRA DESTE ARQUIVO: nada aqui tem conteúdo default de PRODUTO.
// Cada bloco só renderiza com dado real vindo do enriquecimento (lib/enrichment/products.json)
// ou da Unbox; a única copy do molde é a das perguntas MODELO do FAQ (faq-modelo.ts), que o
// template consegue afirmar e o lojista edita. A versão anterior trazia passos de uso de um produto de alimentação cravados no
// código, uma aba nutricional que aparecia com traços em loja de qualquer ramo, e um FAQ inventado
// (validade de 24 meses, devolução em 30 dias). Tudo isso vazou para lojas entregues.
// Um campo vazio declarado é melhor que um campo plausível inventado.
import * as React from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
// EDITOR: módulo de cliente ("use client"): aqui o namespace `Editable.*` é a forma de uso (README §4).
import { Editable } from "@/lib/editable";
import { FAQ_MODELO, CAMINHO_PERGUNTA, CAMINHO_RESPOSTA, type PerguntaResposta } from "@/components/product/pdp/faq-modelo";

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

const CLASSE_RESPOSTA = "px-4 pb-[15px] text-[13.5px] leading-[1.6] text-[var(--store-ink-2)]";

function FaqItem({ open, onToggle, pergunta, resposta }: {
  open: boolean;
  onToggle: () => void;
  pergunta: React.ReactNode;
  /** já com `hidden` quando fechada: a resposta fica no HTML para o painel listar todas sem abrir cada uma */
  resposta: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--store-line)] bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent px-4 py-[15px] text-left text-sm font-semibold text-[var(--store-ink)]"
      >
        {pergunta}
        <CaretDown weight="bold" className="shrink-0 text-[15px] text-[var(--store-primary,#18181B)] transition-transform" style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }} />
      </button>
      {resposta}
    </div>
  );
}

/**
 * FAQ do produto: as perguntas do ENRIQUECIMENTO (por produto) e as perguntas MODELO do molde
 * (faq-modelo.ts). Sem nenhuma das duas, não renderiza nada.
 *
 * EDITOR: a PDP é um MOLDE, um valor para todos os produtos. As perguntas do enriquecimento são dado
 * do catálogo e ficam fora do editor (`data-editor-ignore`, README §8). As perguntas modelo são copy
 * e formam uma LISTA editável (reordenar, ocultar, duplicar, reescrever), com id por PAPEL. O título
 * do cartão fica em quem renderiza esta lista (pdp-view.tsx). O FAQPage da página é lido do MESMO
 * lugar (`faqNaTela`, faq-modelo.ts): o que muda aqui muda lá.
 */
export function FaqList({ items }: { items?: readonly PerguntaResposta[] | null }) {
  const doEnriquecimento = items ?? [];
  const [open, setOpen] = React.useState<string | null>(doEnriquecimento.length ? "0" : (FAQ_MODELO[0]?.id ?? null));
  const toggle = (chave: string) => setOpen((atual) => (atual === chave ? null : chave));
  if (doEnriquecimento.length === 0 && FAQ_MODELO.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {doEnriquecimento.length > 0 && (
        <div className="flex flex-col gap-3" data-editor-ignore>
          {doEnriquecimento.map((x, i) => (
            <FaqItem
              key={i}
              open={open === String(i)}
              onToggle={() => toggle(String(i))}
              pergunta={x.question}
              resposta={<div className={CLASSE_RESPOSTA} hidden={open !== String(i)}>{x.answer}</div>}
            />
          ))}
        </div>
      )}
      <Editable.Sections nested>
        {FAQ_MODELO.map((f) => (
          <Editable.Section key={f.id} item id={f.id} label={f.label}>
            <FaqItem
              open={open === f.id}
              onToggle={() => toggle(f.id)}
              pergunta={<Editable.Text path={CAMINHO_PERGUNTA} fallback={f.question} label="Pergunta" />}
              resposta={<Editable.Text as="div" path={CAMINHO_RESPOSTA} fallback={f.answer} label="Resposta" className={CLASSE_RESPOSTA} hidden={open !== f.id} />}
            />
          </Editable.Section>
        ))}
      </Editable.Sections>
    </div>
  );
}
