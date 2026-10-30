import Link from "next/link"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CheckCircle2, InfoIcon, OctagonXIcon, TriangleAlertIcon, XIcon } from "@/lib/icons"
import { cn } from "@/lib/utils"

// info e warning são neutros (tokens da loja); erro e sucesso são fixos da plataforma.
const VARIANTS = {
  info: { Icon: InfoIcon, cls: "border-transparent bg-[var(--store-surface-2)] text-[var(--store-ink)]" },
  warning: { Icon: TriangleAlertIcon, cls: "border-transparent bg-[var(--store-surface-2)] text-[var(--store-ink)]" },
  error: { Icon: OctagonXIcon, cls: "border-transparent bg-destructive/10 text-destructive" },
  success: { Icon: CheckCircle2, cls: "border-transparent bg-emerald-50 text-emerald-900" },
}

type Action = { label: string; onClick: () => void } | { label: string; href: string }

export function InlineAlert({
  variant,
  title,
  icon,
  action,
  onDismiss,
  className,
  children,
}: {
  variant: keyof typeof VARIANTS
  title?: string // trecho em negrito antes do texto
  icon?: typeof InfoIcon // troca o ícone padrão da variante
  action?: Action
  onDismiss?: () => void
  className?: string
  children?: React.ReactNode
}) {
  const { Icon: Padrao, cls } = VARIANTS[variant]
  const Icon = icon ?? Padrao
  return (
    <Alert
      // só o erro é anunciado na hora; success avisa como status
      role={variant === "error" ? "alert" : variant === "success" ? "status" : undefined}
      className={cn("flex items-start gap-2 px-3 py-2.5", cls, className)}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <AlertDescription className="flex flex-1 flex-col items-start gap-2 text-current">
        <p>
          {title && <strong className="font-semibold">{title} </strong>}
          {children}
        </p>
        {action &&
          ("href" in action ? (
            <Link href={action.href} className="text-sm font-semibold underline underline-offset-3">
              {action.label}
            </Link>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={action.onClick} className="rounded-full border-current bg-transparent text-current">
              {action.label}
            </Button>
          ))}
      </AlertDescription>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Fechar aviso" className="shrink-0 cursor-pointer">
          <XIcon aria-hidden className="size-4" />
        </button>
      )}
    </Alert>
  )
}
