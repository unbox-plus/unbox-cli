// Registry das seções da home — o mapa nome→componente que a receita
// (components/home/home-recipe.ts) referencia.
//
// ESTE ARQUIVO NÃO DESCREVE AS SEÇÕES, só declara os nomes válidos (a union tipada que faz o
// tsc reprovar nome inventado). Pra saber O QUE cada seção é, quais variantes tem e quando
// cabe usar: agents/PADROES.md §2 — é o catálogo, e é mais barato que abrir os 24 componentes.
//
// Pra criar uma seção ou variante nova: arquivo em components/home/sections/ + entrada aqui
// + IDENTIDADE_PADRAO (id, tipo e nome que o lojista vê) + registro no PADROES.md §2.
import type { CatalogProductItem, CatalogCategory } from "@/components/catalog/catalog-client";
import type { ResolvedCombo } from "@/lib/enrichment/combos";
import type { SectionKind } from "@/lib/editable";
// só o TIPO: lib/vitrine.ts é `server-only`, e `import type` é apagado na compilação. Nenhum
// módulo de servidor entra no bundle das seções por causa desta linha.
import type { VitrinesResolvidas } from "@/lib/vitrine";
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
import { BlocoHtmlSection } from "./bloco-html";

/** Dados buscados pelo servidor (app/page.tsx) e entregues a todas as seções. */
export interface HomeData {
  combos: CatalogProductItem[];
  featured: CatalogProductItem | null;
  bundles: ResolvedCombo[];
  categories: CatalogCategory[];
  combosTitle: string;
  /** Rótulo "R$X" do frete grátis; null = loja sem regra de frete grátis (seções escondem o selo). */
  freeShipLabel: string | null;
  /**
   * EDITOR: as VITRINES já resolvidas, indexadas pelo CAMINHO (`<container>.<id da seção>.vitrine`).
   *
   * O documento do lojista guarda só a ESCOLHA (categoria da Unbox, lista de produtos ou busca);
   * quem busca os produtos é o SERVIDOR (lib/vitrine.ts, `resolverVitrinesDoDocumento`) e os entrega
   * prontos aqui. Cada seção acha os seus DERIVANDO o caminho do próprio escopo (`joinPath(ctx.scope,
   * CAMPO_VITRINE)`), nunca por uma constante escrita à mão, que descolaria da seção no primeiro `id`
   * renomeado.
   *
   * Caminho ausente = o lojista não escolheu, ou a escolha não resolveu em nada (Unbox fora,
   * categoria esvaziada): a seção mostra os produtos do CÓDIGO. Omitido de todo (página que não
   * leu o documento, como /oferta) = idem.
   */
  vitrines?: VitrinesResolvidas;
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
  // Seção do EDITOR (não vem da receita): o lojista a adiciona pelo "+" e cola o HTML dele dentro.
  // Fica no registry como as outras porque o catálogo (sections/catalogo.ts) só sabe instanciar o que
  // está aqui, e porque o dia em que a receita quiser um bloco de HTML fixo, ele já existe.
  "bloco-html": BlocoHtmlSection,
} as const;

export type SectionName = keyof typeof SECTIONS;

export interface RecipeEntry {
  section: SectionName;
  /**
   * EDITOR: identidade ESTÁVEL da seção (ordem, ocultar, e o prefixo de todo caminho de copy dentro
   * dela). Omitido = o id de IDENTIDADE_PADRAO da seção (e "-2", "-3" nas repetidas).
   *
   * CHAVE PRIMÁRIA depois que a loja publica: o documento do lojista aponta para este nome. Renomear,
   * ou reordenar seções repetidas (o que renumera as derivadas), apaga a edição dele em silêncio.
   * Escreva o id à mão nas seções que se repetem na receita.
   */
  id?: string;
  /** Nome que o LOJISTA vê no painel ("Banner principal"). Omitido = o de IDENTIDADE_PADRAO. */
  label?: string;
  /** Tipo da seção no vocabulário fechado da foundation (`SECTION_KINDS`). Omitido = o de IDENTIDADE_PADRAO. */
  kind?: SectionKind;
  /** Variante visual da seção (ver cada componente / PADROES.md). Omitida = default. */
  variant?: string;
  /** Props específicas da seção (ex.: imagens do hero, copy). */
  props?: Record<string, unknown>;
}

