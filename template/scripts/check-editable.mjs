#!/usr/bin/env node
// GATE DE COBERTURA EDITÁVEL — o que a LOJA mostra e o lojista NÃO consegue editar.
//
// Mede TODAS as páginas que a loja declara em `GET /api/unbox/paginas`, não só a home. Antes media
// uma página só, a do `--url`: uma loja com /sobre inteira fora dos primitivos passava com 95%,
// porque ninguém tinha olhado o /sobre. Gate que não olha aprova sem ter olhado.
//
// De cada página abre a loja em modo edição (?unbox_editor=1), espera o manifesto dos primitivos e
// mede: de todo texto visível e toda imagem, quanto está dentro de um `[data-editor-path]`. Lista o
// que ficou de fora, com trecho, DIZENDO EM QUE PÁGINA. E lê do manifesto de cada página os dois
// defeitos de construção que a cobertura sozinha não pega: seção sem `kind`/`label` (o painel
// mostraria id de código ao lojista) e editável FORA de container (primitivo bom, página que ninguém
// declarou: ele NÃO é editável, e a loja o denuncia em `manifest.semContainer`).
//
// A loja também diz quais páginas são SÓ CABEÇALHO E RODAPÉ POR REGRA (`soChrome: true` na lista; README
// §8: texto legal, rótulo de formulário/UI e mecânica de compra não viram primitivo). /termos, /privacidade,
// /devolucoes e /busca medem 22% a 65% POR DESENHO, e um gate que as reprova para sempre é um gate que
// ninguém lê. Nelas a régua de --minimo não vale: a cobertura é impressa, não julgada. O resto vale igual
// (zero editável fora de container, zero seção sem tipo/rótulo, manifesto tem de chegar). O gate NÃO infere
// isso do conteúdo: é a loja que declara, em lib/rotas-editaveis.ts (SO_CHROME), com o motivo ao lado;
// página que ela não marcou é página comum.
//
// E a loja DECLARA OS CONTAINERS DE CADA ROTA (`containers` na lista; tabela CONTAINERS_POR_ROTA em
// lib/rotas-editaveis.ts): é com isso que o editor avisa "isto também aparece em «Categoria»" antes de alguém
// abrir /categoria, e que a publicação alcança a página certa na primeira sessão. Uma tabela digitada envelhece
// em silêncio, então o gate CONFERE: os containers que o manifesto de cada página mostrou (fora o `chrome`, que é
// do site inteiro) têm de ser exatamente os declarados. Container que aparece sem estar declarado, container
// declarado que não aparece, ou rota que a loja lista sem declarar nada: REPROVADO, dizendo a rota e o container.
//
// PÁGINAS DO LOJISTA (foundation 13). As páginas que o dono da loja cria pelo editor (`/paginas/<endereço>`,
// `/<coleção>`, `/<coleção>/<artigo>`) são renderizadas por MOLDES (a casca) em rotas que a loja marca com
// `doLojista: true`, e os containers delas nascem do documento, com prefixo reservado (`pagina-<x>`,
// `artigo-<c>-<x>`, `colecao-<c>`). Três coisas mudam no gate por causa disso: (1) a declaração dessas rotas
// é por CURINGA (`containers: ["pagina-*"]`), e um curinga casa todo observado com aquele prefixo; (2) um molde
// sem página publicada (`caminho: null` numa rota `doLojista`) é "molde não medido: nenhuma página publicada",
// e NÃO é NÃO RODOU: a loja declarou o molde e não há o que abrir, o que é diferente de um catálogo que não
// respondeu. Quando há uma página publicada, a casca é medida por ela, como qualquer rota dinâmica; (3) uma
// rota do CÓDIGO (sem `doLojista`) cujo manifesto mostra container com prefixo reservado é REPROVADA: o
// código está usando um prefixo reservado às páginas do lojista, e a loja leria essa seção como página dele.
// Os prefixos vêm do document.ts da própria loja (`PREFIXOS_DO_LOJISTA`), como o vocabulário de `kind`.
//
// O PAR DO CORTE DO DOCUMENTO. O layout raiz entrega ao provider o documento SEM as páginas do lojista
// (`documentoSemPaginas`), e quem renderiza uma dessas páginas devolve a fatia dela (`<EditableFatia>`). As
// duas metades são um par, e a meia-adoção é CALADA: 200, sem erro, sem log, com o `<head>` ainda cheio do
// texto do lojista e o corpo caído no literal do código. Nenhuma outra medida deste gate a pega. Então, quando
// o layout corta, o gate confere no CÓDIGO-FONTE que toda rota de molde do lojista (`ROTAS_DO_LOJISTA` em
// lib/rotas-editaveis.ts, mais o que a loja declarou com `doLojista`) chega a um `<EditableFatia>` seguindo os
// imports da própria loja a partir do `page.tsx`. Sem isso: REPROVADO. Loja cujo layout ainda manda o documento
// inteiro não tem par a cumprir, e isso é conferido, não pulado.
//
// Saída: 0 = toda página >= --minimo (default 0.8), fora as que a loja declarou só cabeçalho e rodapé
// por regra, nenhuma seção sem kind/label, nenhum editável fora de container, a declaração de containers
// batendo em toda página, nenhum container do código com prefixo reservado ao lojista e o par do corte do
// documento fechando em toda rota do lojista · 1 = REPROVADO
// (alguma página comum abaixo do mínimo, seção sem tipo/rótulo, editável fora de container, declaração de
// containers divergente, prefixo reservado em rota do código, ou rota do lojista sem a fatia do documento;
// o relatório diz QUAL página) · 2 = NÃO RODOU (servidor fora, lista de páginas indisponível, rota declarada
// sem exemplo para abrir, página sem provider, manifesto que nunca chegou, ou o par do corte não conferido
// porque a raiz da loja não foi achada). Molde do lojista sem página publicada NÃO conta para o 2: é impresso
// como não medido. Doutrina da casa: gate que varre o vazio e diz "limpo" aprova sem ter olhado.
//
// Uso: node scripts/check-editable.mjs --url http://localhost:3000 [--minimo 0.8] [--json saida.json]
//      node scripts/check-editable.mjs --url http://localhost:3000/sobre
//        (`--url` com caminho mede SÓ aquela página: é a rodada de uma página, para quem está
//         consertando uma rota e não quer esperar as outras.)
//      node scripts/check-editable.mjs --url http://localhost:3000 --paginas /,/sobre,/produtos
//        (`--paginas` é para a loja que ainda não tem /api/unbox/paginas; é uma lista digitada à
//         mão, e o relatório diz isso.)
//      node scripts/check-editable.mjs --url http://localhost:3000/blog/um-artigo
//        (uma página do lojista: a declaração da rota dela é achada pelo padrão, `/[colecao]/[handle]`.)
import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1] ?? "1"] : [])).filter((p) => p.length));
const URL_ = args.url ?? "http://localhost:3000";
const MINIMO = Number(args.minimo ?? 0.8);
const ALVO = new URL(URL_);
const ORIGEM = ALVO.origin;

