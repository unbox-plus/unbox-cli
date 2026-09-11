// ═══════════════════════════════════════════════════════════════════════════
// A LISTAGEM DE UMA COLEÇÃO: `/<coleção>` (a primeira página)
//
// Esta rota é a mais dinâmica da loja: ela responde por QUALQUER primeiro segmento que nenhuma rota
// do código ocupe. Por isso duas coisas têm de ser verdade ao mesmo tempo:
//   · a coleção precisa EXISTIR (declarada no código ou publicada pelo lojista), senão é 404;
//   · nenhuma coleção pode ter o nome de uma rota do código nem de um arquivo de `public/`, porque
//     ali a coleção nunca abriria. Quem calcula essa lista é lib/reservados.ts, e ela viaja até o
//     editor, que recusa o endereço antes de gravar.
//
// COLEÇÃO SEM ARTIGO RESPONDE 200, não 404. O endereço é da loja (ela o declara em
// `COLECOES_DO_CODIGO`, pode estar no menu e pode já estar linkado); dizer "não existe" numa URL que
// existe é o tipo de resposta que tira o endereço do índice e não o traz de volta quando o primeiro
// artigo sai. A listagem vazia diz que ainda não há artigos, e o sitemap só publica a coleção que
// tem artigo, então nada é oferecido ao buscador antes da hora.
//
// O padrão da rota (ISR de 300 s, `generateStaticParams` vazio, `dynamicParams`, sem `loading.tsx`,
// sem `searchParams`, redirecionamento antes do 404) está explicado em `/paginas/[handle]`.
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

export async function generateMetadata({ params }: { params: Promise<{ colecao: string }> }): Promise<Metadata> {
  const { colecao } = await params;
  const handle = decodeURIComponent(colecao);
  await pararSeALeituraFalhou();
  if (!(await colecaoEmProducao(handle))) return { title: "Página não encontrada", robots: { index: false } };
  const doc = await lerPaginas();
  // o total de artigos vai junto: é ele que decide o `noindex` da listagem ainda vazia (paginas-seo.ts)
  const total = (await artigosVisiveis(handle)).length;
  return metadadosDaColecao({ doc, handle, titulo: tituloDaColecao(doc, handle), pagina: 1, totalDeArtigos: total });
}

export default async function Listagem({ params }: { params: Promise<{ colecao: string }> }) {
  const { colecao } = await params;
  const handle = decodeURIComponent(colecao);

  // A LEITURA ANTES DA DECISÃO: sem conseguir ler o publicado, esta rota não sabe se a página existe,
  // e um 404 aqui seria guardado por 300 s e tiraria a URL do índice (o porquê está em
  // `pararSeALeituraFalhou`).
  await pararSeALeituraFalhou();

  if (!(await colecaoEmProducao(handle))) {
    // a listagem VIVA vence a entrada antiga do mapa; o redirecionamento só quando nada responde
    // (o porquê está em `/paginas/[handle]`)
    const destino = await redirecionamentoDe(`/${handle}`);
    if (destino) permanentRedirect(destino);
    notFound();
  }

  const fatia = await fatiaDaListagem(handle, 1);
  // a página 1 existe sempre (`fatiaDaListagem` só recusa página acima do total); a guarda é o
  // compilador, não um caso possível
  if (!fatia) notFound();

  return <ColecaoNaTela handle={handle} pagina={1} artigos={fatia.artigos} totalDePaginas={fatia.totalDePaginas} />;
}
