"use client";

// Faixa de especificações: texto+CTA / tabela de linhas / foto — com modal de tabela
// completa. Serve pra ficha técnica, composição, medidas — e tabela nutricional, se for alimento.
// Conteúdo SÓ via receita (props.rows): sem linhas, a seção não renderiza. "Origem: Brasil" e
// "garantia" não são dados da foundation, são do produto.
//
// EDITOR: título, texto, botão e foto são caminhos da seção; as linhas da tabela são uma LISTA
// editável (`linhas.linha-N`, com rótulo e valor). O divisor entre linhas é uma regra do CONTAINER
// (`[&>*+*>div]:border-t`): o invólucro de cada item é display:contents e é ele o irmão no DOM, então
// a regra "toda linha depois da primeira" continua certa depois que o lojista reordena ou oculta.
// O modal é interface transitória (só existe aberto): as linhas dele LEEM o documento (mesma
// ordem, mesmas ocultas, mesmos valores da lista) sem registrar um segundo ponto, como o eco da
// faixa rolante. Se a receita passar `modalRows` separadas, elas são dado da receita e ficam literais.
import * as React from "react";
import { X } from "@phosphor-icons/react/dist/ssr";
import { Editable, EditableScope, joinPath, orderSections, resolveValue, useEditableContext } from "@/lib/editable";
import type { SectionComponentProps } from "./registry";

type Row = { label: string; value: string };

const ESCOPO_LINHAS = "linhas";
const idDaLinha = (i: number) => `linha-${i + 1}`;
const CLASSE_LINHA = "flex items-center justify-between gap-4 px-4 py-2.5 text-[13.5px]";
const CLASSE_ROTULO = "font-semibold text-[var(--store-ink-2)]";
const CLASSE_VALOR = "text-right text-[var(--store-muted)]";
const CLASSE_DIVISOR = "[&>*+*>div]:border-t [&>*+*>div]:border-[var(--store-line)]";

/**
 * As linhas como o lojista as publicou (ordem, ocultas, cópias e valores), lidas do documento sem
 * registrar ponto editável: é o que o modal mostra.
 */
function useLinhasPublicadas(rows: Row[]): Row[] {
  const ctx = useEditableContext();
  const escopo = joinPath(ctx.scope, ESCOPO_LINHAS);
  const ids = rows.map((_, i) => idDaLinha(i));
  const estado = ctx.doc.sections[escopo];
  const { visible } = orderSections(ids, estado);
  const copias = estado?.clones ?? {};
  return visible.flatMap((id) => {
    const base = rows[ids.indexOf(copias[id] ?? id)];
    if (!base) return [];
    return [{
      label: resolveValue(ctx.doc, `${escopo}.${id}.rotulo`, base.label),
      value: resolveValue(ctx.doc, `${escopo}.${id}.valor`, base.value),
    }];
  });
}

export function SpecTableSection({ sectionProps = {} }: SectionComponentProps) {
  const {
    title = "Ficha completa, sem letra miúda",
    text = "",
    ctaLabel = "Ver ficha completa",
    image = "/brand/ph/photo-b.svg",
    modalTitle = "Ficha completa",
  } = sectionProps as Record<string, string>;
  const rows = ((sectionProps.rows as Row[] | undefined) ?? []).filter((r) => r?.label && r?.value);
  const modalRows = sectionProps.modalRows as Row[] | undefined;
  const linhasPublicadas = useLinhasPublicadas(rows);
  const linhasDoModal = modalRows ?? linhasPublicadas;
  const [open, setOpen] = React.useState(false);
  if (rows.length === 0) return null;

  return (
    <div className="mt-[52px] bg-[var(--store-surface-2)]">
      <div className="mx-auto grid max-w-[var(--container-max,1240px)] items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1fr_1.1fr_0.9fr]">
        <div>
          <Editable.Text as="h2" path="titulo" fallback={title} label="Título" className="font-display text-[26px] font-extrabold leading-[1.2]" />
          {text && <Editable.Text as="p" path="texto" fallback={text} label="Texto" multiline className="mt-2.5 text-[14.5px] leading-[1.55] text-[var(--store-muted)]" />}
          <Editable.Slot path="cta" type="text" fallback={ctaLabel} label="Botão que abre a ficha">
            {(v, attrs, ref, estilo) => (
              <button ref={ref} type="button" onClick={() => setOpen(true)} className="font-display mt-5 rounded-full bg-[var(--store-primary,#18181B)] px-6 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-[var(--store-primary-dark,#09090B)]" style={estilo} {...attrs}>
                {v}
              </button>
            )}
          </Editable.Slot>
        </div>
        <div className={`rounded-2xl border border-[var(--store-line-2)] bg-white p-1.5 ${CLASSE_DIVISOR}`}>
          <EditableScope path={ESCOPO_LINHAS}>
            <Editable.Sections nested>
              {rows.map((r, i) => (
                <Editable.Section key={i} item id={idDaLinha(i)} label={`Linha ${i + 1}`}>
                  <div className={CLASSE_LINHA}>
                    <Editable.Text path="rotulo" fallback={r.label} label="Nome da linha" className={CLASSE_ROTULO} />
                    <Editable.Text path="valor" fallback={r.value} label="Valor da linha" className={CLASSE_VALOR} />
                  </div>
                </Editable.Section>
              ))}
            </Editable.Sections>
          </EditableScope>
        </div>
        {/* TODO: foto real do produto */}
        <Editable.Img path="imagem" fallback={{ src: image, alt: "" }} label="Foto" className="hidden h-full max-h-[320px] w-full rounded-2xl object-cover md:block" loading="lazy" decoding="async" />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-[20px] font-extrabold">{modalTitle}</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--store-line-2)] hover:bg-[var(--store-surface)]"><X weight="bold" /></button>
            </div>
            <div className="rounded-xl border border-[var(--store-line-2)]">
              {linhasDoModal.map((r, i) => (
                <div key={i} className={`${CLASSE_LINHA} ${i > 0 ? "border-t border-[var(--store-line)]" : ""}`}>
                  <span className={CLASSE_ROTULO}>{r.label}</span>
                  <span className={CLASSE_VALOR}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
