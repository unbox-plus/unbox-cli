// ═══════════════════════════════════════════════════════════════════════════
// O QUE O LOJISTA PUBLICOU, DO PONTO DE VISTA DE UMA ROTA.
//
// Uma camada fina, e de propósito: toda a régua (o que é visível agora, qual página responde por um
// caminho, para onde um endereço antigo leva, em que ordem os artigos saem) é dos helpers PUROS da
// foundation, que o editor testa no runner dele. Aqui só se compõe: leitura do publicado + helper +
// o prefixo e as coleções que ESTA loja declara. Regra nova escrita aqui divergiria da que o editor
// aplica ao gravar, e o lojista veria o painel dizer uma coisa e a loja fazer outra.
//
// UMA LEITURA POR RENDERIZAÇÃO: `lerPublicado()` é `cache()` do React (server.ts), então as
// quatro rotas, o `generateMetadata`, o JSON-LD e a casca leem o mesmo documento sem pagar quatro
// buscas. Fora de uma renderização (o sitemap, uma rota de API) a busca acontece uma vez por pedido.
//
// AUSÊNCIA E FALHA DE LEITURA NÃO SÃO A MESMA COISA aqui. Quem só renderiza pode tratá-las igual
// ("vale o código"); quem decide SE UMA URL EXISTE, não — ver `pararSeALeituraFalhou`.
// ═══════════════════════════════════════════════════════════════════════════
import "server-only";
import { cache } from "react";
import { COLECOES_DO_CODIGO, PREFIXO_DE_PAGINAS } from "@/lib/paginas-do-lojista";
import { reservadosDaLoja } from "@/lib/reservados";
import {
  artigosDaColecao,
  lerPublicado,
  paginaDaRota,
  redirecionamentoDe as redirecionamentoNoDocumento,
  rotaDeColecao,
  rotaDePagina,
  visivelAgora,
  type PaginaDoLojista,
} from "@/lib/editable/server";
import { colecaoDaRota, decomporIdDePagina, tituloDaPagina, type ContentDocument } from "@/lib/editable/document";

/** o registro de uma página do lojista com o id do container onde a copy dela mora */
export interface PaginaLida {
  id: string;
  registro: PaginaDoLojista;
}

// ═══ A PENEIRA DA LEITURA ═══════════════════════════════════════════════════
// A régua de gravação do editor (`validateOp`) já recusa tudo o que se peneira aqui. Isto NÃO é
// desconfiança do editor: é que a loja é a camada que RE-CONFERE o publicado, e o documento pode ter
// chegado por outro caminho (uma versão antiga restaurada, um `replace_doc` de fora, uma migração, uma
// entrada de `COLECOES_DO_CODIGO` que a loja tirou do código depois). É o mesmo argumento pelo qual
// `server.ts` derruba bloco de HTML e texto formatado na porta, e pelo qual `redirecionamentoDe` da
// foundation recusa destino externo na LEITURA, com esse motivo escrito no comentário dela.
//
// O que a peneira derruba, e por quê:
//  · id que não se decompõe, ou que não bate com o registro (`pagina-x` com `tipo: "artigo"`, registro
//    sem `tipo`): `rotaDePagina` cairia no ramo da página avulsa e publicaria `/paginas/x`, 200 e no
//    sitemap, para um registro que não é nada;
//  · artigo cuja coleção NÃO EXISTE: o artigo respondia 200 e entrava no sitemap enquanto a listagem
//    dele (a migalha visível da própria página, e o `BreadcrumbList` que ela emite) respondia 404;
//  · página ou coleção sob um endereço RESERVADO: `/produtos` é a rota do catálogo, então uma coleção
//    com esse endereço nunca abre — e o sitemap publicava `/produtos` duas vezes e prometia
//    `/produtos/invasor`, que respondia 200 porque a rota estática não tem filho para pegá-lo.
//
// A peneira é dos MAPAS (`paginas`, `colecoes`); `values` fica inteiro, porque a copy de um registro
// peneirado não é servida por ninguém e não custa nada.

/** este registro é uma página possível NESTA loja? */
function registroUsavel(doc: ContentDocument, id: string, registro: PaginaDoLojista, reservados: readonly string[]): boolean {
  const partes = decomporIdDePagina(id);
  if (!partes || partes.tipo === "colecao") return false;
  if (partes.tipo !== registro.tipo || partes.handle !== registro.handle) return false;
  if (registro.tipo !== "artigo") return true;
  if (partes.colecao !== registro.colecao || !registro.colecao) return false;
  if (reservados.includes(registro.colecao)) return false;
  return colecaoDaRota(doc, rotaDeColecao(registro.colecao), COLECOES_DO_CODIGO) !== null;
}