function carregarPlaywright() {
  const req = createRequire(import.meta.url);
  const candidatos = [process.cwd(), path.dirname(new URL(import.meta.url).pathname), process.env.UNBOX_RUNNER_SCRIPTS ?? ""].filter(Boolean);
  for (const base of candidatos) {
    try {
      return createRequire(path.join(base, "package.json"))("playwright-core");
    } catch {}
  }
  try { return req("playwright-core"); } catch {}
  return null;
}

const pw = carregarPlaywright();
if (!pw) {
  console.error("[check-editable] playwright-core não encontrado (npm i -D playwright-core). NÃO RODOU.");
  process.exit(2);
}

// ── A LISTA DE PÁGINAS ─────────────────────────────────────────────────────────────────────────
// Quem sabe quais páginas a loja tem é a loja (app/api/unbox/paginas/route.ts, contrato no README
// §9). Rota dinâmica entra UMA vez, pelo exemplo concreto que ela devolve — medir 24 produtos é
// medir a mesma receita 24 vezes. Rota declarada SEM exemplo (catálogo vazio, sem credenciais, ou
// fora do ar) não tem como ser medida, e isso é NÃO RODOU: ela não conta como aprovada. A exceção é o
// molde das páginas do lojista (`doLojista: true`) sem página publicada: não há o que abrir, e não é falha.
// E a loja também diz quais páginas são SÓ CABEÇALHO E RODAPÉ POR REGRA (`soChrome: true`; README §8).
const CAMINHO = /^\/(?![/\\])[^\\\s]*$/;
/** a entrada como a loja a declara; `soChrome` e `doLojista` só contam quando são o `true` literal (é a loja que
 *  decide, e só ela); `containers` só existe quando a loja mandou uma lista (ausente = a loja não declarou, e isso reprova) */
const declaradaPelaLoja = (p) => ({
  rota: p.rota,
  caminho: p.caminho,
  label: p.label,
  soChrome: p.soChrome === true,
  // a rota é um MOLDE das páginas que o lojista cria (foundation 13): os containers dela são do documento
  doLojista: p.doLojista === true,
  ...(Array.isArray(p.containers) ? { containers: p.containers.filter((c) => typeof c === "string") } : {}),
});

/**
 * Um caminho concreto cai nesta rota? `/produto/[productSlug]` casa `/produto/x`; `/[colecao]/[handle]` casa
 * `/blog/x`; `[...resto]` e `[[...resto]]` casam o que sobrar. É o que deixa a rodada de UMA página
 * (`--url .../blog/x`) achar a declaração da rota dela mesmo quando o exemplo que a loja devolveu é outro,
 * ou nenhum (molde sem página publicada). Igualdade exata continua vindo antes, em quem chama.
 */
