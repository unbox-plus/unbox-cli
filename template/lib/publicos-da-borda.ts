// ═══════════════════════════════════════════════════════════════════════════
// A VERSÃO DE CADA PÚBLICO, ESCOLHIDA NA BORDA (foundation 18).
//
// O lojista dá à home, à oferta e às páginas avulsas uma versão por público (quem busca volume, quem chegou pelo
// anúncio de inverno). Cada versão é OUTRA página pronta em cache (`/_publico/<id>`, `/_publico/<id>/oferta`,
// `/_publico/<id>/paginas/<endereço>`), e este arquivo só decide qual servir, antes do cache: lê o link do
// anúncio (`?para=`), a campanha (`utm_*`), o cookie, a página feita para um público (quem a abre entra nele), o
// site de onde a pessoa veio (`referer`) e a região dela (cabeçalhos da Vercel), e pergunta a `decidirPublico`
// (lib/editable/document.ts, pura e testada no runner do editor). Nada de conteúdo é trocado no navegador. A
// conta do cliente entra por outro caminho: o login (`lib/publico-do-cliente.ts`).
//
// Uma LP só vai para a versão do público quando ele TEM versão nela (`versoes` na lista): sem isso, cada página
// teria uma cópia em cache por público igual à de Todos. A home vai sempre, como na fase 1.
//
// NENHUM PEDIDO ESPERA BUSCA: a lista dos públicos (`GET /api/unbox/publicos`) fica em memória e se renova
// em segundo plano a cada minuto. Instância recém-criada, sem lista, serve Todos enquanto busca. A única
// espera, com teto curto, é numa instância fria de quem chega com sinal forte (o clique no anúncio), com uma
// escolha já gravada ou numa página avulsa (que pode ser a de um público): sem ela, quem volta com o cookie veria
// Todos na primeira página e a versão na seguinte.
//
// Quem chega sem cookie e sem sinal (a maioria das visitas, o Googlebot, o PageSpeed) recebe exatamente a
// página de hoje.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import {
  CAMPOS_DE_UTM, COOKIE_DE_PUBLICO, DIAS_DA_ESCOLHA, PARAM_DE_PUBLICO, ROTA_DO_PUBLICO, containerVaria, decidirPublico, handleValido, lerCookieDePublico, valorDoCookieDePublico,
  type CampoDeUtm, type PublicosDaBorda,
} from "@/lib/editable/document";
// os dois só têm constante e tipo (nada de `fs`): cabem no edge, onde o middleware roda
import { DECLARACAO_DA_PERSONALIZACAO } from "@/lib/personalizacao";
import { PREFIXO_DE_PAGINAS } from "@/lib/paginas-do-lojista";

/** quanto tempo a cópia em memória vale antes de a borda buscar de novo (em segundo plano) */
const VALIDADE_DA_COPIA_MS = 60_000;
/** quanto quem chega pelo anúncio (ou com escolha gravada, ou numa página avulsa) numa instância sem cópia espera a lista, no máximo */
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
 * O CONTAINER DA PÁGINA PEDIDA, quando ela tem versão por público: `/` → `home`, `/oferta` → `oferta`,
 * `/paginas/<endereço>` → `pagina-<endereço>`. É o par de `DECLARACAO_DA_PERSONALIZACAO` do lado da borda: a página
 * cujo container a loja não declara não tem versão, e aqui responde null. Mora aqui, e não em lib/rotas-editaveis.ts,
 * porque aquela lê o disco e o middleware roda no edge. Cada container daqui tem a sua rota do público.
 */
export function containerDoPedido(pathname: string): string | null {
  let container: string | null = null;
  if (pathname === "/") container = "home";
  else if (pathname === "/oferta") container = "oferta";
  else if (pathname.startsWith(`${PREFIXO_DE_PAGINAS}/`)) {
    const handle = pathname.slice(PREFIXO_DE_PAGINAS.length + 1);
    // o endereço de uma página avulsa pela régua do editor (minúsculas, dígitos e hífen, um segmento só)
    if (handleValido(handle)) container = `pagina-${handle}`;
  }
  return container && containerVaria(container, DECLARACAO_DA_PERSONALIZACAO.containers) ? container : null;
}

/**
 * O pedido é a NAVEGAÇÃO de um documento (o anúncio, o link colado, o recarregar)? O RSC da navegação interna e o
 * prefetch do `<Link>` chegam como `fetch` (`sec-fetch-dest: empty`), e o prefetch acontece sem ninguém clicar: a
 * página feita para um público não pode pôr no público quem só passou o mouse pelo link. O Next tira os cabeçalhos
 * do RSC do que o middleware vê, mas não os `sec-fetch-*` do navegador. Sem o cabeçalho (robô, navegador antigo),
 * vale como navegação.
 */
