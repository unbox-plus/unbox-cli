"use client";

// KITS temáticos — combos curados de lib/enrichment/combos.ts (some se COMBOS vazio).
import { CombosSection } from "@/components/home/combos-section";
import type { SectionComponentProps } from "./registry";

export function KitsSection({ data }: SectionComponentProps) {
  return <CombosSection combos={data.bundles} />;
}