function casaRota(rota, caminho) {
  const r = rota.split("/").filter(Boolean);
  const c = caminho.split("/").filter(Boolean);
  for (let i = 0; i < r.length; i++) {
    const seg = r[i];
    if (/^\[\[?\.\.\./.test(seg)) return true; // o resto é livre
    if (i >= c.length) return false;
    if (/^\[.+\]$/.test(seg)) continue; // um segmento qualquer
    if (seg !== c[i]) return false;
  }
  return r.length === c.length;
}
/** quantos segmentos LITERAIS a rota tem: entre `/[colecao]` e `/produto/[slug]`, a mais específica ganha */
const literais = (rota) => rota.split("/").filter((x) => x && !x.startsWith("[")).length;

async function listaDaLoja() {
  let res;
  try {
    res = await fetch(`${ORIGEM}/api/unbox/paginas`, { signal: AbortSignal.timeout(10_000), headers: { accept: "application/json" } });
  } catch (e) {
    return { erro: `não consegui perguntar à loja quais páginas ela tem (${ORIGEM}/api/unbox/paginas): ${e?.message ?? e}` };
  }
  if (!res.ok) {
    return { erro: `${ORIGEM}/api/unbox/paginas respondeu ${res.status}. Instale a rota na loja (ela deriva as páginas de app/(loja)/ e do DISALLOW do robots) ou passe --paginas /,/sobre,…` };
  }
  const corpo = await res.json().catch(() => null);
  const lista = Array.isArray(corpo?.paginas) ? corpo.paginas : null;
  if (!lista?.length) return { erro: `${ORIGEM}/api/unbox/paginas respondeu sem lista de páginas.` };
  return { lista: lista.filter((p) => typeof p?.rota === "string").map(declaradaPelaLoja) };
}

async function descobrirPaginas() {
  if (args.paginas) {
    const lista = String(args.paginas).split(",").map((s) => s.trim()).filter(Boolean);
    if (!lista.length) return { erro: "--paginas veio vazio." };
    const ruins = lista.filter((p) => !CAMINHO.test(p));
    if (ruins.length) return { erro: `--paginas só aceita caminhos absolutos desta loja (começando com "/"): ${ruins.join(", ")}` };
    // lista digitada: a loja não foi ouvida, então nenhuma página conta como só cabeçalho e rodapé por regra,
    // e a declaração de containers não tem como ser conferida
    return { paginas: lista.map((p) => ({ rota: p, caminho: p, label: p, soChrome: false, doLojista: false, semDeclaracaoPorque: "a loja não foi consultada (--paginas)" })), fonte: "--paginas (lista digitada à mão; a loja não foi consultada, e nenhuma página conta como só cabeçalho e rodapé por regra)", semExemplo: [], moldesNaoMedidos: [] };
  }
  if (ALVO.pathname !== "/") {
    const p = ALVO.pathname;
    // A rodada de uma página só AINDA pergunta à loja se essa página é só cabeçalho e rodapé por regra: sem
    // isso, /termos sozinha reprovaria aqui e passaria na rodada completa, e o gate diria duas coisas. Se a
    // loja não responder a lista, a página é medida como comum, e o relatório diz que a loja não foi ouvida.
    const declarada = await listaDaLoja();
    const porPadrao = declarada.lista ? [...declarada.lista].filter((x) => casaRota(x.rota, p)).sort((a, b) => literais(b.rota) - literais(a.rota))[0] : undefined;
    const marcada = declarada.lista?.find((x) => x.caminho === p || x.rota === p) ?? porPadrao;
    const fonte = declarada.lista
      ? "o caminho do --url (uma página só; sem caminho, mede todas as que a loja declara)"
      : "o caminho do --url (uma página só; a loja não respondeu a lista, então esta página conta como comum)";
    // a declaração de containers só é conferível quando a loja respondeu E lista esta página
    const semDeclaracaoPorque = !declarada.lista ? "a loja não respondeu a lista" : !marcada ? "a loja não lista esta página em /api/unbox/paginas" : undefined;
    return {
      paginas: [{ rota: marcada?.rota ?? p, caminho: p, label: marcada?.label ?? p, soChrome: Boolean(marcada?.soChrome), doLojista: Boolean(marcada?.doLojista), ...(marcada?.containers ? { containers: marcada.containers } : {}), ...(semDeclaracaoPorque ? { semDeclaracaoPorque } : {}) }],
      fonte,
      semExemplo: [],
      moldesNaoMedidos: [],
    };
  }
  const declarada = await listaDaLoja();
  if (declarada.erro) return declarada;
  const temCaminho = (p) => typeof p.caminho === "string" && CAMINHO.test(p.caminho);
  const comExemplo = declarada.lista.filter(temCaminho);
  // MOLDE DO LOJISTA SEM PÁGINA PUBLICADA (foundation 13): a rota existe, a casca existe, e não há página
  // visível no publicado para abri-la. Não é o catálogo que não respondeu: é uma loja em que o dono ainda não
  // criou página nenhuma (ou não publicou). Fica impresso como "molde não medido", fora do NÃO RODOU. A casca
  // é medida no dia em que houver uma página publicada, por ela, como qualquer rota dinâmica.
  const moldesNaoMedidos = declarada.lista.filter((p) => !temCaminho(p) && p.doLojista).map((p) => p.rota);
  const semExemplo = declarada.lista.filter((p) => !temCaminho(p) && !p.doLojista).map((p) => p.rota);
  if (!comExemplo.length) return { erro: `${ORIGEM}/api/unbox/paginas não trouxe nenhuma página com caminho para abrir.` };
  return { paginas: comExemplo, fonte: "a própria loja (/api/unbox/paginas)", semExemplo, moldesNaoMedidos };
}

const achado = await descobrirPaginas();
if (achado.erro) {
  console.error(`[check-editable] ${achado.erro} NÃO RODOU.`);
  process.exit(2);
}

// ── A MEDIÇÃO, PÁGINA A PÁGINA ─────────────────────────────────────────────────────────────────
const browser = await pw.chromium.launch({ channel: "chrome", headless: true }).catch(async () => pw.chromium.launch({ headless: true }));

async function medir(caminho) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let manifest = null;
  await page.exposeFunction("__unboxManifest", (m) => { manifest = m; });
  await page.addInitScript(() => {
    // o provider fala com window.parent; aqui não há pai, então interceptamos o postMessage do próprio window
    const orig = window.postMessage.bind(window);
    Object.defineProperty(window, "parent", { get: () => ({ postMessage: (m) => { if (m && m.type === "unbox-editor:manifest") window.__unboxManifest(m.manifest); } }) });
    void orig;
  });
  const u = new URL(caminho, ORIGEM);
  u.searchParams.set("unbox_editor", "1");
  const res = await page.goto(u.toString(), { waitUntil: "load", timeout: 60_000 }).catch((e) => ({ erro: e }));
  if (!res || res.erro || (res.status && res.status() >= 400)) {
    await page.close();
    return { naoRodou: `não abriu ${u}: ${res?.erro?.message ?? res?.status?.()}` };
  }
  // porta /acesso no caminho? então o gate não viu a loja
  if (page.url().includes("/acesso")) {
    await page.close();
    return { naoRodou: `${caminho} caiu na porta /acesso; rode com PREVIEW_DISABLED=1 ou passe o token` };
  }
  for (let i = 0; i < 40 && !manifest; i++) await page.waitForTimeout(250);
  if (!manifest) {
    await page.close();
    return { naoRodou: `${caminho} nunca publicou manifesto (EditableProvider ausente nesta rota, sem ?unbox_editor, ou NEXT_PUBLIC_EDITOR_ORIGIN vazio no env da loja; o modo edição exige a origem do editor)` };
  }
  const medido = await page.evaluate(() => {
    const ignorar = (el) => {
      if (!el) return true;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return true;
      if (el.closest("script,style,noscript,template,[aria-hidden='true'],.sr-only,[data-editor-ignore],[data-nosnippet],dialog,[role='dialog'],nav [role='menu']")) return true;
      return false;
    };
    const dentro = (el) => Boolean(el.closest("[data-editor-path]"));
    const textos = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = n.textContent.replace(/\s+/g, " ").trim();
      if (t.length < 3) continue;
      const el = n.parentElement;
      if (ignorar(el)) continue;
      // preço, número puro e rótulo de formulário não são copy do lojista
      if (/^(R\$\s?)?[\d.,%\s]+$/.test(t)) continue;
      if (el.closest("input,select,textarea,button[type='submit'],form label")) continue;
      textos.push({ texto: t.slice(0, 80), tag: el.tagName.toLowerCase(), ok: dentro(el), secao: el.closest("[data-editor-section]")?.dataset.editorSection ?? null });
    }
    const imagens = [...document.querySelectorAll("img,video,picture source")].filter((el) => !ignorar(el)).map((el) => ({
      src: (el.currentSrc || el.getAttribute("src") || el.getAttribute("srcset") || "").slice(0, 100),
      ok: dentro(el),
      secao: el.closest("[data-editor-section]")?.dataset.editorSection ?? null,
      decorativa: el.getAttribute("alt") === "" || el.getAttribute("aria-hidden") === "true",
    })).filter((i) => !i.decorativa && i.src && !/\.svg(\?|$)/.test(i.src));
    return { textos, imagens };
  });
  await page.close();
  // texto repetido (marquee com 10 cópias, faixa de anúncio) conta UMA vez: o que se
  // mede é o que o lojista precisaria editar, não quantas vezes a tela repete.
  const unicos = (lista, chave) => {
    const vistos = new Map();
    for (const item of lista) {
      const k = chave(item);
      const prev = vistos.get(k);
      if (!prev || (!prev.ok && item.ok)) vistos.set(k, item);
    }
    return [...vistos.values()];
  };
  const textos = unicos(medido.textos, (t) => `${t.secao}|${t.texto}`);
  const imagens = unicos(medido.imagens, (i) => `${i.secao}|${i.src}`);
  const total = textos.length + imagens.length;
  if (total === 0) return { naoRodou: `${caminho} não tem texto nem imagem visível: nada medido` };
  const cobertos = textos.filter((t) => t.ok).length + imagens.filter((i) => i.ok).length;
  const fora = [
    ...textos.filter((t) => !t.ok).map((t) => `texto  ${t.secao ?? "(fora de seção)"} <${t.tag}> "${t.texto}"`),
    ...imagens.filter((i) => !i.ok).map((i) => `imagem ${i.secao ?? "(fora de seção)"} ${i.src}`),
  ];
  return { url: u.toString(), manifest, total, cobertos, cobertura: cobertos / total, fora };
}

