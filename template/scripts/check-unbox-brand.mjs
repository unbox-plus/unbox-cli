// ═══════════════════════════════════════════════════════════════════════════
// GATE DE BUILD — CONTRATO UNBOX. Roda automaticamente no `prebuild` (ou seja,
// em todo `npm run build`, inclusive no deploy da Vercel). Se qualquer item
// obrigatório estiver ausente, o build FALHA e o site não deploya:
//   1. Selo "Powered by Unbox" no rodapé (componente + asset + uso no footer)
//   2. GTM central da Unbox (GTM-PZLT336) no app/layout.tsx
// NÃO remova este script nem o hook "prebuild" do package.json.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => {
  try { return fs.readFileSync(path.join(ROOT, p), "utf8"); } catch { return null; }
};

const errors = [];

// 1. Powered by Unbox
const poweredBy = read("components/powered-by-unbox.tsx");
if (!poweredBy) errors.push("components/powered-by-unbox.tsx não existe.");
else if (!poweredBy.includes("unbox.com.br")) errors.push("powered-by-unbox.tsx perdeu o link pra unbox.com.br.");
if (!fs.existsSync(path.join(ROOT, "public", "unbox", "powered-by.png"))) {
  errors.push("asset public/unbox/powered-by.png não existe.");
}
// exige a RENDERIZAÇÃO (<PoweredByUnbox), não só o import — senão remover o uso passaria
const footer = read("components/site-footer.tsx");
if (!footer || !footer.includes("<PoweredByUnbox")) {
  errors.push("o rodapé (components/site-footer.tsx) não renderiza <PoweredByUnbox />.");
}

// 2. GTM central
const layout = read("app/layout.tsx");
if (!layout || !layout.includes("GTM-PZLT336")) {
  errors.push("o GTM central da Unbox (GTM-PZLT336) sumiu do app/layout.tsx.");
}

// 3. Contrato da URL do checkout — ?id=&token= do carrinho
//
// Bloqueia porque a recuperação de carrinho abandonado depende INTEIRAMENTE disso: o CRM e o
// pixel capturam a URL navegada, não o cookie httpOnly. Sem os params na URL, a recuperação
// não existe — e some sem nenhum sinal visível, porque a loja continua funcionando e vendendo.
// Já se perdeu uma vez por viver só na aplicação; agora o build reprova.
const destino = read("app/api/checkout-destination/route.ts");
if (!destino) {
  errors.push("app/api/checkout-destination/route.ts não existe — é ele que monta a URL do checkout com ?id=&token=.");
} else if (!/id=\$\{encodeURIComponent\(ref\.cartId\)\}/.test(destino) || !/token=\$\{encodeURIComponent\(ref\.cartToken\)\}/.test(destino)) {
  errors.push("app/api/checkout-destination/route.ts parou de montar ?id=&token= na URL do checkout (recuperação de carrinho depende disso).");
}

// Só no modo checkout CUSTOMIZADO: existe rota /checkout neste projeto, então o middleware
// precisa garantir os params em qualquer forma de chegada. No modo hospedado a página não
// existe e a garantia vive só na rota acima.
if (fs.existsSync(path.join(ROOT, "app", "(loja)", "checkout", "page.tsx"))) {
  const mw = read("middleware.ts");
  if (!mw || !mw.includes("urlDoCheckoutComPonteiro")) {
    errors.push("middleware.ts perdeu a garantia do ?id=&token= no /checkout (função urlDoCheckoutComPonteiro).");
  } else if (!/pathname !== "\/checkout"/.test(mw)) {
    errors.push("a garantia do checkout no middleware.ts não aponta mais para a rota /checkout.");
  }
}

