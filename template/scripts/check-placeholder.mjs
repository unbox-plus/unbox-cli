// ══════════════════════════════════════════════════════════════════════════════
// PLACEHOLDER NO AR — npm run unbox:placeholder
//
// Roda contra o HTML SERVIDO, não contra o código-fonte. A diferença decide os dois casos que
// uma varredura de fonte erra:
//
//   • FALSO POSITIVO: quase todo componente tem um "TODO" em comentário, e componente que não
//     está na receita nunca chega à tela. O fonte acusa o que ninguém vê.
//   • FALSO NEGATIVO: o texto que vaza pode não existir como string no código. Numa loja em
//     produção, "[NOME DA LOJA], inscrita no CNPJ sob o nº [CNPJ]" foi ao ar em /termos e
//     /privacidade, indexáveis; e o logotipo escrito "NOME DA LOJA" no cabeçalho do checkout
//     era um ARQUIVO DE IMAGEM. Nenhuma busca por string em .tsx encontra nenhum dos dois.
//
// Precisa de BUILD DE PRODUÇÃO: em desenvolvimento o Next não gera as páginas estáticas, e é
// justamente o HTML final que interessa. Se o servidor não estiver de pé, o script sobe um
// sozinho na porta livre, mede e derruba.
//
// CÓDIGOS DE SAÍDA
//   0  nada de placeholder no ar
//   1  achou placeholder servido ao público
//   2  O GATE NÃO RODOU (sem build, servidor não subiu, nenhuma rota respondeu)
//
// O 2 segue a doutrina do check-unbox-brand.mjs: gate que varre o vazio e diz "limpo" aprova
// sem ter olhado.
// ══════════════════════════════════════════════════════════════════════════════
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_EXTERNA = process.env.PLACEHOLDER_BASE ?? process.env.QA_BASE ?? null;

// Cada padrão precisa ser algo que NÃO pode aparecer legitimamente numa loja pronta. É por isso
// que "TODO" exige os dois-pontos e "preencher" exige a frase inteira: a loja pode dizer
// "preencha o CEP" sem estar quebrada.
const PADROES = [
  [/\[NOME DA LOJA\]/i, "nome da loja não preenchido"],
  [/\[CNPJ\]/i, "CNPJ não preenchido (e /termos e /privacidade são indexáveis)"],
  [/\[[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 ,._/-]{3,}\]/, "campo entre colchetes em CAIXA ALTA: placeholder do template"],
  [/\bTODO:/, "TODO: visível na página"],
  [/preencher este arquivo|preencha este arquivo/i, "instrução de preenchimento servida ao público"],
  [/lorem ipsum/i, "lorem ipsum"],
  [/Minha Loja/, 'nome placeholder da foundation ("Minha Loja")'],
  [/sua marca/i, 'logo placeholder da foundation ("sua marca")'],
  [/Cliente [A-C]\./, "depoimento placeholder (Cliente A/B/C)"],
];

// As rotas que mais carregam placeholder: as legais (texto longo que ninguém relê), o checkout
// (onde o logo do caso real vazou) e as de catálogo.
const ROTAS_FIXAS = [
  "/", "/produtos", "/busca", "/carrinho", "/checkout",
  "/termos", "/privacidade", "/devolucoes", "/conta/entrar", "/llms.txt",
];

function portaLivre() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

async function noAr(base) {
  try {
    const r = await fetch(base, { signal: AbortSignal.timeout(3000) });
    return r.ok || r.status < 500;
  } catch {
    return false;
  }
}

async function subirServidor() {
  if (!fs.existsSync(path.join(RAIZ, ".next"))) return null;
  const porta = await portaLivre();
  const proc = spawn("npx", ["next", "start", "-p", String(porta)], { cwd: RAIZ, stdio: "ignore" });
  const base = `http://localhost:${porta}`;
  for (let i = 0; i < 40; i++) {
    if (await noAr(base)) return { base, proc };
    await new Promise((r) => setTimeout(r, 500));
  }
  proc.kill();
  return null;
}

/** Descobre uma PDP e uma categoria reais no sitemap: são as rotas que o gate não pode adivinhar. */
async function rotasDoSitemap(base) {
  try {
    const xml = await (await fetch(`${base}/sitemap.xml`, { signal: AbortSignal.timeout(8000) })).text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const caminho = (u) => { try { return new URL(u).pathname; } catch { return null; } };
    const pdp = urls.map(caminho).find((p) => p?.startsWith("/produto/"));
    const cat = urls.map(caminho).find((p) => p?.startsWith("/categoria/"));
    return [pdp, cat].filter(Boolean);
  } catch {
    return [];
  }
}

