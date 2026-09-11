// ===== Padrão de enriquecimento de produtos =====
// Dados que NÃO vêm da Unbox (composição, medidas, origem, EAN, SEO, FAQ, reviews, combos,
// "compre junto" — e tabela nutricional/alergênicos quando o produto for alimento ou
// suplemento) ficam aqui, em products.json, indexados pelo SKU. A junção com o produto Unbox
// é pelo `sku` (produto ou variante). Quem preenche é o briefing, a partir do material real da
// marca. Todo campo é opcional na prática: o que estiver vazio simplesmente não renderiza.
//
// Uso (server-side, ex.: na PDP): getEnrichmentForProduct(product) → mescla com os dados da Unbox.
// Importar SÓ em Server Components / rotas (o JSON é grande; não use em client components).
import raw from "./products.json";

export interface NutritionTable {
  /** "100g" | "Porção" */
  base: string;
  observacao?: string;
  /** ex.: { valor_energetico_kcal: 100, sodio_mg: 200, ... } */
  nutrientes: Record<string, number>;
}

export interface EnrichmentReview {
  author: string;
  stars: number;
  comment: string;
}

export interface EnrichmentFaq {
  question: string;
  answer: string;
}

export interface ProductEnrichment {
  /** chave de junção com a Unbox (variant.sku / product.sku) */
  sku: string;
  /** código de família (agrupa variações de tamanho do mesmo produto), ex.: "LINHA_A" */
  familyCode: string;
  /** SKU agrupador de variações, ex.: "PAI-LINHA_A" */
  parentSku: string;
  name: string;
  /** descrição curta interna (não SEO) */
  description: string;
  weight: { value: number; unit: string } | null;
  /** composição: ingredientes (alimento), INCI (cosmético), materiais (vestuário/objeto) */
  ingredients: string;
  /** passos de uso do produto, exibidos como "Modo de uso" na PDP. Vazio = bloco não aparece. */
  usage?: string[];
  origin: string;
  containsGluten: boolean | null;
  vegan: boolean | null;
  allergens: { inIngredients: string; mayContain: string };
  ean: string;
  dimensionsCm: { length: number | null; width: number | null; height: number | null } | null;
  nutrition: NutritionTable | null;
  seo: { shortDescription: string; longDescriptionHtml: string; keywords: string[]; title: string };
  /** tags/categorias livres da planilha */
  tags: string[];
  /** categorias normalizadas */
  categoriesOptimized: string[];
  collections: string[];
  /** descrição textual de combo sugerido */
  combo: string;
  /** SKUs para "Compre junto" */
  buyTogetherSkus: string[];
  /** SKUs para "Frequentemente comprados juntos" */
  frequentlyBoughtSkus: string[];
  faq: EnrichmentFaq[];
  reviews: EnrichmentReview[];
}

const DATA = raw as unknown as Record<string, ProductEnrichment>;

const norm = (sku: unknown): string => String(sku ?? "").trim();

/** Enriquecimento por SKU exato. */
export function getEnrichmentBySku(sku?: string | number | null): ProductEnrichment | null {
  const k = norm(sku);
  return k && DATA[k] ? DATA[k] : null;
}

// ----- Matching por NOME (a Unbox NÃO expõe SKU/EAN; juntamos pelo nome) -----
// Estratégia: o título Unbox segue "Nome PT - Nome EN [tamanho]". O nome EN (após o último " - ")
// é o identificador distintivo. Casamos exigindo que (quase) todos os tokens do nome EN estejam
// presentes no nome do doc — evita falsos positivos (ex.: "Linha A Plus" ≠ "Linha B Plus").
// Adicione aqui palavras a ignorar no matching de nomes (ex.: o nome da sua marca, que
// costuma aparecer em todos os títulos e por isso não ajuda a diferenciar produtos).
const STOP = new Set(["de", "do", "da", "com", "e", "em", "para", "the", "a", "o", "no", "na"]);
const SIZE_RE = /[\d]+[.,]?[\d]*\s*(g|ml|kg|l)\b/gi;
function nameTokens(s: string): Set<string> {
  const toks = (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[®™]/g, "")
    .replace(SIZE_RE, " ")
    .replace(/[^a-z0-9\s]/g, " ") // mantém o conteúdo dos parênteses (remove só os símbolos)
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
  return new Set(toks);
}
/** Tokens do nome EN (parte após o PRIMEIRO " - ", já sem tamanho). */
function enTokens(title: string): Set<string> {
  const clean = (title || "").replace(SIZE_RE, " ");
  const idx = clean.indexOf(" - ");
  return nameTokens(idx >= 0 ? clean.slice(idx + 3) : clean);
}
function containment(small: Set<string>, big: Set<string>): number {
  if (small.size === 0) return 0;
  let inter = 0;
  for (const x of small) if (big.has(x)) inter++;
  return inter / small.size;
}
// Similaridade simétrica (Jaccard) — usada como desempate para separar a família "base" de uma
// variante com modificador (ex.: "Base" vs "Base Plus"), que empatam no score de containment.
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
const NAME_INDEX = Object.values(DATA).map((e) => ({ e, toks: nameTokens(e.name) }));
const NAME_THRESHOLD = 0.7;

