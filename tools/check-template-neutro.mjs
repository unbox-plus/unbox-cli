// ═══════════════════════════════════════════════════════════════════════════════════════
// GATE DE NEUTRALIDADE DO TEMPLATE — roda no `prepack`, e o pack FALHA se reprovar.
//
// Por que existe: a foundation nasceu de uma loja de temperos e, por duas varreduras, ainda
// entregava loja de outro ramo com "polvilhe sobre o alimento", "escolha o molho", aba
// nutricional com traços e selo "Sem glúten" inventado. As varreduras anteriores olharam COR
// e NOME DE CLIENTE; o que vazava era VOCABULÁRIO DE DOMÍNIO. Este gate olha isso.
//
// Por que aqui e NÃO no projeto gerado: uma loja de alimento pode e deve dizer "polvilhe"
// depois do briefing. O que não pode é a FOUNDATION dizer. Então a checagem é no repositório
// do CLI, antes de empacotar — e nunca viaja para o cliente.
//
// Escopo: código e docs que o agente lê ou o cliente vê. Comentário conta: comentário
// ensina o agente a escrever igual.
// ═══════════════════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = path.join(RAIZ, "template");
const EXTS = new Set([".ts", ".tsx", ".md", ".json", ".css", ".svg", ".txt", ".mjs"]);
const IGNORAR_DIRS = new Set(["node_modules", ".next", "qa"]);

// [regex, por quê]. Só termos SEM uso legítimo numa foundation neutra. "alimento",
// "nutricional", "glúten" ficam de fora de propósito: aparecem em código CONDICIONAL correto
// ("tabela nutricional só se for alimento") e o gate não pode punir isso.
const PROIBIDOS = [
  [/\bbadia\b|\bblessy\b|\bzetona\b|\bzétona\b|\boddie\b/i, "nome de cliente"],
  [/polvilh/i, "instrução de uso de tempero"],
  [/\btemperos?\b|\btempere\b|\btemperad[oa]s?\b/i, "vocabulário de tempero"],
  [/\bespeciarias?\b|\bcondimentos?\b/i, "vocabulário de tempero"],
  [/p[aá]prica|or[eé]gano|cominho|a[cç]afr[aã]o|chimichurri|lemon pepper|sriracha|garlic|alho em p[oó]/i, "produto de tempero"],
  [/\bmolhos?\b(?! de contato)/i, "produto de alimentação"],
  [/marinad[ao]s?|churrasco|festa junina/i, "contexto de alimentação"],
  [/\bsabor(es)?\b/i, "copy de alimentação ('mais sabor')"],
  [/porção 1 ?g\b/i, "porção de tempero cravada"],
  [/Cliente [A-C]\. .*(tempero|prato|receita de)/i, "depoimento de alimentação"],
];

// Trechos permitidos: a explicação do próprio bug, em comentário, precisa poder citar a
// palavra uma vez. Mantém a lista CURTA — todo item aqui é uma exceção que alguém revisou.
const PERMITIDOS = [
  "tools/",                                  // este diretório
  "README.md::### v0.15",                    // changelog descreve o bug
];

const achados = [];
function varrer(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) { if (!IGNORAR_DIRS.has(ent.name)) varrer(p); continue; }
    if (!EXTS.has(path.extname(ent.name))) continue;
    const rel = path.relative(RAIZ, p);
    const linhas = fs.readFileSync(p, "utf8").split("\n");
    linhas.forEach((linha, i) => {
      for (const [re, motivo] of PROIBIDOS) {
        if (!re.test(linha)) continue;
        const chave = `${rel}::${linha.trim().slice(0, 30)}`;
        if (PERMITIDOS.some((ok) => rel.startsWith(ok) || chave.startsWith(ok))) continue;
        achados.push({ rel, n: i + 1, motivo, texto: linha.trim().slice(0, 110) });
        break;
      }
    });
  }
}
varrer(TEMPLATE);

// ── Travessão no texto que o CLI IMPRIME ─────────────────────────────────────
// O template tem gate próprio (scripts/check-unbox-brand.mjs). Aqui pega o outro lado: as
// perguntas, avisos e mensagens do wizard, e os cabeçalhos que o CLI escreve dentro do projeto.
// Comentário de código fica de fora: é nota de engenharia, não texto para quem lê a tela.
function semComentario(linha, dentroDeBloco) {
  let out = "", aspas = null, bloco = dentroDeBloco;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i], prox = linha[i + 1];
    if (bloco) { if (c === "*" && prox === "/") { bloco = false; i++; } continue; }
    if (aspas) {
      if (c === "\\") { out += c + (prox ?? ""); i++; continue; }
      if (c === aspas) aspas = null;
      out += c; continue;
    }
    if (c === '"' || c === "'" || c === "`") { aspas = c; out += c; continue; }
    if (c === "/" && prox === "/") break;
    if (c === "/" && prox === "*") { bloco = true; i++; continue; }
    out += c;
  }
  return { texto: out, bloco };
}
for (const arquivo of ["bin/cli.js", "src/theme.js", "src/presets.js", "src/colors.js"]) {
  const caminho = path.join(RAIZ, arquivo);
  if (!fs.existsSync(caminho)) continue;
  let bloco = false;
  fs.readFileSync(caminho, "utf8").split("\n").forEach((linha, i) => {
    const r = semComentario(linha, bloco);
    bloco = r.bloco;
    if (r.texto.includes("\u2014")) {
      achados.push({ rel: arquivo, n: i + 1, motivo: "travessão no texto impresso pelo CLI", texto: linha.trim().slice(0, 110) });
    }
  });
}

if (achados.length) {
  console.error(`\n✗ PACK BLOQUEADO — a foundation tem ${achados.length} resíduo(s) de domínio:\n`);
  for (const a of achados) console.error(`   ${a.rel}:${a.n}  [${a.motivo}]\n      ${a.texto}`);
  console.error("\n  A foundation é neutra: nada de vocabulário de um ramo específico, nem em comentário.");
  console.error("  E o texto que o CLI imprime não usa travessão: vírgula, dois-pontos, ponto ou \"·\".");
  console.error("  Loja de alimento escreve isso DEPOIS, no briefing. Corrija e rode de novo.\n");
  process.exit(1);
}
console.log("✓ Foundation neutra (sem vocabulário de domínio nem nome de cliente)");
