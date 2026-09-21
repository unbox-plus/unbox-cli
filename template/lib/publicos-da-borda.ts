// ═══════════════════════════════════════════════════════════════════════════
// A VERSÃO DA HOME DE CADA PÚBLICO, ESCOLHIDA NA BORDA (foundation 18).
//
// O lojista dá à home uma versão por público (quem busca volume, quem chegou pelo anúncio de inverno). Cada
// versão é OUTRA página pronta em cache (`/_publico/<id>`), e este arquivo só decide qual servir, antes do
// cache: lê o link do anúncio (`?para=`), a campanha (`utm_*`) e o cookie, e pergunta a `decidirPublico`
// (lib/editable/document.ts, pura e testada no runner do editor). Nada de conteúdo é trocado no navegador.
//
// NENHUM PEDIDO ESPERA BUSCA: a lista dos públicos (`GET /api/unbox/publicos`) fica em memória e se renova
// em segundo plano a cada minuto. Instância recém-criada, sem lista, serve Todos enquanto busca. A única
// espera é de quem chega com sinal forte numa instância fria (o clique no anúncio), e ela tem teto curto.
//
// Quem chega sem cookie e sem sinal (a maioria das visitas, o Googlebot, o PageSpeed) recebe exatamente a
// página de hoje.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import {
  CAMPOS_DE_UTM, COOKIE_DE_PUBLICO, DIAS_DA_ESCOLHA, PARAM_DE_PUBLICO, ROTA_DO_PUBLICO, decidirPublico, valorDoCookieDePublico,
  type CampoDeUtm, type PublicosDaBorda,
} from "@/lib/editable/document";

/** quanto tempo a cópia em memória vale antes de a borda buscar de novo (em segundo plano) */
const VALIDADE_DA_COPIA_MS = 60_000;
/** quanto quem chega pelo anúncio numa instância sem cópia espera a lista, no máximo */
const ESPERA_DO_SINAL_FORTE_MS = 400;

let copia: { dados: PublicosDaBorda | null; em: number } | null = null;
let buscando: Promise<void> | null = null;

async function buscarPublicos(origem: string): Promise<void> {
  try {
    const r = await fetch(new URL("/api/unbox/publicos", origem), { headers: { accept: "application/json" }, signal: AbortSignal.timeout(3_000) });
    const dados = r.ok ? ((await r.json()) as PublicosDaBorda) : null;
    // falhou: a cópia que havia continua valendo (a loja não troca de comportamento porque uma busca caiu)
    copia = { dados: dados && Array.isArray(dados.publicos) ? dados : (copia?.dados ?? null), em: Date.now() };
  } catch {
    copia = { dados: copia?.dados ?? null, em: Date.now() };
  } finally {
    buscando = null;
  }
}

/** renova a cópia se ela venceu, sem segurar o pedido (`waitUntil`); devolve a busca em andamento, se houver */
function renovar(origem: string, event?: NextFetchEvent): Promise<void> | null {
  if (buscando) return buscando;
  if (copia && Date.now() - copia.em < VALIDADE_DA_COPIA_MS) return null;
  buscando = buscarPublicos(origem);
  event?.waitUntil(buscando);
  return buscando;
}

/**
 * Este pedido pode ganhar a versão de um público? Todo GET/HEAD da HOME (a fase 1 é a home), nunca na prévia do
 * editor (`unbox_editor`, que escolhe a visão pelo painel) nem numa ação de servidor.
 *
 * TODO GET, e não só a navegação de documento: o App Router pede a home também como RSC (a navegação interna, o
 * prefetch e o `router.refresh()` que o quiz chama depois de gravar a escolha), e sem reescrever esse pedido o
 * quiz gravaria o cookie e a tela continuaria em Todos. E não dá para escolher só o RSC: o Next TIRA do pedido que
 * o middleware enxerga os cabeçalhos do RSC (`rsc`, `next-router-*`) e o parâmetro `_rsc` (medido no Next
 * 15.5: `server/web/adapter.js`), e repassa ele mesmo o `_rsc` para o destino da reescrita.
 */
export function pedidoDePublico(req: NextRequest): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (req.nextUrl.pathname !== "/") return false;
  return !req.nextUrl.searchParams.has("unbox_editor") && !req.headers.has("next-action");
}

/** acesso DIRETO à rota interna (`/_publico/…`) responde 404: ela só existe como destino da reescrita */
export function rotaInternaDoPublico(pathname: string): boolean {
  return pathname === ROTA_DO_PUBLICO || pathname.startsWith(`${ROTA_DO_PUBLICO}/`);
}

function sortear(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % 100;
}

/**
 * O `next()` da loja, com a versão do público quando cabe: reescreve para `/_publico/<id>` (sem a query, que
 * não muda a página e só multiplicaria o cache; o `_rsc` do App Router o próprio Next repassa) e grava a
 * escolha quando o pedido trouxe sinal forte.
 */
export async function seguir(req: NextRequest, event?: NextFetchEvent): Promise<NextResponse> {
  if (!pedidoDePublico(req)) return NextResponse.next();
  const q = req.nextUrl.searchParams;
  const para = q.get(PARAM_DE_PUBLICO);
  const utm = Object.fromEntries(CAMPOS_DE_UTM.map((c) => [c, q.get(`utm_${c}`)])) as Partial<Record<CampoDeUtm, string | null>>;
  const pendente = renovar(req.nextUrl.origin, event);
  if (!copia && pendente && (para || Object.values(utm).some(Boolean))) {
    await Promise.race([pendente, new Promise((r) => setTimeout(r, ESPERA_DO_SINAL_FORTE_MS))]);
  }
  const decisao = decidirPublico({ para, utm, cookie: req.cookies.get(COOKIE_DE_PUBLICO)?.value }, copia?.dados ?? null, sortear);
  let res: NextResponse;
  if (decisao.servir) {
    res = NextResponse.rewrite(new URL(`${ROTA_DO_PUBLICO}/${decisao.servir}`, req.url));
  } else {
    res = NextResponse.next();
  }
  if (decisao.gravar) {
    res.cookies.set(COOKIE_DE_PUBLICO, valorDoCookieDePublico(decisao.gravar), {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: DIAS_DA_ESCOLHA[decisao.gravar.origem] * 86_400,
      // sem httpOnly: a medição (o script do layout) e o quiz leem este cookie no navegador
    });
  }
  return res;
}
