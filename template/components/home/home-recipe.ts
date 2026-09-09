// ═══════════════════════════════════════════════════════════════════════════
// RECEITA DA HOME — a ordem, as variantes e as props das seções.
// Escrita pelo create-unbox-store conforme o ESTILO escolhido no setup; editada
// pelo agente de branding no briefing (é AQUI que o layout muda — não reescreva
// o JSX das seções; catálogo de seções/variantes em agents/PADROES.md).
// `npm run typecheck` acusa seção/variante inexistente.
//
// EDITOR DE LOJA: cada entrada vira uma seção editável com id, tipo e nome próprios. Os três saem de
// IDENTIDADE_PADRAO (components/home/sections/registry.ts) quando a entrada não os declara: o hero
// vira "banner", o combos-carousel vira "vitrine", e assim por diante. Declare `id` à mão só numa
// seção REPETIDA na receita, ou num bloco com nome próprio (`{ section: "product-story", id:
// "tradicional", label: "Tradicional" }`): o id é chave primária depois que a loja publica, e o
// derivado das repetidas é posicional (`banner-2`), o que faz reordenar renomear.
// ═══════════════════════════════════════════════════════════════════════════
import type { HomeRecipe } from "@/components/home/sections/registry";

export const homeRecipe: HomeRecipe = [
  {
    section: "hero",
    variant: "imagem-full",
    props: {
      imageDesktop: "/brand/hero-desktop.svg",
      imageMobile: "/brand/hero-mobile.svg",
    },
  },
  { section: "trust-bar" },
  { section: "attributes-marquee" },
  { section: "category-pills" },
  { section: "combos-carousel" },
  { section: "savings" },
  { section: "benefits" },
  { section: "media-cards" },
  { section: "reviews", variant: "grid" },
  { section: "ritual" },
  { section: "founder-story" },
  { section: "kits" },
  { section: "spec-table" },
  { section: "video-wall" },
  { section: "trust-strip" },
  { section: "newsletter", variant: "bloco" },
];
