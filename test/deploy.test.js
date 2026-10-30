// `unbox deploy` ponta a ponta: API falsa, git de verdade numa HOME temporária, e o "servidor da
// Unbox" num repositório bare local (ver test/helpers/git-sandbox.mjs).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import prompts from "prompts";
import { runDeploy } from "../src/commands/deploy.js";
import { createOutput } from "../src/output.js";
import { linkDeploy, repoState } from "../src/git.js";
import { sandbox, remotoDaUnbox, projetoComCommits, projetoSemGit, g, escreve, SSH_URL } from "./helpers/git-sandbox.mjs";

const SENHA = "senha-secreta-1";
const URL_COMMIT = "https://loja-teste-abc123.vercel.app";
const PREVIEW = "https://preview.loja-teste.myunbox.com.br";

beforeEach(() => {
  for (const k of Object.keys(process.env)) if (k.startsWith("UNBOX_")) delete process.env[k];
});

/** Projeto provisionado: ligado à deploy do bare, com chave e credenciais. */
function projeto({ identidade = true, comCommits = false } = {}) {
  const sb = sandbox({ identidade });
  const remoto = remotoDaUnbox(sb);
  const dir = comCommits ? projetoComCommits(sb) : projetoSemGit(sb);
  const keyPath = path.join(sb.raiz, "loja1_ed25519");
  fs.writeFileSync(keyPath, "chave falsa\n");
  linkDeploy({ dir, sshUrl: SSH_URL, sshCommand: "ssh", shopId: "loja1", keyPath, st: repoState(dir) });
  escreve(dir, ".env.local", `UNBOX_PARTNER_API_KEY=da2-chave-do-parceiro\nUNBOX_USER=api_loja\nUNBOX_PASS=${SENHA}\n`);
  return { sb, dir, ...remoto };
}

const noBare = (bare) => g(bare, "rev-parse", "deploy");

/** API falsa. `estados` é a sequência de `state` devolvida a cada leitura do deploy (repete o último). */
function apiFalsa({ estados = ["PENDING", "SUCCESS"], previewUrl = PREVIEW, shopId = "loja1" } = {}) {
  const chamadas = [];
  let i = 0;
  const api = {
    async shopId() { chamadas.push("shopId"); return shopId; },
    async request(query, vars) {
      if (/customStorefrontDeployment/.test(query)) {
        chamadas.push("customStorefrontDeployment");
        const state = estados[Math.min(i++, estados.length - 1)];
        return { customStorefrontDeployment: { commitSha: vars.commitSha, state, url: state === "SUCCESS" ? URL_COMMIT : null } };
      }
      chamadas.push("customStorefront");
      return { customStorefront: { previewUrl } };
    },
  };
  return { chamadas, createApi: async ({ out }) => { out.addSecrets(SENHA); return api; } };
}

async function roda(dir, globals = {}, { args = [], interactive = false, falsa = apiFalsa(), deps = {} } = {}) {
  const buf = { stdout: "", stderr: "" };
  const out = createOutput({
    json: Boolean(globals.json),
    stdout: { write: (s) => { buf.stdout += s; } },
    stderr: { write: (s) => { buf.stderr += s; } },
  });
  let t = 0;
  let erro;
  try {
    await runDeploy(args, { dir, ...globals }, {
      out,
      interactive,
      deps: { createApi: falsa.createApi, sleep: async (ms) => { t += ms; }, now: () => t, ...deps },
    });
  } catch (e) {
    erro = e;
    out.fail(e);
  }
  return { ...buf, erro, chamadas: falsa.chamadas };
}

test("--json: commita, envia a deploy e devolve { commitSha, state, url, previewUrl }", async () => {
  const { dir, bare } = projeto();
  g(dir, "remote", "add", "origin", "git@github.com:pessoa/loja.git");
  escreve(dir, "app.txt", "mudou\n");
  const r = await roda(dir, { json: true });
  assert.equal(r.erro, undefined, r.erro?.message);
  const sha = g(dir, "rev-parse", "deploy");
  assert.deepEqual(JSON.parse(r.stdout), { ok: true, data: { commitSha: sha, state: "SUCCESS", url: URL_COMMIT, previewUrl: PREVIEW } });
  assert.equal(noBare(bare), sha);
  assert.equal(g(dir, "log", "-1", "--format=%s|%ae"), "unbox: deploy|teste@exemplo.invalid");
  assert.equal(g(dir, "status", "--porcelain"), "");
  // A chave vai só por GIT_SSH_COMMAND: nada no config, e o origin continua como era.
  assert.throws(() => g(dir, "config", "--get", "core.sshCommand"));
  assert.equal(g(dir, "config", "--get", "remote.origin.url"), "git@github.com:pessoa/loja.git");
  for (const s of [r.stdout, r.stderr]) assert.ok(!s.includes(SENHA));
});

