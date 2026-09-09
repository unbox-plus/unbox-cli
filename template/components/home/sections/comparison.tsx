"use client";

// Comparativo "nós vs outros" — tabela ESTRUTURAL (a loja de referência usava imagem raster; aqui é
// componente de verdade: acessível, responsivo e recolorível). Conteúdo via receita.
// ⚠️ Compare ATRIBUTOS do seu produto, sem citar marcas concorrentes nem inventar dado.
//
// EDITOR: título e os dois cabeçalhos de coluna são caminhos da seção; as linhas são uma LISTA
// editável (`linhas.linha-N`). Em cada linha o atributo é texto; cada célula é OU um ícone
// (`nos-icone` / `outros-icone`, trocável por imagem) OU um texto (`nos` / `outros`), conforme a
// receita traz booleano ou frase. São caminhos diferentes de propósito: trocar o TIPO de um caminho
// descarta a edição do lojista. O divisor entre linhas é regra do container (`[&>*+*>div]`),
// porque o invólucro do item é display:contents e é ele o irmão no DOM.
import { CheckCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import { Editable, EditableScope } from "@/lib/editable";
import type { SectionComponentProps } from "./registry";

type CompRow = { label: string; us: boolean | string; others: boolean | string };

function Cell({ v, coluna }: { v: boolean | string; coluna: "nos" | "outros" }) {
  const onde = coluna === "nos" ? "coluna da loja" : "coluna dos outros";
  if (v === true) {
    return (
      <Editable.Icon path={`${coluna}-icone`} label={`Ícone de sim (${onde})`} size={22} className="mx-auto text-[22px] text-[var(--store-primary,#18181B)]">
        <CheckCircle weight="fill" />
      </Editable.Icon>
    );
  }
  if (v === false) {
    return (
      <Editable.Icon path={`${coluna}-icone`} label={`Ícone de não (${onde})`} size={22} className="mx-auto text-[22px] text-[var(--store-faint)]">
        <XCircle weight="fill" />
      </Editable.Icon>
    );
  }
  return <Editable.Text path={coluna} fallback={v} label={`Texto da célula (${onde})`} className="text-[13px] text-[var(--store-muted)]" />;
}

export function ComparisonSection({ sectionProps = {} }: SectionComponentProps) {
  const {
    title = "Compare e escolha bem",
    usLabel = "Aqui",
    othersLabel = "Por aí",
  } = sectionProps as Record<string, string>;
  const rows = ((sectionProps.rows as CompRow[] | undefined) ?? []).filter((r) => r?.label);
  if (rows.length === 0) return null; // comparativo é afirmação sobre o produto: só com dado da marca
  return (
    <div className="mx-auto max-w-[880px] px-4 pt-[var(--section-gap,52px)] sm:px-6">
      <Editable.Text as="h2" path="titulo" fallback={title} label="Título" className="font-display text-center text-[28px] font-extrabold leading-[1.15]" />
      <div className="mt-7 overflow-hidden rounded-2xl border border-[var(--store-line-2)] bg-white">
        <div className="grid grid-cols-[1.6fr_1fr_1fr] border-b border-[var(--store-line)] bg-[var(--store-surface)] text-center">
          <div />
          <Editable.Text as="div" path="nos" fallback={usLabel} label="Cabeçalho da coluna da loja" className="font-display py-3 text-[14px] font-extrabold text-[var(--store-primary,#18181B)]" />
          <Editable.Text as="div" path="outros" fallback={othersLabel} label="Cabeçalho da coluna dos outros" className="font-display py-3 text-[14px] font-bold text-[var(--store-muted)]" />
        </div>
        <div className="[&>*+*>div]:border-t [&>*+*>div]:border-[var(--store-line)]">
          <EditableScope path="linhas">
            <Editable.Sections nested>
              {rows.map((r, i) => (
                <Editable.Section key={i} item id={`linha-${i + 1}`} label={`Linha ${i + 1}`}>
                  <div className="grid grid-cols-[1.6fr_1fr_1fr] items-center text-center">
                    <Editable.Text as="div" path="rotulo" fallback={r.label} label="Atributo comparado" className="px-4 py-3.5 text-left text-[14px] font-semibold text-[var(--store-ink-2)]" />
                    <div className="py-3.5"><Cell v={r.us} coluna="nos" /></div>
                    <div className="py-3.5"><Cell v={r.others} coluna="outros" /></div>
                  </div>
                </Editable.Section>
              ))}
            </Editable.Sections>
          </EditableScope>
        </div>
      </div>
    </div>
  );
}