/**
 * Enriquecimento pelo NOME (ignora tamanho/acentos). Score = melhor de:
 *  - nome EN do produto contido no nome do doc (casos com nome do doc em inglês), ou
 *  - nome do doc contido no título completo do produto (casos com nome do doc em PT).
 * Limiar 0.7 evita falsos positivos (ex.: "Linha A Plus" não casa com "Linha B Plus").
 * Empates de score são desempatados pela similaridade Jaccard(título, nome do doc): assim "Linha A"
 * casa com a família base e não com "Linha A Plus" (que tem tokens extras).
 */
export function getEnrichmentByName(title?: string | null): ProductEnrichment | null {
  if (!title) return null;
  const en = enTokens(title);
  const full = nameTokens(title);
  if (full.size === 0) return null;
  let best: ProductEnrichment | null = null;
  let bestScore = 0;
  let bestTie = 0;
  for (const { e, toks } of NAME_INDEX) {
    const sc = Math.max(containment(en, toks), containment(toks, full));
    const tie = jaccard(full, toks);
    if (sc > bestScore || (sc === bestScore && tie > bestTie)) {
      bestScore = sc; bestTie = tie; best = e;
    }
  }
  return bestScore >= NAME_THRESHOLD ? best : null;
}

/** Resolve o enriquecimento de um produto Unbox: tenta SKU (produto/variantes) e cai no nome. */
export function getEnrichmentForProduct(product: any): ProductEnrichment | null {
  const candidates = [product?.sku, ...((product?.variants ?? []).map((v: any) => v?.sku))].filter(Boolean);
  for (const c of candidates) {
    const e = getEnrichmentBySku(c);
    if (e) return e;
  }
  return getEnrichmentByName(product?.title);
}

/** Lista de enriquecimentos a partir de uma lista de SKUs (ignora os não encontrados). */
export function getEnrichmentBySkus(skus: string[]): ProductEnrichment[] {
  return skus.map((s) => getEnrichmentBySku(s)).filter((e): e is ProductEnrichment => !!e);
}

// ----- Famílias (mesmo familyCode) -----
// Cada produto Unbox é UM tamanho de uma família; o tamanho vive no título ("297,7 g"), não em
// variante. Agrupamos pelo `familyCode` da planilha — resolvido por nome, já que a Unbox não expõe
// SKU e o casamento por nome ignora o tamanho (todos os irmãos compartilham o mesmo nome EN).

const ONE_SIZE_RE = /(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l)\b/i;

/** Extrai peso/volume de um texto livre (ex.: título "Produto X 250 g" → {value: 250, unit: "g"}). */
export function parseSize(text?: string | null): { value: number; unit: string } | null {
  if (!text) return null;
  const m = text.match(ONE_SIZE_RE);
  if (!m) return null;
  return { value: parseFloat(m[1].replace(",", ".")), unit: m[2].toLowerCase() };
}

/** familyCode de um produto Unbox (via SKU ou nome). Agrupa as variações de tamanho. */
export function getFamilyCode(product: any): string | null {
  return getEnrichmentForProduct(product)?.familyCode ?? null;
}

/** Média de avaliações (para rating real vindo da planilha, quando houver). */
export function reviewStats(e: ProductEnrichment | null): { count: number; average: number } | null {
  if (!e || e.reviews.length === 0) return null;
  const count = e.reviews.length;
  const average = e.reviews.reduce((s, r) => s + (r.stars || 0), 0) / count;
  return { count, average: Math.round(average * 10) / 10 };
}
