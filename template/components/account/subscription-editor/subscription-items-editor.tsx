"use client"

import * as React from "react"
import { CircleNotch } from "@phosphor-icons/react/dist/ssr"

import { AddProductPanel } from "@/components/account/subscription-editor/add-product-panel"
import type { CatalogProduct } from "@/components/account/subscription-editor/catalog-product-card"
import { InlineAlert } from "@/components/account/subscription-editor/inline-alert"
import { SubscriptionEditorItem } from "@/components/account/subscription-editor/subscription-editor-item"
import { VariantSwitcher, variantName } from "@/components/account/subscription-editor/variant-switcher"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatBRL } from "@/lib/format"
import { Calendar, Plus, XIcon } from "@/lib/icons"
import {
  activeItems,
  addItem,
  changeCount,
  createDraft,
  isDirty,
  isLastActive,
  removeItem,
  setQuantity,
  swapVariant,
  toPayload,
  undoRemove,
  validateDraft,
  type SavedItem,
} from "@/lib/subscription-draft"
import { nameKey } from "@/lib/subscription-items"
import { cn } from "@/lib/utils"

export interface ItemDetalhe {
  titulo: string
  variacao: string | null
  foto?: string
  unit: number | null // preço de assinatura
  riscado: number | null // preço avulso
  variantes?: { id: string; label: string; esgotado?: boolean }[]
}

export type EditorPermissions = {
  canChangeProductQuantity?: boolean
  canAddProducts?: boolean
  canRemoveProducts?: boolean
}

const BTN_PRIMARY =
  "h-11 rounded-xl bg-[var(--store-primary,#18181B)] px-5 text-[14px] font-bold text-white hover:bg-[var(--store-primary-dark,#09090B)] disabled:opacity-60"
const BTN_OUTLINE = "h-11 rounded-xl px-4 text-[14px] font-bold"