test("texto: URL do commit e o endereço fixo; -m vira a mensagem do commit", async () => {
  const { dir } = projeto();
  escreve(dir, "app.txt", "mudou\n");
  const r = await roda(dir, {}, { args: ["-m", "nova vitrine"] });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.match(r.stdout, new RegExp(`Preview:\\s+${URL_COMMIT}`));
  assert.match(r.stdout, new RegExp(`Fixo:\\s+${PREVIEW}`));
  assert.equal(g(dir, "log", "-1", "--format=%s"), "nova vitrine");
});

test("previewUrl null: a linha some do texto e vem null no --json", async () => {
  const { dir } = projeto();
  escreve(dir, "app.txt", "mudou\n");
  const texto = await roda(dir, {}, { falsa: apiFalsa({ previewUrl: null }) });
  assert.equal(texto.erro, undefined, texto.erro?.message);
  assert.doesNotMatch(texto.stdout, /Fixo:/);
  escreve(dir, "app.txt", "mudou de novo\n");
  const json = await roda(dir, { json: true }, { falsa: apiFalsa({ previewUrl: null }) });
  assert.equal(JSON.parse(json.stdout).data.previewUrl, null);
});

test("fora da deploy (na main): para com instrução, sem commit, sem push e sem API", async () => {
  const { dir, bare } = projeto({ comCommits: true });
  g(dir, "checkout", "-q", "main");
  escreve(dir, "app.txt", "mudou\n");
  const antes = { main: g(dir, "rev-parse", "main"), deploy: g(dir, "rev-parse", "deploy"), bare: noBare(bare) };
  const r = await roda(dir, { json: true });
  assert.equal(r.erro?.code, "FORA_DA_DEPLOY");
  assert.match(r.erro.message, /git checkout deploy/);
  assert.match(r.erro.message, /git merge main/);
  assert.deepEqual(r.chamadas, []);
  assert.deepEqual({ main: g(dir, "rev-parse", "main"), deploy: g(dir, "rev-parse", "deploy"), bare: noBare(bare) }, antes);
  assert.equal(g(dir, "status", "--porcelain", "--untracked-files=no"), "M app.txt");
});

test("projeto não provisionado: NAO_PROVISIONADO com a instrução", async () => {
  const sb = sandbox();
  const dir = projetoComCommits(sb);
  const r = await roda(dir, { json: true });
  assert.equal(r.erro?.code, "NAO_PROVISIONADO");
  assert.match(r.erro.message, /unbox provision/);

  const p = projeto();
  fs.rmSync(g(p.dir, "config", "--get", "unbox.keyPath"));
  assert.equal((await roda(p.dir, { json: true })).erro?.code, "NAO_PROVISIONADO");
});

test("sem identidade git e --json: GIT_IDENTITY_MISSING antes de commitar e da API", async () => {
  const { dir } = projeto({ identidade: false });
  escreve(dir, "app.txt", "mudou\n");
  const antes = g(dir, "rev-parse", "deploy");
  const r = await roda(dir, { json: true });
  assert.equal(r.erro?.code, "GIT_IDENTITY_MISSING");
  assert.match(r.erro.message, /git config --global user\.name/);
  assert.deepEqual(r.chamadas, []);
  assert.equal(g(dir, "rev-parse", "deploy"), antes);
});

test("sem identidade git, modo interativo: pergunta e grava só no repositório", async () => {
  const { dir } = projeto({ identidade: false });
  escreve(dir, "app.txt", "mudou\n");
  prompts.inject(["Pessoa Teste", "pessoa@exemplo.invalid"]);
  const r = await roda(dir, {}, { interactive: true });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.equal(g(dir, "config", "--local", "user.email"), "pessoa@exemplo.invalid");
  assert.equal(g(dir, "log", "-1", "--format=%ae"), "pessoa@exemplo.invalid");
});

test("mudança em .forgejo/: recusada antes do commit e do push, com como desfazer", async () => {
  const { dir, bare } = projeto();
  escreve(dir, ".forgejo/workflows/deploy.yml", "on: push\n");
  escreve(dir, "app.txt", "mudou\n");
  const antes = { deploy: g(dir, "rev-parse", "deploy"), bare: noBare(bare) };
  const r = await roda(dir, { json: true });
  assert.equal(r.erro?.code, "ARQUIVO_PROTEGIDO");
  assert.match(r.erro.message, /\.forgejo\/workflows\/deploy\.yml/);
  assert.match(r.erro.message, /git checkout unbox\/deploy -- \.forgejo/);
  assert.deepEqual({ deploy: g(dir, "rev-parse", "deploy"), bare: noBare(bare) }, antes);
  assert.ok(!r.chamadas.includes("customStorefrontDeployment"));
});

