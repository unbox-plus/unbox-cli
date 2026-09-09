// ═══════════════════════════════════════════════════════════════════════════
// GATE DE HONESTIDADE (M5) — o bloqueio é contra fabricação
// SILENCIOSA, não contra a escolha do lojista. Roda no QA visual (agente 16) e
// sempre que quiser: npm run unbox:honestidade
//
// A foundation NÃO nasce mais com placeholder de prova social ("793 vendidos",
// "25.347 avaliações", Cliente A/B/C, estoque que desce sozinho): tudo isso foi ao
// ar em loja real e saiu na v0.15.6. Regra: dado que a loja não tem, o bloco não
// renderiza. Num scaffold novo este gate sai VERDE. Ele existe para pegar o que o
// briefing ou alguém adicionar depois sem lastro — e o lojista continua podendo
// decidir manter algo (a loja é dele), registrando na allowlist abaixo.
//
// Decisão tomada (dado real confirmado OU o lojista mandou manter)? Registre a
// substring exata em marca/honestidade-permitido.txt (uma por linha, com quem
// decidiu anotado no DESIGN-<MARCA>.md) — a linha para de ser flagrada.
//
// ── O QUE ESTE GATE VÊ, E O QUE ELE NÃO VÊ ──────────────────────────────────
// Ele lê CÓDIGO-FONTE (.ts/.tsx em components, app e lib), não a página renderizada.
// Isso é de propósito: componente que não renderiza no ambiente atual — o grid do
// catálogo com a loja em modo mockup, por exemplo — continua sendo varrido. A
// fabricação que aparece só no dia em que o catálogo real é conectado, depois da
// revisão humana, é justamente a mais perigosa.
//
// O limite real dele é OUTRO: ele só acha o que algum padrão descreve. Toda
// fabricação que passou até hoje passou por falta de padrão, não por falta de
// alcance. Achou uma? Some com ela E adicione o padrão genérico aqui — senão ela
// volta no próximo componente.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Padrões de fabricação conhecidos da foundation + genéricos suspeitos.
// [regex, explicação curta do porquê é mentira até prova em contrário]
const PATTERNS = [
  [/vendidos esta semana/i, "contador de vendas fixo, sem dado real"],
  [/\b25\.?347\b/, "número de avaliações fabricado da foundation"],
  [/Cliente [A-C]\./, "depoimento placeholder (Cliente A/B/C)"],
  [/Quem usa, recomenda/i, "bloco de depoimentos placeholder"],
  [/ratingValue["':\s]*["'`]?\d|reviewCount["':\s]*(String\()?["'`]?\d/, "nota/contagem LITERAL em dado estruturado (Google): só com avaliações reais"],
  [/MAIS VENDIDO/, "selo de venda sem dado de venda"],
  [/devolu[cç][aã]o em (at[eé] )?30 dias|devolvemos seu dinheiro em at[eé] 30 dias/i, "política de devolução: confirme se existe MESMO"],
  [/validade (?:é )?de 24 meses/i, "validade inventada: leia do rótulo real"],
  [/Apenas .*unidades.*neste pre[cç]o/i, "urgência de estoque fabricada"],
  [/ratingCount\s*=\s*"[\d.,]+k?"/, "contagem de avaliações default no código"],
  // ── Promessas e contadores que apareciam nos docs dos módulos (CRO/SEO) sem dado por trás ──
  [/\d+\s*pessoas\s+(?:compraram|est[ãa]o vendo|visualizando|acabaram de)/i, "contador de compras/visitas fabricado"],
  [/compraram\s+(?:hoje|nas [úu]ltimas\s*\d+\s*(?:h|horas))/i, "contador de compras por janela de tempo sem dado real"],
  [/frete gr[áa]tis (?:acima de|a partir de) R\$\s*\d/i, "frete grátis LITERAL: o valor vem de FREE_SHIPPING_THRESHOLD, e só se existir"],
  [/entrega r[áa]pida/i, "promessa de prazo sem SLA real (é do lojista, não da foundation)"],
  [/satisfa[cç][aã]o garantida/i, "garantia sem política real por trás"],
  [/troc(?:a|amos|as)(?: gr[áa]tis)? em (?:at[eé] )?(?!7 dias)\d+ dias/i, "prazo de troca diferente do CDC (7 dias): confirme com o lojista"],

  // ── Nota/contagem LITERAL na marcação (lacuna que deixou passar o grid da PDP) ──
  // Os padrões acima nomeavam números específicos da foundation ("25.347") ou props
  // conhecidas. Uma nota escrita direto no JSX — <b>4,8</b> ao lado de um ícone de
  // estrela, com "(2,1k)" do lado — não casava com nenhum, e sobreviveu no
  // components/product/pdp/catalog-grid.tsx. Estes são genéricos de propósito: qualquer
  // nota ou volume de avaliação escrito à mão precisa de decisão, não só os da foundation.
  [/<b>\s*[1-5][.,]\d\s*<\/b>/, "nota LITERAL escrita na marcação: sem avaliação real, a loja não exibe nota"],
  [/>\s*\(\s*\d+[.,]?\d*\s*k\s*\)\s*</i, "volume de avaliações abreviado e fixo (ex.: \"(2,1k)\") escrito à mão"],
  // As duas ordens: "avaliações: 12,4 mil" e "12,4 mil avaliações".
  [/(?:avalia[cç][oõ]es|reviews)["'`:\s>]+\d[\d.,]*\s*(?:k|mil)?\b/i, "contagem de avaliações fixa no texto"],
  [/\d[\d.,]*\s*(?:k|mil)\s+(?:avalia[cç][oõ]es|reviews|clientes|compradores)/i, "volume fixo de avaliações/clientes no texto"],
  [/\b[1-5][.,]\d\s*(?:de\s*5|\/\s*5|estrelas)\b/i, "nota fixa em texto corrido"],
];

const SCAN_DIRS = ["components", "app", "lib"];
const EXTS = new Set([".tsx", ".ts"]);

const allowPath = path.join(ROOT, "marca", "honestidade-permitido.txt");
const allow = fs.existsSync(allowPath)
  ? fs.readFileSync(allowPath, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  : [];

const findings = [];
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== "node_modules") scan(p); continue; }
    if (!EXTS.has(path.extname(entry.name))) continue;
    const lines = fs.readFileSync(p, "utf8").split("\n");
    lines.forEach((line, i) => {
      // Comentário não chega ao usuário — o gate mira o que a loja EXIBE.
      const t = line.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*")) return;
      for (const [re, why] of PATTERNS) {
        if (!re.test(line)) continue;
        if (allow.some((a) => line.includes(a))) continue;
        findings.push({ file: path.relative(ROOT, p), line: i + 1, text: line.trim().slice(0, 110), why });
        break;
      }
    });
  }
}
for (const d of SCAN_DIRS) { const p = path.join(ROOT, d); if (fs.existsSync(p)) scan(p); }

if (findings.length) {
  console.error(`\n✗ HONESTIDADE — ${findings.length} item(ns) fabricado(s) SEM decisão do lojista:\n`);
  for (const f of findings) {
    console.error(`   ${f.file}:${f.line}  [${f.why}]`);
    console.error(`      ${f.text}`);
  }
  console.error(`\n  Cada item precisa de UMA decisão: dado real, estado honesto, ou o lojista mandou`);
  console.error(`  manter (aí registre a substring em marca/honestidade-permitido.txt). O que não`);
  console.error(`  pode é ir pro ar sem ninguém ter sido perguntado.\n`);
  process.exit(1);
}
console.log("✓ Honestidade ok: nada fabricado sem decisão do lojista.");
