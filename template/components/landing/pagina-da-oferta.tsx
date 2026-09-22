// ═══════════════════════════════════════════════════════════════════════════
// A LANDING DE OFERTA, o corpo (foundation 18).
//
// Duas rotas a renderizam: `/oferta` (app/(loja)/oferta/page.tsx) e a versão de cada público
// (app/(loja)/%5Fpublico/[publico]/oferta/page.tsx), que a envolve na camada dele (`<EditablePublico>`). Por isso
// o corpo mora aqui e as duas rotas são cascas, como a home em `PaginaInicial`.
//
// Mesma seção purchase-hero usada na home (componente do registry), com a pilha de convencimento por receita
// (components/landing/landing-recipe.ts) abaixo. A página existe como deep-link de campanha; nas receitas dos
// presets o hero de compra pode entrar DIRETO na home (âncora #comprar), que é o padrão das lojas de produção.
// ═══════════════════════════════════════════════════════════════════════════
import type { Metadata } from "next";
import { getCatalog, getTopTags } from "@/lib/queries";
import { buildTagMap, buildCategories, mapCatalogItems } from "@/lib/catalog-map";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/store-config";
import { resolveCombos } from "@/lib/enrichment/combos";
import type { HomeData } from "@/components/home/sections/registry";
// EDITOR: a pilha da landing dentro do container PRÓPRIO dela ("oferta", declarado em
// lib/rotas-editaveis.ts). Renderizada solta, nada nela é editável e o gate reprova a página.
import { OfertaSections } from "@/components/landing/oferta-sections";
import { mockupOr } from "@/lib/mockup";

/** os metadados da oferta, os mesmos nas duas rotas: a versão de um público não é outra página para o buscador */
export const METADADOS_DA_OFERTA: Metadata = {
  title: "Oferta especial",
  description: "Leve mais, aproveite mais. Monte seu pedido com condições especiais.",
  alternates: { canonical: "/oferta" },
};

const isCombo = (s: string) => /kit|combo/i.test(s);

export async function PaginaDaOferta() {
  const [catalog, tags] = await Promise.all([
    mockupOr(getCatalog({ first: 100 }), { nodes: [] as any[] }, "oferta/getCatalog"),
    mockupOr(getTopTags(), [], "oferta/getTopTags"),
  ]);
  const tagMap = buildTagMap(tags as any[]);
  const items = mapCatalogItems(catalog.nodes ?? [], tagMap);

  let combos = items.filter((it) => it.categories.some(isCombo));
  if (combos.length < 2) {
    const deals = items.filter((it) => it.oldPrice != null);
    combos = deals.length >= 2 ? deals : items.slice(0, 8);
  }
  combos = combos.slice(0, 10);

  const data: HomeData = {
    combos,
    // /oferta não oferece vitrine para escolher (a pilha não tem seção adicionável): não há escolha a resolver.
    // O que a versão de um público muda aqui é texto, imagem, ordem e seções ocultas, e isso vem da camada.
    catalogo: [],
    featured: combos[0] ?? items[0] ?? null,
    bundles: resolveCombos((catalog.nodes ?? []).map((n: any) => n.product ?? n)),
    categories: buildCategories(tags as any[]),
    combosTitle: "Destaques",
    freeShipLabel: FREE_SHIPPING_THRESHOLD != null ? `R$${FREE_SHIPPING_THRESHOLD}` : null,
  };

  return (
    <div className="store-layout full-bleed bg-white text-[var(--store-ink)]">
      <h1 className="sr-only">Oferta especial</h1>
      <OfertaSections data={data} />
      <div className="pb-14" />
    </div>
  );
}
