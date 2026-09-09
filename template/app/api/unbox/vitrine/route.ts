// ═══════════════════════════════════════════════════════════════════════════
// A ESCOLHA DA VITRINE VIRA PRODUTOS **NA PRÉVIA**, ANTES DE PUBLICAR.
//
// Por que existe: em produção quem resolve a vitrine é a página, no servidor,
// a partir do documento PUBLICADO (`resolverVitrinesDoDocumento`). Na prévia
// não tem como ser assim — o RASCUNHO nunca passou por este servidor: ele vive
// no editor e chega ao iframe por postMessage, no navegador. Sem esta rota, o
// lojista escolhia cinco produtos, punha limite 3, clicava em aplicar, e a tela
// não mudava; numa loja que ainda não publicou, não mudava nunca. Publicar às
// cegas é o oposto do que a prévia serve para resolver.
//
// Então o primitivo `Editable.Vitrine`, em modo edição, manda a ESCOLHA para cá
// e recebe os produtos de volta. A credencial da Unbox continua onde sempre
// esteve: nesta loja. O editor não fala com a Unbox — nem por esta rota, que ele
// não chama: quem chama é a própria página da loja, dentro do iframe dele.
//
// Irmã de app/api/unbox/catalogo/route.ts (o SELETOR: "o que existe na loja").
// Esta responde outra pergunta: "esta escolha, hoje, mostra o quê?".
//
// ── CONTRATO (o outro lado é `Editable.Vitrine`, em lib/editable/primitives.tsx) ──
//   POST  x-editor-token: <JWT ES256 do editor, purpose "preview">
//         body { escolha: VitrineValue }
//   200 → { produtos: [{ id, titulo, slug, imagem, preco, esgotado }] }  (≤ escolha.limite)
//   400 → escolha malformada     401 → sem token válido     502 → Unbox não respondeu
//
// SOMENTE LEITURA. Nada aqui grava nada, e o documento não é tocado: quem guarda
// a escolha é o editor, e ela só chega à loja de verdade quando o lojista publica.
//
// ⚠️ 502 NUNCA vira 200 com lista vazia. Lista vazia é resposta legítima ("essa
// categoria não tem produto hoje") e o lojista precisa poder distinguir as duas
// coisas — senão ele publica uma seção em branco achando que escolheu errado.
// É por isso que `resolverVitrine` é chamada em modo `estrito` aqui, e não na
// página do cliente, onde a única saída aceitável é cair nos produtos do código.
// ═══════════════════════════════════════════════════════════════════════════
import { ok, fail } from "@/lib/api";
import { verifyEditorToken } from "@/lib/editable/verify";
import { vitrineValida } from "@/lib/editable/document";
import { resolverVitrine } from "@/lib/vitrine";

// A resposta depende do token do request e do rascunho de quem pediu: nada de cache compartilhado.
export const dynamic = "force-dynamic";

const SEM_CACHE = { headers: { "Cache-Control": "private, no-store" } };

/**
 * Teto do corpo, lido ANTES do JSON.parse. Uma escolha de vitrine é minúscula
 * (24 ids no pior caso); qualquer coisa maior que isto não é escolha de vitrine.
 */
const CORPO_MAX = 8 * 1024;

export async function POST(req: Request) {
  // Mesmo portão do seletor de catálogo — só o purpose muda. "preview" é o token com que o editor
  // ABRIU este iframe: ele já está no navegador do lojista, e é o único que a página tem em mãos.
  // Ele vale 15 minutos; quando vence, esta rota responde 401 e o primitivo pede outro ao editor.
  const token = req.headers.get("x-editor-token");
  const autorizado = token ? await verifyEditorToken(token, "preview") : null;
  if (!autorizado) return fail("Não autorizado.", 401);

  const bruto = await req.text().catch(() => "");
  if (bruto.length > CORPO_MAX) return fail("Escolha de vitrine grande demais.", 413);
  let corpo: unknown;
  try {
    corpo = JSON.parse(bruto);
  } catch {
    return fail("Não entendi a escolha da vitrine.", 400);
  }

  // A MESMA validação que o documento usa para aceitar o valor. Se não passa aqui, não passaria lá:
  // resolver uma escolha que o editor não conseguiria gravar mostraria ao lojista uma prévia de uma
  // vitrine que ele nunca vai conseguir publicar.
  const escolha = (corpo as { escolha?: unknown } | null)?.escolha;
  if (!vitrineValida(escolha)) return fail("Escolha de vitrine inválida (modo, categoria/produtos/busca, limite).", 400);

  try {
    // `limite` é aplicado DENTRO de `resolverVitrine` (`limiteDaVitrine`), o mesmo caminho da
    // página publicada — é o que faz "coloquei 3" limitar na prévia igual limitaria no ar.
    const produtos = await resolverVitrine(escolha, { estrito: true });
    return ok({ produtos }, SEM_CACHE);
  } catch (err) {
    // A mensagem crua pode carregar detalhe do gateway; fica no log do servidor.
    console.warn("[vitrine] não consegui resolver a escolha da prévia", err instanceof Error ? err.message : err);
    return fail("Não consegui buscar os produtos na Unbox agora.", 502);
  }
}
