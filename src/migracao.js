// O MIGRACAO.md do pacote: uma ficha por versão, no formato fixo do topo dele. Aqui ele é lido e filtrado
// (`base < versão ≤ atual`) para o `analyze-version` dizer o que mudou e o `upgrade-template` listar o que
// ficou para fazer à mão (ambiente, mudanças de comportamento, armadilhas).
import fs from "node:fs";
import path from "node:path";
import { PACKAGE_ROOT } from "./paths.js";
import { compareVersions } from "./template-diff.js";

const TITULO = /^## (\d+\.\d+\.\d+)(?: a (\d+\.\d+\.\d+))?\b/;
export const SECOES = ["Template", "Loja já gerada", "Ambiente", "Mudanças de comportamento", "Armadilhas"];

/** `[{ versao, ate, titulo, secoes: { Template, "Loja já gerada", ... } }]`, na ordem do arquivo (decrescente). */
export function parseMigracao(markdown) {
  const fichas = [];
  let atual = null, secao = null, emCodigo = false;
  for (const linha of markdown.split("\n")) {
    if (linha.startsWith("```")) emCodigo = !emCodigo;
    if (emCodigo) { if (atual && secao) atual.secoes[secao].push(linha); continue; }
    const t = linha.match(TITULO);
    if (t) {
      atual = { versao: t[1], ate: t[2] ?? t[1], titulo: linha.slice(3).trim(), secoes: Object.fromEntries(SECOES.map((s) => [s, []])) };
      fichas.push(atual);
      secao = null;
      continue;
    }
    if (linha.startsWith("## ")) { atual = null; secao = null; continue; }
    if (atual && linha.startsWith("### ")) { secao = linha.slice(4).trim(); if (!(secao in atual.secoes)) atual.secoes[secao] = []; continue; }
    if (atual && secao) atual.secoes[secao].push(linha);
  }
  for (const f of fichas) for (const s of Object.keys(f.secoes)) f.secoes[s] = f.secoes[s].join("\n").trim();
  return fichas;
}

export function lerMigracao(arquivo = path.join(PACKAGE_ROOT, "MIGRACAO.md")) {
  return parseMigracao(fs.readFileSync(arquivo, "utf8"));
}

/** As fichas que valem para quem sai de `base` e vai para `atual`: limite superior do intervalo > base, inferior ≤ atual. */
export function fichasEntre(fichas, base, atual) {
  return fichas.filter((f) => compareVersions(f.ate, base) > 0 && compareVersions(f.versao, atual) <= 0);
}

/** As variáveis de ambiente que entram (+) e saem (-) nas fichas, lidas das linhas "Ambiente". */
export function variaveisDasFichas(fichas) {
  const entram = new Set(), saem = new Set();
  for (const f of fichas) {
    const s = f.secoes["Ambiente"] ?? "";
    // "+ `A`, `B` (nota) · - `C`": cada sinal vale para os nomes até o próximo sinal ou o fim da linha.
    for (const linha of s.split("\n")) {
      for (const parte of linha.split(/\s·\s/)) {
        const m = parte.match(/^\s*([+-])\s*(.*)$/);
        if (!m) continue;
        for (const v of m[2].matchAll(/`([A-Z][A-Z0-9_]*)`/g)) (m[1] === "+" ? entram : saem).add(v[1]);
      }
    }
  }
  for (const v of saem) entram.delete(v);
  return { entram: [...entram], saem: [...saem] };
}