/**
 * Uma segunda chance quando a página não abriu no prazo: em `next dev` a primeira visita compila a
 * rota, e oito páginas em sequência estouraram os 60 s justamente na home e em /busca numa rodada em
 * que as outras seis abriram (medido numa loja piloto). Reprovar por isso seria reprovar o compilador.
 * Só o prazo de abertura ganha a segunda chance; manifesto que não chegou e página vazia são NÃO RODOU
 * de primeira. E qualquer estouro inesperado do Playwright vira NÃO RODOU daquela página, com o
 * motivo, em vez de derrubar o gate inteiro com exit 1, que seria lido como reprovação.
 */
async function medirComSegundaChance(caminho) {
  let r;
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      r = await medir(caminho);
    } catch (e) {
      r = { naoRodou: `${caminho}: ${String(e?.message ?? e).split("\n")[0]}` };
    }
    if (!r.naoRodou || !/Timeout \d+ms exceeded/.test(r.naoRodou)) return r;
    if (tentativa === 1) console.log(`  (${caminho} não abriu no prazo; segunda tentativa, porque em next dev a primeira visita compila a rota)`);
  }
  return r;
}

const resultados = [];
for (const p of achado.paginas) {
  const r = await medirComSegundaChance(p.caminho);
  resultados.push({ ...p, ...r });
}
await browser.close();

// ── O RELATÓRIO ────────────────────────────────────────────────────────────────────────────────
console.log(`[check-editable] ${ORIGEM} · ${achado.paginas.length} página(s), lista veio de: ${achado.fonte}`);
const semExemplo = achado.semExemplo ?? [];
if (semExemplo.length) {
  console.log(`\nROTAS DECLARADAS SEM EXEMPLO PARA ABRIR (${semExemplo.length}), NÃO foram medidas: ${semExemplo.join(", ")}`);
  console.log("  (a loja não devolveu um caminho concreto para elas: catálogo vazio, sem credenciais da Unbox neste ambiente, ou fora do ar)");
}
const moldesNaoMedidos = achado.moldesNaoMedidos ?? [];
if (moldesNaoMedidos.length) {
  console.log(`\nMOLDES DAS PÁGINAS DO LOJISTA SEM PÁGINA PUBLICADA (${moldesNaoMedidos.length}), não medidos: ${moldesNaoMedidos.join(", ")}`);
  console.log("  (a loja declarou a rota como molde do lojista e não devolveu caminho: não há página visível no publicado para abrir. A casca é medida quando houver uma; isto não conta como NÃO RODOU)");
}
const porRegra = achado.paginas.filter((p) => p.soChrome);
if (porRegra.length) {
  console.log(`\nSÓ CABEÇALHO E RODAPÉ, POR REGRA (§8), declaradas pela loja (${porRegra.length}): ${porRegra.map((p) => p.caminho).join(", ")}`);
  console.log("  (texto legal, rótulo de formulário e de UI e mecânica de compra não viram primitivo; nelas a cobertura é impressa, não julgada, e o resto do gate vale)");
}

// TIPO E RÓTULO DE SEÇÃO (07/09): toda seção nasce com `kind` (vocabulário fechado) e `label`.
// Sem isso o painel mostra id de código para o lojista — reprova. A conta é da UNIÃO das páginas:
// a mesma seção declarada em duas rotas é uma só, e o relatório diz onde ela foi vista primeiro.
// O VOCABULÁRIO vem do document.ts da própria loja (lib/editable/document.ts, que a foundation copia para
// cá): um `kind` novo entra lá e o gate passa a aceitá-lo sem ninguém lembrar de uma segunda lista, que
// era o que havia (e reprovava seção legítima assim que o vocabulário crescia). A lista interna é só a
// reserva para quando o arquivo não está onde a foundation o põe, e o relatório diz de onde veio.
const KINDS_RESERVA = ["cabecalho", "faixa-de-anuncio", "banner", "texto-rolante", "vitrine-de-produtos", "produto-em-destaque", "beneficios", "como-funciona", "depoimentos", "perguntas-frequentes", "galeria", "video", "sobre-a-marca", "comparacao", "newsletter", "contato", "lojas-fisicas", "botao-flutuante", "rodape", "outro"];
// os PREFIXOS dos containers do lojista (foundation 13) saem do mesmo arquivo, pelo mesmo motivo: a lista é UMA
const PREFIXOS_RESERVA = ["pagina-", "artigo-", "colecao-"];
function vocabularioDoDocumento() {
  const candidatos = [new URL("../lib/editable/document.ts", import.meta.url), path.join(process.cwd(), "lib", "editable", "document.ts")];
  const lista = (fonte, nome) => {
    const m = fonte.match(new RegExp(`export const ${nome}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`));
    return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
  };
  for (const c of candidatos) {
    try {
      const fonte = readFileSync(c, "utf8");
      const kinds = lista(fonte, "SECTION_KINDS");
      // document.ts anterior à 13 não declara prefixo nenhum: aí vale a reserva, e o relatório diz de onde veio
      const prefixos = lista(fonte, "PREFIXOS_DO_LOJISTA");
      if (kinds.length) return { kinds, prefixos: prefixos.length ? prefixos : PREFIXOS_RESERVA, fonte: "lib/editable/document.ts", fontePrefixos: prefixos.length ? "lib/editable/document.ts" : "lista interna do gate (document.ts sem PREFIXOS_DO_LOJISTA)" };
    } catch {}
  }
  return { kinds: KINDS_RESERVA, prefixos: PREFIXOS_RESERVA, fonte: "lista interna do gate (lib/editable/document.ts não encontrado)", fontePrefixos: "lista interna do gate (lib/editable/document.ts não encontrado)" };
}
const { kinds: SECTION_KINDS, prefixos: PREFIXOS_DO_LOJISTA, fonte: FONTE_DOS_KINDS, fontePrefixos: FONTE_DOS_PREFIXOS } = vocabularioDoDocumento();
const semTipo = new Map();
for (const r of resultados) {
  for (const s of r.manifest?.sections ?? []) {
    if (s.item || (s.kind && SECTION_KINDS.includes(s.kind) && s.label)) continue;
    if (!semTipo.has(`${s.container}/${s.id}`)) semTipo.set(`${s.container}/${s.id}`, { ...s, onde: r.caminho });
  }
}

