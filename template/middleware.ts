// PORTA DE PREVIEW — trava a loja atrás da tela /acesso enquanto ela não é pública.
//
// ⚠️ ISTO NÃO É SEGURANÇA. É um aviso de "ainda não está pronto": quem preenche o
// formulário entra, e o cookie vale 30 dias.
//
// A porta se ESCOPA PELO DOMÍNIO sozinha: só existe nos hosts de preview
// (*.vercel.app, *.myunbox.com.br e o que PREVIEW_HOSTS acrescentar). Em domínio
// PRÓPRIO da marca — o lançamento de verdade — e no localhost do dev, ela some sem
// precisar mexer em env. Overrides: PREVIEW_DISABLED=1 desliga em qualquer lugar;
// PREVIEW_FORCE=1 liga em qualquer lugar (ex.: testar a porta no localhost).
//
// Time interno não preenche formulário: qualquer URL da loja com ?chave=<senha>
// (a PREVIEW_PASSWORD, padrão "unbox") grava o cookie e segue limpo. Ex.:
//   https://loja.vercel.app/?chave=unbox
//
// O cookie guarda o SHA-256 da chave, nunca a chave em si.
import { NextResponse, type NextRequest } from "next/server";
import { verifyEditorToken } from "@/lib/editable/verify";

const LOJA = "minhaloja"; // o CLI troca pelo slug da loja no scaffold

export const COOKIE = `${LOJA}_preview`;

/** Chave que assina o cookie. Sobrescreva com PREVIEW_PASSWORD na Vercel.
 *  Trocar a chave invalida os acessos já concedidos. */
export function senhaDoPreview() {
  return process.env.PREVIEW_PASSWORD || "unbox";
}

/** SHA-256 em hex via Web Crypto (o middleware roda no edge; sem node:crypto). */
export async function tokenDaSenha(valor: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(valor));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Host de PREVIEW = porta ligada. Domínio próprio da marca/localhost = loja aberta. */
function hostDePreview(hostHeader: string): boolean {
  const h = hostHeader.split(":")[0].toLowerCase();
  const sufixos = [".vercel.app", ".myunbox.com.br"];
  for (const extra of (process.env.PREVIEW_HOSTS ?? "").split(",")) {
    const s = extra.trim().toLowerCase();
    if (s) sufixos.push(s.startsWith(".") ? s : `.${s}`);
  }
  return sufixos.some((s) => h.endsWith(s));
}

// ═══ CONTRATO DA URL DO CHECKOUT — não remova, o build bloqueia sem isto ═══
// A URL do checkout SEMPRE carrega ?id=&token= do carrinho. É o que permite o CRM montar o
// e-mail de carrinho abandonado a partir da URL navegada (pixel/GTM capturam a URL, não o
// cookie) e o link colar o carrinho em outro aparelho. Sem os params, a recuperação de
// carrinho simplesmente não existe pra quem só enxerga a navegação.
//
// POR QUE AQUI, e não só no app/(loja)/checkout/page.tsx (que também tem a guarda):
// o middleware roda em TODA requisição — navegação do servidor, navegação client-side do
// App Router, link direto, refresh, retorno de gateway — e independe de o componente da
// página existir ou de alguém ter lembrado de chamar o helper certo. A regra já se perdeu
// uma vez porque vivia só na aplicação: bastava um caminho novo pro checkout, ou uma
// refatoração da página, pra ela sumir sem nenhum sinal.
//
// Roda ANTES de qualquer coisa da porta de preview, porque vale em todo host — inclusive
// no domínio próprio da marca, onde o resto deste arquivo não faz nada.
const COOKIE_CARRINHO = "unbox_cart";
const COOKIE_FREQ = "unbox_recur_freq";