test("commit já feito com .github/: recusado; arquivo novo não rastreado em .github/ não conta", async () => {
  const { dir } = projeto();
  escreve(dir, ".github/rascunho.md", "fica na pasta\n");
  escreve(dir, "app.txt", "mudou\n");
  assert.equal((await roda(dir, { json: true })).erro, undefined);

  escreve(dir, ".github/workflows/ci.yml", "on: push\n");
  g(dir, "add", "-f", ".github/workflows/ci.yml");
  g(dir, "commit", "-q", "-m", "ci");
  const r = await roda(dir, { json: true });
  assert.equal(r.erro?.code, "ARQUIVO_PROTEGIDO");
  assert.match(r.erro.message, /git rm -r -q --cached \.github/);
});

test("remoto à frente: rebase, novo push, histórico linear e nunca force", async () => {
  const { dir, bare, semente } = projeto();
  escreve(dir, "app.txt", "mudou\n");
  g(semente, "pull", "-q", bare, "deploy");
  escreve(semente, "da-unbox.txt", "x\n");
  g(semente, "add", "-A");
  g(semente, "commit", "-q", "-m", "commit concorrente");
  g(semente, "push", "-q", bare, "deploy");
  const concorrente = noBare(bare);

  const r = await roda(dir, { json: true });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.match(r.stderr, /reaplicados/);
  const sha = g(dir, "rev-parse", "deploy");
  assert.equal(noBare(bare), sha);
  assert.equal(JSON.parse(r.stdout).data.commitSha, sha);
  g(bare, "merge-base", "--is-ancestor", concorrente, "deploy");
  assert.equal(g(dir, "rev-list", "--merges", "--count", `${concorrente}..deploy`), "0");
  assert.equal(g(dir, "show", "deploy:da-unbox.txt"), "x");
});

test("remoto à frente com conflito: rebase desfeito, nada enviado, REBASE_CONFLITO", async () => {
  const { dir, bare, semente } = projeto();
  g(semente, "pull", "-q", bare, "deploy");
  escreve(semente, "README.md", "# da unbox, de novo\n");
  g(semente, "add", "-A");
  g(semente, "commit", "-q", "-m", "muda o readme");
  g(semente, "push", "-q", bare, "deploy");
  const remoto = noBare(bare);

  // O README.md do projeto (# minha loja) difere do da Unbox: o primeiro commit conflita.
  const r = await roda(dir, { json: true });
  assert.equal(r.erro?.code, "REBASE_CONFLITO");
  assert.match(r.erro.message, /git rebase unbox\/deploy/);
  assert.equal(noBare(bare), remoto);
  assert.equal(g(dir, "symbolic-ref", "--short", "HEAD"), "deploy");
  assert.equal(fs.existsSync(path.join(dir, ".git/rebase-merge")), false);
  assert.equal(g(dir, "log", "-1", "--format=%s"), "unbox: deploy");
  assert.equal(g(dir, "status", "--porcelain", "--untracked-files=no"), "");
});

test("primeiro deploy de projeto com histórico e remoto à frente: merge, sem reescrever a main", async () => {
  const { dir, bare, semente } = projeto({ comCommits: true });
  const main = g(dir, "rev-parse", "main");
  g(semente, "pull", "-q", bare, "deploy");
  escreve(semente, "da-unbox.txt", "x\n");
  g(semente, "add", "-A");
  g(semente, "commit", "-q", "-m", "commit concorrente");
  g(semente, "push", "-q", bare, "deploy");

  escreve(dir, "app.txt", "mudou\n");
  const r = await roda(dir, { json: true });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.match(r.stderr, /mesclada/);
  g(dir, "merge-base", "--is-ancestor", main, "deploy");
  assert.equal(noBare(bare), g(dir, "rev-parse", "deploy"));
});

test("FAILURE: DEPLOY_FAILURE com a orientação, depois do push", async () => {
  const { dir, bare } = projeto();
  escreve(dir, "app.txt", "mudou\n");
  const r = await roda(dir, { json: true }, { falsa: apiFalsa({ estados: ["PENDING", "FAILURE"] }) });
  assert.equal(r.erro?.code, "DEPLOY_FAILURE");
  assert.match(r.erro.message, /rode unbox deploy de novo/);
  assert.equal(noBare(bare), g(dir, "rev-parse", "deploy"));
  assert.equal(JSON.parse(r.stdout).ok, false);
});

