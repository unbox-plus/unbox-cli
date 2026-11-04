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
  label,
  readOnly,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number | null;
  disabled?: boolean;
  label?: string;
  readOnly?: boolean;
  className?: string;
}) {
  if (readOnly)
    return (
      <span className={cn("text-sm tabular-nums", className)}>
        Qtd.: {value}
      </span>
    );
  const de = label ? ` de ${label}` : "";
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () =>
    onChange(max != null ? Math.min(max, value + 1) : value + 1);
  return (
    <div
      className={cn("inline-flex items-center rounded-lg border", className)}
      role="group"
      aria-label={`Quantidade${de}`}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="relative after:absolute after:-inset-2 after:content-['']"
        onClick={dec}
        disabled={disabled || value <= min}
        aria-label={label ? `Diminuir quantidade${de}` : "Diminuir"}
      >
        <Minus />
      </Button>
      <span className="w-9 text-center text-sm tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="relative after:absolute after:-inset-2 after:content-['']"
        onClick={inc}
        disabled={disabled || (max != null && value >= max)}
        aria-label={label ? `Aumentar quantidade${de}` : "Aumentar"}
      >
        <Plus />
      </Button>
    </div>
  );
}
