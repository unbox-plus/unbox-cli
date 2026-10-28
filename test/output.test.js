import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createOutput, redact } from "../src/output.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const unbox = (...args) => spawnSync(process.execPath, [path.join(RAIZ, "bin/unbox.js"), ...args], { encoding: "utf8" });

function streams() {
  const out = { stdout: "", stderr: "" };
  return {
    out,
    stdout: { write: (s) => { out.stdout += s; } },
    stderr: { write: (s) => { out.stderr += s; } },
  };
}

/** stdout tem de ser exatamente um objeto JSON (uma linha), nada antes nem depois. */
function umJson(stdout) {
  const linhas = stdout.trim().split("\n");
  assert.equal(linhas.length, 1, `stdout com mais de uma linha: ${stdout}`);
  return JSON.parse(linhas[0]);
}

test("--json: progresso e aviso em stderr, resultado como um objeto em stdout", () => {
  const s = streams();
  const o = createOutput({ json: true, stdout: s.stdout, stderr: s.stderr });
  o.progress("fazendo login");
  o.warn("cuidado");
  o.result({ a: 1 }, () => "texto");
  assert.deepEqual(umJson(s.out.stdout), { ok: true, data: { a: 1 } });
  assert.match(s.out.stderr, /fazendo login/);
});

test("texto: falha em stderr com ✗, sem stack por padrão", () => {
  const s = streams();
  const o = createOutput({ stdout: s.stdout, stderr: s.stderr });
  o.fail(Object.assign(new Error("deu errado"), { code: "X" }));
  assert.equal(s.out.stdout, "");
  assert.equal(s.out.stderr, "\n✗ deu errado\n");
});

test("segredos somem da saída, na forma literal e na escapada em JSON", () => {
  const s = streams();
  const o = createOutput({ json: true, stdout: s.stdout, stderr: s.stderr });
  const senha = 'p"ss\\w$rd';
  o.addSecrets(senha, "da2-chave-do-parceiro", "abc");
  o.fail(new Error(`signIn: usuário api_x com senha ${senha} e chave da2-chave-do-parceiro recusado (abc)`));
  const err = umJson(s.out.stdout).error;
  assert.ok(!err.message.includes(senha));
  assert.ok(!err.message.includes("da2-chave-do-parceiro"));
  assert.ok(!s.out.stdout.includes(JSON.stringify(senha).slice(1, -1)));
  assert.match(err.message, /\(abc\)/, "valor curto não é filtrado");
  assert.equal(redact("x token-123456 y", ["token-123456"]), "x *** y");
});

test("unbox sem comando: ajuda em stderr, saída 2", () => {
  const r = unbox();
  assert.equal(r.status, 2);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /Comandos:/);
});

test("unbox --help: ajuda em stdout, saída 0", () => {
  const r = unbox("--help");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /create \[pasta\]/);
});

test("comando desconhecido: 2, e um JSON só com --json", () => {
  const r = unbox("--json", "nada");
  assert.equal(r.status, 2);
  assert.equal(umJson(r.stdout).error.code, "USAGE");
  assert.equal(unbox("nada").status, 2);
});

test("global sem valor com --json: o erro de parse também sai como JSON", () => {
  const r = unbox("--json", "--dir");
  assert.equal(r.status, 2);
  assert.equal(umJson(r.stdout).ok, false);
  // No create, o mesmo erro mantém a saída 1 do create.
  const c = unbox("create", "--json", "--dir");
  assert.equal(c.status, 1);
  assert.equal(umJson(c.stdout).ok, false);
});

test("create com --json: um JSON de erro de uso e saída 1, sem banner", () => {
  const r = unbox("create", "--json");
  assert.equal(r.status, 1);
  assert.equal(umJson(r.stdout).error.code, "USAGE");
});

test("create com --dir: erro de uso, saída 1", () => {
  const r = unbox("create", "x", "--dir", "/tmp");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /não usa --dir/);
});
