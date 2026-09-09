// ═══════════════════════════════════════════════════════════════════════════
// LEITURA DO CATÁLOGO PARA O SELETOR DE VITRINE DO EDITOR.
//
// Por que existe: quando o lojista escolhe "quais produtos esta vitrine mostra",
// o editor precisa listar as categorias e os produtos da loja. Ele NÃO fala com
// a Unbox e NÃO guarda credencial — quem tem o cliente da Unbox é a loja. Então
// o editor pergunta aqui, com o mesmo token assinado que ele já usa em
// /api/revalidate (ES256, chave pública no JWKS dele), agora com purpose
// "catalogo".
//
// SOMENTE LEITURA, e só os campos que o seletor mostra. Nada de credencial,
// nada de cadastro interno, nada de escrita.
//
// Se a Unbox falhar, isto responde 502 — NUNCA 200 com lista vazia. Lista vazia
// é uma resposta legítima ("essa categoria não tem produto") e o editor
// precisa saber diferenciar as duas coisas para não oferecer uma vitrine que na
// verdade ninguém conseguiu ler.
//
// ── CONTRATO (o outro lado é lib/catalogo.ts do editor) ────────────────────
//   GET ?tipo=categorias                → { categorias: [{ id, nome, slug }] }
//   GET ?tipo=produtos                  → { produtos:   [{ id, titulo, slug, imagem, preco, esgotado }] }
//   GET ?busca=<texto> | ?tagId=<id>    → idem, filtrado
//   GET ?ids=<id,id,id>                 → idem, só ESSES, na ordem pedida (quem já está na vitrine)
//   `limite` (1..60, padrão 30) é o tamanho da LISTA do seletor, não o teto da vitrine.
//   `imagem: string|null`, `preco: number|null` (a loja formata; o editor também) —
//   null é ausência honesta, nunca zero nem foto genérica. `id` é o que o editor grava
//   na escolha, e o que `resolverVitrine` usa para achar o produto de volta.
// ═══════════════════════════════════════════════════════════════════════════
import { ok, fail } from "@/lib/api";
import { verifyEditorToken } from "@/lib/editable/verify";
import { getCatalog, getTopTags } from "@/lib/queries";
import { VITRINE_MAX } from "@/lib/editable/document";
import { produtoDaVitrine, resolverVitrine, type VitrineProduto } from "@/lib/vitrine";

// A resposta depende do token do request; nada de cache compartilhado.
export const dynamic = "force-dynamic";

const SEM_CACHE = { headers: { "Cache-Control": "private, no-store" } };

/** Texto de busca / id de categoria: curtos, como no resto da foundation. */
const MAX_TEXTO = 120;

// Quantos itens o SELETOR lista de uma vez. NÃO é `VITRINE_MAX` (o teto de quantos
// produtos uma vitrine mostra): são duas coisas diferentes, e usar o teto da vitrine
// aqui cortava a lista de escolha em 24 mesmo quando o editor pedia 30. Os mesmos
// números vivem em lib/catalogo.ts do editor (LISTA_MAX / LISTA_PADRAO).
const LISTA_MAX = 60;
const LISTA_PADRAO = 30;

function limiteDaLista(bruto: number): number {
  return Number.isFinite(bruto) && bruto >= 1 ? Math.min(LISTA_MAX, Math.floor(bruto)) : LISTA_PADRAO;
}