/** SVG é texto: um logotipo com o nome errado dentro é encontrável. PNG e JPG não são. */
function varrerAssetsDeMarca() {
  const achados = [];
  const dir = path.join(RAIZ, "public", "brand");
  if (!fs.existsSync(dir)) return achados;
  const pilha = [dir];
  let raster = 0;
  while (pilha.length) {
    const atual = pilha.pop();
    for (const e of fs.readdirSync(atual, { withFileTypes: true })) {
      const p = path.join(atual, e.name);
      if (e.isDirectory()) { pilha.push(p); continue; }
      if (/\.(png|jpe?g|webp|avif)$/i.test(e.name)) { raster++; continue; }
      if (!/\.svg$/i.test(e.name)) continue;
      const t = fs.readFileSync(p, "utf8");
      for (const [rx, motivo] of PADROES) {
        const m = t.match(rx);
        if (m) achados.push({ onde: path.relative(RAIZ, p), motivo, trecho: m[0].slice(0, 60) });
      }
    }
  }
  return { achados, raster };
}

// ⚠️ NÃO usar "o que estiver na 3000". No primeiro uso deste gate, a porta 3000 tinha OUTRO
// projeto de pé e o gate mediu a loja errada: teria aprovado esta e reprovado aquela, com a
// mesma confiança. Sem base explícita, ele sobe o PRÓPRIO servidor a partir do .next daqui.
let base = null;
let servidor = null;
if (BASE_EXTERNA) {
  base = (await noAr(BASE_EXTERNA)) ? BASE_EXTERNA : null;
  if (!base) {
    console.error(`\n✗ o gate NÃO RODOU: ${BASE_EXTERNA} não respondeu.\n`);
    process.exit(2);
  }
} else {
  servidor = await subirServidor();
  base = servidor?.base ?? null;
}
if (!base) {
  console.error(
    "\n✗ o gate NÃO RODOU: não há build de produção para subir (.next ausente).\n" +
    "   Rode `npm run build` antes, ou aponte para um servidor já de pé:\n" +
    "   PLACEHOLDER_BASE=https://sua-loja.vercel.app npm run unbox:placeholder\n",
  );
  process.exit(2);
}

console.log(`Varrendo o HTML servido em ${base}${servidor ? " (servidor próprio, subido para esta medição)" : " (base externa informada)"}`);
const rotas = [...ROTAS_FIXAS, ...(await rotasDoSitemap(base))];
const achados = [];
let respondidas = 0;

for (const rota of rotas) {
  let html;
  try {
    const r = await fetch(`${base}${rota}`, { signal: AbortSignal.timeout(15000), redirect: "follow" });
    html = await r.text();
    if (r.status >= 500) continue;
    respondidas++;
  } catch {
    continue;
  }
  for (const [rx, motivo] of PADROES) {
    const m = html.match(rx);
    if (m) achados.push({ onde: rota, motivo, trecho: m[0].slice(0, 60) });
  }
}

// Os assets varridos são os DESTE projeto, mesmo quando a base é externa: um é o que está no
// ar, o outro é o que está no disco, e misturar os dois sem dizer confunde o diagnóstico.
const assets = varrerAssetsDeMarca();
achados.push(...assets.achados);
if (servidor) servidor.proc.kill();

if (respondidas === 0) {
  console.error("\n✗ o gate NÃO RODOU: nenhuma rota respondeu. O build está de pé?\n");
  process.exit(2);
}

if (achados.length) {
  console.error(`\n✗ PLACEHOLDER NO AR — ${achados.length} ocorrência(s) em ${respondidas} rotas varridas:\n`);
  for (const a of achados) console.error(`   ${a.onde.startsWith("/") ? base + a.onde : a.onde + " (arquivo local)"}\n      [${a.motivo}]  "${a.trecho}"`);
  console.error(
    "\n  Isto é o que o público vê, não o que está no código. Página legal com colchete vazio é\n" +
    "  indexável, e nome de loja errado no logo do checkout aparece na hora de pagar.\n",
  );
  process.exit(1);
}

console.log(`✓ Sem placeholder no ar (${respondidas} rotas + ${assets.achados.length === 0 ? "assets SVG" : "assets"} varridos)`);
if (assets.raster) {
  console.log(
    `   nota: ${assets.raster} imagem(ns) raster em public/brand não podem ser varridas por texto.\n` +
    "   Logotipo com o nome errado dentro de um PNG só aparece olhando. Confira o do checkout.",
  );
}
process.exit(0);
