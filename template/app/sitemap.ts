import type { MetadataRoute } from "next";
import { loadAllCatalogItems } from "@/lib/dataloader";
import { getTopTags } from "@/lib/queries";
// PÁGINAS DO LOJISTA (foundation 13): o que ele publicou entra aqui, e só o que está no ar.
import { artigosVisiveis, colecoesEmProducao, pararSeALeituraFalhou, todasAsPaginasVisiveis } from "@/lib/paginas-publicadas";
import { rotaDeColecao } from "@/lib/editable/server";

export const revalidate = 3600;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/produtos`, changeFrequency: "daily", priority: 0.9 },
  ];

  // produtos (paginado por offset até hasNextPage===false; só os visíveis — doc 10)
  let products: MetadataRoute.Sitemap = [];
  try {
    const items = await loadAllCatalogItems();
    products = items
      .map((n: any) => n.product)
      .filter((p: any) => p && p.isVisible !== false && p.slug)
      .map((p: any) => ({
        url: `${siteUrl}/produto/${encodeURIComponent(p.slug)}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
  } catch {
    /* falha de rede não deve quebrar o sitemap inteiro */
  }

  let categories: MetadataRoute.Sitemap = [];
  try {
    const tags = await getTopTags();
    categories = (tags as any[])
      .filter((t) => t.isVisible !== false && t.slug)
      .map((t) => ({ url: `${siteUrl}/categoria/${encodeURIComponent(t.slug)}`, changeFrequency: "weekly" as const, priority: 0.6 }));
  } catch {
    /* idem */
  }

  // ── PÁGINAS E ARTIGOS DO LOJISTA ─────────────────────────────────────────────────────────────
  // O sitemap é uma AFIRMAÇÃO: cada URL aqui responde 200, é canônica e mudou quando o `lastmod` diz
  // que mudou. Por isso entra só o que está no ar (visível e com a data de publicação já passada) e
  // sem "ocultar de buscadores"; a data é o `atualizadoEm` do registro, que a foundation carimba a
  // cada edição de conteúdo daquela página.
  //
  // SEM `priority` E SEM `changeFrequency` nas entradas novas: o Google os ignora há anos, e o único
  // campo em que ele acredita é o `lastmod`, desde que verdadeiro. As entradas antigas continuam com
  // os deles para não mudar o que já estava publicado.
  //
  // NO AR, SEM CONSEGUIR LER O PUBLICADO, ESTE ARQUIVO NÃO SAI. O sitemap é uma afirmação sobre o conjunto
  // inteiro, e publicá-lo sem as URLs do lojista é a loja dizendo ao buscador que as páginas dele
  // acabaram de sumir (medido com o editor fora: sobravam as poucas URLs que saem do código). O erro
  // deixa o Next servir o sitemap ANTERIOR — o ISR guarda a última versão boa e a serve quando a
  // revalidação falha — e o arquivo de ontem continua verdadeiro. É a mesma decisão das quatro rotas:
  // 5xx em vez de negar.
  //
  // Fora do `try` de propósito: o `catch` abaixo existe para o EDITOR estar fora não derrubar o
  // catálogo, e engolir esta parada aqui recriaria justamente o sitemap que encolhe.
  //
  // MENOS DURANTE O BUILD, e a exceção não é detalhe: no build NÃO EXISTE versão anterior para o
  // Next servir. Um erro ao pré-renderizar `/sitemap.xml` não segura o arquivo de ontem, ele DERRUBA
  // O DEPLOY. Medido, com o editor fora e o cache de fetch limpo:
  //   Error occurred prerendering page "/sitemap.xml"
  //   Export encountered an error on /sitemap.xml/route: /sitemap.xml, exiting the build.
  // Um blip do editor na hora do deploy impediria a loja inteira de subir, que é exatamente o que
  // lib/editable/server.ts promete no topo que não acontece ("a loja não cai por causa do editor").
  // Entre um sitemap sem as URLs do lojista por uma hora (que se conserta sozinho na revalidação
  // seguinte, e do qual buscador nenhum desindexa nada) e uma loja que não sobe, a escolha é o
  // sitemap curto. Em produção, com o arquivo já publicado, o erro continua sendo a resposta certa,
  // e é ali que ele vale.
  //
  // `NEXT_PHASE` é a variável que o PRÓPRIO Next usa para essa distinção (ele a compara com esta
  // mesma string para não registrar a instrumentação durante o build); só `next build` a escreve.
  if (process.env.NEXT_PHASE !== "phase-production-build") await pararSeALeituraFalhou();

  let doLojista: MetadataRoute.Sitemap = [];
  try {
    const paginas = await todasAsPaginasVisiveis();
    doLojista = paginas.map((p) => ({ url: `${siteUrl}${p.rota}`, lastModified: p.registro.atualizadoEm }));
    // a LISTAGEM de cada coleção, com a data do artigo mais recente dela. Coleção sem artigo fica de
    // fora: a URL responde 200, e é uma página vazia, que não é o que se oferece ao buscador.
    // A paginação também: `/pagina/2` é a mesma coleção repartida, e o buscador chega nela pelos
    // links da própria listagem.
    for (const handle of await colecoesEmProducao()) {
      const artigos = (await artigosVisiveis(handle)).filter((a) => !a.registro.seo?.ocultarDeBuscadores);
      if (!artigos.length) continue;
      // pelo INSTANTE, não pelo texto: duas datas ISO com fusos diferentes ordenam errado como
      // string, e o `lastmod` da listagem passaria a apontar para a edição errada
      const maisRecente = artigos.reduce(
        (maior, a) => ((Date.parse(a.registro.atualizadoEm) || 0) > (Date.parse(maior) || 0) ? a.registro.atualizadoEm : maior),
        artigos[0].registro.atualizadoEm,
      );
      doLojista.push({ url: `${siteUrl}${rotaDeColecao(handle)}`, lastModified: maisRecente });
    }
  } catch {
    /* o editor fora do ar não pode derrubar o sitemap do catálogo */
  }

  return [...base, ...categories, ...products, ...doLojista];
}