// EDITÁVEL FORA DE CONTAINER (foundation 11): a seção foi escrita com primitivos, mas está sendo
// renderizada solta, sem `Editable.Sections container=…`/`Editable.Section` em volta. O caminho dela
// cairia na RAIZ do documento, onde o mesmo nome vale para o site inteiro: o `titulo` do FAQ e o
// `titulo` da newsletter seriam o MESMO valor, em todas as páginas. A loja recusa (deixa o literal do
// código na tela) e declara em `manifest.semContainer`. Não é cobertura baixa por falta de primitivo:
// é primitivo bom em página que ninguém declarou. Reprova sozinho, e diz em que página está.
// (Manifesto abaixo da foundation 11 não traz o campo: aí a lista fica vazia, e a cobertura por
// página continua sendo o que pega a seção solta, porque um primitivo fora de container não recebe
// `data-editor-path`.)
const foraDeContainer = new Map();
for (const r of resultados) {
  for (const x of r.manifest?.semContainer ?? []) {
    const onde = x.pagina ?? r.caminho;
    const atual = foraDeContainer.get(x.path);
    if (!atual) foraDeContainer.set(x.path, { ...x, paginas: [onde] });
    else if (!atual.paginas.includes(onde)) atual.paginas.push(onde);
  }
}

// A DECLARAÇÃO DE CONTAINERS (achado 2 do Astra): a loja diz, por rota, quais containers ela renderiza
// (CONTAINERS_POR_ROTA em lib/rotas-editaveis.ts), e o editor e a publicação confiam nisso antes de a prévia
// ter aberto a página. O gate confere a declaração contra o que o manifesto mostrou: os containers de primeiro
// nível das seções e dos caminhos ("home.faq" é o `home`), fora o `chrome`, que é do site inteiro e não se lista.
// Diverge = REPROVADO, dizendo a rota e o container: é o que impede a tabela de envelhecer em silêncio.
// A ROTA DO LOJISTA declara por CURINGA (`pagina-*`): os containers dela nascem do documento, um por página que
// o dono criar, e a tabela não tem como listá-los. O curinga casa todo observado com aquele prefixo, e SÓ NELA:
// numa rota do código, `containers: ["*"]` esvaziaria a conferência inteira, que é justamente o que impede a
// tabela de envelhecer em silêncio. Fora da rota do lojista, o curinga é ignorado (não casa com nada) e a
// declaração é conferida nome a nome, como sempre.
const CONTAINER_DO_SITE = "chrome";
const raizDoContainer = (c) => String(c).split(".")[0];
const casaContainer = (declarado, observado, comCuringa) => (declarado.endsWith("*") ? comCuringa && observado.startsWith(declarado.slice(0, -1)) : declarado === observado);
/** o prefixo reservado ao lojista que este container usa, ou undefined */
const prefixoReservadoDe = (c) => PREFIXOS_DO_LOJISTA.find((p) => c.startsWith(p));
function containersObservados(manifest) {
  const vistos = new Set();
  for (const s of manifest?.sections ?? []) if (s.container) vistos.add(raizDoContainer(s.container));
  for (const e of manifest?.entries ?? []) if (e.container) vistos.add(raizDoContainer(e.container));
  vistos.delete(CONTAINER_DO_SITE);
  return [...vistos].sort();
}
/** por página medida: { declarados, observados, faltouDeclarar, declaradoSemAparecer } ou { naoConferido: motivo } */
function conferirDeclaracao(r) {
  if (r.semDeclaracaoPorque) return { naoConferido: r.semDeclaracaoPorque };
  const observados = containersObservados(r.manifest);
  if (!r.containers) return { observados, semDeclaracao: true };
  const declarados = [...new Set(r.containers.map(raizDoContainer).filter((c) => c !== CONTAINER_DO_SITE))].sort();
  const comCuringa = Boolean(r.doLojista);
  return {
    declarados,
    observados,
    faltouDeclarar: observados.filter((o) => !declarados.some((d) => casaContainer(d, o, comCuringa))),
    declaradoSemAparecer: declarados.filter((d) => !observados.some((o) => casaContainer(d, o, comCuringa))),
  };
}
for (const r of resultados) if (!r.naoRodou) r.declaracao = conferirDeclaracao(r);
const semDeclaracao = resultados.filter((r) => r.declaracao?.semDeclaracao);

// PREFIXO RESERVADO EM ROTA DO CÓDIGO (foundation 13): `pagina-`, `artigo-` e `colecao-` são dos containers que o
// lojista cria, e a loja trata qualquer container com esse prefixo como página dele (carimbo de data, sitemap,
// exclusão junto com a página). Um container do CÓDIGO com esse prefixo seria lido assim, e a página do código
// passaria a depender de um registro que não existe. Só é julgado onde a loja foi ouvida e listou a página: sem a
// declaração, não dá para saber se a rota é do lojista, e reprovar no escuro é reprovar sem ter olhado.
const prefixoIndevido = resultados
  .filter((r) => !r.naoRodou && !r.doLojista && r.declaracao && !r.declaracao.naoConferido)
  .map((r) => ({ caminho: r.caminho, rota: r.rota, containers: containersObservados(r.manifest).filter(prefixoReservadoDe) }))
  .filter((x) => x.containers.length);
const divergentes = resultados.filter((r) => r.declaracao && !r.declaracao.naoConferido && !r.declaracao.semDeclaracao && (r.declaracao.faltouDeclarar.length || r.declaracao.declaradoSemAparecer.length));

