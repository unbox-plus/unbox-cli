// O `HomeData` que as seções ADICIONADAS de uma página recebem: as páginas e os artigos do lojista, a listagem de
// uma coleção, o catálogo de produtos e a página de produto (foundation 18: toda página aceita o catálogo da loja).
//
// As seções do catálogo são as MESMAS da home, e esperam o mesmo pacote de dados. Estas páginas não têm receita,
// então o que se busca é o catálogo, as categorias e os kits, e os destaques saem pela MESMA escolha da home (kits
// e combos; senão os em oferta; senão os primeiros): a seção "Destaques" ou "Kits" adicionada numa página mostra
// o mesmo que na home. E as ESCOLHAS de produto do container desta página, já resolvidas (vitrines e blocos de
// compra). Nada disso aparece sozinho: só nas seções que o lojista adicionar.
//
// `mockupOr` em toda busca: sem credenciais da Unbox (o começo de toda loja) a página continua
// abrindo, com a vitrine vazia, em vez de estourar.
import "server-only";
import { buildCategories, buildTagMap, mapCatalogItems, catalogoDasVitrines } from "@/lib/catalog-map";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/store-config";
import { getCatalog, getTopTags } from "@/lib/queries";
import { mockupOr } from "@/lib/mockup";
import { resolveCombos } from "@/lib/enrichment/combos";
import { resolverVitrinesDoDocumento } from "@/lib/vitrine";
import type { HomeData } from "@/components/home/sections/registry";
import type { ContentDocument } from "@/lib/editable/document";

const isCombo = (s: string) => /kit|combo/i.test(s);

/** os destaques da loja pela régua da home (components/home/pagina-inicial.tsx): kits e combos; senão ofertas; senão os primeiros */
function destaquesDoCatalogo(items: HomeData["combos"]): HomeData["combos"] {
  let combos = items.filter((it) => it.categories.some(isCombo));
  if (combos.length < 2) {
    const deals = items.filter((it) => it.oldPrice != null);
    combos = deals.length >= 2 ? deals : items.slice(0, 8);
  }
  return combos.slice(0, 10);
}

/**
 * `container` é o da página (`pagina-<endereço>`, `artigo-<coleção>--<endereço>`, `colecao-<endereço>`,
 * `catalogo`, `produto`): é dele que saem os caminhos das escolhas de produto deste documento. Sem ele, duas
 * páginas com vitrine mostrariam a escolha uma da outra.
 */
export async function dadosDasPaginas(doc: ContentDocument | null | undefined, container: string): Promise<HomeData> {
  const [catalog, tags] = await Promise.all([
    mockupOr(getCatalog({ first: 100 }), { nodes: [] as any[] }, "paginas/getCatalog"),
    mockupOr(getTopTags(), [], "paginas/getTopTags"),
  ]);
  const tagMap = buildTagMap(tags as any[]);
  const items = mapCatalogItems(catalog.nodes ?? [], tagMap);
  const vitrines = await resolverVitrinesDoDocumento(doc, container);
  const combos = destaquesDoCatalogo(items);
  return {
    combos,
    catalogo: catalogoDasVitrines(items, vitrines),
    featured: combos[0] ?? items[0] ?? null,
    bundles: resolveCombos((catalog.nodes ?? []).map((n: any) => n.product ?? n)),
    categories: buildCategories(tags as any[]),
    combosTitle: "Destaques",
    freeShipLabel: FREE_SHIPPING_THRESHOLD != null ? `R$${FREE_SHIPPING_THRESHOLD}` : null,
    vitrines,
  };
}

/**
 * Os dados SÓ QUANDO O CONTAINER TEM SEÇÃO ADICIONADA no documento (`criadas`); sem nenhuma, `null`, e nada é
 * buscado. É o que as páginas cujo corpo vem do código usam (a página de produto, o catálogo, a listagem de uma
 * coleção): o catálogo da loja vai no HTML só quando alguma seção vai desenhá-lo. Na prévia do editor, a página que
 * recebeu `null` busca os dados em `GET /api/unbox/secoes` quando precisa (`useDadosDasSecoes`).
 */
export async function dadosSeHouverSecoes(doc: ContentDocument | null | undefined, container: string): Promise<HomeData | null> {
  return Object.keys(doc?.sections?.[container]?.criadas ?? {}).length ? dadosDasPaginas(doc, container) : null;
}

