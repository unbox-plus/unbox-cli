// Registry das seções da home — o mapa nome→componente que a receita
// (components/home/home-recipe.ts) referencia.
//
// ESTE ARQUIVO NÃO DESCREVE AS SEÇÕES, só declara os nomes válidos (a union tipada que faz o
// tsc reprovar nome inventado). Pra saber O QUE cada seção é, quais variantes tem e quando
// cabe usar: agents/PADROES.md §2 — é o catálogo, e é mais barato que abrir os 23 componentes.
//
// Pra criar uma seção ou variante nova: arquivo em components/home/sections/ + entrada aqui
// + registro no PADROES.md §2 (sem o registro, ninguém acha).
import type { CatalogProductItem, CatalogCategory } from "@/components/catalog/catalog-client";
import type { ResolvedCombo } from "@/lib/enrichment/combos";
import { HeroSection } from "./hero";
import { TrustBarSection } from "./trust-bar";
import { CategoryPillsSection } from "./category-pills";
import { CombosCarouselSection } from "./combos-carousel";
import { SavingsSection } from "./savings";
import { ReviewsSection } from "./reviews";
import { KitsSection } from "./kits";
import { TrustStripSection } from "./trust-strip";
import { NewsletterSection } from "./newsletter";
import { AttributesMarqueeSection } from "./attributes-marquee";
import { BenefitsSection } from "./benefits";
import { StatsGridSection } from "./stats-grid";
import { QuoteBannerSection } from "./quote-banner";
import { MediaCardsSection } from "./media-cards";
import { SpecTableSection } from "./spec-table";
import { RitualSection } from "./ritual";
import { FounderStorySection } from "./founder-story";
import { VideoWallSection } from "./video-wall";
import { SocialRowSection } from "./social-row";
import { ReviewsCarouselSection } from "./reviews-carousel";
import { ComparisonSection } from "./comparison";
import { ProductShowcaseSection } from "./product-showcase";
import { PurchaseHeroSection } from "./purchase-hero";

/** Dados buscados pelo servidor (app/page.tsx) e entregues a todas as seções. */
export interface HomeData {
  combos: CatalogProductItem[];
  featured: CatalogProductItem | null;
  bundles: ResolvedCombo[];
  categories: CatalogCategory[];
  combosTitle: string;
  /** Rótulo "R$X" do frete grátis; null = loja sem regra de frete grátis (seções escondem o selo). */
  freeShipLabel: string | null;
}

/** Props que toda seção recebe do renderer (CombosHome). */
export interface SectionComponentProps {
  data: HomeData;
  variant?: string;
  sectionProps?: Record<string, unknown>;
}

export const SECTIONS = {
  hero: HeroSection,
  "trust-bar": TrustBarSection,
  "category-pills": CategoryPillsSection,
  "combos-carousel": CombosCarouselSection,
  savings: SavingsSection,
  reviews: ReviewsSection,
  kits: KitsSection,
  "trust-strip": TrustStripSection,
  newsletter: NewsletterSection,
  // Biblioteca de conversão (portada de uma loja Unbox real em produção, genericizadas):
  "attributes-marquee": AttributesMarqueeSection,
  benefits: BenefitsSection,
  "stats-grid": StatsGridSection,
  "quote-banner": QuoteBannerSection,
  "media-cards": MediaCardsSection,
  "spec-table": SpecTableSection,
  ritual: RitualSection,
  "founder-story": FounderStorySection,
  "video-wall": VideoWallSection,
  "social-row": SocialRowSection,
  "reviews-carousel": ReviewsCarouselSection,
  comparison: ComparisonSection,
  "product-showcase": ProductShowcaseSection,
  "purchase-hero": PurchaseHeroSection,
} as const;

export type SectionName = keyof typeof SECTIONS;

export interface RecipeEntry {
  section: SectionName;
  /** Variante visual da seção (ver cada componente / PADROES.md). Omitida = default. */
  variant?: string;
  /** Props específicas da seção (ex.: imagens do hero, copy). */
  props?: Record<string, unknown>;
}

/** A receita da home: ordem + variante + props de cada seção. */
export type HomeRecipe = RecipeEntry[];