// ── O PAR DO CORTE DO DOCUMENTO (layout que corta × casca que junta) ─────────────────────────────
//
// O layout raiz entrega ao provider o documento SEM as páginas do lojista (`documentoSemPaginas`),
// porque ele viaja no HTML de toda página e o texto de cem artigos não tem o que fazer numa página de
// produto. Quem renderiza uma página do lojista tem de DEVOLVER a fatia dela (`<EditableFatia>`).
//
// As duas metades são obrigatoriamente um par, e a meia-adoção é CALADA: a rota responde 200, não
// registra erro, o `<head>` continua com o texto do lojista (metadados e dado estruturado saem do
// servidor, que lê o publicado inteiro) e o corpo cai no literal do código. Não há um sintoma que a
// cobertura, o manifesto ou o console peguem. O risco é o da propagação: a foundation é COPIADA para
// loja existente, e o layout e as cascas são editados à mão, loja por loja.
//
// Esta conferência é de CÓDIGO-FONTE, não do HTML servido: o que se cobra é o par existir, e ele
// existe (ou não) antes de a loja subir. Só é cobrada quando o layout corta; loja que ainda manda o
// documento inteiro não tem par a cumprir. A prévia do editor não entra na lista porque ela renderiza
// as MESMAS cascas das rotas de produção: tirar a fatia de uma casca reprova pelas rotas que a usam.
const EXTENSOES = [".tsx", ".ts", ".jsx", ".js"];
function raizDaLoja() {
  const candidatos = [process.cwd(), path.dirname(path.dirname(new URL(import.meta.url).pathname))];
  return candidatos.find((c) => existsSync(path.join(c, "app", "layout.tsx"))) ?? null;
}
/** todo page.tsx sob app/, com a rota que ele responde (o grupo de rotas, `(loja)`, não entra na URL) */
function paginasDoApp(raiz) {
  const achadas = new Map();
  const andar = (dir, partes) => {
    let entradas = [];
    try { entradas = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entradas) {
      if (e.isDirectory()) andar(path.join(dir, e.name), e.name.startsWith("(") && e.name.endsWith(")") ? partes : [...partes, e.name]);
      else if (/^page\.(tsx|ts|jsx|js)$/.test(e.name)) achadas.set(`/${partes.join("/")}`, path.join(dir, e.name));
    }
  };
  andar(path.join(raiz, "app"), []);
  return achadas;
}
/** o arquivo que este import aponta, se for da própria loja (`@/…`, `./…`, `../…`); senão `null` */
function arquivoDoImport(alvo, deArquivo, raiz) {
  if (!alvo.startsWith("@/") && !alvo.startsWith("./") && !alvo.startsWith("../")) return null;
  const base = alvo.startsWith("@/") ? path.join(raiz, alvo.slice(2)) : path.resolve(path.dirname(deArquivo), alvo);
  for (const cand of [base, ...EXTENSOES.map((x) => base + x), ...EXTENSOES.map((x) => path.join(base, "index" + x))]) {
    try { if (statSync(cand).isFile()) return cand; } catch {}
  }
  return null;
}
/**
 * O texto sem comentário. A foundation DOCUMENTA a fatia em comentário (`<EditableFatia>` dentro de
 * uma frase), e sem esta peneira o gate lia a documentação como uso e aprovava a loja que tirou a
 * fatia da casca. A peneira vale só para a busca; os imports saem do texto cru.
 */
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\w])\/\/[^\n]*/g, "$1");
/** a fatia aparece na cadeia de imports desta rota? Devolve o arquivo onde ela está, ou null */
function ondeEstaAFatia(entrada, raiz) {
  const vistos = new Set();
  const fila = [entrada];
  while (fila.length && vistos.size < 500) {
    const arq = fila.shift();
    if (!arq || vistos.has(arq)) continue;
    vistos.add(arq);
    // a foundation é onde a fatia MORA, e morar não é usar: um `<EditableFatia>` citado ali é
    // documentação, e a casca que a rota renderiza está fora desta pasta
    if (arq.includes(`${path.sep}lib${path.sep}editable${path.sep}`)) continue;
    let fonte = "";
    try { fonte = readFileSync(arq, "utf8"); } catch { continue; }
    if (/<\s*(EditableFatia|Editable\.Fatia)[\s>]/.test(semComentarios(fonte))) return path.relative(raiz, arq);
    for (const m of fonte.matchAll(/from\s+["']([^"']+)["']/g)) {
      const prox = arquivoDoImport(m[1], arq, raiz);
      if (prox) fila.push(prox);
    }
  }
  return null;
}
const RAIZ_DA_LOJA = raizDaLoja();
const parDoCorte = { conferido: false, motivo: "", semFatia: [], semArquivo: [], comFatia: [] };
if (!RAIZ_DA_LOJA) {
  parDoCorte.motivo = "não achei a raiz da loja (app/layout.tsx) a partir de process.cwd() nem do lugar do script: rode o gate da pasta da loja";
} else {
  const layout = readFileSync(path.join(RAIZ_DA_LOJA, "app", "layout.tsx"), "utf8");
  if (!/documentoSemPaginas/.test(layout)) {
    parDoCorte.motivo = "o app/layout.tsx desta loja manda o documento inteiro ao provider (não chama documentoSemPaginas): não há par a cobrar";
    parDoCorte.conferido = true;
  } else {
    // as rotas do molde saem da própria loja (lib/rotas-editaveis.ts) e do que ela declarou em
    // /api/unbox/paginas: a tabela é a fonte, e o que a loja disse na hora acrescenta
    let daTabela = [];
    try {
      const fonte = readFileSync(path.join(RAIZ_DA_LOJA, "lib", "rotas-editaveis.ts"), "utf8");
      const m = fonte.match(/export const ROTAS_DO_LOJISTA[^=]*=\s*\[([\s\S]*?)\]/);
      if (m) daTabela = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    } catch {}
    const declaradas = (achado.paginas ?? []).filter((p) => p.doLojista).map((p) => p.rota);
    const rotas = [...new Set([...daTabela, ...declaradas, ...moldesNaoMedidos])].sort();
    const paginas = paginasDoApp(RAIZ_DA_LOJA);
    if (!rotas.length) {
      parDoCorte.motivo = "o layout corta o documento e esta loja não declara nenhuma rota de página do lojista (ROTAS_DO_LOJISTA vazia): não há casca a conferir";
      parDoCorte.conferido = true;
    } else {
      for (const rota of rotas) {
        const arq = paginas.get(rota);
        if (!arq) { parDoCorte.semArquivo.push(rota); continue; }
        const onde = ondeEstaAFatia(arq, RAIZ_DA_LOJA);
        if (onde) parDoCorte.comFatia.push({ rota, onde });
        else parDoCorte.semFatia.push({ rota, arquivo: path.relative(RAIZ_DA_LOJA, arq) });
      }
      parDoCorte.conferido = true;
    }
  }
}

const naoRodaram = resultados.filter((r) => r.naoRodou);
const medidas = resultados.filter((r) => !r.naoRodou);
// a página só cabeçalho e rodapé por regra não entra na régua: a cobertura dela é impressa, não julgada
const medidasPorRegra = medidas.filter((r) => r.soChrome);
const descobertas = medidas.filter((r) => !r.soChrome && r.cobertura < MINIMO);

