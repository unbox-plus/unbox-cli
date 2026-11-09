#!/usr/bin/env node
// GATE DA MIGRAÇÃO — node tools/check-migracao.mjs [--versao X.Y.Z]
//
// Recusa fechar uma versão sem a ficha dela em MIGRACAO.md. Roda no `prepack` (antes do `npm pack`/`publish`)
// e no `tools/github-release.mjs` (antes de criar a tag). Confere:
//
//   1. MIGRACAO.md tem a seção `## <versão do package.json>` com os cinco títulos do formato
//      (Template, Loja já gerada, Ambiente, Mudanças de comportamento, Armadilhas), nenhum vazio.
//   2. src/version-markers.json é válido e cada marcador BATE no template/ atual: um arquivo de marcador
//      renomeado ou apagado faria toda loja daquela versão em diante ser lida como anterior, em silêncio.
//   3. Versão anterior ao carimbo (`carimbo.desde`) tem marcador; da `desde` em diante o carimbo
//      `unbox.templateVersion` do package.json da loja é a fonte e o marcador é opcional.
//
// Por que um gate e não um lembrete: a ficha é o que uma migração de loja consome, e documentação que o release
// aceita publicar sem ela é a que fica para trás na primeira versão apertada. Saída 0 = ok; 1 = reprovado,
// dizendo o quê.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = path.join(RAIZ, "template");
const TITULOS = ["Template", "Loja já gerada", "Ambiente", "Mudanças de comportamento", "Armadilhas"];

const argVersao = process.argv.indexOf("--versao");
const versao = argVersao > -1 ? process.argv[argVersao + 1] : JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8")).version;
const falhas = [];

// 1. a seção da versão em MIGRACAO.md
const md = fs.readFileSync(path.join(RAIZ, "MIGRACAO.md"), "utf8");
const secoes = md.split(/^## (?=\S)/m).slice(1);
const secao = secoes.find((s) => s.split("\n")[0].trim().startsWith(versao));
if (!secao) {
  falhas.push(`MIGRACAO.md não tem a seção \`## ${versao}\`. Escreva a ficha da versão (o formato está no topo do arquivo).`);
} else {
  for (const t of TITULOS) {
    const m = secao.match(new RegExp(`^### ${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=^### |\\s*$)`, "m"));
    if (!m) falhas.push(`MIGRACAO.md, seção ${versao}: falta \`### ${t}\`.`);
    else if (!m[1].trim()) falhas.push(`MIGRACAO.md, seção ${versao}: \`### ${t}\` está vazio (escreva "nada" ou "nenhuma conhecida" quando for o caso).`);
  }
}

// 2 e 3. a tabela de marcadores
const tabela = JSON.parse(fs.readFileSync(path.join(RAIZ, "src", "version-markers.json"), "utf8"));
const vt = (v) => v.split(".").map(Number);
const menor = (a, b) => { const x = vt(a), y = vt(b); for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0); return false; };
function confere([tipo, rel, regex]) {
  const alvo = path.join(TEMPLATE, rel);
  if (tipo === "file") return fs.existsSync(alvo) && fs.statSync(alvo).isFile();
  if (tipo === "dir") return fs.existsSync(alvo) && fs.statSync(alvo).isDirectory();
  if (!fs.existsSync(alvo)) return false;
  const hit = new RegExp(regex).test(fs.readFileSync(alvo, "utf8"));
  return tipo === "grep" ? hit : !hit;
}
for (const m of tabela.marcadores) {
  for (const c of m.checagens) {
    if (!confere(c)) falhas.push(`marcador ${m.versao} não bate no template/ atual: ${JSON.stringify(c)}. Arquivo renomeado ou apagado? Toda loja ${m.versao}+ seria lida como anterior.`);
  }
}
const temMarcador = tabela.marcadores.some((m) => m.versao === versao);
if (menor(versao, tabela.carimbo.desde) && !temMarcador && !tabela.marcadores.some((m) => !menor(m.versao, versao))) {
  falhas.push(`a versão ${versao} é anterior ao carimbo (${tabela.carimbo.desde}) e não tem marcador em src/version-markers.json.`);
}

if (falhas.length) {
  console.error(`check-migracao: ${falhas.length} problema(s) na versão ${versao}:`);
  for (const f of falhas) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`check-migracao: ${versao} tem a ficha em MIGRACAO.md e os ${tabela.marcadores.length} marcadores batem no template.`);
