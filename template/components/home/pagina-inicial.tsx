// ═══════════════════════════════════════════════════════════════════════════
// A PÁGINA INICIAL, a partir de um documento (foundation 18).
//
// A home tem DUAS rotas que a renderizam: `/` (app/(loja)/page.tsx) com o documento publicado, e a página de
// cada público (app/(loja)/%5Fpublico/[publico]/page.tsx) com o documento EFETIVO dele. Por isso o corpo mora
// aqui, recebendo o documento, e as duas rotas são cascas: uma home que lesse o publicado sozinha mostraria a
// versão de Todos também na página do público, com as vitrines de Todos.
//
// O que a home mostra continua vindo da receita (components/home/home-recipe.ts) e dos primitivos; aqui ficam
// os dados do servidor: catálogo, vitrines do documento e o dado estruturado da marca.
// ═══════════════════════════════════════════════════════════════════════════
import { getCatalog, getTopTags } from "@/lib/queries";
import { buildTagMap, buildCategories, mapCatalogItems, catalogoDasVitrines } from "@/lib/catalog-map";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/store-config";
import { resolveCombos } from "@/lib/enrichment/combos";
import { CombosHome } from "@/components/home/combos-home";
import { mockupOr } from "@/lib/mockup";
import { DataLayerReady } from "@/components/analytics/data-layer-ready";
import { ldJson } from "@/lib/json-ld";
// EDITOR: quem transforma a ESCOLHA das vitrines (no documento) em produtos
import { resolverVitrinesDoDocumento } from "@/lib/vitrine";
import type { ContentDocument } from "@/lib/editable/document";
// A IDENTIDADE DA MARCA NO DADO ESTRUTURADO VEM DE UM LUGAR SÓ (lib/paginas-seo.ts): o nome, o
// endereço e os dois `@id`. Aqui havia um literal cravado, que o create-unbox-store reescreve,
// enquanto toda página do lojista emitia o nome de `NEXT_PUBLIC_SITE_NAME` sob EXATAMENTE o mesmo
// `@id`. Uma entidade com dois nomes é pior que duas entidades: é a loja se contradizendo sobre quem
// ela é, no lugar em que o buscador mais acredita.
import { jsonLdDaLoja, SITE_URL } from "@/lib/paginas-seo";

const isCombo = (s: string) => /kit|combo/i.test(s);

export async function PaginaInicial({ doc }: { doc: ContentDocument | null }) {
  const [catalog, tags] = await Promise.all([
    mockupOr(getCatalog({ first: 100 }), { nodes: [] as any[] }, "home/getCatalog"),
    mockupOr(getTopTags(), [], "home/getTopTags"),
  ]);
  const tagMap = buildTagMap(tags as any[]);
  const items = mapCatalogItems(catalog.nodes ?? [], tagMap);

  // Combos reais: categoria "Kits & Combos" → senão produtos em oferta (compareAtPrice) → senão destaques.
  let combos = items.filter((it) => it.categories.some(isCombo));
  let title = "Nossos Combos em Destaque";
  if (combos.length < 2) {
    const deals = items.filter((it) => it.oldPrice != null);
    if (deals.length >= 2) { combos = deals; title = "Ofertas em destaque"; }
    else { combos = items.slice(0, 8); title = "Destaques"; }
  }
  combos = combos.slice(0, 10);
  const featured = combos[0] ?? items[0] ?? null;

  // Kits temáticos (combos de linha, edição de data…) montados a partir do products.json.
  const bundles = resolveCombos((catalog.nodes ?? []).map((n: any) => n.product ?? n));

  // ── AS VITRINES DA HOME (editor de loja) ─────────────────────────────────
  // O documento publicado guarda só a ESCOLHA do lojista ("quais produtos esta vitrine mostra");
  // quem a transforma em produto com preço e estoque é a LOJA, aqui, com o cliente da Unbox de
  // sempre. Quais caminhos existem sai do PRÓPRIO DOCUMENTO, não de constante escrita à mão: a
  // vitrine também é uma seção ADICIONÁVEL, cujo id só nasce quando o lojista clica no "+"
  // (`novo-vitrine-de-produtos-2`), e nenhuma constante do repositório o conheceria.
  //
  // Sem editor, sem escolha, ou com a Unbox fora: `{}`, e cada vitrine mostra os produtos do
  // CÓDIGO. Ligar isto não muda um pixel enquanto ninguém escolher nada.
  // `doc` é o documento que esta página mostra: o de Todos na home, o EFETIVO de um público na página dele
  // (`aplicarPublico`). É por isso que as vitrines saem por público: a escolha de produtos também é camada.
  const vitrines = await resolverVitrinesDoDocumento(doc, "home");

  // Organization + WebSite: dá à marca uma entidade citável (busca e resposta de IA) e liga a
  // busca interna ao Google (SearchAction). Só fatos deriváveis: nome, URL, logo, busca.
  // Os `@id` existem para o RESTO do site apontar para estas duas entidades em vez de repeti-las: as
  // páginas do lojista dizem `publisher: { "@id": ... }` e `isPartOf: { "@id": ... }`. Por isso os
  // dois nós saem de `jsonLdDaLoja()`, a MESMA função que aquelas páginas chamam: com o `@id` igual,
  // o conteúdo tem de ser igual também, senão o buscador lê a mesma entidade dizendo duas coisas.
  const [organizacao, site] = jsonLdDaLoja(doc);
  const jsonLd = [
    organizacao,
    // A BUSCA INTERNA SÓ AQUI. `potentialAction` é o que liga a busca da loja ao Google (a caixa de
    // busca no resultado), e o próprio Google pede que ela seja declarada na HOME e só nela: repetida
    // em toda página, ele passa a ignorá-la. É o único campo que a home tem a mais, e é de propósito.
    {
      ...site,
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/busca?q={search_term_string}` }, "query-input": "required name=search_term_string" },
    },
  ];

  return (
    <>
    {/* dataLayerReady: é o ÚNICO gatilho de tipo de página do container central (medido: ele não
        tem gatilho de `page_view`). Sem isto, a home fica invisível pro remarketing do Ads. */}
    <DataLayerReady pageType="home" products={combos.slice(0, 6).map((c) => ({ id: c.productId, name: c.title, price: c.price }))} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(jsonLd) }} />
    <CombosHome
      combos={combos}
      catalogo={catalogoDasVitrines(items, vitrines)}
      featured={featured}
      bundles={bundles}
      categories={buildCategories(tags as any[])}
      combosTitle={title}
      freeShipLabel={FREE_SHIPPING_THRESHOLD != null ? `R$${FREE_SHIPPING_THRESHOLD}` : null}
      vitrines={vitrines}
    />
    </>
  );
}
