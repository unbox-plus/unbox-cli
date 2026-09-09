// Paginação completa do catálogo por offset (doc 11): NÃO confiar num `first` gigante (há teto
// de servidor que trunca em silêncio). Itera em lotes até pageInfo.hasNextPage === false.
import "server-only";
import { withStoreClient } from "./unbox/store";

const PAGE = 100;

/** Carrega TODOS os itens visíveis do catálogo (para sitemap e listagens completas). */
export async function loadAllCatalogItems(opts: { tagIds?: string[]; searchText?: string } = {}): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  // teto de segurança para não loopar infinito caso a API mude o contrato
  for (let guard = 0; guard < 100; guard++) {
    const page = await withStoreClient((c) =>
      c.getCatalog({ first: PAGE, offset, tagIds: opts.tagIds, searchText: opts.searchText }),
    );
    const nodes = page.nodes ?? [];
    all.push(...nodes);
    if (!page.pageInfo?.hasNextPage || nodes.length === 0) break;
    offset += PAGE;
  }
  return all;
}
