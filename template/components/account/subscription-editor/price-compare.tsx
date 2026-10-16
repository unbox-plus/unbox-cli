import { formatBRL } from "@/lib/format"
import { cn } from "@/lib/utils"

// Preço de assinatura com o avulso riscado ao lado. O leitor de tela não lê o risco, então o texto escondido diz o que é.
export function PriceCompare({
  price,
  compareAtPrice,
  className,
}: {
  price: number
  compareAtPrice?: number | null
  className?: string
}) {
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5", className)}>
      <span className="font-semibold whitespace-nowrap tabular-nums">{formatBRL(price)}</span>
      {compareAtPrice != null && compareAtPrice > price && (
        <s className="text-[0.85em] whitespace-nowrap text-[var(--store-muted)] tabular-nums">
          <span className="sr-only">Preço avulso: </span>
          {formatBRL(compareAtPrice)}
        </s>
      )}
    </span>
  )
}