// 4. Contrato do dataLayer — o que o GTM central da Unbox lê
//
// Medido no JS do container GTM-PZLT336: ele lê `ecommerce.items` (GA4), `ecommerce.purchase.*`
// e `transactionId/transactionTotal` (gerações anteriores) e `dataLayerReady` com `pageType` e
// `products[]` (remarketing do Ads). A camada de tracking emite as três. Se alguém "limpar"
// isso para deixar só o GA4 puro, a compra chega vazia no GA4 da Unbox — e ninguém vê.
const analytics = read("lib/analytics.ts");
if (!analytics) {
  errors.push("lib/analytics.ts não existe — é a camada única de tracking.");
} else {
  for (const [marca, why] of [
    ["ecommerce.purchase", "compra no formato que o GTM central lê (ecommerce.purchase.*)"],
    ["transactionTotal", "chaves clássicas (transactionId/transactionTotal) que o GTM central lê"],
    ['"dataLayerReady"', "evento dataLayerReady (pageType + products[]) do remarketing"],
    ["{ ecommerce: null }", "limpeza do objeto ecommerce antes de cada push"],
  ]) {
    if (!analytics.includes(marca)) errors.push(`lib/analytics.ts perdeu: ${why}.`);
  }
  if (/if \(typeof w\.gtag === "function"\) w\.gtag\("event"[^\n]*\n\s*else if \(Array\.isArray\(w\.dataLayer\)\)/.test(analytics)) {
    errors.push("lib/analytics.ts voltou a priorizar o gtag sobre o dataLayer — o GTM central fica cego com GA4 próprio.");
  }
}

// `dataLayerReady` é o ÚNICO gatilho de tipo de página do container central (medido no JS dele:
// não existe gatilho de custom event `page_view`). Página principal que não emite o evento é
// invisível pro remarketing do Ads — e é justamente onde cai o tráfego de campanha.
for (const [arquivo, rotulo] of [
  ["app/(loja)/page.tsx", "home"],
  ["app/(loja)/produtos/page.tsx", "catálogo"],
  ["app/(loja)/categoria/[tagSlug]/page.tsx", "categoria"],
  ["app/(loja)/busca/page.tsx", "busca"],
  ["app/(loja)/produto/[productSlug]/page.tsx", "PDP"],
  ["app/(loja)/carrinho/page.tsx", "carrinho"],
]) {
  const src = read(arquivo);
  if (src && !/DataLayerReady|trackPageType/.test(src)) {
    errors.push(`${arquivo} (${rotulo}) não emite dataLayerReady — o GTM central perde o tipo de página e o remarketing.`);
  }
}

// ── 5. Tom sobre a plataforma ────────────────────────────────────────────────
// A loja é de um cliente que comprou a Unbox e recebe este código-fonte inteiro. Restrição de
// plataforma se DESCREVE (a regra, o efeito, a decisão); julgar a plataforma dentro do produto
// que ela vende não informa nada que a frase neutra não informe. Nasceu de um caso real: o
// agente explicou a frequência de assinatura como "é pior do que parece / limitação da
// plataforma" para o lojista e levou esse enquadramento para a interface da loja.
// Detalhe e exemplos: CLAUDE.md → "Como falar da plataforma".
const JULGAMENTO = [
  [/limita[çc][ãa]o d[ao]s? (plataforma|Unbox|sistema)/i, '"limitação da plataforma"'],
  [/pior do que parece/i, '"pior do que parece"'],
  [/(culpa|problema|falha|defeito|bug) d[ao] Unbox/i, "culpa/problema/falha atribuídos à Unbox"],
  [/a Unbox n[ãa]o (deixa|permite|aceita|suporta|consegue|tem como)/i, '"a Unbox não deixa/aceita/suporta"'],
  [/n[ãa]o d[áa] pra resolver/i, '"não dá pra resolver"'],
  [/infelizmente/i, '"infelizmente"'],
  [/por limita[çc][ãa]o d[oa] sistema/i, '"por limitação do sistema" (copy do comprador)'],
];
const arquivosDoProjeto = [];
(function varre(dir) {
  for (const nome of fs.readdirSync(dir, { withFileTypes: true })) {
    if (nome.name === "node_modules" || nome.name === ".next" || nome.name.startsWith(".git")) continue;
    const caminho = path.join(dir, nome.name);
    if (nome.isDirectory()) varre(caminho);
    else if (/\.(tsx?|mjs|md)$/.test(nome.name)) arquivosDoProjeto.push(caminho);
  }
})(ROOT);
for (const caminho of arquivosDoProjeto) {
  const rel = path.relative(ROOT, caminho);
  // O próprio gate e a seção do CLAUDE.md CITAM as frases proibidas para ensinar a regra.
  if (rel === "scripts/check-unbox-brand.mjs" || rel === "CLAUDE.md" || rel === "agents/CONSTRUCAO.md" || rel === ".claude/agents/branding-briefing.md") continue;
  const src = fs.readFileSync(caminho, "utf8");
  for (const [rx, rotulo] of JULGAMENTO) {
    const m = src.match(rx);
    if (m) {
      const linha = src.slice(0, m.index).split("\n").length;
      errors.push(`${rel}:${linha} julga a plataforma (${rotulo}) — descreva a regra e o efeito, sem juízo de valor (CLAUDE.md → "Como falar da plataforma").`);
    }
  }
}

// ── 6. Travessão na copy ─────────────────────────────────────────────────────
// A regra "nada de travessão na copy" existia só no prompt do briefing e não se sustentou: a
// própria foundation entregava travessão em título de aba, página legal, catálogo e carrinho, e
// exemplo vale mais que instrução. Aqui ela vira build quebrado.
// Fora do escopo, de propósito: comentário (nota de engenharia, não copy) e o "—" sozinho como
// marcador de valor vazio numa tabela (`?? "—"`), que é uso tipográfico e não prosa.
/** Devolve só a parte de CÓDIGO+STRING da linha: tira comentário de linha e de bloco inline,
 *  sem se enganar com "//" dentro de string (URL) nem com aspas dentro de comentário. */
function semComentario(linha, dentroDeBloco) {
  let out = "";
  let aspas = null;
  let bloco = dentroDeBloco;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    const prox = linha[i + 1];
    if (bloco) {
      if (c === "*" && prox === "/") { bloco = false; i++; }
      continue;
    }
    if (aspas) {
      if (c === "\\") { out += c + (prox ?? ""); i++; continue; }
      if (c === aspas) aspas = null;
      out += c;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { aspas = c; out += c; continue; }
    if (c === "/" && prox === "/") break;              // comentário até o fim da linha
    if (c === "/" && prox === "*") { bloco = true; i++; continue; }
    out += c;
  }
  return { texto: out, bloco };
}

const arquivosDeCopy = [];
function varreCopy(dir) {
  let entradas;
  try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entradas) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const caminho = path.join(dir, e.name);
    if (e.isDirectory()) varreCopy(caminho);
    else if (/\.tsx?$/.test(e.name)) arquivosDeCopy.push(caminho);
  }
}
varreCopy(path.join(ROOT, "app"));
varreCopy(path.join(ROOT, "components"));

