// O nome que aparece na tela para uma página, um artigo ou uma coleção. Duas linhas, num arquivo só,
// porque o mesmo nome é lido pela casca (no navegador, do rascunho, para a prévia mudar enquanto o
// lojista digita) e pelas rotas (no servidor, do publicado, para o `<title>`, o caminho de migalhas e
// o dado estruturado). Escrito duas vezes, divergiria.
//
// Client-safe: sem `fs` e sem `server-only`.
import { COLECOES_DO_CODIGO } from "@/lib/paginas-do-lojista";
import { idDeColecao, tituloDaPagina, type ContentDocument } from "@/lib/editable/document";

/**
 * O endereço como título de emergência (`receita-de-pao` → "Receita de pao"). É o mesmo critério da
 * foundation (`tituloDaPagina` sem valor em `values`), e existe aqui para a casca ter o que passar
 * como `fallback` do primitivo: o fallback é o texto do CÓDIGO, e a loja nunca renderiza `<h1>` vazio.
 */
export function enderecoComoTitulo(handle: string): string {
  const s = handle.replace(/-+/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * O título de uma coleção: o que o lojista escreveu no cabeçalho dela, senão o que o CÓDIGO declara
 * (`COLECOES_DO_CODIGO`), senão o endereço capitalizado. A coleção do código não tem registro no
 * documento até alguém editá-la, e sem esta ordem a listagem de fábrica apareceria pelo endereço.
 */
export function tituloDaColecao(doc: ContentDocument | null | undefined, handle: string): string {
  const id = idDeColecao(handle);
  const doDocumento = doc?.values[`${id}.cabecalho.titulo`];
  if (typeof doDocumento === "string" && doDocumento.trim()) return doDocumento.trim();
  const doCodigo = COLECOES_DO_CODIGO.find((c) => c.handle === handle);
  if (doCodigo) return doCodigo.titulo;
  return tituloDaPagina(doc, id);
}

/**
 * O título de uma PÁGINA ou de um ARTIGO: o que o lojista escreveu no cabeçalho, senão o endereço
 * capitalizado.
 *
 * Existe para tapar o último recurso de `tituloDaPagina` da foundation: ela só sabe capitalizar o
 * endereço quando acha o REGISTRO no documento, e devolve o ID CRU quando não acha. Na PRÉVIA isso é o
 * caso normal, não o de borda (ela existe justamente para a página que ainda não foi publicada), e o
 * id cru é vocabulário de dentro: a migalha mostrava "artigo-blog--nunca-publicado" logo acima de um
 * `<h1>` com o texto certo, e o mesmo id ia para o dado estruturado. O endereço, o `<h1>` e a migalha
 * passam a dizer a mesma coisa.
 */
export function tituloDaPaginaOuEndereco(doc: ContentDocument | null | undefined, id: string, handle: string): string {
  const escrito = tituloDaPagina(doc, id);
  return escrito === id ? enderecoComoTitulo(handle) : escrito;
}
