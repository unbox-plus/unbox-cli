// O `HomeData` que as seções criadas de uma página do lojista recebem.
//
// As seções do catálogo (banner, vitrine de produtos, benefícios, cards, citação) são as MESMAS da
// home, e esperam o mesmo pacote de dados. Uma página do lojista não tem receita nem combos, então o
// que ela busca é o mínimo: o catálogo e as categorias, para a vitrine ter o que mostrar quando o
// lojista escolher uma categoria ou uma lista de produtos. `combos` e `bundles` vêm vazios de
// propósito: são a curadoria comercial da home, e uma página institucional não tem curadoria.
//
// `mockupOr` em toda busca: sem credenciais da Unbox (o começo de toda loja) a página continua
// abrindo, com a vitrine vazia, em vez de estourar.
import "server-only";
import { buildCategories, buildTagMap, mapCatalogItems } from "@/lib/catalog-map";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/store-config";
import { getCatalog, getTopTags } from "@/lib/queries";
import { mockupOr } from "@/lib/mockup";
import { resolverVitrinesDoDocumento } from "@/lib/vitrine";
import type { HomeData } from "@/components/home/sections/registry";
import type { ContentDocument } from "@/lib/editable/document";

/**
 * `container` é o id da página (`pagina-<endereço>`, `artigo-<coleção>--<endereço>`): é dele que saem
 * os caminhos de vitrine deste documento. Sem ele, duas páginas com vitrine mostrariam a escolha uma
 * da outra.
 */
export async function dadosDasPaginas(doc: ContentDocument | null | undefined, container: string): Promise<HomeData> {
  const [catalog, tags] = await Promise.all([
    mockupOr(getCatalog({ first: 100 }), { nodes: [] as any[] }, "paginas/getCatalog"),
    mockupOr(getTopTags(), [], "paginas/getTopTags"),
  ]);
  const tagMap = buildTagMap(tags as any[]);
  const items = mapCatalogItems(catalog.nodes ?? [], tagMap);
  const vitrines = await resolverVitrinesDoDocumento(doc, container);
  return {
    combos: items.slice(0, 10),
    featured: items[0] ?? null,
    bundles: [],
    categories: buildCategories(tags as any[]),
    combosTitle: "Destaques",
    freeShipLabel: FREE_SHIPPING_THRESHOLD != null ? `R$${FREE_SHIPPING_THRESHOLD}` : null,
    vitrines,
  };
}
