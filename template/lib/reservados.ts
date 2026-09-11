// ═══════════════════════════════════════════════════════════════════════════
// OS ENDEREÇOS QUE UMA COLEÇÃO NÃO PODE OCUPAR: DERIVADOS, NUNCA DIGITADOS.
//
// A listagem de uma coleção mora em `/<coleção>` (`app/(loja)/[colecao]`), na RAIZ da loja. O
// roteador do Next dá precedência à rota estática, e o servidor de estáticos dá precedência a
// `public/`: uma coleção chamada `produtos` existiria no documento, apareceria na lista do editor e
// nunca abriria, porque `/produtos` é a página do catálogo. Uma chamada `brand` abriria a pasta de
// imagens. O lojista veria a URL certa levando a outro lugar, sem erro nenhum.
//
// Esta lista é a conferência, e ela é CALCULADA: `RESERVADOS_FIXOS` (a base da foundation) mais os
// primeiros segmentos ocupados pelo código desta loja mais as entradas de `public/`. Viaja no
// manifesto (`paginasDoLojista.reservados`) e em `GET /api/unbox/paginas`; o editor recusa o endereço
// com "Esse endereço é reservado pela loja." antes de gravar.
//
// A varredura é a de `app/` INTEIRA (`segmentosDoCodigo()`, em lib/rotas-editaveis.ts), não a das
// páginas editáveis: uma rota fora de `app/(loja)/` ocupa o mesmo primeiro segmento de URL e ganha da
// coleção por precedência do Next. O porquê, e o modo de falha, estão escritos lá.
//
// SERVER-ONLY: lê o sistema de arquivos. Quem monta o objeto que vai ao cliente é
// `lib/paginas-do-lojista.ts`, que recebe esta lista pronta.
// ═══════════════════════════════════════════════════════════════════════════
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { RESERVADOS_FIXOS } from "@/lib/editable/document";
import { ErroDeVarredura, segmentosDoCodigo } from "@/lib/rotas-editaveis";

/**
 * As entradas de `public/`, com e SEM extensão. Sem extensão porque a coleção `brand` colidiria com a
 * pasta `public/brand`; com extensão porque a coleção não pode se chamar `favicon.ico` nem
 * `sitemap.xml` (que não é arquivo de `public/`, mas está nos fixos pelo mesmo motivo). Só o primeiro
 * nível: é o único que disputa o primeiro segmento da URL.
 */
function entradasDePublic(): string[] {
  const raiz = path.join(process.cwd(), "public");
  let itens: fs.Dirent[];
  try {
    itens = fs.readdirSync(raiz, { withFileTypes: true });
  } catch {
    // `public/` ausente (ou ilegível) não derruba a loja nem esvazia a lista: os fixos e as rotas
    // continuam valendo, e o que se perde é a conferência de um arquivo estático. A pasta existe em
    // toda loja do CLI; quando não existir, não há arquivo com que colidir.
    return [];
  }
  const nomes: string[] = [];
  for (const item of itens) {
    nomes.push(item.name);
    const semExtensao = item.name.replace(/\.[^.]+$/, "");
    if (semExtensao && semExtensao !== item.name) nomes.push(semExtensao);
  }
  return nomes;
}

let guardada: string[] | null = null;

/**
 * A lista inteira, ordenada e sem repetição. MEMOIZADA no módulo: ela é lida em toda renderização
 * (o `app/layout.tsx` a passa ao provider) e não muda enquanto o processo vive, porque as duas fontes
 * são arquivos do build. Em desenvolvimento, reiniciar o servidor a recalcula.
 *
 * A varredura das rotas pode falhar (fontes fora do pacote da função, subpasta ilegível): a lista sai
 * mesmo assim, com os fixos e o `public/`, e o motivo vai para o log. Derrubar o layout inteiro por
 * causa disso tiraria a loja do ar; devolver a lista curta em silêncio deixaria passar uma coleção
 * com nome de rota, e é por isso que o motivo é dito.
 */
export function reservadosDaLoja(): string[] {
  if (guardada) return guardada;
  const nomes = new Set<string>(RESERVADOS_FIXOS as readonly string[]);
  try {
    for (const seg of segmentosDoCodigo()) nomes.add(seg);
  } catch (e) {
    const motivo = e instanceof ErroDeVarredura ? e.message : e instanceof Error ? e.message : String(e);
    console.warn(`[paginas] não consegui varrer as rotas para a lista de endereços reservados (${motivo}); vale a lista fixa mais o conteúdo de public/`);
  }
  for (const nome of entradasDePublic()) nomes.add(nome);
  guardada = [...nomes].sort();
  return guardada;
}
