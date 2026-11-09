#!/usr/bin/env node
// SKILLS DE MIGRAÇÃO: UMA FONTE, DUAS CÓPIAS. node tools/sync-skills.mjs [--check]
//
// As skills `migrar-loja-analisar` e `migrar-loja-executar` existem em dois lugares: `.claude/skills/` (onde um
// agente trabalhando neste repositório as usa e as edita) e `template/.claude/skills/` (o que cada loja recebe no
// `unbox create`, para poder migrar sozinha mais tarde). A fonte é `.claude/skills/`; a cópia do template é
// gerada por este script e nunca editada à mão.
//
//   sem flag   copia a fonte por cima do template (apaga o que sobrou lá);
//   --check    só compara, byte a byte, e reprova com a lista do que difere. Roda no `prepack` e em
//              `test/skills-sincronizadas.test.js`, então drift não passa nem no `npm test` nem no release.
//
// Além da igualdade, o --check recusa texto que só faz sentido neste repositório (caminho absoluto de uma máquina,
// `<repo-da-cli>`): a cópia vai para a loja, onde o repo da CLI não existe; a skill tem de chamar a CLI pelo npx.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SKILLS = ["migrar-loja-analisar", "migrar-loja-executar"];
export const FONTE = path.join(RAIZ, ".claude", "skills");
export const DESTINO = path.join(RAIZ, "template", ".claude", "skills");
const NAO_PORTAVEL = [/\/home\/[a-z0-9_-]+\//i, /\/Users\/[^/\s]+\//, /[A-Z]:\\Users\\/, /<repo-da-cli>/];

function arquivos(dir, prefixo = "") {
  if (!fs.existsSync(dir)) return [];
  const saida = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = prefixo ? `${prefixo}/${e.name}` : e.name;
    if (e.isDirectory()) saida.push(...arquivos(path.join(dir, e.name), rel));
    else saida.push(rel);
  }
  return saida;
}

/** Lista do que difere entre fonte e template; vazia = sincronizado. */
export function drift() {
  const falhas = [];
  for (const skill of SKILLS) {
    const f = path.join(FONTE, skill), d = path.join(DESTINO, skill);
    if (!fs.existsSync(f)) { falhas.push(`${path.relative(RAIZ, f)} não existe (a fonte sumiu).`); continue; }
    const af = arquivos(f), ad = arquivos(d);
    for (const rel of af) {
      const origem = fs.readFileSync(path.join(f, rel));
      for (const re of NAO_PORTAVEL) if (re.test(origem.toString("utf8"))) falhas.push(`.claude/skills/${skill}/${rel} tem texto que só vale neste repositório (${re}); a cópia vai para a loja.`);
      if (!ad.includes(rel)) { falhas.push(`template/.claude/skills/${skill}/${rel} falta.`); continue; }
      if (!origem.equals(fs.readFileSync(path.join(d, rel)))) falhas.push(`template/.claude/skills/${skill}/${rel} difere da fonte.`);
    }
    for (const rel of ad) if (!af.includes(rel)) falhas.push(`template/.claude/skills/${skill}/${rel} sobra (não está na fonte).`);
  }
  return falhas;
}

export function sincronizar() {
  for (const skill of SKILLS) {
    const f = path.join(FONTE, skill), d = path.join(DESTINO, skill);
    if (!fs.existsSync(f)) throw new Error(`${path.relative(RAIZ, f)} não existe.`);
    fs.rmSync(d, { recursive: true, force: true });
    fs.cpSync(f, d, { recursive: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    const falhas = drift();
    if (falhas.length) {
      console.error("Skills de migração fora de sincronia entre .claude/skills/ e template/.claude/skills/:");
      for (const f of falhas) console.error(`  - ${f}`);
      console.error("\nEdite a fonte em .claude/skills/ e rode `node tools/sync-skills.mjs` (ou `npm run sync:skills`). Se a edição foi feita na cópia do template, leve-a para a fonte primeiro: a cópia é sobrescrita.");
      process.exit(1);
    }
    console.log("Skills de migração sincronizadas com o template.");
  } else {
    sincronizar();
    console.log(`Copiadas para template/.claude/skills/: ${SKILLS.join(", ")}.`);
  }
}