export async function GET(req: Request) {
  const token = req.headers.get("x-editor-token");
  const autorizado = token ? await verifyEditorToken(token, "catalogo") : null;
  if (!autorizado) return fail("Não autorizado.", 401);

  const params = new URL(req.url).searchParams;
  const tipo = params.get("tipo")?.trim() ?? "";
  const busca = params.get("busca")?.trim() ?? "";
  const tagId = params.get("tagId")?.trim() ?? "";
  const limite = limiteDaLista(Number(params.get("limite")));
  // Ids de uma escolha de vitrine. O charset é o de `vitrineValida` — mais largo que o do
  // tagId porque o id da Unbox pode ser OPACO (base64, com `/` e `=`) —, e o teto é
  // `VITRINE_MAX` porque é o que cabe numa escolha. Id fora do formato é descartado em
  // silêncio: ele não poderia estar gravado numa vitrine de todo jeito.
  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => /^[\w:.@+/=-]{1,200}$/.test(x))
    .slice(0, VITRINE_MAX);

  if (busca.length > MAX_TEXTO || tagId.length > MAX_TEXTO) {
    return fail("Busca ou categoria longa demais.", 400);
  }

  try {
    // ── Categorias ────────────────────────────────────────────────────────
    // `getTopTags` é o nome que a foundation dá ao fetcher de tags (ele chama
    // `client.getTags()` por dentro, cacheado por 10 min). `quantidade` fica de
    // fora de propósito: a query de tags da Unbox não devolve contagem de
    // produtos, e número de produto não se estima.
    if (tipo === "categorias") {
      const tags = await getTopTags();
      const categorias = (tags ?? [])
        .filter((t: any) => t?.isVisible !== false)
        .sort((a: any, b: any) => (a?.position ?? 0) - (b?.position ?? 0))
        .map((t: any) => ({ id: String(t._id ?? ""), nome: t.displayTitle || t.name || "", slug: t.slug ?? "" }))
        .filter((c: { id: string; nome: string }) => c.id && c.nome)
        .slice(0, limite);
      return ok({ categorias }, SEM_CACHE);
    }

    // ── Produtos por ID: quem são os que a vitrine JÁ escolheu ───────────
    // A escolha guarda só o id (e o CÓDIGO da loja guarda o SLUG no fallback da vitrine).
    // Sem este caminho, a lista de escolhidos no painel mostrava o id CRU para todo produto
    // que não estivesse na página de resultados aberta na hora — o lojista lia o slug ao
    // lado do nome do produto, na mesma lista, sem nunca ter escrito slug nenhum.
    //
    // Quem responde é `resolverVitrine`, a MESMA função da vitrine publicada: mesma ordem e a
    // mesma tolerância a id que é productId, `_id` ou slug. `limite: ids.length` porque sem
    // limite ela assume o padrão da vitrine (12) e cortaria a lista do painel. Em modo
    // ESTRITO: aqui uma resposta que não veio (rede, prazo, 5xx) não pode virar "esses produtos
    // sumiram da loja" — o painel marca o ausente em vermelho, e o lojista tiraria da vitrine
    // produto que existe.
    if (ids.length) {
      const produtos = await resolverVitrine({ modo: "produtos", produtos: ids, limite: ids.length }, { estrito: true });
      return ok({ produtos }, SEM_CACHE);
    }

    // ── Produtos: os primeiros da loja, uma busca ou uma categoria ────────
    // SEM `busca` e SEM `tagId` o seletor está ABRINDO a aba de produtos: ele espera
    // os primeiros do catálogo, que é como o lojista acha o que quer sem saber o nome
    // exato. Recusar isso com 400 deixava a aba de produtos vazia na abertura, com uma
    // mensagem de falha, e só funcionando depois de digitar.
    if (tipo === "produtos" || busca || tagId) {
      const catalogo = await getCatalog(
        busca ? { first: limite, searchText: busca } : tagId ? { first: limite, tagIds: [tagId] } : { first: limite },
      );
      const produtos: VitrineProduto[] = [];
      for (const node of catalogo?.nodes ?? []) {
        const p = produtoDaVitrine(node);
        if (p) produtos.push(p);
        if (produtos.length >= limite) break;
      }
      return ok({ produtos }, SEM_CACHE);
    }

    return fail("Diga o que buscar: ?tipo=categorias, ?tipo=produtos, ?busca=<texto> ou ?tagId=<id>.", 400);
  } catch (err) {
    // A mensagem crua pode carregar detalhe do gateway; fica no log do servidor.
    console.warn("[vitrine] catálogo indisponível", err instanceof Error ? err.message : err);
    return fail("Não consegui ler o catálogo da Unbox agora.", 502);
  }
}
