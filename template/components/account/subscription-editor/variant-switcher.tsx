"use client"

import * as React from "react"

import { VariantChips, type VariantOption } from "@/components/account/subscription-editor/variant-chips"

// "Moagem: Em grãos" -> "moagem", para o link "Trocar moagem". Sem o prefixo, cai em "Trocar".
export const variantName = (variacao: string) => {
  const i = variacao.indexOf(":")
  return i > 0 ? variacao.slice(0, i).trim().toLowerCase() : ""
}

// Troca a variante de um item no lugar (mantém quantidade e posição). Entrega o link e o painel de chips
// separados, porque o link vive ao lado do valor atual e o painel abaixo dele.
export function VariantSwitcher({
  name,
  options,
  value,
  onSwap,
  children,
}: {
  name: string // "moagem"
  options: VariantOption[] // as já usadas por outro item chegam com disabled + disabledReason
  value: string | null
  onSwap: (variantId: string) => void
  children: (parts: { link: React.ReactNode; panel: React.ReactNode }) => React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const linkRef = React.useRef<HTMLButtonElement>(null)

  const close = React.useCallback(() => {
    setOpen(false)
    linkRef.current?.focus()
  }, [])

  // Esc fecha só os chips. O modal escuta Esc no documento, então a captura na janela precisa vir antes.
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      close()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open, close])

  if (options.length === 0) return <>{children({ link: null, panel: null })}</>

  const link = (
    <button
      ref={linkRef}
      type="button"
      aria-expanded={open}
      className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-bold text-[var(--store-ink)] underline underline-offset-3"
      onClick={() => setOpen((o) => !o)}
    >
      {name ? `Trocar ${name}` : "Trocar"}
    </button>
  )

  const panel = open && (
    <VariantChips
      className="mt-2 rounded-lg bg-[var(--store-surface-2)] p-3"
      legend={name ? `Opções de ${name}` : "Opções de variação"}
      hideLegend
      value={value}
      options={options}
      onChange={(id) => {
        onSwap(id)
        close()
      }}
    />
  )

  return <>{children({ link, panel })}</>
}
