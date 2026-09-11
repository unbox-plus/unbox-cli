// A metade de SERVIDOR da listagem de uma coleção: a fatia de artigos desta página e o dado
// estruturado. As duas rotas da listagem (`/<coleção>` e `/<coleção>/pagina/N`) e a prévia do editor
// chamam daqui, para as três mostrarem a mesma coisa.
//
// Componente de SERVIDOR (sem "use client"): quem roda no navegador é a casca.
//
// A FATIA DO DOCUMENTO entra aqui, e não em cada rota, pelo motivo escrito em pagina-do-lojista.tsx.
import { ldJson } from "@/lib/json-ld";
import { EditableFatia } from "@/lib/editable";
import { DataLayerReady } from "@/components/analytics/data-layer-ready";
import { CascaDeColecao, type ArtigoDaLista } from "@/components/paginas/casca-de-colecao";
import { tituloDaColecao } from "@/components/paginas/titulos";
import { jsonLdDaColecao, jsonLdDaLoja, jsonLdDeMigalhas } from "@/lib/paginas-seo";
import { artigosVisiveis, lerPaginas } from "@/lib/paginas-publicadas";
import { ARTIGOS_POR_PAGINA, fatiaDoDocumento } from "@/lib/editable/server";
import { idDeColecao, SECAO_CABECALHO } from "@/lib/editable/document";

export interface FatiaDaListagem {
  artigos: ArtigoDaLista[];
  totalDePaginas: number;
}

/**
 * Os artigos DESTA página da listagem. `null` = a página pedida não existe (a listagem tem 2 páginas
 * e alguém pediu a 5): 404, e não uma página vazia, que responderia 200 numa URL que não existe.
 *
 * A página 1 existe sempre, mesmo sem nenhum artigo: a coleção é uma URL que a loja declara.
 */
export async function fatiaDaListagem(handle: string, pagina: number): Promise<FatiaDaListagem | null> {
  const todos = await artigosVisiveis(handle);
  const totalDePaginas = Math.max(1, Math.ceil(todos.length / ARTIGOS_POR_PAGINA));
  if (pagina > totalDePaginas) return null;
  const inicio = (pagina - 1) * ARTIGOS_POR_PAGINA;
  return { artigos: todos.slice(inicio, inicio + ARTIGOS_POR_PAGINA), totalDePaginas };
}

export async function ColecaoNaTela({
  handle,
  pagina,
  artigos,
  totalDePaginas,
}: {
  handle: string;
  pagina: number;
  artigos: ArtigoDaLista[];
  totalDePaginas: number;
}) {
  const doc = await lerPaginas();
  const titulo = tituloDaColecao(doc, handle);
  const caminho = pagina > 1 ? `/${handle}/pagina/${pagina}` : `/${handle}`;
  const migalhas = [{ nome: "Início", href: "/" }, { nome: titulo }];
  const jsonLd = [
    jsonLdDaColecao({ doc, handle, titulo, caminho, artigos }),
    jsonLdDeMigalhas(migalhas, caminho),
    // a entidade da loja vai JUNTO: o `isPartOf` do `CollectionPage` aponta para ela por `@id`, e um
    // `@id` que só existe no JSON-LD da home não é resolvido por quem lê esta página
    ...jsonLdDaLoja(),
  ];
  return (
    <>
      <DataLayerReady pageType="other" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(jsonLd) }} />
      {/* A COLEÇÃO INTEIRA MAIS O CABEÇALHO DE CADA ARTIGO QUE ESTA PÁGINA MOSTRA. A casca é de
          cliente e lê o título, o resumo e a foto de cada card pelo caminho do container DAQUELE
          artigo (`resolveValue`), então sem eles na fatia os cards cairiam no endereço capitalizado e
          ficariam sem foto. Os artigos das OUTRAS páginas da listagem não entram: eles não estão
          nesta tela.
          O CORTE DO ARTIGO É FUNDO (`.cabecalho.`, e não o container inteiro): o card lê três
          caminhos, e pedindo o container o corpo de cada artigo viajava no HTML sem ninguém ler —
          numa listagem de doze cards medida, 39,7% da página. A coleção vai inteira porque ela tem
          seções próprias, que a casca renderiza. `SECAO_CABECALHO` é a mesma constante que o card usa
          para ler: o corte e o leitor têm uma fonte só. */}
      <EditableFatia fatia={fatiaDoDocumento(doc, [idDeColecao(handle), ...artigos.map((a) => `${a.id}.${SECAO_CABECALHO}.`)])}>
        <CascaDeColecao handle={handle} titulo={titulo} artigos={artigos} pagina={pagina} totalDePaginas={totalDePaginas} />
      </EditableFatia>
    </>
  );
}