console.log("\nCOBERTURA POR PÁGINA:");
for (const rota of moldesNaoMedidos) console.log(`  molde      ${rota.padEnd(28)} molde não medido: nenhuma página publicada`);
for (const r of resultados) {
  if (r.naoRodou) {
    console.log(`  NÃO RODOU  ${r.caminho.padEnd(28)} ${r.naoRodou}`);
    continue;
  }
  const marca = r.soChrome ? "por regra " : r.cobertura >= MINIMO ? "ok        " : "DESCOBERTA";
  const nota = r.soChrome ? " · só cabeçalho e rodapé, por regra (§8)" : "";
  const soltos = (r.manifest.semContainer ?? []).length;
  console.log(`  ${marca} ${r.caminho.padEnd(28)} ${(r.cobertura * 100).toFixed(1)}%  (${r.cobertos}/${r.total})${nota}  · manifesto: ${r.manifest.entries.length} caminhos · ${r.manifest.sections.length} seções${soltos ? ` · ${soltos} editável(is) FORA de container` : ""}`);
}

for (const r of descobertas) {
  console.log(`\nFORA DOS PRIMITIVOS em ${r.caminho} (${r.fora.length}):`);
  for (const f of r.fora.slice(0, 40)) console.log("  " + f);
  if (r.fora.length > 40) console.log(`  … +${r.fora.length - 40}`);
}

if (foraDeContainer.size) {
  console.log(`\nEDITÁVEIS FORA DE CONTAINER (${foraDeContainer.size}): a página os renderiza soltos, então eles NÃO são editáveis:`);
  for (const [p, x] of [...foraDeContainer].slice(0, 40)) console.log(`  ${p} · ${x.type}${x.label ? ` · ${x.label}` : ""} · em ${x.paginas.join(", ")}`);
  if (foraDeContainer.size > 40) console.log(`  … +${foraDeContainer.size - 40}`);
  console.log(`  Envolva as seções dessa(s) página(s) em <Editable.Sections container="<nome-da-página>"> com um <Editable.Section id=…> por seção.`);
  console.log(`  A ordem é do container e a copy é do container: duas páginas no MESMO container dividem as duas de propósito; página que quer copy própria declara container próprio.`);
}

if (semTipo.size) {
  console.log(`\nSEÇÕES SEM TIPO OU RÓTULO (${semTipo.size}): toda Editable.Section precisa de kind (um de: ${SECTION_KINDS.join(", ")}; vocabulário lido de ${FONTE_DOS_KINDS}) e label:`);
  for (const [chave, s] of semTipo) console.log(`  ${chave} · kind=${s.kind ?? "(vazio)"} · label=${s.label ?? "(vazio)"} · visto em ${s.onde}`);
}

if (prefixoIndevido.length) {
  console.log(`\nPREFIXO RESERVADO ÀS PÁGINAS DO LOJISTA EM ROTA DO CÓDIGO (${prefixoIndevido.length}): o código está usando um prefixo reservado às páginas do lojista:`);
  for (const x of prefixoIndevido) console.log(`  ${x.caminho} (rota ${x.rota}) · ${x.containers.join(", ")}`);
  console.log(`  Os prefixos ${PREFIXOS_DO_LOJISTA.join(", ")} (lidos de ${FONTE_DOS_PREFIXOS}) são dos containers que o lojista cria pelo editor; a loja trata qualquer container assim como página dele. Renomeie o container no código (ou marque a rota com doLojista, se ela for a casca das páginas do lojista).`);
}

console.log("\nO PAR DO CORTE DO DOCUMENTO (o layout tira as páginas do lojista; a casca devolve a fatia):");
if (!parDoCorte.conferido || parDoCorte.motivo) {
  console.log(`  não conferido · ${parDoCorte.motivo}`);
} else {
  for (const x of parDoCorte.comFatia) console.log(`  ok             ${x.rota.padEnd(24)} fatia em ${x.onde}`);
  for (const x of parDoCorte.semFatia) console.log(`  SEM A FATIA    ${x.rota.padEnd(24)} ${x.arquivo} e nada que ela importa renderiza <EditableFatia>`);
  for (const rota of parDoCorte.semArquivo) console.log(`  não conferido  ${rota.padEnd(24)} a loja declara a rota e não achei o page.tsx dela em app/`);
  if (parDoCorte.semFatia.length) {
    console.log("  Sem a fatia, a página vai ao ar com o literal do código no lugar do texto do lojista: título, resumo, imagem e corpo somem do corpo da página, sem erro, sem log e sem 500. E o <head> continua com o texto dele, porque metadados e dado estruturado saem do servidor, que lê o publicado inteiro.");
    console.log("  Envolva o que a rota renderiza em <EditableFatia fatia={fatiaDoDocumento(doc, alvos)}> (no template isso mora nas metades de servidor: components/paginas/pagina-do-lojista.tsx e colecao-do-lojista.tsx), ou devolva o documento inteiro ao provider no app/layout.tsx.");
  }
}

if (medidas.length) {
  const lista = (xs) => (xs.length ? xs.join(", ") : "(nenhum)");
  console.log("\nCONTAINERS POR PÁGINA (o que a loja declara em CONTAINERS_POR_ROTA × o que o manifesto mostrou, fora o chrome):");
  for (const r of medidas) {
    const d = r.declaracao;
    if (d.naoConferido) {
      console.log(`  não conferido ${r.caminho.padEnd(24)} observados: ${lista(d.observados ?? containersObservados(r.manifest))} · ${d.naoConferido}`);
      continue;
    }
    if (d.semDeclaracao) {
      console.log(`  SEM DECLARAÇÃO ${r.caminho.padEnd(23)} observados: ${lista(d.observados)} · a loja lista a rota ${r.rota} sem \`containers\`: acrescente-a a CONTAINERS_POR_ROTA em lib/rotas-editaveis.ts`);
      continue;
    }
    const diverge = d.faltouDeclarar.length || d.declaradoSemAparecer.length;
    const detalhe = [d.faltouDeclarar.length ? `faltou declarar: ${d.faltouDeclarar.join(", ")}` : "", d.declaradoSemAparecer.length ? `declarado sem aparecer: ${d.declaradoSemAparecer.join(", ")}` : ""].filter(Boolean).join(" · ");
    console.log(`  ${diverge ? "DIVERGE      " : "ok           "} ${r.caminho.padEnd(24)} declarados: ${lista(d.declarados)} · observados: ${lista(d.observados)}${detalhe ? ` · ${detalhe}` : ""}`);
  }
  if (divergentes.length || semDeclaracao.length) console.log("  A tabela é a promessa que o editor e a publicação usam antes de abrir a página: quem mexeu na página atualiza a linha dela em lib/rotas-editaveis.ts (rota → containers que ela renderiza, fora o chrome).");
}

