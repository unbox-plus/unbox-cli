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
