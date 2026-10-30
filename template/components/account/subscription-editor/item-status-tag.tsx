import { Check, Clock, Pencil, TriangleAlertIcon, Trash2 } from "@/lib/icons"
import { cn } from "@/lib/utils"

const STRIP = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm"
const INLINE = "inline-flex items-center gap-1 text-xs font-semibold"

// Sempre ícone + texto, nunca só cor. Esgotado e indisponível são fixos da plataforma; o resto usa tokens da loja.
const TAGS = {
  outOfStock: { Icon: Clock, label: "Esgotado", cls: `${STRIP} bg-amber-50 text-amber-950` },
  ineligible: { Icon: TriangleAlertIcon, label: "Indisponível para assinatura", cls: `${STRIP} bg-destructive/10 text-destructive` },
  alreadySubscribed: { Icon: Check, label: "Já está na sua assinatura", cls: `${INLINE} text-emerald-700` },
  picksChanged: { Icon: Pencil, label: "Itens alterados", cls: `${INLINE} text-[var(--store-primary)]` },
  willBeRemoved: { Icon: Trash2, label: "Será removido ao salvar", cls: `${STRIP} bg-[var(--store-surface-2)] text-[var(--store-ink)] font-semibold` },
}

export type ItemStatus = keyof typeof TAGS

// children troca o texto padrão (ex.: "Sem estoque no momento. Se não voltar até 14/10..."); action fica à direita (ex.: "Desfazer").
export function ItemStatusTag({
  status,
  action,
  className,
  children,
}: {
  status: ItemStatus
  action?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  const { Icon, label, cls } = TAGS[status]
  return (
    <div className={cn(cls, className)}>
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className="flex-1">{children ?? label}</span>
      {action}
    </div>
  )
}
