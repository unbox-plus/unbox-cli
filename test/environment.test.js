// As regras puras do `unbox env`: o que vai, o que fica e por quê.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadProjectEnv } from "../src/env.js";
import {
  VALUE_MAX,
  credenciaisSoNoTerminal,
  isReserved,
  joiIndex,
  lotes,
  mensagemPulada,
  planSet,
  validaUnset,
} from "../src/environment.js";

const criadas = [];
afterEach(() => {
  for (const k of criadas.splice(0)) delete process.env[k];
});

/** `loadProjectEnv` de verdade sobre um .env.local temporário, com o process.env real. */
function carrega(conteudo, terminal = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "unbox-env-"));
  fs.writeFileSync(path.join(dir, ".env.local"), conteudo);
  for (const [k, v] of Object.entries(terminal)) {
    process.env[k] = v;
    criadas.push(k);
  }
  return loadProjectEnv({ dir });
}

test("reservadas: nomes e prefixos do backend", () => {
  for (const k of ["NEXT_PUBLIC_SITE_URL", "TZ", "VERCEL_URL", "NEXT_PUBLIC_VERCEL_ENV", "NOW_REGION", "AWS_REGION", "LAMBDA_X"]) {
    assert.ok(isReserved(k), k);
  }
  for (const k of ["UNBOX_USER", "NEXT_PUBLIC_SITE_NAME", "TZX", "MY_VERCEL_URL"]) assert.ok(!isReserved(k), k);
});

test("planSet: só as chaves do arquivo, e cada pulada com o motivo", () => {
  const loaded = carrega([
    "UNBOX_USER=api_loja",
    "VAZIA=",
    "NEXT_PUBLIC_SITE_URL=http://localhost:3000",
    "TZ=America/Sao_Paulo",
    "minuscula=x",
    "COM-HIFEN=x",
    `${"A".repeat(257)}=x`,
    `GRANDE=${"x".repeat(VALUE_MAX + 1)}`,
    "REF=${INDEFINIDA_UNBOX_TESTE}",
    "",
  ].join("\n"));
  const { set, skipped } = planSet(loaded);
  assert.deepEqual(set.map((x) => x.key), ["UNBOX_USER"]);
  assert.deepEqual(skipped.map((x) => [x.key.slice(0, 20), x.reason]), [
    ["VAZIA", "vazia"],
    ["NEXT_PUBLIC_SITE_URL", "gerenciada"],
    ["TZ", "reservada"],
    ["minuscula", "nome_invalido"],
    ["COM-HIFEN", "nome_invalido"],
    ["A".repeat(20), "nome_invalido"],
    ["GRANDE", "valor_grande"],
    ["REF", "vazia"],
  ]);
  // Nada do ambiente do processo entra: PATH e HOME existem, mas não estão no arquivo.
  assert.ok(!set.some((x) => x.key === "PATH" || x.key === "HOME"));
});

test("planSet: o limite do valor é em caracteres, como no backend (acento conta 1)", () => {
  const loaded = carrega(`ACENTO="${"ç".repeat(VALUE_MAX)}"\n`);
  assert.equal(planSet(loaded).set.length, 1);
});

test("planSet: o terminal vence o arquivo, a expansão usa o terminal, e só chave do arquivo vai", () => {
  const loaded = carrega("DUP_UNBOX_TESTE=do-arquivo\nREF_UNBOX_TESTE=$SO_TERMINAL_UNBOX_TESTE-y\n", {
    DUP_UNBOX_TESTE: "do-terminal",
    SO_TERMINAL_UNBOX_TESTE: "t",
  });
  const { set, fromTerminal } = planSet(loaded);
  assert.deepEqual(set, [
    { key: "DUP_UNBOX_TESTE", value: "do-terminal" },
    { key: "REF_UNBOX_TESTE", value: "t-y" },
  ]);
  assert.deepEqual(fromTerminal, ["DUP_UNBOX_TESTE"]);
});

test("credenciaisSoNoTerminal: a que o login usou e o arquivo não tem", () => {
  const loaded = carrega("UNBOX_PARTNER_API_KEY=k\nUNBOX_USER=u\n", { UNBOX_PASS: "senha-do-terminal" });
  assert.deepEqual(credenciaisSoNoTerminal(loaded), ["UNBOX_PASS"]);
});

test("lotes: 50 por chamada", () => {
  const itens = Array.from({ length: 101 }, (_, i) => i);
  assert.deepEqual(lotes(itens.slice(0, 50)).map((l) => l.length), [50]);
  assert.deepEqual(lotes(itens.slice(0, 51)).map((l) => l.length), [50, 1]);
  assert.deepEqual(lotes(itens).map((l) => l.length), [50, 50, 1]);
});

test("validaUnset: vazia, reservada e nome inválido são uso incorreto; repetida some", () => {
  assert.throws(() => validaUnset([]), (e) => e.code === "USAGE");
  assert.throws(() => validaUnset(["NEXT_PUBLIC_SITE_URL"]), (e) => e.code === "USAGE" && /gerenciada/.test(e.message));
  assert.throws(() => validaUnset(["VERCEL_URL"]), (e) => e.code === "USAGE");
  assert.throws(() => validaUnset(["minuscula"]), (e) => e.code === "USAGE");
  assert.deepEqual(validaUnset(["A", "B", "A"]), ["A", "B"]);
});

test("joiIndex: mensagens reais da validação do backend", () => {
  assert.deepEqual(joiIndex(new Error('"set[3].key" must start with an uppercase letter followed by uppercase letters, digits or _')), { campo: "set", i: 3 });
  assert.deepEqual(joiIndex(new Error('"set[1]" contains a duplicate value')), { campo: "set", i: 1 });
  assert.deepEqual(joiIndex(new Error('"unset[0]" length must be less than or equal to 256 characters long')), { campo: "unset", i: 0 });
  // Como o SDK entrega: a mensagem em errors[] e o erro original em cause.
  const doSdk = Object.assign(new Error("GraphQL"), { cause: { errors: [{ message: '"set[7].value" is not allowed to be empty' }] } });
  assert.deepEqual(joiIndex(doSdk), { campo: "set", i: 7 });
  assert.equal(joiIndex(new Error("must be something else")), undefined);
});

test("mensagemPulada: só o nome, nunca o valor", () => {
  assert.match(mensagemPulada({ key: "NEXT_PUBLIC_SITE_URL", reason: "gerenciada" }), /gerenciada pela Unbox/);
  assert.match(mensagemPulada({ key: "X", reason: "reservada_nova" }), /Atualize a CLI/);
});
