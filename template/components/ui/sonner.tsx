"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "@/lib/icons"

// Toast da loja: cartão claro nos tokens da marca.
//
// SEM `richColors`. Com ele, o Sonner pinta sucesso/erro/aviso com as cores DELE (verde,
// vermelho e âmbar próprios), e nenhum token da loja chega lá — era o toast verde escuro que
// aparecia em toda loja, de qualquer paleta, e que sobreviveu à descaracterização porque não
// é hex no nosso código. Aqui fundo, texto, borda e sombra vêm de --store-*, e o ESTADO é dito
// só pelo ícone: primária (sucesso), CTA (aviso), sale (erro), muted (info). Quando o briefing
// aplicar a paleta da marca, o toast acompanha sozinho.
//
// `theme="light"` fixo: a loja não tem tema escuro próprio, e deixar o Sonner seguir o sistema
// fazia o toast trocar de cara conforme o SO do visitante, fora do controle da marca.
const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    theme="light"
    className="toaster group"
    icons={{
      success: <CircleCheckIcon className="size-4 text-[var(--store-primary,#18181B)]" />,
      info: <InfoIcon className="size-4 text-[var(--store-muted,#71717A)]" />,
      warning: <TriangleAlertIcon className="size-4 text-[var(--store-cta,#D97706)]" />,
      error: <OctagonXIcon className="size-4 text-[var(--store-sale,#DC2626)]" />,
      loading: <Loader2Icon className="size-4 animate-spin text-[var(--store-muted,#71717A)]" />,
    }}
    style={
      {
        "--normal-bg": "var(--store-surface,#FFFFFF)",
        "--normal-text": "var(--store-ink,#18181B)",
        "--normal-border": "var(--store-line,#E4E4E7)",
        "--border-radius": "var(--radius)",
      } as React.CSSProperties
    }
    toastOptions={{
      classNames: { toast: "cn-toast" },
      style: { boxShadow: "var(--store-shadow-card)" },
    }}
    {...props}
  />
)

export { Toaster }
