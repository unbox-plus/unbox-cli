"use client"

import * as React from "react"

import { QuantityStepper } from "@/components/quantity-stepper"
import { Button } from "@/components/ui/button"
import { Foto } from "@/components/ui/foto"
import type { KitPick } from "@/lib/subscription-draft"
import { cn } from "@/lib/utils"

// Um item que o cliente pode escolher dentro do kit: ele decide quantas unidades de cada um, até fechar a cota.
export type KitComponent = { productId: string; variantId: string; title: string; subtitle?: string | null; imageUrl?: string | null }

// Monta a escolha dos itens de um kit. A soma tem de bater EXATAMENTE com a cota: "Confirmar" só habilita nesse ponto.
// `initialPicks` preenche o que já estava escolhido (edição); `onCancel` só aparece quando existe (na adição o cartão já tem "Fechar").
export function KitPicksBuilder({
  cap,
  options,
  initialPicks,
  onConfirm,
  onCancel,
  confirmLabel = "Confirmar",
  confirmDisabled,
  className,
}: {
  cap: number
  options: KitComponent[]
  initialPicks?: KitPick[]
  onConfirm: (picks: KitPick[]) => void
  onCancel?: () => void
  confirmLabel?: string
  confirmDisabled?: boolean // trava por outro motivo (ex.: opção esgotada ou já na assinatura)
  className?: string
}) {
  const [picks, setPicks] = React.useState<Record<string, number>>(() =>
    Object.fromEntries((initialPicks ?? []).map((p) => [p.productVariantId, p.quantity])),
  )
  const chosen = Object.values(picks).reduce((a, b) => a + b, 0)
  const remaining = cap - chosen
  const noun = (n: number) => (n === 1 ? "item" : "itens")

  const confirm = () => {
    if (remaining !== 0 || confirmDisabled) return
    onConfirm(
      options
        .filter((o) => (picks[o.variantId] ?? 0) > 0)
        .map((o) => ({ productId: o.productId, productVariantId: o.variantId, quantity: picks[o.variantId] })),
    )
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p role="status" className="text-xs font-bold text-[var(--store-ink-2)]">
        {chosen} de {cap} {cap === 1 ? "item escolhido" : "itens escolhidos"}
        {remaining < 0 && ` (passou ${-remaining} ${noun(-remaining)})`}
      </p>
      <ul className="flex flex-col divide-y divide-[var(--store-surface-2)]">
        {options.map((c) => {
          const n = picks[c.variantId] ?? 0
          return (
            <li key={c.variantId} className="flex items-center gap-3 py-3">
              <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-[var(--store-surface-2)]">
                {c.imageUrl && <Foto src={c.imageUrl} alt="" width={40} height={40} sizes="40px" className="size-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[var(--store-ink)]">{c.title}</p>
                {c.subtitle && <p className="text-[13px] text-[var(--store-muted)]">{c.subtitle}</p>}
              </div>
              <QuantityStepper
                value={n}
                min={0}
                max={n + Math.max(0, remaining)}
                label={c.title}
                onChange={(v) => setPicks((p) => ({ ...p, [c.variantId]: v }))}
                className="rounded-xl"
              />
            </li>
          )
        })}
      </ul>
      {onCancel ? (
        // edição: "Cancelar" em link e o botão de confirmar à direita
        <div className="flex items-center justify-end gap-4">
          <button type="button" className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-bold text-[var(--store-ink)] underline underline-offset-3" onClick={onCancel}>
            Cancelar
          </button>
          <Button
            type="button"
            className="h-11 rounded-lg bg-[var(--store-primary,#18181B)] px-5 text-[14px] font-bold text-white hover:bg-[var(--store-primary-dark,#09090B)] disabled:opacity-60"
            disabled={remaining !== 0 || confirmDisabled}
            onClick={confirm}
          >
            {confirmLabel}
          </Button>
        </div>
      ) : (
        // adição: o botão ocupa a largura toda. Sem flex-1: numa coluna ele zera a base do flex e o botão encolhe até a altura do texto.
        <Button
          type="button"
          className="h-12 w-full rounded-full bg-[var(--store-primary)] text-[15px] font-bold text-white hover:bg-[var(--store-primary-dark)] disabled:bg-[var(--store-primary)]/25 disabled:opacity-100"
          disabled={remaining !== 0 || confirmDisabled}
          onClick={confirm}
        >
          {confirmLabel}
        </Button>
      )}
    </div>
  )
}
