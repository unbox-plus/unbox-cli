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
import type { KitSelection } from "@/lib/subscription-draft"
import { nameKey } from "@/lib/subscription-items"
import { cn } from "@/lib/utils"

export type CatalogVariant = { id: string; label: string; soldOut?: boolean }

// Um componente do kit: o cliente escolhe quantas unidades de cada um até fechar a cota.
export type KitComponent = { productId: string; variantId: string; title: string; subtitle?: string | null; imageUrl?: string | null }

// Uma opção do kit (ex.: "4 Box"): na loja cada opção é um produto de kit com a sua cota, o seu preço e os seus componentes.
export type KitOption = {
  productId: string // o produto de kit desta opção: vai como `productKitId` ao adicionar
  variantId: string // a variante do próprio kit
  label: string
  requiredPicks: number
  price: number
  compareAtPrice?: number | null
  highlight?: string | null // ex.: "8% OFF"
  soldOut?: boolean
  components: KitComponent[]
}

// Produto do catálogo no formato que o painel precisa. Sem `variants` o produto tem uma variante só, em `variantId`.
export type CatalogProduct = {
  productId: string
  title: string
  imageUrl?: string | null
  price: number // preço de assinatura (no kit com várias opções, o menor)
  compareAtPrice?: number | null // preço avulso
  categories?: string[]
  soldOut?: boolean
  variantId?: string | null
  variantsLegend?: string // "Moagem"
  variants?: CatalogVariant[]
  kit?: { options: KitOption[] } // só em kit: um cartão só, e o cliente escolhe a opção
}

export type AddedItem = { productId: string; variantId: string; quantity: number; kit?: KitSelection }

const PILL = "h-10 shrink-0 cursor-pointer rounded-full px-5 text-[14px] font-bold"
const ADD_BTN =
  "h-12 w-full rounded-full bg-[var(--store-primary)] text-[15px] font-bold text-white hover:bg-[var(--store-primary-dark)] disabled:bg-[var(--store-primary)]/25 disabled:opacity-100"

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
  const [optionId, setOptionId] = React.useState<string | null>(null) // kit: a opção escolhida
  const [picks, setPicks] = React.useState<Record<string, number>>({}) // kit: quantidade por componente
  const bodyId = React.useId()

  const has = (pid: string, variantId: string | null | undefined) => subscribedKeys.has(nameKey({ productId: pid, variantId }))

  // ---- kit
  const kitOptions = product.kit?.options
  const option = kitOptions ? (kitOptions.length === 1 ? kitOptions[0] : (kitOptions.find((o) => o.productId === optionId) ?? null)) : null
  const optionSubscribed = (o: KitOption) => has(o.productId, o.variantId)
  const chosen = Object.values(picks).reduce((a, b) => a + b, 0)
  const remaining = option ? option.requiredPicks - chosen : 0
  const cheapest = kitOptions ? kitOptions.reduce((m, o) => (o.price < m.price ? o : m), kitOptions[0]) : null

  // ---- produto comum
  const options = variants?.map((v) => ({
    id: v.id,
    label: v.label,
    disabled: has(productId, v.id) || v.soldOut,
    disabledReason: has(productId, v.id) ? "Já está na sua assinatura" : v.soldOut ? "Esgotado" : undefined,
  }))
  const legend = product.variantsLegend ?? "Variação"
  const variantId = variants ? picked : (product.variantId ?? null)

  const inSubscription = kitOptions ? kitOptions.some(optionSubscribed) : variants ? variants.some((v) => has(productId, v.id)) : has(productId, product.variantId)
  const allSubscribed = kitOptions ? kitOptions.every(optionSubscribed) : variants ? variants.every((v) => has(productId, v.id)) : has(productId, product.variantId)
  const canAdd = kitOptions
    ? !!option && !option.soldOut && !optionSubscribed(option) && remaining === 0
    : !product.soldOut && variantId != null && !has(productId, variantId)

  const reset = () => {
    setOpen(false)
    setPicked(null)
    setQuantity(1)
    setOptionId(null)
    setPicks({})
  }

  const add = () => {
    if (!canAdd) return
    if (option) {
      const selected = option.components.filter((c) => (picks[c.variantId] ?? 0) > 0)
      onAdd({
        productId: option.productId,
        variantId: option.variantId,
        quantity: 1,
        kit: { productKitId: option.productId, picks: selected.map((c) => ({ productId: c.productId, productVariantId: c.variantId, quantity: picks[c.variantId] })) },
      })
    } else if (variantId != null) onAdd({ productId, variantId, quantity })
    reset()
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
          {kitOptions && kitOptions.length > 1 && !option ? (
            <p className="text-[13px] text-[var(--store-muted)]">
              A partir de <strong className="font-semibold text-[var(--store-ink)] tabular-nums">{formatBRL(cheapest!.price)}</strong>
            </p>
          ) : (
            <PriceCompare price={option?.price ?? product.price} compareAtPrice={option ? option.compareAtPrice : product.compareAtPrice} className="text-[13px]" />
          )}
          {kitOptions && (
            <p className="text-[13px] text-[var(--store-muted)]">
              {kitOptions.length > 1
                ? `Kit · ${kitOptions.length} opções`
                : `Kit · monte com ${kitOptions[0].requiredPicks} ${kitOptions[0].requiredPicks === 1 ? "item" : "itens"}`}
            </p>
          )}
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

      {open && !allSubscribed && kitOptions && (
        <div id={bodyId} className="mt-3 flex flex-col gap-3 border-t border-[var(--store-surface-2)] pt-3">
          {kitOptions.length > 1 && (
            <VariantChips
              legend="Opções do kit"
              options={kitOptions.map((o) => ({
                id: o.productId,
                label: o.label,
                disabled: optionSubscribed(o) || o.soldOut,
                disabledReason: optionSubscribed(o) ? "Já está na sua assinatura" : o.soldOut ? "Esgotado" : undefined,
              }))}
              value={optionId}
              onChange={(id) => {
                setOptionId(id)
                setPicks({}) // cada opção tem outra cota e outros componentes
              }}
            />
          )}

          {option ? (
            <>
              {option.highlight && <p className="text-xs font-bold text-[var(--store-primary)]">{option.highlight}</p>}
              <p role="status" className="text-xs font-bold text-[var(--store-ink-2)]">
                {chosen} de {option.requiredPicks} {option.requiredPicks === 1 ? "item escolhido" : "itens escolhidos"}
              </p>
              <ul className="flex flex-col divide-y divide-[var(--store-surface-2)]">
                {option.components.map((c) => {
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
                        max={n + remaining}
                        label={c.title}
                        onChange={(v) => setPicks((p) => ({ ...p, [c.variantId]: v }))}
                        className="rounded-xl"
                      />
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <p role="status" className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--store-primary)]">
              <InfoIcon aria-hidden className="size-4 shrink-0" /> Escolha uma opção do kit para continuar.
            </p>
          )}

          <Button type="button" className={ADD_BTN} disabled={!canAdd} onClick={add}>
            {option ? `Adicionar · ${formatBRL(option.price)}` : "Adicionar"}
          </Button>
          <p className="text-center text-xs text-[var(--store-muted)]">Entra na assinatura quando você salvar as alterações.</p>
        </div>
      )}

      {open && !allSubscribed && !kitOptions && (
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
          <Button type="button" className={ADD_BTN} disabled={!canAdd} onClick={add}>
            Adicionar · {formatBRL(product.price * quantity)}
          </Button>
          <p className="text-center text-xs text-[var(--store-muted)]">Entra na assinatura quando você salvar as alterações.</p>
        </div>
      )}
    </div>
  )
}
