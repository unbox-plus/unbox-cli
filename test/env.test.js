import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { envValue, parseEnvContents, loadProjectEnv, requireCredentials, describeOrigins } from "../src/env.js";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "unbox-env-"));

// Os valores que já quebraram o signIn de alguém, mais os que o envValue escolhe formatos diferentes.
const ADVERSOS = [
  "#minhaSenha$123", "a$1b", "$HOME", "${HOME}", "pa ss", "x`y$z", "'aspas simples'",
  '"aspas duplas"', "a#b", "\\$x", "tab\there", "plain", "", "=igual=", "ç acentuação",
];

test("ida e volta: o que o create grava volta idêntico pelo parser do Next", () => {
  const texto = ADVERSOS.map((v, i) => `K${i}=${envValue(v)}`).join("\n");
  const lido = parseEnvContents(texto);
  ADVERSOS.forEach((v, i) => assert.equal(lido[`K${i}`], v, `valor ${JSON.stringify(v)}`));
});

test("ler não deixa rastro no process.env", () => {
  const antes = { ...process.env };
  parseEnvContents("NOVA_CHAVE_TESTE=1\nOUTRA=$NOVA_CHAVE_TESTE\n");
  assert.deepEqual({ ...process.env }, antes);
});

test("CRLF e comentários", () => {
  const lido = parseEnvContents("A=1\r\n# comentario\r\nB=dois # resto\r\n");
  assert.equal(lido.A, "1");
  assert.equal(lido.B, "dois");
});

test("variável do processo vence o arquivo, e a origem fica marcada", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, ".env.local"), "UNBOX_PARTNER_API_KEY=da2-arquivo\nUNBOX_USER=do_arquivo\nUNBOX_PASS=senha123\n");
  const loaded = loadProjectEnv({ dir, processEnvironment: { UNBOX_USER: "do_shell", PATH: "/bin" } });
  assert.equal(loaded.env.UNBOX_USER, "do_shell");
  assert.equal(loaded.env.UNBOX_PASS, "senha123");
  assert.equal(loaded.origem.UNBOX_USER, "ambiente");
  assert.equal(loaded.origem.UNBOX_PASS, "arquivo");
  assert.equal(loaded.origem.PATH, undefined);
  assert.match(describeOrigins(loaded), /UNBOX_USER do ambiente do terminal/);
  assert.match(describeOrigins(loaded), /UNBOX_PASS do \.env\.local/);
});

test("variável vazia no processo também vence, como no Next", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, ".env.local"), "UNBOX_USER=do_arquivo\n");
  const loaded = loadProjectEnv({ dir, processEnvironment: { UNBOX_USER: "" } });
  assert.equal(loaded.env.UNBOX_USER, "");
});

test("sem arquivo: erro com instrução", () => {
  const dir = tmp();
  const loaded = loadProjectEnv({ dir, processEnvironment: {} });
  assert.equal(loaded.exists, false);
  assert.throws(() => requireCredentials(loaded), (e) => e.code === "CREDENCIAIS_AUSENTES" && /não encontrado/.test(e.message) && /\.env\.example/.test(e.message));
});

test("faltando chave: diz quais, e aponta o .env quando é lá que elas estão", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, ".env.local"), "UNBOX_USER=x\n");
  fs.writeFileSync(path.join(dir, ".env"), "UNBOX_PARTNER_API_KEY=k\nUNBOX_USER=u\nUNBOX_PASS=p\n");
  const loaded = loadProjectEnv({ dir, processEnvironment: {} });
  assert.throws(() => requireCredentials(loaded), (e) => /UNBOX_PARTNER_API_KEY, UNBOX_PASS/.test(e.message) && /--env-file \.env/.test(e.message));
});

test("--env-file aponta outro arquivo, relativo ao --dir", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, ".env.stage"), "UNBOX_PARTNER_API_KEY=k\nUNBOX_USER=u\nUNBOX_PASS=p\n");
  const loaded = loadProjectEnv({ dir, envFile: ".env.stage", processEnvironment: {} });
  assert.equal(requireCredentials(loaded).UNBOX_USER, "u");
  assert.match(describeOrigins(loaded), /UNBOX_USER do \.env\.stage/);
});

test("connectionOrigins mostra só as variáveis de conexão", async () => {
  const { connectionOrigins } = await import("../src/env.js");
  const dir = tmp();
  fs.writeFileSync(path.join(dir, ".env.local"), "UNBOX_PARTNER_API_KEY=k\nUNBOX_USER=u\nUNBOX_PASS=p\nNEXT_PUBLIC_X=1\n");
  const loaded = loadProjectEnv({ dir, processEnvironment: { UNBOX_MCP_TOKEN: "t", UNBOX_PASS: "q" } });
  assert.deepEqual(connectionOrigins(loaded), { UNBOX_PARTNER_API_KEY: "arquivo", UNBOX_USER: "arquivo", UNBOX_PASS: "ambiente" });
});
