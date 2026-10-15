"use client"

import { Check } from "@/lib/icons"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

export type VariantOption = { id: string; label: string; disabled?: boolean; disabledReason?: string }

// Radio group com visual de chip. O label envolve o radio: nome acessível e área de toque de 44px.
export function VariantChips({
  legend,
  options,
  value,
  onChange,
  hideLegend,
  className,
}: {
  legend: string
  options: VariantOption[]
  value: string | null
  onChange: (id: string) => void
  hideLegend?: boolean
  className?: string
}) {
  return (
    <fieldset className={cn("min-w-0 border-0 p-0", className)}>
      <legend className={cn("mb-2 text-[13px] font-bold text-[var(--store-ink-2)]", hideLegend && "sr-only")}>{legend}</legend>
      <RadioGroup value={value ?? ""} onValueChange={(v) => onChange(String(v))} className="flex w-full flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.id}
            className={cn(
              "group relative inline-flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-center rounded-lg border-[1.5px] border-[var(--store-line-2)] bg-white px-3.5 py-1 text-[13px] font-semibold text-[var(--store-ink)] transition-colors",
              "has-data-checked:border-[var(--store-primary)] has-data-checked:bg-[var(--store-primary-soft)] has-data-checked:text-[var(--store-primary)]",
              "has-focus-visible:ring-3 has-focus-visible:ring-[var(--store-primary)]/40",
              "has-data-disabled:cursor-not-allowed has-data-disabled:text-[var(--store-muted)] has-data-disabled:opacity-70"
            )}
          >
            <RadioGroupItem value={o.id} disabled={o.disabled} className="absolute! inset-0 size-full! opacity-0" />
            <span className="inline-flex items-center gap-1.5">
              <Check aria-hidden weight="bold" className="hidden size-4 group-has-data-checked:block" />
              {o.label}
            </span>
            {o.disabled && o.disabledReason && <span className="text-xs font-normal">{o.disabledReason}</span>}
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  )
}