function urlDoCheckoutComPonteiro(req: NextRequest): NextResponse | null {
  if (req.nextUrl.pathname !== "/checkout") return null;
  const q = req.nextUrl.searchParams;
  if (q.get("id") && q.get("token")) return null; // já está completa

  const bruto = req.cookies.get(COOKIE_CARRINHO)?.value;
  if (!bruto) return null; // sem carrinho não há o que recuperar
  let ref: { cartId?: string; cartToken?: string };
  try { ref = JSON.parse(bruto); } catch { return null; }
  if (!ref.cartId || !ref.cartToken) return null;

  const url = req.nextUrl.clone();
  url.searchParams.set("id", ref.cartId);
  url.searchParams.set("token", ref.cartToken);
  const freq = req.cookies.get(COOKIE_FREQ)?.value;
  if (freq && !url.searchParams.get("freq")) url.searchParams.set("freq", freq);
  if (!url.searchParams.get("step")) url.searchParams.set("step", "1");
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const comPonteiro = urlDoCheckoutComPonteiro(req);
  if (comPonteiro) return comPonteiro;

  if (process.env.PREVIEW_DISABLED === "1") return NextResponse.next();
  if (process.env.PREVIEW_FORCE !== "1" && !hostDePreview(req.headers.get("host") ?? "")) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  // Enquanto a porta estiver de pé, NADA pode ir pra cache compartilhado: a resposta
  // depende do cookie. Sem isso a CDN serve o redirect pra quem já entrou (ou a loja
  // pra quem não entrou) — é o sintoma de "preenchi e não foi".
  const semCache = (res: NextResponse) => {
    res.headers.set("Cache-Control", "private, no-store, must-revalidate");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  };

  // A própria porta e o endpoint do lead passam (senão vira loop de redirect),
  // mas COM noindex: tela de acesso não aparece em buscador.
  if (pathname === "/acesso" || pathname === "/api/acesso") return semCache(NextResponse.next());

  // Rotas chamadas por SERVIDOR ficam de fora — máquina não preenche formulário.
  // (Cada uma já tem sua própria proteção: HMAC no webhook, secret ou JWT do editor no revalidate.)
  // /api/revalidate: quem chama é também o EDITOR da Unbox (servidor), com JWT próprio; atrás da
  // porta ele levava 307 para /acesso e a revalidação nunca acontecia.
  // /api/unbox/catalogo: é o SELETOR de vitrine do editor pedindo categorias e produtos, servidor a
  // servidor, com o mesmo JWT (purpose "catalogo"). Atrás da porta o lojista veria um seletor vazio.
  // A rota valida o token por conta própria e é só leitura.
  // /api/unbox/paginas: é a loja dizendo quais páginas ela tem, informação que o sitemap já publica.
  // Quem pergunta é o editor (servidor, para o seletor de página e a revalidação) e o gate de
  // cobertura, nenhum dos dois com cookie da porta. A rota é pública por contrato e só lê.
  // (/api/unbox/vitrine NÃO entra aqui: quem a chama é a própria página da loja, dentro do iframe do
  // editor, e ela já carrega o cookie que o token de prévia grava logo abaixo.)
  if (
    pathname === "/api/webhooks/unbox" ||
    pathname === "/api/revalidate" ||
    pathname === "/api/unbox/catalogo" ||
    pathname === "/api/unbox/paginas"
  ) return NextResponse.next();

  // PRÉVIA DO EDITOR DA UNBOX: a loja abre dentro do iframe do editor com um token assinado por ele
  // (ES256; a loja só busca a chave pública no JWKS do editor, não guarda segredo nenhum). Token
  // válido passa pela porta e recebe o cookie dela, para a navegação interna da prévia também passar.
  // `sameSite: "none"` + `secure` de propósito: dentro de um iframe de OUTRA origem, cookie `lax`
  // não viaja, e cada clique na prévia cairia de novo na porta. Sem EDITOR_URL, nunca valida.
  const tokenDoEditor = req.nextUrl.searchParams.get("unbox_editor_token");
  if (tokenDoEditor && (await verifyEditorToken(tokenDoEditor, "preview"))) {
    const res = semCache(NextResponse.next());
    res.cookies.set(COOKIE, await tokenDaSenha(senhaDoPreview()), { path: "/", httpOnly: true, sameSite: "none", secure: true, maxAge: 60 * 60 * 8 });
    return res;
  }

  // CHAVE DO TIME: ?chave=<senha> em qualquer URL grava o cookie e redireciona pra
  // mesma página sem o parâmetro (a chave não fica no histórico/URL compartilhada).
  // É o atalho interno; lead de verdade continua entrando pelo formulário.
  const chave = req.nextUrl.searchParams.get("chave");
  if (chave && chave === senhaDoPreview()) {
    const url = req.nextUrl.clone();
    url.searchParams.delete("chave");
    const res = NextResponse.redirect(url);
    res.cookies.set(COOKIE, await tokenDaSenha(senhaDoPreview()), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return semCache(res);
  }

  const esperado = await tokenDaSenha(senhaDoPreview());
  if (req.cookies.get(COOKIE)?.value === esperado) {
    return semCache(NextResponse.next());
  }

  const url = req.nextUrl.clone();
  url.pathname = "/acesso";
  // Limpa a query antes de montar a da porta: o destino inteiro (com sua própria query) vai
  // no "de", e herdar os params da página de origem só duplicaria dado na URL da porta — no
  // caso do checkout, duplicaria o token do carrinho, que não tem o que fazer aqui.
  url.search = "";
  // Guarda pra onde a pessoa queria ir, pra devolver depois de entrar.
  url.searchParams.set("de", pathname + req.nextUrl.search);
  return semCache(NextResponse.redirect(url));
}

export const config = {
  // Deixa passar o que a PRÓPRIA tela de acesso precisa pra renderizar: assets do
  // Next, /brand (logo), /unbox (selo) e os ícones da aba.
  matcher: ["/((?!_next/static|_next/image|brand/|unbox/|favicon.ico|icon.svg|apple-icon.svg|manifest.webmanifest).*)"],
};
