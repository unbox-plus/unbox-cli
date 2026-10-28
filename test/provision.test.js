// `unbox provision` ponta a ponta: API falsa, git e ssh-keygen de verdade numa HOME temporária.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import prompts from "prompts";
import { runProvision } from "../src/commands/provision.js";
import { createOutput } from "../src/output.js";
import { sandbox, remotoDaUnbox, projetoComCommits, projetoSemGit, g, escreve, SSH_URL } from "./helpers/git-sandbox.mjs";

const semKeygen = spawnSync("ssh-keygen", ["-?"]).error ? "sem ssh-keygen nesta máquina" : false;
const SENHA = "senha-secreta-1";
const MARCADOR_PRIVADA = ["-----BEGIN", "OPENSSH", "PRIVATE", "KEY-----"].join(" ");

beforeEach(() => {
  for (const k of Object.keys(process.env)) if (k.startsWith("UNBOX_")) delete process.env[k];
});

function credenciais(dir) {
  escreve(dir, ".env.local", `UNBOX_PARTNER_API_KEY=da2-chave-do-parceiro\nUNBOX_USER=api_loja\nUNBOX_PASS=${SENHA}\n`);
}

/** API falsa: READY na primeira leitura depois da mutation. `producao` pode lançar. */
function apiFalsa({ producao = () => ({ url: "https://loja-teste.myunbox.com.br" }) } = {}) {
  const chamadas = [];
  let provisionada = false;
  const api = {
    endpoint: "https://partners.teste/graphql",
    async shopId() { chamadas.push("shopId"); return "loja1"; },
    async request(query, vars) {
      chamadas.push(query.split(/[\s({]/).filter(Boolean)[0] + (vars?.input ? ":mutation" : ""));
      if (/provisionCustomStorefront/.test(query)) {
        provisionada = true;
        return { provisionCustomStorefront: { _id: "sf1", status: "PROVISIONING", currentStep: "GIT_REPOSITORY", repositorySshUrl: null, lastErrorCode: null } };
      }
      if (/customStorefrontProduction/.test(query)) return { customStorefrontProduction: producao() };
      return { customStorefront: provisionada ? { _id: "sf1", status: "READY", currentStep: null, repositorySshUrl: SSH_URL, lastErrorCode: null } : null };
    },
  };
  return { api, chamadas, createApi: async ({ out }) => { out.addSecrets(SENHA); return api; } };
}

async function roda(dir, globals, { interactive = false, falsa = apiFalsa() } = {}) {
  const buf = { stdout: "", stderr: "" };
  const out = createOutput({
    json: Boolean(globals.json),
    stdout: { write: (s) => { buf.stdout += s; } },
    stderr: { write: (s) => { buf.stderr += s; } },
  });
  let erro;
  try {
    await runProvision([], { dir, ...globals }, { out, interactive, deps: { createApi: falsa.createApi, sleep: async () => {} } });
  } catch (e) {
    erro = e;
    out.fail(e);
  }
  return { ...buf, erro, chamadas: falsa.chamadas };
}

test("--json, pasta do unbox create: um único objeto, deploy criada, nada de segredo na saída", { skip: semKeygen }, async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoSemGit(sb);
  credenciais(dir);
  const r = await roda(dir, { json: true });
  assert.equal(r.erro, undefined, r.erro?.message);
  const obj = JSON.parse(r.stdout);
  assert.deepEqual(obj, {
    ok: true,
    data: { status: "READY", repositorySshUrl: SSH_URL, shopId: "loja1", productionUrl: "https://loja-teste.myunbox.com.br" },
  });
  assert.equal(g(dir, "symbolic-ref", "--short", "HEAD"), "deploy");
  const privada = fs.readFileSync(path.join(sb.home, ".config/unbox/keys/loja1_ed25519"), "utf8");
  for (const s of [r.stdout, r.stderr]) {
    assert.ok(!s.includes(SENHA));
    assert.ok(!s.includes(MARCADOR_PRIVADA));
    assert.ok(!s.includes(privada.split("\n")[1]));
  }
  assert.ok(fs.existsSync(path.join(sb.home, ".config/unbox/known_hosts")));
});

test("checagem local que falha não chama a API", async () => {
  const sb = sandbox();
  const dir = projetoComCommits(sb);
  credenciais(dir);
  escreve(dir, "app.txt", "mudou\n");
  const r = await roda(dir, { json: true });
  assert.equal(r.erro?.code, "ARVORE_SUJA");
  assert.deepEqual(r.chamadas, []);
  assert.equal(JSON.parse(r.stdout).error.code, "ARVORE_SUJA");
});

test("--json sem --yes com .github: PROTECTED_PATHS com a lista, sem chamar a API", async () => {
  const sb = sandbox();
  const dir = projetoComCommits(sb, { "README.md": "x\n", ".github/workflows/ci.yml": "on: push\n" });
  credenciais(dir);
  const r = await roda(dir, { json: true });
  assert.equal(r.erro?.code, "PROTECTED_PATHS");
  assert.match(r.erro.message, /\.github\/workflows\/ci\.yml/);
  assert.deepEqual(r.chamadas, []);
});

test("com --yes e .github: segue, e a pasta fica fora da deploy", { skip: semKeygen }, async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoComCommits(sb, { "README.md": "x\n", ".github/workflows/ci.yml": "on: push\n" });
  credenciais(dir);
  const r = await roda(dir, { yes: true });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.match(r.stdout, /Fora da deploy \(continuam na main\): \.github\/workflows\/ci\.yml/);
  assert.match(r.stdout, /a sua branch main ficou como estava/);
});

test("sem identidade git, com commit a fazer e --json: GIT_IDENTITY_MISSING antes da API", async () => {
  const sb = sandbox({ identidade: false });
  const dir = projetoComCommits(sb);
  credenciais(dir);
  const r = await roda(dir, { json: true });
  assert.equal(r.erro?.code, "GIT_IDENTITY_MISSING");
  assert.deepEqual(r.chamadas, []);
});

test("sem identidade git, modo interativo: pergunta e grava só no repositório", { skip: semKeygen }, async () => {
  const sb = sandbox({ identidade: false });
  remotoDaUnbox(sb);
  const dir = projetoComCommits(sb);
  credenciais(dir);
  prompts.inject(["Pessoa Teste", "pessoa@exemplo.invalid"]);
  const r = await roda(dir, {}, { interactive: true });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.equal(g(dir, "config", "--local", "user.email"), "pessoa@exemplo.invalid");
  assert.equal(g(dir, "log", "-1", "--format=%ae", "deploy"), "pessoa@exemplo.invalid");
});

test("endereço de produção que falha não derruba o comando", { skip: semKeygen }, async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoSemGit(sb);
  credenciais(dir);
  const falsa = apiFalsa({ producao: () => { throw Object.assign(new Error("Unauthorized"), { code: "MISSING_PERMISSION" }); } });
  const r = await roda(dir, { json: true }, { falsa });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.equal(JSON.parse(r.stdout).data.productionUrl, null);
  assert.match(r.stderr, /endereço de produção/);
});

test("argumento posicional é uso incorreto", async () => {
  const sb = sandbox();
  const out = createOutput({ json: true, stdout: { write() {} }, stderr: { write() {} } });
  await assert.rejects(runProvision(["pasta"], { dir: sb.raiz }, { out }), (e) => e.code === "USAGE");
});
