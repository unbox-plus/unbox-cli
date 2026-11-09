// As skills de migração têm uma fonte (.claude/skills/) e uma cópia que vai para cada loja
// (template/.claude/skills/). Quem edita uma e esquece a outra cai aqui, antes do prepack.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { drift, SKILLS, FONTE, DESTINO } from "../tools/sync-skills.mjs";

test("skills de migração iguais na fonte e no template, e portáveis", () => {
  const falhas = drift();
  assert.deepEqual(falhas, [], `rode node tools/sync-skills.mjs:\n  ${falhas.join("\n  ")}`);
});

test("as duas skills existem nos dois lugares com SKILL.md", () => {
  for (const s of SKILLS) {
    assert.ok(fs.existsSync(path.join(FONTE, s, "SKILL.md")), `${s} sem SKILL.md na fonte`);
    assert.ok(fs.existsSync(path.join(DESTINO, s, "SKILL.md")), `${s} sem SKILL.md no template`);
  }
});

test("a skill chama a CLI pelo npx, não por caminho do repositório", () => {
  for (const s of SKILLS) {
    const md = fs.readFileSync(path.join(FONTE, s, "SKILL.md"), "utf8");
    assert.match(md, /npx --yes --package=@unbox-plus\/cli@latest unbox (analyze-version|upgrade-template)/);
  }
});
