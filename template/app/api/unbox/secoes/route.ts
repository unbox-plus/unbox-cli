// ═══════════════════════════════════════════════════════════════════════════
// OS DADOS DAS SEÇÕES ADICIONADAS, **NA PRÉVIA** (foundation 18).
//
// Toda página aceita o catálogo da loja ("+ Adicionar seção"), e as seções de produto (vitrine, bloco de compra,
// destaques, categorias, kits) precisam do catálogo para desenhar. A página publicada só manda esses dados no HTML
// quando o container dela TEM seção adicionada (`dadosSeHouverSecoes`): numa página de produto sem nenhuma, o
// catálogo viajaria em toda visita sem ninguém ler. Na prévia, o lojista adiciona a primeira e ela precisa
// aparecer na hora, com produto: é aqui que a página (no iframe do editor) busca esses dados.
//
// ── CONTRATO (o outro lado é `useDadosDasSecoes`, em components/home/secoes-com-catalogo.tsx) ──
//   GET   /api/unbox/secoes?container=<container>    x-editor-token: <JWT ES256 do editor, purpose "preview">
//   200 → HomeData (o mesmo pacote que a página publicada manda)     400 → container inválido     401 → sem token
//
// SOMENTE LEITURA, e só com o token da prévia, como a rota irmã da vitrine (app/api/unbox/vitrine): os dados
// não são segredo (é o catálogo da loja), mas uma rota pública a mais é uma porta a mais para o catálogo da Unbox.
// ═══════════════════════════════════════════════════════════════════════════
import { ok, fail } from "@/lib/api";
import { verifyEditorToken } from "@/lib/editable/verify";
import { getPublishedContent } from "@/lib/editable/server";
import { dadosDasPaginas } from "@/lib/paginas-dados";

// a resposta depende do token de quem pediu: nada de cache compartilhado
export const dynamic = "force-dynamic";
const SEM_CACHE = { headers: { "Cache-Control": "private, no-store" } };
/** um container da loja: `produto`, `catalogo`, `colecao-blog`, `pagina-sobre`, `artigo-blog--post` */
const CONTAINER = /^[a-z][a-z0-9-]{0,120}$/;

export async function GET(req: Request) {
  const token = req.headers.get("x-editor-token");
  const autorizado = token ? await verifyEditorToken(token, "preview") : null;
  if (!autorizado) return fail("Não autorizado.", 401);
  const container = new URL(req.url).searchParams.get("container") ?? "";
  if (!CONTAINER.test(container)) return fail("Container inválido.", 400);
  return ok(await dadosDasPaginas(await getPublishedContent(), container), SEM_CACHE);
}
