// COMBOS: kits temáticos da loja. Substitua pelos combos da nova marca.
// Cada item usa `family` (familyCode do products.json) para resolver contra o catálogo Unbox.
// Para usar: popule lib/enrichment/products.json à mão, no formato de lib/enrichment/index.ts.
//
// ===== Combos (kits temáticos) =====
// Bundles curados a partir das famílias do products.json (familyCode). Cada item aponta para uma
// FAMÍLIA — na resolução escolhemos o produto comprável do catálogo (por nome+tamanho), então o
// combo nunca quebra se um tamanho específico sair de linha. Preço e imagem vêm do catálogo Unbox;
// o desconto do combo é distribuído por item (mesmo padrão de `add({ price })` da buy box).
import { getEnrichmentByName, parseSize } from "./index";
import { resolveProductPrice } from "../format";

/** "min" = menor tamanho da família (combo mais acessível); "max" = maior. */
export interface ComboItem {
  family: string;
  qty?: number;
  size?: "min" | "max";
}

export interface ComboHighlight {
  /** chave de ícone resolvida no componente */
  icon: "box" | "fire" | "sparkle" | "star" | "shield" | "heart" | "tag" | "gift";
  label: string;
}

export interface ComboDef {
  id: string;
  name: string;
  description: string;
  /** imagem temática do combo, composta a partir das fotos reais dos produtos */
  imageUrl: string;
  /** selo opcional, ex.: "MAIS VENDIDO" */
  badge?: string;
  highlights: ComboHighlight[];
  /** % de desconto sobre a soma dos itens */
  /** @deprecated ignorado: o preço final é sempre o do catálogo (ver resolveCombos). */
  discountPct?: number;
  items: ComboItem[];
}

// TODO: defina os combos/kits da sua loja aqui.
// Cada item usa `family` (familyCode do products.json) para resolver contra o catálogo Unbox.
// Para usar: popule lib/enrichment/products.json com os dados dos produtos e defina os familyCodes.
//
// Exemplo de combo:
// {
//   id: "kit-essencial",
//   name: "Kit Essencial",
//   description: "Tudo o que você precisa para começar.",
//   imageUrl: "/brand/combos/kit-essencial.webp",
//   badge: "MAIS VENDIDO",
//   discountPct: 15,
//   highlights: [
//     { icon: "sparkle", label: "3 itens" },
//     { icon: "box", label: "Pronto para usar" },
//   ],
//   items: [
//     { family: "FAMILIA_A" },
//     { family: "FAMILIA_B" },
//     { family: "FAMILIA_C", size: "min" },
//   ],
// },
export const COMBOS: ComboDef[] = [];

// ----- Resolução contra o catálogo -----

export interface ResolvedComboItem {
  family: string;
  qty: number;
  name: string;
  weight: string;
  imageUrl: string | null;
  slug: string;
  productId: string;
  variantId: string;
  /** preço unitário cheio */
  price: number;
  /** preço unitário com o desconto do combo (para enviar ao carrinho) */
  discountedPrice: number;
}

export interface ResolvedCombo {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  badge?: string;
  highlights: ComboHighlight[];
  discountPct: number;
  items: ResolvedComboItem[];
  itemCount: number;
  subtotal: number;
  total: number;
  save: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** "Nome ( Name in English )" → "Nome"; sem parênteses devolve o nome inteiro. */
function familyLabel(name: string): string {
  const pt = name.split("(")[0].trim().replace(/\s+/g, " ");
  return pt || name.trim();
}

function fmtWeight(w: { value: number; unit: string } | null): string {
  if (!w) return "";
  const v = Number.isInteger(w.value) ? String(w.value) : String(w.value).replace(".", ",");
  return `${v} ${w.unit}`;
}

/** Indexa os produtos do catálogo por familyCode (ordenados por peso crescente). */
function indexByFamily(catalogProducts: any[]) {
  const map = new Map<string, { product: any; weight: number }[]>();
  for (const p of catalogProducts) {
    if (!p?.slug) continue;
    const e = getEnrichmentByName(p.title);
    if (!e) continue;
    const w = parseSize(p.title)?.value ?? e.weight?.value ?? 0;
    const arr = map.get(e.familyCode) ?? [];
    arr.push({ product: p, weight: w });
    map.set(e.familyCode, arr);
  }
  for (const arr of map.values()) arr.sort((a, b) => a.weight - b.weight);
  return map;
}

/** Resolve todos os combos contra a lista de produtos do catálogo. Descarta itens/combos sem match. */
export function resolveCombos(catalogProducts: any[]): ResolvedCombo[] {
  const byFamily = indexByFamily(catalogProducts);
  const out: ResolvedCombo[] = [];

  for (const def of COMBOS) {
    const items: ResolvedComboItem[] = [];
    for (const it of def.items) {
      const fam = byFamily.get(it.family);
      if (!fam || fam.length === 0) continue;
      const list = fam;
      const picked = it.size === "max" ? list[list.length - 1] : list[0];
      const cp = picked.product;
      const v0 = cp.variants?.[0];
      const rp = resolveProductPrice(cp);
      if (!v0?._id || rp.price == null) continue;
      const e = getEnrichmentByName(cp.title);
      const qty = it.qty ?? 1;
      // O preço final de um item é sempre o do catálogo: o servidor recalcula o carrinho a
      // partir dele (lib/unbox/types.ts). Um "preço do kit" calculado aqui vira promessa que o
      // carrinho desmente. Desconto de kit real se configura como regra de preço/cupom no painel.
      const discountedPrice = round2(rp.price);
      items.push({
        family: it.family,
        qty,
        name: familyLabel(e?.name ?? cp.title),
        weight: fmtWeight(parseSize(cp.title) ?? e?.weight ?? null),
        imageUrl: cp.imageUrls?.[0] ?? null,
        slug: cp.slug,
        productId: cp.productId,
        variantId: v0._id,
        price: rp.price,
        discountedPrice,
      });
    }

    if (items.length < 2) continue; // combo precisa de pelo menos 2 itens reais

    const subtotal = round2(items.reduce((s, i) => s + i.price * i.qty, 0));
    const total = round2(items.reduce((s, i) => s + i.discountedPrice * i.qty, 0));
    out.push({
      id: def.id,
      name: def.name,
      description: def.description,
      imageUrl: def.imageUrl,
      badge: def.badge,
      highlights: def.highlights,
      discountPct: 0,
      items,
      itemCount: items.reduce((s, i) => s + i.qty, 0),
      subtotal,
      total,
      save: round2(subtotal - total),
    });
  }

  return out;
}
