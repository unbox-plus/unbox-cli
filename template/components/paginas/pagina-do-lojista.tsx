// A metade de SERVIDOR de uma página do lojista: busca o que a casca precisa e emite o dado
// estruturado. As três rotas que abrem uma página (a avulsa, o artigo e a prévia do editor) chamam
// daqui, para as três renderizarem exatamente a mesma coisa. Duplicado, o dia em que o JSON-LD
// mudasse numa delas a prévia deixaria de mostrar o que vai ao ar.
//
// Componente de SERVIDOR (sem "use client"): quem roda no navegador é a casca.
//
// É AQUI QUE A FATIA DO DOCUMENTO ENTRA, e não em cada uma das três rotas, pelo mesmo motivo do
// JSON-LD: as três renderizam exatamente a mesma coisa, e a prévia tem de mostrar o que vai ao ar.
// Repetida rota a rota, a fatia divergiria numa delas em silêncio, e o sintoma seria o texto do
// lojista sumindo da tela sem erro nenhum.
//
// A VERSÃO DE UM PÚBLICO (foundation 18, LPs) também entra aqui: a quarta rota,
// `/_publico/[publico]/paginas/[handle]`, passa `publico`, e tudo sai do documento EFETIVO dele
// (`aplicarPublico`): a fatia (o texto, as fotos, a ordem e as seções ocultas da versão), as vitrines e
// o dado estruturado. Os metadados não: o SEO da página vale para todos.
import { ldJson } from "@/lib/json-ld";
import { EditableFatia } from "@/lib/editable";
import { fatiaDoDocumento } from "@/lib/editable/server";
import { DataLayerReady } from "@/components/analytics/data-layer-ready";
import { CascaDePagina, type Migalha, type RegistroNaCasca } from "@/components/paginas/casca-de-pagina";
import { tituloDaColecao, tituloDaPaginaOuEndereco } from "@/components/paginas/titulos";
import { dadosDasPaginas } from "@/lib/paginas-dados";
import { jsonLdDaLoja, jsonLdDaPagina, jsonLdDeMigalhas } from "@/lib/paginas-seo";
import { lerPaginas } from "@/lib/paginas-publicadas";
import { aplicarPublico, type ContentDocument, type PaginaDoLojista } from "@/lib/editable/document";

/**
 * O caminho de migalhas desta página. Montado no SERVIDOR e usado pelos dois lados (a navegação
 * visível e o `BreadcrumbList`): é a mesma lista, então nunca divergem.
 *
 * A última migalha usa `tituloDaPaginaOuEndereco`, e não o `tituloDaPagina` da foundation: sem o
 * registro no publicado (o caso NORMAL da prévia, que abre a página antes de ela existir na loja) o
 * helper devolve o ID DO CONTAINER, e a migalha mostrava "artigo-blog--nunca-publicado" ao lojista,
 * logo acima do `<h1>` com o título certo. A migalha leva `data-editor-ignore`, então nem quando o
 * rascunho chega ela se corrigiria sozinha.
 */
export async function migalhasDaPagina(id: string, registro: PaginaDoLojista, docDaVista?: ContentDocument | null): Promise<Migalha[]> {
  // `docDaVista`: o documento que a página mostra (o efetivo de um público), para a migalha dizer o mesmo título do <h1>
  const doc = docDaVista === undefined ? await lerPaginas() : docDaVista;
  const migalhas: Migalha[] = [{ nome: "Início", href: "/" }];
  if (registro.tipo === "artigo" && registro.colecao) {
    migalhas.push({ nome: tituloDaColecao(doc, registro.colecao), href: `/${registro.colecao}` });
  }
  migalhas.push({ nome: tituloDaPaginaOuEndereco(doc, id, registro.handle) });
  return migalhas;
}

/**
 * O registro CORTADO no que a casca lê (ver `RegistroNaCasca`). Montado aqui, e não em cada uma das
 * três rotas, pelo mesmo motivo do JSON-LD e da fatia: as três renderizam exatamente a mesma coisa.
 */
function registroNaCasca(r: PaginaDoLojista): RegistroNaCasca {
  return { tipo: r.tipo, handle: r.handle, colecao: r.colecao, autor: r.autor, tags: r.tags, publicadoEm: r.publicadoEm, criadoEm: r.criadoEm, ocultarCabecalho: r.ocultarCabecalho, ocultarRodape: r.ocultarRodape };
}

export async function PaginaDoLojistaNaTela({
  id,
  registro,
  caminho,
  aviso = null,
  publico,
}: {
  id: string;
  registro: PaginaDoLojista;
  /** o caminho desta página (`/paginas/sobre`, `/blog/titulo`), sem barra no fim */
  caminho: string;
  /**
   * A tarja que a casca mostra em modo edição quando a página NÃO está na loja. Quem escreve a frase
   * é quem chama, porque só ele sabe o motivo: em produção não se chega aqui com uma página fora do
   * ar (a rota respondeu 404 antes), e na prévia o motivo pode ser oculta, agendada ou nunca
   * publicada, que são três frases diferentes.
   */
  aviso?: string | null;
  /** a versão de um público (a rota `/_publico/[publico]/paginas/[handle]`); público que não existe mostra a de Todos */
  publico?: string;
}) {
  const publicado = await lerPaginas();
  const doc = publicado && publico ? aplicarPublico(publicado, publico) : publicado;
  const [dados, migalhas] = await Promise.all([dadosDasPaginas(doc, id), migalhasDaPagina(id, registro, doc)]);
  const colecao = registro.tipo === "artigo" && registro.colecao ? tituloDaColecao(doc, registro.colecao) : undefined;
  // a entidade da loja vai JUNTO: `publisher` e `isPartOf` apontam para ela por `@id`, e um `@id` que
  // só existe no JSON-LD da home não é resolvido por quem lê esta página (ver `jsonLdDaLoja`)
  const jsonLd = [jsonLdDaPagina({ doc, id, registro, caminho, colecao }), jsonLdDeMigalhas(migalhas, caminho), ...jsonLdDaLoja(doc)];

  return (
    <>
      {/* dataLayerReady: o gatilho de tipo de página do container central da Unbox (não renderiza
          nada). "other" é o que uma página de conteúdo é no vocabulário dele: não é home, catálogo,
          produto nem carrinho, e carimbar um desses faria o remarketing tratá-la como o que ela não é. */}
      <DataLayerReady pageType="other" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(jsonLd) }} />
      {/* a fatia desta página, e só ela: o layout raiz mandou o documento sem nenhuma página do
          lojista, e é daqui que a casca lê o título, o resumo, a imagem e as seções do corpo. */}
      <EditableFatia fatia={fatiaDoDocumento(doc, [id])}>
        <CascaDePagina
          id={id}
          registro={registroNaCasca(registro)}
          data={dados}
          modo={registro.tipo === "artigo" ? "artigo" : "pagina"}
          migalhas={migalhas}
          aviso={aviso}
        />
      </EditableFatia>
    </>
  );
}
