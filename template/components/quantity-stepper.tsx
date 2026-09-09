"use client";

import { Minus, Plus } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Stepper de quantidade respeitando min/max do produto (doc 02).
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number | null;
  disabled?: boolean;
  className?: string;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(max ? Math.min(max, value + 1) : value + 1);
  return (
    <div className={cn("inline-flex items-center rounded-lg border", className)} role="group" aria-label="Quantidade">
      <Button type="button" variant="ghost" size="icon-sm" onClick={dec} disabled={disabled || value <= min} aria-label="Diminuir">
        <Minus />
      </Button>
      <span className="w-9 text-center text-sm tabular-nums" aria-live="polite">{value}</span>
      <Button type="button" variant="ghost" size="icon-sm" onClick={inc} disabled={disabled || (max != null && value >= max)} aria-label="Aumentar">
        <Plus />
      </Button>
    </div>
  );
}
