# Agente 10 — Feedback / UX

> ⚠️ **Doc de plano (histórico).** A implementação entregue pela foundation difere em nomes e
> caminhos de arquivo citados abaixo. O mapa REAL de arquivos por área é a tabela "Agentes
> 00-11" do `agents/MANAGER.md` — em conflito, valem o MANAGER e o código.

## Escopo
Padrões de UX compartilhados: toasts, skeletons, estados de loading, error boundaries e páginas
especiais (error.tsx, not-found.tsx).

## Dependências
- Agente 00 (Scaffold) — `lib/feedback.ts` base
- Reutilizado por todos os outros agentes

## Arquivos proprietários

| Arquivo | Descrição |
|---------|-----------|
| `components/ui/Toast.tsx` | Componente de toast |
| `components/ui/ToastProvider.tsx` | Provider global com useToast hook |
| `components/ui/skeleton.tsx` | Skeleton polimórfico com animate-pulse |
| `components/ui/LoadingSpinner.tsx` | Spinner SVG com aria-label |
| `components/ui/ErrorBoundary.tsx` | Client error boundary |
| `components/ui/EmptyState.tsx` | Estado vazio genérico |
| `app/error.tsx` | Erro global (client component obrigatório) |
| `app/not-found.tsx` | 404 |
| `app/loading.tsx` | Fallback de Suspense global |
| `lib/feedback.ts` | Re-exports + mapa de erros de pagamento |

## lib/feedback.ts (completo)

```ts
export { friendlyError, cartEventLabel, ERROR_MESSAGES, CART_EVENT_LABELS } from "@payflows/unbox-sdk"

export const CHECKOUT_STEPS = {
  address: "Endereço",
  shipping: "Frete",
  payment: "Pagamento",
  confirmation: "Confirmação",
} as const

export function getPaymentErrorMessage(code: string): string {
  const map: Record<string, string> = {
    INSUFFICIENT_FUNDS_ERROR: "Cartão sem limite disponível",
    CARD_DECLINED: "Cartão recusado pela operadora",
    INVALID_CARD: "Dados do cartão inválidos",
    EXPIRED_CARD: "Cartão expirado",
    PAYMENT_PROCESSING_ERROR: "Erro ao processar pagamento. Tente novamente.",
  }
  return map[code] ?? "Erro no pagamento. Tente outro cartão ou método de pagamento."
}
```

## ToastProvider + useToast

```tsx
// Não depender de Radix/shadcn toast — usar Base UI ou implementação própria
type ToastType = "success" | "error" | "info" | "warning"
interface ToastItem { id: string; title: string; description?: string; type: ToastType }

const ToastContext = createContext<{
  toast(params: Omit<ToastItem, "id">): void
  dismiss(id: string): void
}>()

export function useToast() { return useContext(ToastContext) }

// Toast com auto-dismiss em 5s, acessível com role="status" aria-live="polite"
```

## Skeleton — uso

```tsx
// Genérico (polimórfico):
<Skeleton className="h-4 w-32" />           // linha de texto
<Skeleton className="aspect-square w-full" /> // imagem

// Compostos:
export function ProductCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-square w-full rounded-lg" />
      <Skeleton className="mt-2 h-4 w-3/4" />
      <Skeleton className="mt-1 h-4 w-1/2" />
    </div>
  )
}
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => <ProductCardSkeleton key={i} />)}
    </div>
  )
}
```

## app/error.tsx (CRÍTICO)

```tsx
"use client"  // ← obrigatório pelo Next.js
import { useEffect } from "react"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset(): void }) {
  useEffect(() => {
    // Log interno — nunca exibir ao usuário
    console.error("[Error Boundary]", error.message)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <h2>Algo deu errado</h2>
      <p>Ocorreu um erro inesperado. Tente novamente.</p>
      <button onClick={reset}>Tentar novamente</button>
    </div>
  )
}
```

## Acessibilidade — checklist obrigatório

```
- aria-live="polite" nos toasts (não "assertive" para não interromper)
- aria-busy="true" em botões durante loading
- role="status" em mensagens de feedback
- Não remover outline/foco visível (apenas customizar cor)
- Focus trap em drawers e dialogs (Base UI já cuida)
- Skip link: <a href="#main-content" className="sr-only focus:not-sr-only">Pular para conteúdo</a>
```
