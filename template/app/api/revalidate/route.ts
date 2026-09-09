// Revalidação on-demand (ISR) — chamada por webhook/cron quando catálogo/estoque mudam.
// Protegida por REVALIDATE_SECRET.
import { revalidatePath, revalidateTag } from "next/cache";
import { serverEnv } from "@/lib/config";
import { ok, fail } from "@/lib/api";
import { verifyEditorToken } from "@/lib/editable/verify";
import { conteudoPublicadoAgora } from "@/lib/editable/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret") ?? req.headers.get("x-revalidate-secret");
  const viaSecret = Boolean(serverEnv.revalidateSecret) && secret === serverEnv.revalidateSecret;
  // O editor publica conteúdo e chama aqui com um JWT (ES256, purpose "revalidate") verificado pela
  // chave PÚBLICA dele — a loja não guarda segredo do editor.
  const tokenDoEditor = req.headers.get("x-editor-token");
  const viaEditor = tokenDoEditor ? await verifyEditorToken(tokenDoEditor, "revalidate") : null;
  if (!viaSecret && !viaEditor) {
    return fail("Não autorizado.", 401);
  }
  const body = await req.json().catch(() => ({}));
  const paths: string[] = Array.isArray(body.paths) && body.paths.length ? body.paths : ["/", "/produtos"];
  // o conteúdo publicado é lido no layout com esta tag; sem purgá-la, o path re-renderiza com o
  // JSON antigo do Data Cache.
  if (viaEditor) revalidateTag("unbox-editor-content");
  // O editor manda as páginas que o conteúdo publicado realmente alcança, e uma delas pode ser uma
  // ROTA com segmento dinâmico ("/produto/[productSlug]"): trocar o cabeçalho muda todas as páginas
  // de produto, não uma. Sem o segundo argumento o Next leria os colchetes como caminho literal e não
  // revalidaria nada — em silêncio.
  // Caminho que falha NÃO some do recibo: ele fica FORA de `revalidated`, e é assim que o editor
  // descobre que aquela página continua no ar com o conteúdo antigo (ver lib/recibo.ts do editor).
  const revalidados: string[] = [];
  const falhas: string[] = [];
  for (const p of paths) {
    try {
      if (p.includes("[")) revalidatePath(p, "page");
      else revalidatePath(p);
      revalidados.push(p);
    } catch (err) {
      falhas.push(`${p}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (falhas.length) console.warn("[revalidate] caminhos que não revalidaram:", falhas.join(" · "));
  // O RECIBO. Quem chamou daqui foi o editor, e é com esta resposta que ele decide se pode dizer ao
  // lojista "a loja já está no ar com a versão N". Purgar o cache não prova isso: prova que a PRÓXIMA
  // leitura vai buscar de novo. Então a loja vai ler o conteúdo publicado agora e devolve QUAL
  // documento ela passou a servir (ver `conteudoPublicadoAgora` em lib/editable/server.ts). Sem isto o
  // editor afirmava "no ar" até para uma loja que nem está ligada a ele.
  // Só para o editor: o webhook por segredo não precisa do recibo e não paga essa leitura.
  const conteudo = viaEditor ? await conteudoPublicadoAgora() : null;
  return ok({ revalidated: revalidados, ...(falhas.length ? { falhas } : {}), via: viaEditor ? "editor" : "secret", conteudo });
}
