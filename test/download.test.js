// `unbox download`: API falsa, "servidor da Unbox" num repositório bare local (git-sandbox) e
// ssh-keygen de verdade numa HOME temporária. O que se confere é o que o comando deixa no disco:
// o clone na deploy, o vínculo que os outros comandos procuram e o .env.local com as credenciais.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import prompts from "prompts";
import { destinoDoClone, escreveEnvLocal, nomeDoRepositorio, runDownload } from "../src/commands/download.js";
import { createOutput } from "../src/output.js";
import { fingerprintDe } from "../src/deploy-keys.js";
import { parseEnvContents } from "../src/env.js";
import { SSH_URL, escreve, g, remotoDaUnbox, sandbox } from "./helpers/git-sandbox.mjs";

const semKeygen = spawnSync("ssh-keygen", ["-?"]).error ? "sem ssh-keygen nesta máquina" : false;

const SENHA = "senha-secreta-1";
const CREDENCIAIS = {
  UNBOX_PARTNER_API_KEY: "da2-chave-do-parceiro",
  UNBOX_USER: "api_loja",
  UNBOX_PASS: SENHA,
};

beforeEach(() => {
  for (const k of Object.keys(process.env)) if (k.startsWith("UNBOX_")) delete process.env[k];
});

const LOJA_PRONTA = {
  _id: "sf1",
  status: "READY",
  currentStep: null,
  repositorySshUrl: SSH_URL,
  previewUrl: "https://preview.loja-teste.myunbox.com.br",
  lastErrorCode: null,
};

