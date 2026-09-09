// ═══════════════════════════════════════════════════════════════════════════
// RECEITA DA LANDING DE OFERTA (/oferta) — as seções ABAIXO do hero de compra.
// Mesma mecânica da home: registry + entradas editáveis pelo agente de branding
// (catálogo de seções em agents/PADROES.md). O hero de compra (galeria + tiers)
// é fixo da página; o que muda por marca é a pilha de convencimento abaixo dele.
// ═══════════════════════════════════════════════════════════════════════════
import type { HomeRecipe } from "@/components/home/sections/registry";

export const landingRecipe: HomeRecipe = [
  { section: "attributes-marquee" },
  { section: "benefits" },
  { section: "stats-grid" },
  { section: "ritual" },
  { section: "media-cards" },
  { section: "spec-table" },
  { section: "reviews-carousel" },
  { section: "video-wall" },
  { section: "comparison" },
  { section: "quote-banner" },
];
