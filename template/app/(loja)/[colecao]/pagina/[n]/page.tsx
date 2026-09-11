// ═══════════════════════════════════════════════════════════════════════════
// A LISTAGEM DE UMA COLEÇÃO, DA PÁGINA 2 EM DIANTE: `/<coleção>/pagina/N`
//
// SEGMENTO, NÃO QUERY. `?page=2` obrigaria a rota a ler `searchParams`, o que a torna dinâmica em
// toda visita e mata o ISR; o segmento pré-renderiza e revalida como qualquer outra página. É por
// isso que `pagina` é um endereço reservado de artigo: um artigo com esse endereço nunca abriria.
//
// `N` É INTEIRO E MAIOR QUE 1. "0", "1.5", "02", "abc" e um número acima do total de páginas são
// 404: cada um deles é uma URL que não existe, e responder 200 numa URL que não existe é o que enche
// o índice do buscador de páginas iguais. `N = 1` é o caso especial: existe uma página 1, e ela é
// `/<coleção>`, então a resposta é 308 para lá, não 404, e a listagem tem UMA canônica só.
//
// O padrão da rota (ISR de 300 s, `generateStaticParams` vazio, `dynamicParams`, sem `loading.tsx`,
// sem `searchParams`) está explicado em `/paginas/[handle]`.
// ═══════════════════════════════════════════════════════════════════════════
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { tituloDaColecao } from "@/components/paginas/titulos";
import { ColecaoNaTela, fatiaDaListagem } from "@/components/paginas/colecao-do-lojista";
import { artigosVisiveis, colecaoEmProducao, lerPaginas, pararSeALeituraFalhou, redirecionamentoDe } from "@/lib/paginas-publicadas";
import { metadadosDaColecao } from "@/lib/paginas-seo";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

/** o número da página, ou `null` quando o segmento não é um inteiro maior que 1 escrito sem enfeite */
function numeroDaPagina(bruto: string): number | null {
  if (!/^[1-9][0-9]{0,4}$/.test(bruto)) return null;
  const n = Number(bruto);
  return n >= 2 ? n : null;
}

export async function generateMetadata({ params }: { params: Promise<{ colecao: string; n: string }> }): Promise<Metadata> {
  const { colecao, n } = await params;
  const handle = decodeURIComponent(colecao);
  const pagina = numeroDaPagina(decodeURIComponent(n));
  if (!pagina) return { title: "Página não encontrada", robots: { index: false } };
  await pararSeALeituraFalhou();
  if (!(await colecaoEmProducao(handle))) return { title: "Página não encontrada", robots: { index: false } };
  // o intervalo também: com 2 páginas de artigos, `/pagina/9` responde 404, e sem esta conferência a
  // resposta viria com o `<title>` e a canônica de uma listagem que não existe
  if (!(await fatiaDaListagem(handle, pagina))) return { title: "Página não encontrada", robots: { index: false } };
  const doc = await lerPaginas();
  const total = (await artigosVisiveis(handle)).length;
  return metadadosDaColecao({ doc, handle, titulo: tituloDaColecao(doc, handle), pagina, totalDeArtigos: total });
}

export default async function ListagemPaginada({ params }: { params: Promise<{ colecao: string; n: string }> }) {
  const { colecao, n } = await params;
  const handle = decodeURIComponent(colecao);
  const bruto = decodeURIComponent(n);

  // A LEITURA ANTES DA DECISÃO: sem conseguir ler o publicado, esta rota não sabe se a página existe,
  // e um 404 aqui seria guardado por 300 s e tiraria a URL do índice (o porquê está em
  // `pararSeALeituraFalhou`).
  await pararSeALeituraFalhou();

  // A COLEÇÃO VIVA VENCE o mapa de redirecionamentos, como nas outras três rotas (o porquê está em
  // `/paginas/[handle]`): só quando ela não existe mais é que a entrada antiga responde.
  if (!(await colecaoEmProducao(handle))) {
    // O mapa guarda a LISTAGEM (`/velha` → `/nova`), não cada página dela. Levar o número junto é o
    // que faz o link para a página 3 de uma coleção renomeada continuar chegando na página 3.
    //
    // E SÓ LEVA O NÚMERO QUANDO AQUELA PÁGINA EXISTE NO DESTINO. Duas condições, e as duas são
    // conferidas aqui: o destino tem de ser uma COLEÇÃO (um segmento só — apagada, a entrada aponta
    // para a raiz, ou para `/produtos`, e ali não existe página 3), e a coleção de destino tem de
    // TER essa página. `redirecionamentoDe` prova que o destino existe, nunca que a página N dele
    // existe: com uma coleção renomeada e encolhida, `/velha/pagina/3` respondia 308 permanente para
    // `/nova/pagina/3`, que responde 404 — exatamente o que o comentário de `redirecionamentoDe` diz
    // não fazer ("mandar um 308 permanente para um endereço que responde 404 é pior que o 404
    // direto"). Coleção que encolheu leva para a página 1, que existe sempre.
    const destinoDaColecao = await redirecionamentoDe(`/${handle}`);
    if (destinoDaColecao) {
      const pedida = numeroDaPagina(bruto);
      const temAPagina =
        pedida !== null &&
        /^\/[^/]+$/.test(destinoDaColecao) &&
        (await fatiaDaListagem(destinoDaColecao.slice(1), pedida)) !== null;
      permanentRedirect(temAPagina ? `${destinoDaColecao}/pagina/${bruto}` : destinoDaColecao);
    }
    notFound();
  }

  if (bruto === "1") permanentRedirect(`/${handle}`);
  const pagina = numeroDaPagina(bruto);
  if (!pagina) notFound();

  const fatia = await fatiaDaListagem(handle, pagina);
  if (!fatia) notFound();

  return <ColecaoNaTela handle={handle} pagina={pagina} artigos={fatia.artigos} totalDePaginas={fatia.totalDePaginas} />;
}