/** A receita da home: ordem + variante + props de cada seção. */
export type HomeRecipe = RecipeEntry[];

/**
 * A IDENTIDADE de cada seção PARA O EDITOR: o id (prefixo de todo caminho de copy, chave primária
 * depois de publicado), o tipo do vocabulário fechado e o nome que o lojista lê no painel.
 *
 * Mora AQUI, e não em cada entrada da receita, porque `components/home/home-recipe.ts` é REESCRITO
 * pelo create-unbox-store a partir de src/presets.js: uma receita que exigisse id/kind/label em cada
 * linha nasceria incompleta em toda loja gerada. A receita pode sobrescrever qualquer um dos três
 * (é o que fazer numa seção repetida ou num bloco com nome próprio, "Tradicional", "Chocolate").
 *
 * Ids em português, do ponto de vista do lojista, nunca o nome de código: o id vaza no tooltip do
 * painel e no caminho de todo texto da seção ("banner", nunca "hero"; ver README do editor,
 * "Vocabulário: nunca hero"). NÃO RENOMEIE depois que alguma loja publicou.
 */
export const IDENTIDADE_PADRAO: Record<SectionName, { id: string; kind: SectionKind; label: string }> = {
  hero: { id: "banner", kind: "banner", label: "Banner principal" },
  "trust-bar": { id: "selos", kind: "beneficios", label: "Selos de confiança" },
  "category-pills": { id: "categorias", kind: "outro", label: "Categorias" },
  "combos-carousel": { id: "vitrine", kind: "vitrine-de-produtos", label: "Vitrine de destaques" },
  savings: { id: "economia", kind: "produto-em-destaque", label: "Economia do combo" },
  reviews: { id: "depoimentos", kind: "depoimentos", label: "Depoimentos" },
  kits: { id: "kits", kind: "vitrine-de-produtos", label: "Kits e combos" },
  "trust-strip": { id: "diferenciais", kind: "beneficios", label: "Diferenciais" },
  newsletter: { id: "newsletter", kind: "newsletter", label: "Newsletter" },
  "attributes-marquee": { id: "faixa-rolante", kind: "texto-rolante", label: "Faixa rolante" },
  benefits: { id: "beneficios", kind: "beneficios", label: "Benefícios" },
  "stats-grid": { id: "numeros", kind: "beneficios", label: "Números e destaques" },
  "quote-banner": { id: "citacao", kind: "sobre-a-marca", label: "Citação" },
  "media-cards": { id: "cards", kind: "galeria", label: "Cards de imagem" },
  "spec-table": { id: "ficha", kind: "outro", label: "Ficha técnica" },
  ritual: { id: "como-funciona", kind: "como-funciona", label: "Como funciona" },
  "founder-story": { id: "historia", kind: "sobre-a-marca", label: "Nossa história" },
  "video-wall": { id: "videos", kind: "video", label: "Vídeos" },
  "social-row": { id: "comunidade", kind: "galeria", label: "Comunidade" },
  "reviews-carousel": { id: "avaliacoes", kind: "depoimentos", label: "Avaliações" },
  comparison: { id: "comparativo", kind: "comparacao", label: "Comparativo" },
  "product-showcase": { id: "grade", kind: "vitrine-de-produtos", label: "Grade de produtos" },
  "purchase-hero": { id: "compra", kind: "produto-em-destaque", label: "Bloco de compra" },
  "bloco-html": { id: "bloco-html", kind: "outro", label: "Bloco de HTML" },
};

/**
 * Cada entrada da receita com a identidade completa (id, kind, label) que o editor usa: o que a
 * receita declara vence; o que ela omite sai de IDENTIDADE_PADRAO. Id derivado ganha "-2", "-3"
 * quando a mesma seção se repete, na ordem em que aparece.
 */
export function withIds(recipe: HomeRecipe): (RecipeEntry & { id: string; kind: SectionKind; label: string })[] {
  const vistos = new Map<string, number>();
  return recipe.map((e) => {
    const padrao = IDENTIDADE_PADRAO[e.section];
    const kind = e.kind ?? padrao.kind;
    const label = e.label ?? padrao.label;
    if (e.id) return { ...e, id: e.id, kind, label };
    const n = (vistos.get(padrao.id) ?? 0) + 1;
    vistos.set(padrao.id, n);
    return { ...e, id: n === 1 ? padrao.id : `${padrao.id}-${n}`, kind, label };
  });
}
