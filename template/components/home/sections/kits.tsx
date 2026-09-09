"use client";

// KITS temáticos — combos curados de lib/enrichment/combos.ts (some se COMBOS vazio).
// EDITOR: o cabeçalho da seção (chapéu, título, subtítulo) é copy e vira caminho da seção, dentro
// de CombosSection; os kits em si (nome, itens, preço) são DADO da loja e ficam fora (README §8).
import { CombosSection } from "@/components/home/combos-section";
import type { SectionComponentProps } from "./registry";

export function KitsSection({ data }: SectionComponentProps) {
  return <CombosSection combos={data.bundles} />;
}
