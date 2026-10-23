import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, extractGlobals } from "../src/args.js";
import { UsageError } from "../src/errors.js";

test("globais saem de qualquer posição e o resto fica na ordem", () => {
  const a = extractGlobals(["-y", "create", "loja", "--estilo", "boutique", "--json"]);
  assert.deepEqual(a.globals, { yes: true, json: true });
  assert.deepEqual(a.rest, ["create", "loja", "--estilo", "boutique"]);
  const b = extractGlobals(["create", "loja", "--yes"]);
  assert.deepEqual(b.globals, { yes: true });
  assert.deepEqual(b.rest, ["create", "loja"]);
});

test("globais com valor: --dir x e --env-file=y", () => {
  const { globals } = extractGlobals(["status", "--dir", "/tmp/loja", "--env-file=.env"]);
  assert.deepEqual(globals, { dir: "/tmp/loja", "env-file": ".env" });
});

test("global de valor sem valor é erro de uso", () => {
  assert.throws(() => extractGlobals(["status", "--dir"]), UsageError);
  assert.throws(() => extractGlobals(["status", "--dir", "--json"]), UsageError);
  assert.throws(() => extractGlobals(["--json=1"]), UsageError);
});

test("parseArgs: booleana, valor, alias e negação declarada", () => {
  const spec = { force: { type: "boolean", short: "f" }, commit: { type: "string" }, build: { type: "boolean", negatable: true } };
  assert.deepEqual(parseArgs(["-f", "--commit", "abc", "x"], spec), { flags: { force: true, commit: "abc" }, positional: ["x"] });
  assert.deepEqual(parseArgs(["--commit=a=b", "--no-build"], spec).flags, { commit: "a=b", build: false });
});

test("parseArgs: desconhecida, valor ausente e valor em booleana são erro de uso", () => {
  const spec = { commit: { type: "string" }, force: { type: "boolean" } };
  assert.throws(() => parseArgs(["--comit", "x"], spec), /Flag desconhecida: "--comit"/);
  assert.throws(() => parseArgs(["--commit"], spec), UsageError);
  assert.throws(() => parseArgs(["--force=sim"], spec), UsageError);
  assert.throws(() => parseArgs(["-z"], spec), UsageError);
});