function apiFalsa({ storefront = LOJA_PRONTA, chaves = [], producao = null, deployment = null, falha = {} } = {}) {
  const chamadas = [];
  const api = {
    endpoint: "https://partners.teste/graphql",
    async shopId() { return "loja1"; },
    async request(query, vars) {
      const op = query.match(/\{\s*(?:\w+\s*\([^)]*\)\s*\{\s*)?(\w+)/)[1];
      chamadas.push({ op, input: vars?.input });
      if (/customStorefrontDeployKeys/.test(query)) return { customStorefrontDeployKeys: [...chaves] };
      if (/addCustomStorefrontDeployKey/.test(query)) {
        const k = { _id: String(100 + chaves.length), title: vars.input.title, fingerprint: fingerprintDe(vars.input.deployPublicKey), createdAt: "2026-11-10T00:00:00Z" };
        chaves.push(k);
        return { addCustomStorefrontDeployKey: k };
      }
      if (/customStorefrontDeployment/.test(query)) {
        if (falha.deployment) throw new Error(falha.deployment);
        return { customStorefrontDeployment: deployment };
      }
      if (/customStorefrontProduction/.test(query)) {
        if (falha.production) throw new Error(falha.production);
        return { customStorefrontProduction: producao };
      }
      if (/customStorefront\b/.test(query)) return { customStorefront: storefront };
      throw new Error(`consulta inesperada: ${query}`);
    },
  };
  return { api, chamadas, chaves, createApi: async ({ out }) => { out.addSecrets(SENHA); return api; } };
}

async function roda(args, globals, { falsa, interactive = false, env = CREDENCIAIS } = {}) {
  Object.assign(process.env, env);
  const buf = { stdout: "", stderr: "" };
  const out = createOutput({
    json: Boolean(globals.json),
    stdout: { write: (s) => { buf.stdout += s; } },
    stderr: { write: (s) => { buf.stderr += s; } },
  });
  let erro;
  try {
    await runDownload(args, globals, { out, interactive, deps: { createApi: falsa.createApi } });
  } catch (e) {
    erro = e;
    out.fail(e);
  }
  return { ...buf, erro, json: buf.stdout && globals.json ? JSON.parse(buf.stdout) : undefined };
}

test("nome do repositório sai da URL SSH; URL estranha cai no shopId", () => {
  assert.equal(nomeDoRepositorio(SSH_URL, "loja1"), "loja-teste");
  assert.equal(nomeDoRepositorio("ssh://git@git.unbox.com.br:222/Clientes/x.git", "loja1"), "x");
  assert.equal(nomeDoRepositorio("nao-e-url", "loja1"), "loja-loja1");
  assert.equal(nomeDoRepositorio("ssh://git@git.unbox.com.br:222/", "loja1"), "loja-loja1");
});

test("destino do clone: pasta informada, pasta-mãe ocupada e pasta ocupada sem argumento", () => {
  const sb = sandbox();
  const cwd = sb.raiz;
  // pasta que não existe: é o destino.
  assert.equal(destinoDoClone("lojas/loja-x", "loja-teste", { cwd }), path.join(cwd, "lojas/loja-x"));
  // pasta que existe e está vazia: também é o destino.
  fs.mkdirSync(path.join(cwd, "vazia"));
  assert.equal(destinoDoClone("vazia", "loja-teste", { cwd }), path.join(cwd, "vazia"));
  // pasta que existe com arquivos: é a pasta-mãe.
  fs.mkdirSync(path.join(cwd, "lojas-cheia"));
  escreve(path.join(cwd, "lojas-cheia"), "outra-loja/README.md", "#\n");
  assert.equal(destinoDoClone("lojas-cheia", "loja-teste", { cwd }), path.join(cwd, "lojas-cheia/loja-teste"));
  // sem pasta informada, o nome do repositório; ocupado é erro, e não loja-teste/loja-teste.
  assert.equal(destinoDoClone(undefined, "loja-teste", { cwd }), path.join(cwd, "loja-teste"));
  escreve(cwd, "loja-teste/README.md", "#\n");
  assert.throws(() => destinoDoClone(undefined, "loja-teste", { cwd }), (e) => e.code === "PASTA_OCUPADA");
  // pasta-mãe ocupada E a de dentro também: aí não há destino possível.
  escreve(path.join(cwd, "lojas-cheia"), "loja-teste/README.md", "#\n");
  assert.throws(() => destinoDoClone("lojas-cheia", "loja-teste", { cwd }), (e) => e.code === "PASTA_OCUPADA");
  escreve(cwd, "arquivo.txt", "x\n");
  assert.throws(() => destinoDoClone("arquivo.txt", "loja-teste", { cwd }), (e) => e.code === "PASTA_OCUPADA");
});

test("env.local: valores com $ e # voltam inteiros; arquivo existente não é alterado", () => {
  const sb = sandbox();
  const dir = path.join(sb.raiz, "loja");
  fs.mkdirSync(dir);
  const dificil = { ...CREDENCIAIS, UNBOX_PASS: 'se#nha$1 com "aspas"' };
  const r = escreveEnvLocal(dir, dificil, { graphqlUrl: "https://homolog.unbox/graphql" });
  assert.equal(r.escrito, true);
  assert.deepEqual(r.chaves, ["UNBOX_PARTNER_API_KEY", "UNBOX_USER", "UNBOX_PASS", "UNBOX_PARTNER_GRAPHQL_URL"]);
  const lido = parseEnvContents(fs.readFileSync(r.caminho, "utf8"), { dir });
  assert.equal(lido.UNBOX_PASS, dificil.UNBOX_PASS);
  assert.equal(lido.UNBOX_PARTNER_GRAPHQL_URL, "https://homolog.unbox/graphql");
  if (process.platform !== "win32") assert.equal(fs.statSync(r.caminho).mode & 0o777, 0o600);

  const denovo = escreveEnvLocal(dir, CREDENCIAIS);
  assert.equal(denovo.escrito, false);
  assert.equal(parseEnvContents(fs.readFileSync(r.caminho, "utf8"), { dir }).UNBOX_PASS, dificil.UNBOX_PASS);
});

test("baixa a loja: clone na deploy, vínculo gravado, .env.local e estado do deploy", { skip: semKeygen }, async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const falsa = apiFalsa({
    deployment: { commitSha: "abc", state: "SUCCESS", url: "https://commit.myunbox.com.br" },
    producao: { state: "PUBLISHED", commitSha: "abcdef1234", url: "https://loja-teste.myunbox.com.br", publishedAt: "2026-11-01T10:00:00Z", canRollback: true, rollbackCommitSha: null, operation: null },
  });
  const destino = path.join(sb.raiz, "baixadas", "loja-x");
  const r = await roda([destino], { json: true }, { falsa });
  assert.equal(r.erro, undefined, r.erro?.message);

  const d = r.json.data;
  assert.equal(d.dir, destino);
  assert.equal(d.shopId, "loja1");
  assert.equal(d.repositorySshUrl, SSH_URL);
  assert.equal(d.branch, "deploy");
  assert.equal(d.deployKey.added, true);
  assert.equal(d.deployment.state, "SUCCESS");
  assert.equal(d.production.state, "PUBLISHED");
  assert.equal(d.storefront.previewUrl, LOJA_PRONTA.previewUrl);

  // O repositório: branch deploy rastreando unbox/deploy, com o conteúdo da Unbox.
  assert.equal(g(destino, "symbolic-ref", "--short", "HEAD"), "deploy");
  assert.equal(g(destino, "config", "--get", "remote.unbox.url"), SSH_URL);
  assert.equal(g(destino, "config", "--get", "branch.deploy.remote"), "unbox");
  assert.equal(g(destino, "rev-parse", "HEAD"), d.commitSha);
  assert.ok(fs.existsSync(path.join(destino, ".forgejo/workflows/deploy.yml")));

  // O vínculo que o deploy, o publish e o status procuram.
  assert.equal(g(destino, "config", "--get", "unbox.shopId"), "loja1");
  const keyPath = g(destino, "config", "--get", "unbox.keyPath");
  assert.equal(keyPath, path.join(sb.home, ".config/unbox/keys/loja1_ed25519"));
  assert.ok(fs.existsSync(keyPath));
  assert.equal(d.deployKey.fingerprint, fingerprintDe(fs.readFileSync(`${keyPath}.pub`, "utf8").trim()));
  assert.equal(falsa.chaves.length, 1);

  // As credenciais, lidas pelo mesmo parser dos outros comandos.
  const env = parseEnvContents(fs.readFileSync(path.join(destino, ".env.local"), "utf8"), { dir: destino });
  assert.deepEqual(
    { UNBOX_PARTNER_API_KEY: env.UNBOX_PARTNER_API_KEY, UNBOX_USER: env.UNBOX_USER, UNBOX_PASS: env.UNBOX_PASS },
    CREDENCIAIS,
  );
  assert.equal(env.UNBOX_PARTNER_GRAPHQL_URL, undefined);
  assert.ok(!r.stdout.includes(SENHA), "a senha não pode sair na saída");
});