for (const caminho of arquivosDeCopy) {
  const rel = path.relative(ROOT, caminho);
  let bloco = false;
  fs.readFileSync(caminho, "utf8").split("\n").forEach((linha, idx) => {
    const r = semComentario(linha, bloco);
    bloco = r.bloco;
    if (!r.texto.includes("—")) return;
    const semPlaceholder = r.texto.replace(/(["'`])\s*—\s*\1/g, ""); // `?? "—"` é marcador de vazio
    if (!semPlaceholder.includes("—")) return;
    errors.push(`${rel}:${idx + 1} usa travessão na copy: troque por vírgula, dois-pontos, ponto ou "·" (CLAUDE.md, "Copy sem travessão").`);
  });
}

// ── 7. Destino do checkout: só pelo checkout-nav ─────────────────────────────
// Com UNBOX_HOSTED_CHECKOUT_URL preenchida o destino é EXTERNO e só o servidor sabe montar a URL
// (o cartToken é httpOnly). Uma tela que navega para "/checkout" no braço fura isso: metade dos
// botões vai para o checkout hospedado e metade para uma rota que, no modo hospedado, nem existe.
// Ficam de fora as telas do próprio checkout customizável, que o CLI remove no modo hospedado.
const CHECKOUT_PROPRIO = ["app/(loja)/checkout", "components/checkout", "lib/checkout-nav.ts"];
for (const caminho of arquivosDeCopy) {
  const rel = path.relative(ROOT, caminho);
  if (CHECKOUT_PROPRIO.some((dir) => rel.startsWith(dir))) continue;
  let bloco = false;
  fs.readFileSync(caminho, "utf8").split("\n").forEach((linha, idx) => {
    const r = semComentario(linha, bloco);
    bloco = r.bloco;
    if (/(push|replace)\(\s*["'`]\/checkout|href\s*=\s*["'`]\/checkout|location\.href\s*=\s*["'`]\/checkout/.test(r.texto)) {
      errors.push(`${rel}:${idx + 1} navega para "/checkout" direto: use goToCheckout() de lib/checkout-nav (o destino pode ser o checkout hospedado).`);
    }
  });
}

// ── 8. /llms.txt é rota, e nada pode escondê-la ──────────────────────────────
// Arquivo em public/ tem precedência sobre rota de mesmo caminho: um `public/llms.txt` deixaria
// a rota morta e voltaria a servir texto estático (foi assim que uma loja publicou "TODO:
// preencher" para os crawlers). O conteúdo tem que vir do catálogo real.
if (!fs.existsSync(path.join(ROOT, "app/llms.txt/route.ts"))) {
  errors.push("app/llms.txt/route.ts sumiu: o /llms.txt precisa ser gerado do catálogo real, não escrito à mão.");
}
if (fs.existsSync(path.join(ROOT, "public/llms.txt"))) {
  errors.push("public/llms.txt existe e ESCONDE a rota app/llms.txt (arquivo estático tem precedência): apague o arquivo.");
}

// ── Avisos NÃO bloqueantes (acabamento de marca) ──────────────────────────────
const warnings = [];
if (layout && /description:\s*(undefined|""|process\.env\.NEXT_PUBLIC_SITE_DESCRIPTION \|\| undefined)/.test(layout) && !process.env.NEXT_PUBLIC_SITE_DESCRIPTION) {
  warnings.push('a loja ainda não tem meta description: escreva uma frase com o que ela vende e para quem, em app/layout.tsx (busca e IA extraem daí).');
}
for (const f of ["app/icon.svg", "app/apple-icon.svg"]) {
  const svg = read(f);
  if (svg && svg.includes("unbox-placeholder")) {
    warnings.push(`${f} ainda é o placeholder da foundation — troque pelo ícone da marca.`);
  }
}
// Logos da marca ainda com o placeholder da foundation. São DOIS arquivos usados em
// lugares diferentes (logo.svg: header claro, menu mobile, checkout, porta de preview;
// logo-chrome.svg: rodapé e header sobreposto) — trocar só um deixa o outro placeholder
// no ar, e ninguém percebe até um cliente ver.
for (const f of ["public/brand/logo.svg", "public/brand/logo-chrome.svg"]) {
  const svg = read(f);
  if (svg && svg.includes("sua marca")) {
    warnings.push(`${f} ainda é o logo placeholder da foundation (quadrado cinza "sua marca").`);
  }
}
// Paleta ainda no default da foundation. O cinza neutro é canvas provisória: entregar a
// loja assim é entregar loja sem identidade. Aviso, não bloqueio — pode ser deliberado
// numa demo ou num scaffold recém-criado.
const css = read("app/globals.css");
if (css && /--store-primary:\s*#18181B/i.test(css) && /--store-cta:\s*#D97706/i.test(css)) {
  warnings.push("a loja ainda usa a PALETA DEFAULT da foundation (tinta + âmbar) — aplique as cores reais da marca.");
}
const manifest = read("app/manifest.ts");
if (manifest && /"Minha Loja"|"Loja"/.test(manifest)) {
  warnings.push('app/manifest.ts ainda tem nome placeholder ("Minha Loja"/"Loja") — o PWA instala com esse nome.');
}
if (warnings.length) {
  console.warn("\n⚠ Acabamento de marca pendente (não bloqueia o build):");
  for (const w of warnings) console.warn(`   • ${w}`);
  console.warn("   Dicas: apple-icon precisa de fundo OPACO (iOS não aplica transparência) e ícone");
  console.warn("   maskable precisa de ~20% de margem de segurança. Detalhes no QA.md.\n");
}

if (errors.length) {
  console.error("\n✗ BUILD BLOQUEADO — itens obrigatórios do contrato Unbox ausentes:\n");
  for (const e of errors) console.error(`   • ${e}`);
  console.error("\n  Toda loja criada com o create-unbox-store precisa do selo \"Powered by Unbox\"");
  console.error("  no rodapé, do GTM central ativo e do ?id=&token= na URL do checkout (sem ele a");
  console.error("  recuperação de carrinho abandonado não funciona). Restaure e rode o build de novo.");
  console.error("  (Eles fazem parte do contrato da plataforma e não podem ser removidos.)\n");
  process.exit(1);
}
console.log("✓ Contrato Unbox ok (Powered by + GTM + ?id=&token= + dataLayer)");