/** o mesmo documento com os mapas de página peneirados (ver o bloco acima) */
function comMapasPeneirados(doc: ContentDocument): ContentDocument {
  const reservados = reservadosDaLoja();
  // as coleções PRIMEIRO: é contra a lista já peneirada que cada artigo prova que a coleção dele existe
  const semReservadas: ContentDocument = doc.colecoes
    ? { ...doc, colecoes: Object.fromEntries(Object.entries(doc.colecoes).filter(([h]) => !reservados.includes(h))) }
    : doc;
  if (!semReservadas.paginas) return semReservadas;
  const paginas = Object.fromEntries(
    Object.entries(semReservadas.paginas).filter(([id, r]) => registroUsavel(semReservadas, id, r, reservados)),
  );
  return { ...semReservadas, paginas };
}

/**
 * A LEITURA do publicado, já peneirada, DIZENDO QUAL DOS DOIS CASOS FOI: ausência (`falhou: false` —
 * a loja nunca publicou, ou está desligada do editor) ou FALHA DE LEITURA (`falhou: true` — rede,
 * 5xx, JSON inválido). A foundation distingue os dois desde sempre (`lerPublicado`); quem RENDERIZA
 * pode colapsá-los em "vale o código", mas quem DECIDE SE UMA URL EXISTE não pode: ver
 * `pararSeALeituraFalhou`. `cache` do React para a peneira rodar UMA vez por renderização.
 */
const leituraDasPaginas = cache(async (): Promise<{ doc: ContentDocument | null; falhou: boolean }> => {
  const leitura = await lerPublicado();
  return { doc: leitura.doc ? comMapasPeneirados(leitura.doc) : leitura.doc, falhou: leitura.falhou };
});

/**
 * O documento publicado, já peneirado; `null` = a loja nunca publicou, ou a leitura falhou (nos dois
 * vale o código, que é o que RENDERIZAR precisa saber).
 */
export async function lerPaginas(): Promise<ContentDocument | null> {
  return (await leituraDasPaginas()).doc;
}

/** o erro que interrompe a rota quando não se conseguiu LER o publicado (ver `pararSeALeituraFalhou`) */
class LeituraDoPublicadoFalhou extends Error {}

/**
 * PARA A ROTA quando não se conseguiu LER o que o lojista publicou. Chamada no começo das quatro
 * rotas de página e do sitemap, ANTES de qualquer decisão sobre existir ou não existir.
 *
 * POR QUE NÃO SEGUIR E RESPONDER 404. Um 404 é uma AFIRMAÇÃO — "esta URL não existe" — e é a
 * afirmação que tira o endereço do índice do buscador. Numa falha de leitura a loja não sabe se a
 * página existe: ela não conseguiu perguntar. Colapsar "não existe" com "não consegui ler" era o
 * mesmo defeito que a foundation já tinha resolvido com o `falhou` e que aqui se jogava fora.
 *
 * E O 404 FICAVA GUARDADO. As quatro rotas são ISR de 300 s: medido com o editor derrubado, toda
 * página do lojista respondia 404, o sitemap encolhia para as poucas URLs que saem do código, e o
 * 404 continuava sendo servido do cache DEPOIS de o editor voltar (três tentativas seguidas). Um
 * blip de cinco segundos virava cinco minutos de "não existe" para cada URL publicada.
 *
 * O ERRO responde 5xx, e 5xx é a única resposta verdadeira aqui: o buscador a lê como "temporário,
 * volto depois" e não desindexa nada, e o Next NÃO guarda resposta de erro no cache de rota — o
 * pedido seguinte tenta ler de novo. Perde-se a página enquanto o editor está fora, que é o que de
 * fato está acontecendo, em vez de negá-la por cinco minutos além disso.
 *
 * (5xx e não 503 com `Retry-After`: uma página do App Router só sabe responder 200, o 404 do
 * `notFound()` e o 5xx de um erro — status próprio exigiria mover a decisão para o middleware, que
 * não lê o publicado. O que importa aqui é a FAMÍLIA do status, e 5xx já é a certa.)
 */
export async function pararSeALeituraFalhou(): Promise<void> {
  if (!(await leituraDasPaginas()).falhou) return;
  throw new LeituraDoPublicadoFalhou(
    "não foi possível ler o que o lojista publicou; a loja responde erro em vez de afirmar que a página não existe",
  );
}

/**
 * A página que responde por este caminho E está no ar (visível, com a data de publicação já passada).
 * `null` é 404 real: página oculta, agendada para o futuro ou inexistente respondem a mesma coisa, que
 * é o que tira uma URL do índice do buscador.
 */
export async function paginaEmProducao(caminho: string): Promise<PaginaLida | null> {
  const doc = await lerPaginas();
  const achada = paginaDaRota(doc, caminho, PREFIXO_DE_PAGINAS);
  if (!achada || !visivelAgora(achada.registro)) return null;
  return achada;
}

/**
 * Esta coleção existe? A do CÓDIGO (`COLECOES_DO_CODIGO`) existe sempre, mesmo sem nenhum artigo: é uma
 * URL que a loja declara, como `/produtos`, e responder 404 nela seria a loja negar o próprio endereço.
 * A do lojista existe depois de publicada.
 */
