#!/usr/bin/env node
// Roda os medidores de sistema visual (sistema.py e vocabulario.py) em MODO RELATÓRIO:
// imprime e sai 0, sempre. Ainda não é gate.
//
// Por que relatório e não gate: os tetos dos scripts (8 tamanhos de tipo, 5 raios, 0 hex solto)
// vieram de uma medição só. Medido aqui contra cinco lojas geradas e contra a própria foundation,
// TODAS estouram, a foundation inclusive: ligar como gate hoje reprovaria o build de todo mundo,
// inclusive de um scaffold recém-criado que ninguém tocou. A régua se escolhe depois de ver a
// distribuição, e é isso que este comando serve para acumular.
//
// Python: os medidores são .py. Onde não houver python3 (imagem de build enxuta), este wrapper
// AVISA e segue. Um medidor que não rodou não pode derrubar deploy de loja.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEDIDORES = [
  { arquivo: "sistema.py", args: [], titulo: "Orçamento de sistema visual" },
  { arquivo: "vocabulario.py", args: [], titulo: "Cobertura do vocabulário gráfico" },
];

// TÍTULO COM TAMANHO NA CLASSE. h1..h4 têm tamanho, entrelinha e peso na escada de app/globals.css, FORA de
// @layer, e utilitária do Tailwind mora em @layer utilities: `text-[34px]`, `leading-*` ou `font-bold` num título
// perdem para a escada em silêncio, e só a captura mostra (é o título portado de uma loja antiga que sai menor).
// Em JS, e antes do Python, para avisar também onde não há python3. Relatório: não reprova nada.
function titulosComTamanhoNaClasse() {
  const achados = [];
  const UTIL = /(?:^|[\s"'`{(])(?:[a-z0-9-]+:)*(text-(?:\[(?:\d|clamp|calc|min|max)[^\]]*\]|xs|sm|base|lg|xl|[2-9]xl)|leading-[\w[\].-]+|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black))(?=[\s"'`})]|$)/g;
  const andar = (dir) => {
    let entradas = [];
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entradas) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { andar(p); continue; }
      if (!/\.(tsx|jsx)$/.test(e.name)) continue;
      const fonte = fs.readFileSync(p, "utf8");
      for (const m of fonte.matchAll(/<h([1-4])\b([^>]*)>/g)) {
        const classes = [...m[2].matchAll(UTIL)].map((x) => x[1]);
        if (!classes.length) continue;
        const linha = fonte.slice(0, m.index).split("\n").length;
        achados.push(`${path.relative(RAIZ, p)}:${linha} <h${m[1]}> ${[...new Set(classes)].join(" ")}`);
      }
    }
  };
  for (const d of ["app", "components"]) andar(path.join(RAIZ, d));
  if (!achados.length) return;
  console.log(`\n── Títulos com tamanho, entrelinha ou peso na classe (relatório, não bloqueia) ──`);
  console.log(`   ${achados.length} título(s): a escada de h1..h4 (app/globals.css) vence essas classes, e o título sai no tamanho dela.`);
  for (const a of achados.slice(0, 30)) console.log(`   ${a}`);
  if (achados.length > 30) console.log(`   … +${achados.length - 30}`);
  console.log("   Tamanho próprio de verdade: uma classe no bloco da escada, em clamp() e multiplicada por --unbox-escala-titulos");
  console.log("   (como .titulo-heroi-*), para o controle de títulos do lojista continuar valendo. Nunca revert-layer nem !important.");
}
titulosComTamanhoNaClasse();

function acharPython() {
  for (const cmd of ["python3", "python"]) {
    const r = spawnSync(cmd, ["--version"], { encoding: "utf8" });
    if (r.status === 0) return cmd;
  }
  return null;
}

const python = acharPython();
if (!python) {
  console.log("\nℹ️  medição de sistema visual pulada: python3 não encontrado nesta máquina.");
  console.log("   Os medidores são opcionais e não bloqueiam o build. Para rodar localmente:");
  console.log("   npm run unbox:sistema   ·   npm run unbox:vocabulario\n");
  process.exit(0);
}

for (const { arquivo, args, titulo } of MEDIDORES) {
  const script = path.join(RAIZ, "scripts", arquivo);
  if (!fs.existsSync(script)) continue;
  console.log(`\n── ${titulo} (relatório, não bloqueia) ──`);
  const r = spawnSync(python, [script, RAIZ, ...args], { encoding: "utf8" });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.status === 2) {
    // 2 é "o gate não rodou". Em modo relatório isso não derruba nada, mas precisa APARECER:
    // medidor que varre o vazio e diz "limpo" aprova sem ter olhado.
    process.stdout.write(r.stderr || "");
    console.log("   (o medidor não rodou: o resultado acima não vale como aprovação)");
  } else if (r.stderr) {
    process.stdout.write(r.stderr);
  }
}
console.log("\n   Números acima são linha de base, não reprovação. Régua ainda não definida.\n");
process.exit(0);