test("saída de texto mostra a pasta, o estado e os próximos passos", { skip: semKeygen }, async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const falsa = apiFalsa({ producao: { state: "NOT_PUBLISHED", commitSha: null, url: "https://loja-teste.myunbox.com.br", publishedAt: null, canRollback: false, rollbackCommitSha: null, operation: null } });
  const destino = path.join(sb.raiz, "loja-x");
  const r = await roda([destino], {}, { falsa });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.match(r.stdout, /Loja baixada e ligada à Unbox/);
  assert.match(r.stdout, new RegExp(`Pasta:\\s+${destino.replace(/[/\\]/g, "\\$&")}`));
  assert.match(r.stdout, /Deploy do commit baixado/);
  assert.match(r.stdout, /sem deploy registrado para este commit/);
  assert.match(r.stdout, /Em breve/);
  assert.match(r.stdout, /unbox deploy/);
  assert.ok(!r.stdout.includes(SENHA));
});

test("a pasta já ocupada para antes de criar chave, clonar ou escrever qualquer coisa", async () => {
  const sb = sandbox();
  const destino = path.join(sb.raiz, "ocupada");
  escreve(destino, "README.md", "#\n");
  // Sem pasta-mãe vazia: o destino ocupado vira <pasta>/<repo>, que também existe.
  escreve(destino, "loja-teste/README.md", "#\n");
  const falsa = apiFalsa();
  const r = await roda([destino], { json: true }, { falsa });
  assert.equal(r.erro?.code, "PASTA_OCUPADA");
  assert.deepEqual(falsa.chamadas.map((c) => c.op), ["customStorefront"]);
});

test("loja sem storefront, provisionando ou falha: para e não cria pasta nenhuma", async () => {
  const sb = sandbox();
  const destino = path.join(sb.raiz, "loja-x");
  for (const [storefront, trecho] of [
    [null, /não tem um storefront/],
    [{ ...LOJA_PRONTA, status: "PROVISIONING", currentStep: "GIT_REPOSITORY" }, /criando o repositório/],
    [{ ...LOJA_PRONTA, status: "FAILED", lastErrorCode: "CUSTOM_STOREFRONT_DEPLOY_WORKFLOW_MISMATCH_ERROR" }, /Repetir não resolve/],
    [{ ...LOJA_PRONTA, status: "FAILED", lastErrorCode: null }, /unbox provision/],
  ]) {
    const r = await roda([destino], { json: true }, { falsa: apiFalsa({ storefront }) });
    assert.match(r.erro?.message ?? "", trecho);
    assert.equal(fs.existsSync(destino), false);
  }
});

test("repositório em outro host não é clonado", async () => {
  const sb = sandbox();
  const falsa = apiFalsa({ storefront: { ...LOJA_PRONTA, repositorySshUrl: "ssh://git@git.outro.com:22/x.git" } });
  const r = await roda([path.join(sb.raiz, "loja-x")], { json: true }, { falsa });
  assert.equal(r.erro?.code, "UNEXPECTED_GIT_HOST");
});

test("sem terminal e sem credenciais no ambiente: para antes de qualquer coisa", async () => {
  const sb = sandbox();
  const falsa = apiFalsa();
  const r = await roda([path.join(sb.raiz, "loja-x")], { json: true }, { falsa, env: { UNBOX_USER: "api_loja" } });
  assert.equal(r.erro?.code, "CREDENCIAIS_AUSENTES");
  assert.match(r.erro.message, /UNBOX_PARTNER_API_KEY, UNBOX_PASS/);
  assert.deepEqual(falsa.chamadas, []);
});