export async function colecaoEmProducao(handle: string): Promise<boolean> {
  const doc = await lerPaginas();
  return colecaoDaRota(doc, rotaDeColecao(handle), COLECOES_DO_CODIGO) !== null;
}

/** os artigos visíveis da coleção, do mais novo ao mais antigo (a ordem da listagem, do sitemap e do JSON-LD) */
export async function artigosVisiveis(colecao: string): Promise<PaginaLida[]> {
  const doc = await lerPaginas();
  return artigosDaColecao(doc, colecao);
}

/**
 * Para onde este caminho leva depois de o lojista ter renomeado o endereço, ou `null`. A rota consulta
 * ANTES de decidir 404: é o que faz o endereço antigo continuar valendo para sempre, sem cadeia.
 *
 * E SÓ LEVA A LUGAR QUE EXISTE. O destino é uma página do lojista que pode ter saído do ar depois de o
 * desvio ser gravado (ocultada, agendada para o futuro, ou numa coleção que o lojista apagou): mandar um
 * 308 permanente para um endereço que responde 404 é pior que o 404 direto, porque para quem chega dá no
 * mesmo e para o buscador é um salto a mais numa cadeia que não termina em página nenhuma. Quando o
 * destino é de página do lojista e não está no ar, esta função devolve `null` e a rota segue para o 404.
 * O desvio continua GRAVADO: o dia em que a página voltar a ficar visível, o endereço antigo volta a
 * valer sozinho. Destino que não é de página do lojista (`/`, `/produtos`, uma rota do código) passa: quem
 * responde por ele é a própria loja.
 */
export async function redirecionamentoDe(caminho: string): Promise<string | null> {
  const doc = await lerPaginas();
  const destino = redirecionamentoNoDocumento(doc, caminho);
  if (!destino) return null;
  const daPagina = paginaDaRota(doc, destino, PREFIXO_DE_PAGINAS);
  if (daPagina) return visivelAgora(daPagina.registro) ? destino : null;
  const colecao = colecaoDaRota(doc, destino, COLECOES_DO_CODIGO);
  if (colecao !== null) return destino;
  // o destino tem forma de página do lojista e não há nada ali: sob o prefixo das páginas, ou dentro de
  // uma coleção que existe (o artigo foi apagado). Não leva a lugar nenhum.
  if (destino.startsWith(`${PREFIXO_DE_PAGINAS}/`)) return null;
  const [primeiro] = destino.split("/").filter(Boolean);
  if (primeiro && colecaoDaRota(doc, rotaDeColecao(primeiro), COLECOES_DO_CODIGO) !== null) return null;
  return destino;
}

/** o título que o lojista deu à página (ou à coleção), senão o endereço capitalizado */
export async function tituloPublicado(id: string): Promise<string> {
  return tituloDaPagina(await lerPaginas(), id);
}

/** uma página visível, com a rota já montada, para o sitemap */
export interface PaginaDoSitemap extends PaginaLida {
  rota: string;
}

/**
 * Todas as páginas e artigos que estão no ar e que o lojista NÃO marcou "ocultar de buscadores". É o
 * que o sitemap publica, e o sitemap é uma afirmação: URL que responde 200, canônica, com `lastmod`
 * verdadeiro. Página oculta, agendada ou marcada como noindex fica de fora, porque prometer ao
 * buscador uma URL que ele vai encontrar bloqueada é o que faz ele parar de acreditar no arquivo.
 */
export async function todasAsPaginasVisiveis(): Promise<PaginaDoSitemap[]> {
  const doc = await lerPaginas();
  const saida: PaginaDoSitemap[] = [];
  for (const [id, registro] of Object.entries(doc?.paginas ?? {})) {
    if (!visivelAgora(registro)) continue;
    if (registro.seo?.ocultarDeBuscadores) continue;
    saida.push({ id, registro, rota: rotaDePagina(registro, PREFIXO_DE_PAGINAS) });
  }
  return saida.sort((a, b) => (a.rota < b.rota ? -1 : a.rota > b.rota ? 1 : 0));
}

/**
 * Os endereços de todas as coleções que existem (as do código e as que o lojista publicou), para a
 * listagem de cada uma entrar no sitemap. A paginação fica de fora: `/2` em diante é a mesma coleção
 * repartida, e o buscador chega nela pelos links da própria listagem.
 */
export async function colecoesEmProducao(): Promise<string[]> {
  const doc = await lerPaginas();
  // `doc.colecoes` já vem sem endereço reservado (a peneira da leitura); `COLECOES_DO_CODIGO` passa
  // pela mesma régua aqui porque ela é uma constante do código, e uma loja que declarasse `produtos`
  // ali publicaria a URL do catálogo como listagem de coleção
  const reservados = reservadosDaLoja();
  const handles = new Set<string>(COLECOES_DO_CODIGO.map((c) => c.handle).filter((h) => !reservados.includes(h)));
  for (const h of Object.keys(doc?.colecoes ?? {})) handles.add(h);
  return [...handles].sort();
}
