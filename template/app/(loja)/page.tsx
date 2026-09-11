import type { Metadata } from "next";
import { getCatalog, getTopTags } from "@/lib/queries";
import { buildTagMap, buildCategories, mapCatalogItems } from "@/lib/catalog-map";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/store-config";
import { resolveCombos } from "@/lib/enrichment/combos";
import { CombosHome } from "@/components/home/combos-home";
import { mockupOr } from "@/lib/mockup";
import { DataLayerReady } from "@/components/analytics/data-layer-ready";
import { ldJson } from "@/lib/json-ld";
// EDITOR: o documento publicado (só a ESCOLHA das vitrines) e quem a transforma em produtos
import { getPublishedContent } from "@/lib/editable/server";
import { resolverVitrinesDoDocumento } from "@/lib/vitrine";
// A IDENTIDADE DA MARCA NO DADO ESTRUTURADO VEM DE UM LUGAR SÓ (lib/paginas-seo.ts): o nome, o
// endereço e os dois `@id`. Aqui havia um literal cravado, que o create-unbox-store reescreve,
// enquanto toda página do lojista emitia o nome de `NEXT_PUBLIC_SITE_NAME` sob EXATAMENTE o mesmo
// `@id`. Uma entidade com dois nomes é pior que duas entidades: é a loja se contradizendo sobre quem
// ela é, no lugar em que o buscador mais acredita.
import { jsonLdDaLoja, SITE_URL } from "@/lib/paginas-seo";

// Canonical por página: o layout raiz não declara (seria herdado por todas as rotas).
export const metadata: Metadata = { alternates: { canonical: "/" } };

export const revalidate = 300; // ISR — catálogo público e estável

const isCombo = (s: string) => /kit|combo/i.test(s);

export default async function HomePage() {
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
  const doc = await getPublishedContent();
  const vitrines = await resolverVitrinesDoDocumento(doc, "home");

  // Organization + WebSite: dá à marca uma entidade citável (busca e resposta de IA) e liga a
  // busca interna ao Google (SearchAction). Só fatos deriváveis: nome, URL, logo, busca.
  // Os `@id` existem para o RESTO do site apontar para estas duas entidades em vez de repeti-las: as
  // páginas do lojista dizem `publisher: { "@id": ... }` e `isPartOf: { "@id": ... }`. Por isso os
  // dois nós saem de `jsonLdDaLoja()`, a MESMA função que aquelas páginas chamam: com o `@id` igual,
  // o conteúdo tem de ser igual também, senão o buscador lê a mesma entidade dizendo duas coisas.
  const [organizacao, site] = jsonLdDaLoja();
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
