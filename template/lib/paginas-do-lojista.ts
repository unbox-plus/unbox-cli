// ═══════════════════════════════════════════════════════════════════════════
// A LOJA DECLARA QUE SABE RENDERIZAR AS PÁGINAS DO LOJISTA.
//
// O dono da loja cria páginas avulsas (`/paginas/<endereço>`), coleções (`/blog`) e os artigos delas
// (`/blog/<endereço>`) pelo editor, sem programador. O documento guarda o registro de cada uma; quem
// as coloca na tela é esta loja, com as rotas de `app/(loja)/paginas`, `app/(loja)/[colecao]` e a
// casca de `components/paginas/`.
//
// ESTE ARQUIVO É A DECLARAÇÃO, e ela é o INTERRUPTOR: enquanto a loja não passa
// `paginasDoLojista` ao `EditableProvider`, o editor não oferece páginas nela (a régua do documento
// recusa toda operação de página com "Nesta loja ainda não dá para criar páginas"). Uma loja que
// apagar as rotas e a casca tira esta prop e volta ao estado anterior, sem mentira nenhuma no meio.
//
// SEM `fs` E SEM `server-only` DE PROPÓSITO: o mesmo objeto viaja para o provider (que roda no
// cliente em modo edição) e para `GET /api/unbox/paginas`. Quem lê o sistema de arquivos é
// `lib/reservados.ts`, que é de servidor, e entrega a lista pronta aqui.
// ═══════════════════════════════════════════════════════════════════════════
import type { ManifestPaginasDoLojista } from "@/lib/editable/document";

/**
 * O prefixo das páginas avulsas. Fixo, como nas plataformas de onde o lojista vem: o endereço que ele
 * escolhe é só o último segmento, e o prefixo nunca colide com uma rota do código.
 */
export const PREFIXO_DE_PAGINAS = "/paginas";

/**
 * As coleções que já existem no CÓDIGO desta loja: elas não têm registro no documento e ainda assim
 * têm listagem e artigos, para o lojista escrever o primeiro artigo sem antes criar nada. `blog` é a
 * de fábrica; uma loja que queira outra ("receitas", "guias") acrescenta aqui E confere que o
 * endereço não é primeiro segmento de rota do código (senão a rota estática ganha e a listagem nunca
 * abre; a lista de reservados de `lib/reservados.ts` é justamente essa conferência).
 */
export const COLECOES_DO_CODIGO: readonly { handle: string; titulo: string }[] = [
  { handle: "blog", titulo: "Blog" },
];

/**
 * O objeto que vai ao `EditableProvider` (e daí ao manifesto) e a `GET /api/unbox/paginas`. Os
 * `reservados` chegam de fora porque só o servidor os calcula (`reservadosDaLoja()`): é a lista de
 * primeiros segmentos que uma coleção não pode ocupar, e o editor nunca a digita.
 *
 * Cópias rasas das listas: o objeto viaja para o cliente e para JSON, e devolver as constantes do
 * módulo deixaria quem recebe mexer no que a loja inteira lê.
 */
export function declaracaoDoLojista(reservados: readonly string[]): ManifestPaginasDoLojista {
  return {
    foundation: 13,
    prefixoDePaginas: PREFIXO_DE_PAGINAS,
    colecoesDoCodigo: COLECOES_DO_CODIGO.map((c) => ({ handle: c.handle, titulo: c.titulo })),
    reservados: [...reservados],
  };
}
