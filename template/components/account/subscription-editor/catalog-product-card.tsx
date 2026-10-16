"use client"

import * as React from "react"

import { ItemStatusTag } from "@/components/account/subscription-editor/item-status-tag"
import { PriceCompare } from "@/components/account/subscription-editor/price-compare"
import { VariantChips } from "@/components/account/subscription-editor/variant-chips"
import { QuantityStepper } from "@/components/quantity-stepper"
import { Button } from "@/components/ui/button"
import { Foto } from "@/components/ui/foto"
import { formatBRL } from "@/lib/format"
import { InfoIcon } from "@/lib/icons"
import { nameKey } from "@/lib/subscription-items"
import { cn } from "@/lib/utils"

export type CatalogVariant = { id: string; label: string; soldOut?: boolean }

// Produto do catálogo no formato que o painel precisa. Sem `variants` o produto tem uma variante só, em `variantId`.
export type CatalogProduct = {
  productId: string
  title: string
  imageUrl?: string | null
  price: number // preço de assinatura
  compareAtPrice?: number | null // preço avulso
  categories?: string[]
  soldOut?: boolean
  variantId?: string | null
  variantsLegend?: string // "Moagem"
  variants?: CatalogVariant[]
}

export type AddedItem = { productId: string; variantId: string; quantity: number }

const PILL = "h-10 shrink-0 cursor-pointer rounded-full px-5 text-[14px] font-bold"

// Cartão de um produto na etapa "Adicionar produto". Recolhido mostra o resumo e "Escolher"; aberto mostra
// variante, quantidade e "Adicionar". `subscribedKeys` usa a chave de `nameKey` (produto + variante).
export function CatalogProductCard({
  product,
  subscribedKeys,
  onAdd,
  className,
}: {
  product: CatalogProduct
  subscribedKeys: ReadonlySet<string>
  onAdd: (item: AddedItem) => void
  className?: string
}) {
  const { productId, title, variants } = product
  const [open, setOpen] = React.useState(false)
  const [picked, setPicked] = React.useState<string | null>(null)
  const [quantity, setQuantity] = React.useState(1)
  const bodyId = React.useId()

  const has = (variantId: string | null | undefined) => subscribedKeys.has(nameKey({ productId, variantId }))
  const options = variants?.map((v) => ({
    id: v.id,
    label: v.label,
    disabled: has(v.id) || v.soldOut,
    disabledReason: has(v.id) ? "Já está na sua assinatura" : v.soldOut ? "Esgotado" : undefined,
  }))
  const legend = product.variantsLegend ?? "Variação"
  const variantId = variants ? picked : (product.variantId ?? null)
  const inSubscription = variants ? variants.some((v) => has(v.id)) : has(product.variantId)
  const allSubscribed = variants ? variants.every((v) => has(v.id)) : has(product.variantId)
  const canAdd = !product.soldOut && variantId != null && !has(variantId)

  const add = () => {
    if (!canAdd || variantId == null) return
    onAdd({ productId, variantId, quantity })
    setOpen(false)
    setPicked(null)
    setQuantity(1)
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-3 text-sm transition-colors",
        open ? "border-[var(--store-primary)]" : "border-[var(--store-line-2)]",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-[var(--store-surface-2)]">
          {product.imageUrl && <Foto src={product.imageUrl} alt="" width={48} height={48} sizes="48px" className="size-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[var(--store-ink)]">{title}</p>
          <PriceCompare price={product.price} compareAtPrice={product.compareAtPrice} className="text-[13px]" />
          {variants && !open && (
            <p className="text-[13px] text-[var(--store-muted)]">
              {variants.length} opções de {legend.toLowerCase()}
            </p>
          )}
        </div>
        {allSubscribed ? (
          <ItemStatusTag status="alreadySubscribed" className="max-w-28 shrink-0" />
        ) : (
          <Button
            type="button"
            variant="outline"
            className={cn(PILL, "border-[var(--store-primary)] text-[var(--store-primary)]")}
            disabled={product.soldOut}
            aria-expanded={open}
            aria-controls={bodyId}
            aria-label={`${open ? "Fechar" : "Escolher"} ${title}`}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Fechar" : "Escolher"}
          </Button>
        )}
      </div>

      {product.soldOut && <ItemStatusTag status="outOfStock" className="mt-2" />}
      {inSubscription && !allSubscribed && <ItemStatusTag status="alreadySubscribed" className="mt-2" />}

      {open && !allSubscribed && (
        <div id={bodyId} className="mt-3 flex flex-col gap-3 border-t border-[var(--store-surface-2)] pt-3">
          {options && <VariantChips legend={legend} options={options} value={picked} onChange={setPicked} />}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-bold text-[var(--store-ink-2)]">Quantidade</span>
            <QuantityStepper value={quantity} label={title} onChange={setQuantity} className="rounded-xl" />
          </div>
          {variants && picked == null && (
            <p role="status" className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--store-primary)]">
              <InfoIcon aria-hidden className="size-4 shrink-0" /> Escolha a {legend.toLowerCase()} para continuar.
            </p>
          )}
          <Button
            type="button"
            className="h-12 w-full rounded-full bg-[var(--store-primary)] text-[15px] font-bold text-white hover:bg-[var(--store-primary-dark)] disabled:bg-[var(--store-primary)]/25 disabled:opacity-100"
            disabled={!canAdd}
            onClick={add}
          >
            Adicionar · {formatBRL(product.price * quantity)}
          </Button>
          <p className="text-center text-xs text-[var(--store-muted)]">Entra na assinatura quando você salvar as alterações.</p>
        </div>
      )}
    </div>
  )
}
