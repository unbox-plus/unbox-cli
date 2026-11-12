// O medidor de receita do template (`template/scripts/check-recipe.mjs`) lê as famílias das seções PRÓPRIAS de
// `components/home/sections/familias.json`, da loja, para o script ser igual em toda loja (antes a loja editava
// o mapa dentro dele). Roda o script numa loja falsa, como a loja roda: `node scripts/check-recipe.mjs`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(RAIZ, "template/scripts/check-recipe.mjs");

function loja({ familias } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "unbox-recipe-"));
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.copyFileSync(SCRIPT, path.join(dir, "scripts/check-recipe.mjs"));
  fs.mkdirSync(path.join(dir, "components/home/sections"), { recursive: true });
  fs.writeFileSync(path.join(dir, "components/home/home-recipe.ts"),
    'export const r = [{ section: "hero" }, { section: "quiz-da-marca" }, { section: "kits" }];\n');
  if (familias !== undefined) fs.writeFileSync(path.join(dir, "components/home/sections/familias.json"), familias);
  return dir;
}

function mede(dir) {
  const r = spawnSync(process.execPath, ["scripts/check-recipe.mjs"], { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

test("sem familias.json, a seção própria aparece sem família e aponta o arquivo", () => {
  const out = mede(loja());
  assert.match(out, /seções sem família mapeada: quiz-da-marca/);
  assert.match(out, /components\/home\/sections\/familias\.json/);
  assert.match(out, /3 seções, 3 famílias/);
});

test("com familias.json, a seção própria entra na conta com a família declarada", () => {
  const out = mede(loja({ familias: JSON.stringify({ "quiz-da-marca": "grade" }) }));
  assert.doesNotMatch(out, /sem família mapeada/);
  assert.match(out, /3 seções, 2 famílias/);
  assert.match(out, /famílias: hero, grade/);
});

test("familias.json inválido ou com valor errado: avisa e segue (o medidor nunca reprova)", () => {
  assert.match(mede(loja({ familias: "{ nao é json" })), /não é JSON válido/);
  assert.match(mede(loja({ familias: "[]" })), /tem de ser um objeto/);
  const out = mede(loja({ familias: JSON.stringify({ "quiz-da-marca": 3 }) }));
  assert.match(out, /a família de "quiz-da-marca" tem de ser um texto/);
  assert.match(out, /sem família mapeada: quiz-da-marca/);
});

test("receita com a chave entre aspas, como o applyPreset escreve a home, também é medida", () => {
  const dir = loja();
  fs.writeFileSync(path.join(dir, "components/home/home-recipe.ts"),
    'export const r = [\n  {\n    "section": "hero"\n  },\n  {\n    "section": "kits"\n  }\n];\n');
  assert.match(mede(dir), /receita "home": 2 seções, 2 famílias/);
});

test("o script do template não carrega travessão", () => {
  assert.ok(!fs.readFileSync(SCRIPT, "utf8").includes("—"));
});