export function navegacaoDeDocumento(req: NextRequest): boolean {
  const destino = req.headers.get("sec-fetch-dest");
  return destino === null || destino === "document";
}

/**
 * Este pedido pode ganhar a versão de um público? Todo GET/HEAD da home, da oferta e das páginas avulsas (as que
 * `containerDoPedido` conhece), nunca na prévia do editor (`unbox_editor`, que escolhe a visão pelo painel) nem
 * numa ação de servidor.
 *
 * TODO GET, e não só a navegação de documento: o App Router pede a home também como RSC (a navegação interna, o
 * prefetch e o `router.refresh()` que o quiz chama depois de gravar a escolha), e sem reescrever esse pedido o
 * quiz gravaria o cookie e a tela continuaria em Todos. E não dá para escolher só o RSC: o Next TIRA do pedido que
 * o middleware enxerga os cabeçalhos do RSC (`rsc`, `next-router-*`) e o parâmetro `_rsc` (medido no Next
 * 15.5: `server/web/adapter.js`), e repassa ele mesmo o `_rsc` para o destino da reescrita.
 */
export function pedidoDePublico(req: NextRequest): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (!containerDoPedido(req.nextUrl.pathname)) return false;
  return !req.nextUrl.searchParams.has("unbox_editor") && !req.headers.has("next-action");
}

/** a rota do público para a página pedida: `/` → `/_publico/<id>`, `/oferta` → `/_publico/<id>/oferta` */
export function rotaDoPublicoPara(pathname: string, publico: string): string {
  return `${ROTA_DO_PUBLICO}/${publico}${pathname === "/" ? "" : pathname}`;
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

/** a cidade vem codificada no cabeçalho (`S%C3%A3o%20Paulo`); codificação quebrada vale como "sem cidade" */
function decodificar(v: string | null): string | null {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return null;
  }
}

/**
 * O `next()` da loja, com a versão do público quando cabe: reescreve para a rota do público (sem a query, que
 * não muda a página e só multiplicaria o cache; o `_rsc` do App Router o próprio Next repassa) e grava a
 * escolha quando o pedido trouxe sinal forte.
 */
export async function seguir(req: NextRequest, event?: NextFetchEvent): Promise<NextResponse> {
  const container = containerDoPedido(req.nextUrl.pathname);
  if (!container || !pedidoDePublico(req)) return NextResponse.next();
  const q = req.nextUrl.searchParams;
  const para = q.get(PARAM_DE_PUBLICO);
  const utm = Object.fromEntries(CAMPOS_DE_UTM.map((c) => [c, q.get(`utm_${c}`)])) as Partial<Record<CampoDeUtm, string | null>>;
  const pendente = renovar(req.nextUrl.origin, event);
  const gravado = lerCookieDePublico(req.cookies.get(COOKIE_DE_PUBLICO)?.value);
  const temEscolha = gravado !== null && gravado.origem !== "recusa";
  // a página avulsa espera também: ela pode ser a de um público (e isso só a lista sabe), e quem chega pelo anúncio
  // dela numa instância fria entraria na loja fora do público
  if (!copia && pendente && (para || Object.values(utm).some(Boolean) || temEscolha || container.startsWith("pagina-"))) {
    await Promise.race([pendente, new Promise((r) => setTimeout(r, ESPERA_DO_SINAL_FORTE_MS))]);
  }
  const decisao = decidirPublico(
    {
      para,
      utm,
      cookie: req.cookies.get(COOKIE_DE_PUBLICO)?.value,
      container,
      navegacao: navegacaoDeDocumento(req),
      // os sinais FRACOS: o site de onde a pessoa veio (referer de outro host) e onde ela está, pelos cabeçalhos
      // que a Vercel põe em todo pedido (fora dela eles não vêm, e a região simplesmente não casa)
      referer: req.headers.get("referer"),
      host: req.nextUrl.hostname,
      regiao: {
        pais: req.headers.get("x-vercel-ip-country"),
        uf: req.headers.get("x-vercel-ip-country-region"),
        cidade: decodificar(req.headers.get("x-vercel-ip-city")),
      },
    },
    copia?.dados ?? null,
    sortear,
  );
  let res: NextResponse;
  if (decisao.servir) {
    res = NextResponse.rewrite(new URL(rotaDoPublicoPara(req.nextUrl.pathname, decisao.servir), req.url));
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