// Modal "Editar produtos". Sem API: recebe tudo por props e devolve a lista completa em `onSave`.
// Os preços e nomes dos itens salvos vêm em `details` (chave `nameKey`); `catalog` são os produtos que podem ser adicionados.
export function SubscriptionItemsEditor({
  open,
  savedItems,
  details,
  catalog,
  permissions,
  initialStep = "list",
  nextDeliveryDate,
  saving = false,
  saveError = null,
  onSave,
  onClose,
  onCancelSubscription,
}: {
  open: boolean
  savedItems: SavedItem[]
  details: Record<string, ItemDetalhe>
  catalog: CatalogProduct[]
  permissions: EditorPermissions
  initialStep?: "list" | "add"
  nextDeliveryDate?: string
  saving?: boolean
  saveError?: string | null
  onSave: (items: SavedItem[]) => void
  onClose: () => void
  onCancelSubscription: () => void
}) {
  const [draft, setDraft] = React.useState(() => createDraft(savedItems))
  const [step, setStep] = React.useState<"list" | "add">(initialStep)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [status, setStatus] = React.useState("")
  const [wasOpen, setWasOpen] = React.useState(false)
  const keepEditingRef = React.useRef<HTMLButtonElement>(null)

  // Ao abrir, o rascunho sempre começa da lista salva. Feito durante a renderização (e não num efeito)
  // para o modal nunca aparecer um quadro com o rascunho da vez anterior.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraft(createDraft(savedItems))
      setStep(initialStep)
      setConfirmOpen(false)
      setStatus("")
    }
  }

  const canAdd = !!permissions.canAddProducts && catalog.length > 0
  const dirty = isDirty(savedItems, draft)
  const invalid = validateDraft(draft)
  const active = activeItems(draft)
  const nameOf = (it: SavedItem) => details[nameKey(it)]?.titulo ?? catalog.find((p) => p.productId === it.productId)?.title ?? it.productId

  const requestClose = () => {
    if (saving) return
    if (dirty) setConfirmOpen(true)
    else onClose()
  }
  const save = () => {
    if (!dirty || invalid || saving) return
    onSave(toPayload(draft))
  }

  // Resumo: só aparece se todo item ativo tem preço de assinatura.
  const priced = active.map((it) => ({ it, d: details[nameKey(it)] }))
  const showTotal = priced.length > 0 && priced.every((x) => x.d?.unit != null)
  const total = priced.reduce((t, x) => t + (x.d?.unit ?? 0) * x.it.quantity, 0)
  const changes = changeCount(savedItems, draft)

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && requestClose()}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            "grid-cols-[minmax(0,1fr)] sm:max-w-2xl",
            canAdd && "lg:max-w-4xl",
            // mobile: tela cheia nas duas etapas, então abrir, fechar e trocar de etapa não muda o tamanho do modal.
            // Sem animação de zoom (em tela cheia ela só pisca); cabeçalho, miolo e rodapé são faixas.
            "max-lg:top-0 max-lg:left-0 max-lg:flex max-lg:h-dvh max-lg:max-w-none! max-lg:translate-x-0 max-lg:translate-y-0 max-lg:flex-col max-lg:gap-0 max-lg:rounded-none max-lg:p-0 max-lg:data-open:animate-none max-lg:data-closed:animate-none",
          )}
        >
          {/* primeiro no DOM: é o primeiro da ordem do Tab */}
          <Button type="button" variant="ghost" size="icon-sm" className="absolute top-3 right-3 z-10" aria-label="Fechar" disabled={saving} onClick={requestClose}>
            <XIcon aria-hidden className="size-4" />
          </Button>

          <DialogHeader className={cn(step === "list" ? "max-lg:shrink-0 max-lg:border-b max-lg:p-4 max-lg:pr-14" : "sr-only lg:not-sr-only")}>
            <DialogTitle>Editar produtos</DialogTitle>
            <DialogDescription>Ajuste os produtos dos próximos ciclos.</DialogDescription>
          </DialogHeader>

          {/* erro e faixa de vigência ficam fora da rolagem: sempre visíveis */}
          <div className="flex shrink-0 flex-col gap-3 max-lg:px-4 max-lg:pt-4">
            {saveError && (
              <InlineAlert variant="error" title="Não foi possível salvar." action={{ label: "Tentar de novo", onClick: save }}>
                {saveError}
              </InlineAlert>
            )}
            <InlineAlert variant="info" icon={Calendar} title={`As mudanças valem a partir da próxima entrega${nextDeliveryDate ? `, em ${nextDeliveryDate}` : ""}.`}>
              A entrega que já está a caminho não muda.
            </InlineAlert>
          </div>

          <fieldset
            disabled={saving}
            aria-busy={saving}
            className={cn(
              "m-0 flex min-h-0 min-w-0 flex-col gap-6 border-0 p-0 max-lg:flex-1 lg:flex-row",
              step === "list" ? "max-lg:overflow-y-auto max-lg:p-4" : "max-lg:overflow-hidden",
            )}
          >
            <div className={cn("flex min-w-0 flex-1 flex-col gap-4", step === "add" && "hidden lg:flex")}>
              <ul className="flex flex-col divide-y divide-[var(--store-surface-2)]">
                {draft.map((it, i) => {
                  const d = details[nameKey(it)]
                  const before = savedItems.find((x) => nameKey(x) === nameKey(it))?.quantity
                  const swappable = d?.variantes ?? []
                  return (
                    <li key={`${it.productId}:${i}`} className="py-3.5 first:pt-0">
                      <VariantSwitcher
                        name={d?.variacao ? variantName(d.variacao) : ""}
                        value={it.variantId}
                        options={swappable.map((o) => {
                          const jaTem = draft.some((x, j) => j !== i && x.productId === it.productId && x.variantId === o.id)
                          return {
                            id: o.id,
                            label: o.label,
                            disabled: jaTem || o.esgotado,
                            disabledReason: jaTem ? "Já está na sua assinatura" : o.esgotado ? "Esgotado" : undefined,
                          }
                        })}
                        onSwap={(v) => {
                          setDraft((dr) => swapVariant(dr, i, v))
                          setStatus(`Variação trocada em ${nameOf(it)}`)
                        }}
                      >
                        {({ link, panel }) => (
                          <SubscriptionEditorItem
                            item={{
                              name: d?.titulo ?? it.productId,
                              image: d?.foto,
                              variant: d?.variacao,
                              quantity: it.quantity,
                              price: d?.unit,
                              compareAtPrice: d?.riscado,
                              previousQuantity: before,
                              status: swappable.find((v) => v.id === it.variantId)?.esgotado ? "outOfStock" : undefined,
                            }}
                            canChangeQuantity={permissions.canChangeProductQuantity}
                            canRemove={permissions.canRemoveProducts}
                            isLastActiveItem={isLastActive(draft, i)}
                            isNew={it.isNew}
                            isRemoved={it.removed}
                            variantAction={link}
                            onQuantityChange={(q) => setDraft((dr) => setQuantity(dr, i, q))}
                            onRemove={() => {
                              setDraft((dr) => removeItem(dr, i))
                              setStatus(`Item removido: ${nameOf(it)}`)
                            }}
                            onUndo={() => {
                              setDraft((dr) => undoRemove(dr, i))
                              setStatus(`Remoção desfeita: ${nameOf(it)}`)
                            }}
                          >
                            {panel}
                          </SubscriptionEditorItem>
                        )}
                      </VariantSwitcher>
                    </li>
                  )
                })}
              </ul>

              {active.length === 1 && (
                <InlineAlert variant="warning">
                  A assinatura precisa de pelo menos 1 produto. Para parar de receber, use{" "}
                  <button type="button" className="cursor-pointer font-bold underline underline-offset-3" onClick={onCancelSubscription}>
                    Cancelar assinatura
                  </button>
                  .
                </InlineAlert>
              )}

              {canAdd && (
                <Button type="button" variant="outline" className={cn(BTN_OUTLINE, "lg:hidden")} onClick={() => setStep("add")}>
                  <Plus aria-hidden weight="bold" /> Adicionar produto
                </Button>
              )}

              {showTotal && (
                <div className="rounded-xl border border-[var(--store-line)] bg-white p-4">
                  <div className="flex items-baseline justify-between gap-3 font-bold text-[var(--store-ink)]">
                    <span>Valor dos produtos na próxima entrega</span>
                    <span className="font-display text-[17px] font-extrabold tabular-nums">{formatBRL(total)}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--store-muted)]">Frete calculado na cobrança. Preços já com desconto de assinatura.</p>
                </div>
              )}
            </div>

            {canAdd && (
              <AddProductPanel
                className={cn(step === "list" && "hidden lg:flex", "lg:border-l lg:border-[var(--store-surface-2)] lg:pl-6")}
                catalog={catalog}
                subscribedKeys={new Set(draft.map(nameKey))}
                onAdd={(novo) => {
                  setDraft((dr) => addItem(dr, novo))
                  setStatus(`Produto adicionado: ${catalog.find((p) => p.productId === novo.productId)?.title ?? ""}`)
                }}
                onBack={() => setStep("list")}
              />
            )}
          </fieldset>

          {/* uma só região para os avisos de status */}
          <div role="status" aria-live="polite" className="sr-only">
            {status}
          </div>

          <DialogFooter
            className={cn(
              "flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between",
              "max-lg:mx-0 max-lg:mb-0 max-lg:shrink-0 max-lg:rounded-none max-lg:bg-white max-lg:pb-[max(1rem,env(safe-area-inset-bottom))]",
              step === "add" && "hidden lg:flex",
            )}
          >
            <p className="flex flex-col gap-0.5 text-[13px] text-[var(--store-muted)]">
              {showTotal && (
                <span>
                  <strong className="font-display text-[15px] font-extrabold text-[var(--store-ink)] tabular-nums">{formatBRL(total)}</strong> em produtos, sem frete
                </span>
              )}
              <span>{changes === 0 ? "Nenhuma alteração" : changes === 1 ? "1 alteração não salva" : `${changes} alterações não salvas`}</span>
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                className="h-11 cursor-pointer border-none bg-transparent px-3 text-[14px] font-bold text-[var(--store-ink)] underline underline-offset-3 disabled:opacity-60"
                disabled={saving}
                onClick={requestClose}
              >
                Cancelar
              </button>
              <Button type="button" className={cn(BTN_PRIMARY, "max-sm:flex-1")} disabled={!dirty || !!invalid || saving} onClick={save}>
                {saving && <CircleNotch aria-hidden className="animate-spin" />}
                {saving ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </DialogFooter>

          {/* dentro do modal: assim o foco e o Esc tratam a confirmação como aninhada */}
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent initialFocus={keepEditingRef}>
              <AlertDialogHeader>
                <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
                <AlertDialogDescription>Você mudou os produtos e ainda não salvou. Se sair agora, as mudanças serão perdidas.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel ref={keepEditingRef} className={BTN_OUTLINE}>
                  Continuar editando
                </AlertDialogCancel>
                <AlertDialogAction
                  className={BTN_PRIMARY}
                  onClick={() => {
                    setConfirmOpen(false)
                    onClose()
                  }}
                >
                  Sair sem salvar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogContent>
      </Dialog>

    </>
  )
}
