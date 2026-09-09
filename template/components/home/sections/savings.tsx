"use client";

// Card de ECONOMIA — comparativo "preço normal − combo = você economiza".
// Só aparece quando o produto em destaque tem desconto real (preço antigo do catálogo).
//
// EDITOR: título, texto e os rótulos das colunas são copy (caminhos da seção). Preço, economia,
// porcentagem e o nome do produto são DADO do catálogo: fora dos primitivos (README do editor,
// §8); a célula com o nome do produto sai do gate por `data-editor-ignore`.
import { Editable } from "@/lib/editable";
import { formatBRL } from "@/lib/format";
import type { SectionComponentProps } from "./registry";

export function SavingsSection({ data }: SectionComponentProps) {
  const { featured } = data;
  const featSave = featured?.oldPrice != null ? featured.oldPrice - featured.price : null;
  if (!featured || featSave == null || featSave <= 0) return null;

  return (
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-10 sm:px-6">
      <div className="store-card rounded-xl p-7">
        <div className="grid items-center gap-6 lg:grid-cols-[1.1fr_auto_auto_auto]">
          <div>
            <Editable.Text as="h2" path="titulo" fallback="Economia que faz diferença" label="Título" className="font-display text-[22px] font-extrabold" />
            <Editable.Text as="p" path="texto" fallback="Compare e veja como compensa levar o nosso combo." label="Texto" className="mt-1.5 max-w-[280px] text-sm text-[var(--store-muted)]" />
          </div>
          <div className="text-center">
            <Editable.Text as="div" path="rotulo-normal" fallback="Preço normal" label="Rótulo do preço normal" className="text-[12.5px] font-semibold leading-[1.3] text-[var(--store-muted)]" />
            <div className="font-display mt-1.5 text-[22px] font-bold text-[var(--store-muted)] line-through">{featured.displayOld}</div>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-xl font-bold text-[var(--store-faint)]">−</span>
            <div className="text-center">
              <div className="text-[12.5px] font-semibold text-[var(--store-muted)]" data-editor-ignore="">No {featured.title}</div>
              <div className="font-display mt-1.5 text-[22px] font-extrabold text-[var(--store-primary,#18181B)]">{featured.displayPrice}</div>
            </div>
            <span className="text-xl font-bold text-[var(--store-faint)]">=</span>
          </div>
          <div className="rounded-lg bg-[var(--store-cta,#D97706)] px-6 py-4 text-center lg:justify-self-end">
            <Editable.Text as="div" path="rotulo-economia" fallback="Você economiza" label="Rótulo da economia" className="text-[12.5px] font-bold text-[var(--store-cta-fg,#1C1207)]" />
            <div className="font-display mt-1 text-[26px] font-extrabold leading-[1.1] text-[var(--store-cta-fg,#1C1207)]">{formatBRL(featSave)}</div>
            {featured.offPct != null && <div className="mt-0.5 text-xs font-extrabold text-[var(--store-cta-fg,#1C1207)]">{featured.offPct}% OFF</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
