"use client"

import * as React from "react"

import { ItemStatusTag } from "@/components/account/subscription-editor/item-status-tag"
import { PriceCompare } from "@/components/account/subscription-editor/price-compare"
import { formatBRL } from "@/lib/format"
import { QuantityStepper } from "@/components/quantity-stepper"
import { Foto } from "@/components/ui/foto"
import { Trash2 } from "@/lib/icons"
import { cn } from "@/lib/utils"

export type EditorItem = {
  name: string
  image?: string
  variant?: string | null
  quantity: number
  price?: number | null
  compareAtPrice?: number | null
  status?: "outOfStock" | "ineligible"
  previousQuantity?: number // quantidade salva, para o aviso "Antes: N"
}

const LINK_BTN = "inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-1.5 text-[13px] font-bold"

// Linha de um produto no modal de edição. Controlada: quem salva decide o que é removido, aqui só se mostra e se avisa.
export function SubscriptionEditorItem({
  item,
  canChangeQuantity,
  canRemove,
  isLastActiveItem,
  isNew,
  isRemoved,
  onQuantityChange,
  onRemove,
  onUndo,
  variantAction,
  children,
}: {
  item: EditorItem
  canChangeQuantity?: boolean
  canRemove?: boolean
  isLastActiveItem?: boolean
  isNew?: boolean
  isRemoved?: boolean
  onQuantityChange: (quantity: number) => void
  onRemove: () => void
  onUndo: () => void
  variantAction?: React.ReactNode // ao lado da variante, ex.: "Trocar"
  children?: React.ReactNode // abaixo do cabeçalho: painel de troca de variante, "Editar sabores"
}) {
  const removeRef = React.useRef<HTMLButtonElement>(null)
  const undoRef = React.useRef<HTMLButtonElement>(null)
  const moveFocus = React.useRef(false) // só depois de um clique, não na primeira renderização

  // O botão clicado some da tela; o foco segue para o par dele depois que o pai muda isRemoved.
  React.useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    ;(isRemoved ? undoRef : removeRef).current?.focus()
  }, [isRemoved])

  const showRemove = (canRemove || isNew) && !isLastActiveItem
  const label = item.variant ? `${item.name} · ${item.variant}` : item.name

  return (
    <div className="flex items-start gap-3 text-sm">
      <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-[var(--store-surface-2)]">
        {item.image && <Foto src={item.image} alt="" width={56} height={56} sizes="56px" className="size-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("flex items-start justify-between gap-3", isRemoved && "line-through opacity-60")}>
          <div className="min-w-0">
            <p className="font-bold text-[var(--store-ink)]">{item.name}</p>
            {item.variant && (
              <p className="flex flex-wrap items-baseline gap-x-1.5 text-[13px] text-[var(--store-muted)]">
                <span>{item.variant}</span>
                {variantAction && !isRemoved && (
                  <>
                    <span aria-hidden>·</span>
                    {variantAction}
                  </>
                )}
              </p>
            )}
          </div>
          {item.price != null && (
            <p className="font-display whitespace-nowrap font-extrabold tabular-nums text-[var(--store-ink)]">{formatBRL(item.price * item.quantity)}</p>
          )}
        </div>

        {isRemoved ? (
          <ItemStatusTag
            status="willBeRemoved"
            className="mt-2"
            action={
              <button
                ref={undoRef}
                type="button"
                className={cn(LINK_BTN, "underline underline-offset-3")}
                aria-label={`Desfazer remoção de ${label}`}
                onClick={() => {
                  moveFocus.current = true
                  onUndo()
                }}
              >
                Desfazer
              </button>
            }
          />
        ) : (
          <>
            {children}
            {item.price != null && (
              <p className="mt-2 text-[13px] text-[var(--store-muted)]">
                <PriceCompare price={item.price} compareAtPrice={item.compareAtPrice} className="font-normal" /> cada
              </p>
            )}
            {item.previousQuantity != null && item.previousQuantity !== item.quantity && (
              <ItemStatusTag status="picksChanged" className="mt-1">
                Antes: {item.previousQuantity}
              </ItemStatusTag>
            )}
            {item.status && <ItemStatusTag status={item.status} className="mt-2" />}
            <div className="mt-3 flex items-center justify-between gap-3">
              <QuantityStepper value={item.quantity} label={label} readOnly={!canChangeQuantity} onChange={onQuantityChange} />
              {showRemove && (
                <button
                  ref={removeRef}
                  type="button"
                  className={cn(LINK_BTN, "text-[var(--store-muted)]")}
                  aria-label={`Remover ${label}`}
                  onClick={() => {
                    moveFocus.current = true
                    onRemove()
                  }}
                >
                  <Trash2 aria-hidden weight="bold" /> Remover
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