if (args.json) {
  writeFileSync(args.json, JSON.stringify({
    origem: ORIGEM,
    fonteDaLista: achado.fonte,
    minimo: MINIMO,
    rotasSemExemplo: semExemplo,
    moldesNaoMedidos,
    prefixoReservadoEmRotaDoCodigo: prefixoIndevido,
    parDoCorteDoDocumento: parDoCorte,
    paginas: resultados.map((r) => ({
      rota: r.rota,
      caminho: r.caminho,
      cobertura: r.cobertura ?? null,
      total: r.total ?? 0,
      cobertos: r.cobertos ?? 0,
      fora: r.fora ?? [],
      foraDeContainer: r.manifest?.semContainer ?? [],
      naoRodou: r.naoRodou ?? null,
      ...(r.soChrome ? { soChrome: true } : {}),
      ...(r.doLojista ? { doLojista: true } : {}),
      ...(r.declaracao ? { containers: r.declaracao } : {}),
    })),
    secoesSemTipo: [...semTipo.keys()],
    editaveisForaDeContainer: [...foraDeContainer].map(([p, x]) => ({ path: p, type: x.type, label: x.label ?? null, paginas: x.paginas })),
  }, null, 2));
}

// O VEREDITO. O que não foi medido vem primeiro, mas sem esconder o que já reprovou: quem lê o
// relatório conserta as duas coisas numa rodada só, em vez de descobrir a segunda depois de
// consertar a primeira.
const reprovacoes = [];
if (descobertas.length) reprovacoes.push(`página(s) descoberta(s): ${descobertas.map((r) => `${r.caminho} (${(r.cobertura * 100).toFixed(1)}%)`).join(", ")}`);
if (foraDeContainer.size) reprovacoes.push(`${foraDeContainer.size} editável(is) fora de container em ${[...new Set([...foraDeContainer.values()].flatMap((x) => x.paginas))].join(", ")}`);
if (semTipo.size) reprovacoes.push(`${semTipo.size} seção(ões) sem tipo ou rótulo`);
if (divergentes.length) {
  reprovacoes.push(`declaração de containers divergente em ${divergentes.map((r) => {
    const d = r.declaracao;
    const partes = [d.faltouDeclarar.length ? `faltou declarar ${d.faltouDeclarar.join(", ")}` : "", d.declaradoSemAparecer.length ? `declarado sem aparecer ${d.declaradoSemAparecer.join(", ")}` : ""].filter(Boolean);
    return `${r.rota} (${partes.join("; ")})`;
  }).join(", ")}`);
}
if (semDeclaracao.length) reprovacoes.push(`rota(s) listada(s) pela loja sem declaração de containers: ${semDeclaracao.map((r) => r.rota).join(", ")}`);
if (prefixoIndevido.length) reprovacoes.push(`container do código com prefixo reservado às páginas do lojista em ${prefixoIndevido.map((x) => `${x.rota} (${x.containers.join(", ")})`).join(", ")}`);
if (parDoCorte.semFatia.length) reprovacoes.push(`rota(s) do lojista sem a fatia do documento: ${parDoCorte.semFatia.map((x) => `${x.rota} (${x.arquivo})`).join(", ")}: a página vai ao ar com o literal do código no lugar do texto do lojista`);

// o par não conferido é NÃO RODOU pelo mesmo motivo dos outros: gate que varre o vazio e diz "limpo"
// aprova sem ter olhado. Layout que não corta é conferido e não tem par a cumprir, que é outra coisa.
const naoConferiuOPar = !parDoCorte.conferido || (parDoCorte.semArquivo.length > 0 && parDoCorte.comFatia.length === 0 && parDoCorte.semFatia.length === 0);
if (naoRodaram.length || semExemplo.length || naoConferiuOPar) {
  const partes = [];
  if (naoRodaram.length) partes.push(`${naoRodaram.length} de ${resultados.length} página(s) NÃO foram medidas: ${naoRodaram.map((r) => r.caminho).join(", ")}`);
  if (semExemplo.length) partes.push(`${semExemplo.length} rota(s) declarada(s) sem exemplo para abrir: ${semExemplo.join(", ")}`);
  if (naoConferiuOPar) partes.push(`o par do corte do documento não foi conferido: ${parDoCorte.motivo || "nenhuma rota do lojista pôde ser resolvida em app/"}`);
  if (reprovacoes.length) partes.push(`e, do que foi medido, já reprovou: ${reprovacoes.join(" · ")}`);
  console.error(`\n[check-editable] ${partes.join(" · ")}. NÃO RODOU.`);
  process.exit(2);
}
if (reprovacoes.length) {
  console.error(`\n[check-editable] REPROVADO: ${reprovacoes.join(" · ")}`);
  process.exit(1);
}
// "1 página(s), 1 só cabeçalho e rodapé por regra": a parte comum só aparece quando houve página comum medida
const comuns = medidas.length - medidasPorRegra.length;
const resumo = medidasPorRegra.length
  ? `${comuns ? `${comuns} >= ${(MINIMO * 100).toFixed(0)}% e ` : ""}${medidasPorRegra.length} só cabeçalho e rodapé por regra (§8)`
  : `todas >= ${(MINIMO * 100).toFixed(0)}%`;
const conferidas = medidas.filter((r) => r.declaracao && !r.declaracao.naoConferido).length;
const declaracao = conferidas ? `, declaração de containers batendo em ${conferidas} página(s)` : ", declaração de containers não conferida (a loja não foi ouvida)";
// o molde não medido vai na frase de aprovação: aprovado sem tê-lo olhado é o que a frase tem de dizer
const moldes = moldesNaoMedidos.length ? `; ${moldesNaoMedidos.length} molde(s) do lojista sem página publicada, não medido(s)` : "";
const par = parDoCorte.motivo ? `, par do corte não conferido (${parDoCorte.motivo})` : parDoCorte.comFatia.length ? `, o par do corte do documento fechando em ${parDoCorte.comFatia.length} rota(s) do lojista` : "";
console.log(`\n[check-editable] aprovado: ${medidas.length} página(s), ${resumo}, nenhuma seção sem tipo, nenhum editável fora de container${declaracao}${par}${moldes}`);
process.exit(0);
