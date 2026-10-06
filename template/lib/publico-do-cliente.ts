// ═══════════════════════════════════════════════════════════════════════════
// O PÚBLICO DO CLIENTE LOGADO, CONFERIDO NO LOGIN (foundation 18).
//
// A regra de cliente (comprou tal produto, tem assinatura ativa, tem endereço em tal estado) é o único sinal
// que a borda não vê, porque depende da conta. Quem o confere é o LOGIN, uma vez, no servidor: lê as regras do
// documento publicado (elas não saem na lista pública da borda), consulta a conta com teto de tempo e grava o
// cookie do público na mesma resposta. Dali em diante é a borda de sempre: a home seguinte já vem na versão.
//
// Nunca atrasa nem derruba o login: sem regra de cliente, não consulta nada; passou do teto, segue sem
// público; erro vai para o log. Público tirado de compra é perfilamento: a página de privacidade explica e
// oferece a loja padrão, e quem a pediu continua nela (`escolhaDoLogin`).
// ═══════════════════════════════════════════════════════════════════════════
import "server-only";
import { cookies } from "next/headers";
import {
  COOKIE_DE_PUBLICO, DIAS_DA_ESCOLHA, escolhaDoLogin, publicoDoCliente, temRegraDeCliente, valorDoCookieDePublico,
  type ContentDocument, type CookieDePublico, type DadosDoCliente,
} from "@/lib/editable/document";
import { getPublishedContent } from "@/lib/editable/server";
import { getCustomerClientFor } from "@/lib/unbox";

/** o máximo que o login espera pela conta: a personalização nunca pode ser o motivo de um login lento */
export const TETO_DO_PUBLICO_NO_LOGIN_MS = 800;

/** Chamar DEPOIS de gravar o token do cliente, na rota do login. Não lança. */
export async function publicoNoLogin(customerToken: string): Promise<void> {
  try {
    const jar = await cookies();
    const escolha = await comTeto(escolhaDaConta(customerToken, jar.get(COOKIE_DE_PUBLICO)?.value), TETO_DO_PUBLICO_NO_LOGIN_MS);
    if (!escolha) return;
    jar.set(COOKIE_DE_PUBLICO, valorDoCookieDePublico(escolha), {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: DIAS_DA_ESCOLHA.cliente * 86_400,
      // sem httpOnly, como o da borda: a medição e o quiz leem este cookie no navegador
    });
  } catch (e) {
    registrar("login", e);
  }
}

async function escolhaDaConta(token: string, cookie: string | undefined): Promise<CookieDePublico | null> {
  const doc = await getPublishedContent();
  if (!temRegraDeCliente(doc)) return null;
  return escolhaDoLogin(publicoDoCliente(await dadosDaConta(token, doc), doc), cookie, sortear);
}

/** nenhum sinal: o login segue sem público, que é o pior caso previsto */
const SEM_DADOS: DadosDoCliente = { produtos: [], assinante: false, ufs: [] };

/** só o que as regras da loja perguntam: sem regra de compra, nenhum pedido é lido (e assim por diante) */
async function dadosDaConta(token: string, doc: ContentDocument | null): Promise<DadosDoCliente> {
  const regras = Object.values(doc?.publicos ?? {}).flatMap((p) => p.entrada?.cliente ?? []);
  const pede = (tipo: string) => regras.some((r) => r.tipo === tipo);
  const c = await getCustomerClientFor(token);
  if (!c) return SEM_DADOS;
  const [produtos, assinaturas, conta] = await Promise.all([
    pede("comprou") ? c.purchasedProducts().catch((e) => (registrar("pedidos", e), [] as string[])) : ([] as string[]),
    pede("assinante") ? c.subscriptions({ first: 1, status: ["ACTIVE"] }).catch((e) => (registrar("assinaturas", e), null)) : null,
    pede("uf") ? c.me().catch((e) => (registrar("conta", e), null)) : null,
  ]);
  const regioes: unknown[] = [...(conta?.addressBooks ?? []).map((a: { region?: unknown }) => a?.region), conta?.lastAddressUsed?.region];
  return {
    produtos,
    assinante: Number(assinaturas?.totalCount ?? assinaturas?.nodes?.length ?? 0) > 0,
    ufs: regioes.filter((u): u is string => typeof u === "string" && /^[A-Za-z]{2}$/.test(u.trim())),
  };
}

/** a promessa, ou null se ela passar do teto (e o relógio é desligado quando ela chega antes) */
async function comTeto<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([p, new Promise<null>((r) => { relogio = setTimeout(() => r(null), ms); })]);
  } finally {
    clearTimeout(relogio);
  }
}

function sortear(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % 100;
}

function registrar(etapa: string, e: unknown): void {
  console.error(JSON.stringify({ tag: "[publico-no-login]", etapa, erro: (e instanceof Error ? e.message : String(e)).slice(0, 300), quando: new Date().toISOString() }));
}