test("PENDING até o teto: DEPLOY_TIMEOUT com o sha, nas esperas 2 s, 5 s e 10 s", async () => {
  const { dir } = projeto();
  escreve(dir, "app.txt", "mudou\n");
  const esperas = [];
  let t = 0;
  const r = await roda(dir, { json: true }, {
    falsa: apiFalsa({ estados: ["PENDING"] }),
    deps: { sleep: async (ms) => { esperas.push(ms); t += ms; }, now: () => t },
  });
  assert.equal(r.erro?.code, "DEPLOY_TIMEOUT");
  assert.ok(r.erro.message.includes(g(dir, "rev-parse", "deploy")));
  assert.deepEqual(esperas.slice(0, 4), [2000, 5000, 10000, 10000]);
  assert.ok(t >= 15 * 60 * 1000 && t < 15 * 60 * 1000 + 10000);
});

test("nada a enviar: avisa, sai sem push e sem acompanhar deploy", async () => {
  const { dir, bare } = projeto();
  escreve(dir, "app.txt", "mudou\n");
  assert.equal((await roda(dir, { json: true })).erro, undefined);
  const antes = noBare(bare);
  const r = await roda(dir, {});
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.match(r.stdout, /Nada a enviar/);
  assert.ok(!r.chamadas.includes("customStorefrontDeployment"));
  assert.equal(noBare(bare), antes);
});

test("--build que falha: nada commitado nem enviado", async () => {
  const { dir, bare } = projeto();
  escreve(dir, "app.txt", "mudou\n");
  const antes = { deploy: g(dir, "rev-parse", "deploy"), bare: noBare(bare) };
  const build = () => { throw Object.assign(new Error("O npm run build falhou"), { code: "BUILD_FALHOU" }); };
  const r = await roda(dir, { json: true }, { args: ["--build"], deps: { build } });
  assert.equal(r.erro?.code, "BUILD_FALHOU");
  assert.deepEqual({ deploy: g(dir, "rev-parse", "deploy"), bare: noBare(bare) }, antes);
});

test("login de outra loja: OUTRA_LOJA antes de commitar", async () => {
  const { dir } = projeto();
  escreve(dir, "app.txt", "mudou\n");
  const antes = g(dir, "rev-parse", "deploy");
  const r = await roda(dir, { json: true }, { falsa: apiFalsa({ shopId: "loja2" }) });
  assert.equal(r.erro?.code, "OUTRA_LOJA");
  assert.equal(g(dir, "rev-parse", "deploy"), antes);
});

test("fetch e push passam pelo ssh com a chave do unbox.keyPath e o known_hosts da CLI", { skip: process.platform === "win32" && "ssh falso em sh" }, async () => {
  const { sb, dir, bare } = projeto();
  // Sem o insteadOf, o git fala SSH de verdade: um `ssh` falso no PATH registra os argumentos e
  // atende pelo bare local.
  g(dir, "config", "--global", "--unset", `url.${bare}.insteadOf`);
  const bin = path.join(sb.raiz, "bin");
  const log = path.join(sb.raiz, "ssh.log");
  escreve(bin, "ssh", [
    "#!/bin/sh",
    `printf '%s\\n' "$@" >> '${log}'`,
    'for a; do ultimo="$a"; done',
    `exec sh -c "$(printf '%s' "$ultimo" | sed "s#'/Clientes/loja-teste.git'#'${bare}'#")"`,
    "",
  ].join("\n"));
  fs.chmodSync(path.join(bin, "ssh"), 0o755);
  const pathAntes = process.env.PATH;
  process.env.PATH = `${bin}${path.delimiter}${pathAntes}`;
  try {
    escreve(dir, "app.txt", "mudou\n");
    const r = await roda(dir, { json: true });
    assert.equal(r.erro, undefined, r.erro?.message);
  } finally {
    process.env.PATH = pathAntes;
  }
  assert.equal(noBare(bare), g(dir, "rev-parse", "deploy"));
  const args = fs.readFileSync(log, "utf8");
  const keyPath = g(dir, "config", "--get", "unbox.keyPath");
  assert.ok(args.includes(`-i\n${keyPath}\n`), args);
  for (const o of ["IdentitiesOnly=yes", "StrictHostKeyChecking=yes", "BatchMode=yes", `UserKnownHostsFile=${path.join(sb.home, ".config/unbox/known_hosts")}`]) {
    assert.ok(args.includes(o), o);
  }
  assert.match(args, /git-upload-pack/);
  assert.match(args, /git-receive-pack/);
  assert.ok(fs.existsSync(path.join(sb.home, ".config/unbox/known_hosts")));
  assert.throws(() => g(dir, "config", "--get", "core.sshCommand"));
});