test("uso incorreto: --dir e mais de uma pasta", async () => {
  const falsa = apiFalsa();
  const comDir = await roda(["x"], { json: true, dir: "/tmp" }, { falsa });
  assert.equal(comDir.erro?.name, "UsageError");
  const duas = await roda(["a", "b"], { json: true }, { falsa });
  assert.equal(duas.erro?.name, "UsageError");
  assert.deepEqual(falsa.chamadas, []);
});

test("chave já na loja: nada é adicionado, e o .env.local existente fica como está", { skip: semKeygen }, async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const destino = path.join(sb.raiz, "loja-x");
  // Primeiro download: cria a chave desta máquina e o .env.local.
  const primeiro = await roda([destino], { json: true }, { falsa: apiFalsa() });
  assert.equal(primeiro.erro, undefined, primeiro.erro?.message);
  fs.appendFileSync(path.join(destino, ".env.local"), "UNBOX_SHOP_SLUG=minha-loja\n");

  // Segundo, na mesma máquina, com a chave já na loja e a pasta ocupada: vai para a de dentro.
  const pub = fs.readFileSync(path.join(sb.home, ".config/unbox/keys/loja1_ed25519.pub"), "utf8").trim();
  const falsa = apiFalsa({ chaves: [{ _id: "1", title: "ja-estava", fingerprint: fingerprintDe(pub), createdAt: null }] });
  const segundo = await roda([destino], { json: true }, { falsa });
  assert.equal(segundo.erro, undefined, segundo.erro?.message);
  assert.equal(segundo.json.data.deployKey.added, false);
  assert.equal(segundo.json.data.dir, path.join(destino, "loja-teste"));
  assert.equal(falsa.chamadas.filter((c) => c.op === "addCustomStorefrontDeployKey").length, 0);
  // O .env.local do primeiro download continua com o que foi acrescentado à mão.
  assert.match(fs.readFileSync(path.join(destino, ".env.local"), "utf8"), /UNBOX_SHOP_SLUG=minha-loja/);
});

test("no terminal, as três credenciais e a pasta vêm das perguntas", { skip: semKeygen }, async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const destino = path.join(sb.raiz, "perguntada");
  // As respostas na ordem das perguntas: api key, usuário, senha, pasta.
  prompts.inject([CREDENCIAIS.UNBOX_PARTNER_API_KEY, CREDENCIAIS.UNBOX_USER, SENHA, destino]);
  const r = await roda([], {}, { falsa: apiFalsa(), interactive: true, env: {} });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.match(r.stdout, /Loja baixada e ligada à Unbox/);
  assert.equal(g(destino, "config", "--get", "unbox.shopId"), "loja1");
  const env = parseEnvContents(fs.readFileSync(path.join(destino, ".env.local"), "utf8"), { dir: destino });
  assert.equal(env.UNBOX_PASS, SENHA);
  assert.equal(env.UNBOX_USER, CREDENCIAIS.UNBOX_USER);
  assert.ok(!r.stdout.includes(SENHA));
});

test("pasta no comando: a pergunta dela não aparece, e o ambiente preenche as credenciais", { skip: semKeygen }, async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const destino = path.join(sb.raiz, "do-argumento");
  // Só três respostas: a quarta pergunta não roda, e um Enter (undefined) usa o que o ambiente tem.
  prompts.inject([undefined, undefined, undefined]);
  const r = await roda([destino], {}, { falsa: apiFalsa(), interactive: true });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.equal(g(destino, "config", "--get", "unbox.shopId"), "loja1");
  assert.equal(parseEnvContents(fs.readFileSync(path.join(destino, ".env.local"), "utf8"), { dir: destino }).UNBOX_PASS, SENHA);
});

test("consulta de estado que falha vira aviso: a loja baixada continua valendo", { skip: semKeygen }, async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const falsa = apiFalsa({ falha: { production: "CUSTOM_STOREFRONT_NOT_READY_ERROR", deployment: "boom" } });
  const destino = path.join(sb.raiz, "loja-x");
  const r = await roda([destino], { json: true }, { falsa });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.equal(r.json.data.errors.production.code, "CUSTOM_STOREFRONT_NOT_READY_ERROR");
  assert.equal(r.json.data.errors.deployment.code, "ERRO");
  assert.match(r.stderr, /a consulta da produção falhou/);
  assert.ok(fs.existsSync(path.join(destino, ".env.local")));
});
