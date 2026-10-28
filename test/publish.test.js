// `unbox publish` ponta a ponta: API falsa, git de verdade numa HOME temporária, e o "servidor da
// Unbox" num repositório bare local (ver test/helpers/git-sandbox.mjs).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import prompts from "prompts";
import { runPublish } from "../src/commands/publish.js";
import { createOutput } from "../src/output.js";
import { linkDeploy, repoState } from "../src/git.js";
import { execFileSync } from "node:child_process";
import { sandbox, remotoDaUnbox, projetoSemGit, g, escreve, SSH_URL } from "./helpers/git-sandbox.mjs";

const SENHA = "senha-secreta-1";
const PROD = "https://loja-teste.myunbox.com.br";
const URL_PREVIEW = "https://loja-teste-abc123.vercel.app";
const PEDIDO = "2026-10-28T14:00:00.000Z";
const CREDENCIAIS = `UNBOX_PARTNER_API_KEY=da2-chave-do-parceiro\nUNBOX_USER=api_loja\nUNBOX_PASS=${SENHA}\n`;

beforeEach(() => {
  for (const k of Object.keys(process.env)) if (k.startsWith("UNBOX_")) delete process.env[k];
});

/** Projeto provisionado: ligado à deploy do bare, com chave e credenciais. */
function projeto() {
  const sb = sandbox();
  const remoto = remotoDaUnbox(sb);
  const dir = projetoSemGit(sb);
  const keyPath = path.join(sb.raiz, "loja1_ed25519");
  fs.writeFileSync(keyPath, "chave falsa\n");
  linkDeploy({ dir, sshUrl: SSH_URL, sshCommand: "ssh", shopId: "loja1", keyPath, st: repoState(dir) });
  escreve(dir, ".env.local", CREDENCIAIS);
  return { sb, dir, ...remoto };
}

/** Um commit novo na deploy, enviado à Unbox (ou só local, com `enviar: false`). Devolve o hash. */
function commit(dir, nome, { enviar = true } = {}) {
  escreve(dir, `${nome}.txt`, `${nome}\n`);
  g(dir, "add", "-A");
  g(dir, "commit", "-q", "-m", nome);
  if (enviar) g(dir, "push", "-q", "unbox", "deploy");
  return g(dir, "rev-parse", "HEAD");
}

const op = (sha, state, extra = {}) => ({ type: "PUBLISH", state, commitSha: sha, errorCode: null, requestedAt: PEDIDO, finishedAt: null, ...extra });
const naoPublicada = (operation = null) => ({
  state: "NOT_PUBLISHED", commitSha: null, url: PROD, publishedAt: null, rollbackCommitSha: null, canRollback: false, operation,
});
const publicada = (sha, operation = null) => ({
  state: "PUBLISHED", commitSha: sha, url: PROD, publishedAt: "2026-10-27T10:00:00.000Z", rollbackCommitSha: null, canRollback: true, operation,
});

const erroDoBackend = (codigo) => Object.assign(new Error(codigo), { code: codigo.slice(0, 40) });
const erroDeRede = () => Object.assign(new Error("Não foi possível conectar"), { code: "NETWORK" });

/**
 * API falsa. Cada lista é consumida uma por leitura e repete o último item: `producao` (views),
 * `previews` (estados do deploy) e `publicar` (view devolvida, ou Error lançado).
 */
function apiFalsa({ producao = [naoPublicada()], previews = ["SUCCESS"], publicar = [], shopId = "loja1" } = {}) {
  const chamadas = [];
  const proximo = (lista, i) => lista[Math.min(i, lista.length - 1)];
  const n = { producao: 0, previews: 0, publicar: 0 };
  const api = {
    async shopId() { chamadas.push("shopId"); return shopId; },
    async request(query, vars) {
      if (/publishCustomStorefront/.test(query)) {
        chamadas.push(["publish", vars.input.commitSha]);
        const r = proximo(publicar, n.publicar++);
        if (r instanceof Error) throw r;
        return { publishCustomStorefront: r };
      }
      if (/customStorefrontDeployment/.test(query)) {
        chamadas.push("preview");
        const state = proximo(previews, n.previews++);
        return { customStorefrontDeployment: { commitSha: vars.commitSha, state, url: state === "SUCCESS" ? URL_PREVIEW : null } };
      }
      chamadas.push("producao");
      const r = proximo(producao, n.producao++);
      if (r instanceof Error) throw r;
      return { customStorefrontProduction: r };
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
    await runPublish(args, { dir, ...globals }, {
      out,
      interactive,
      deps: { createApi: falsa.createApi, sleep: async (ms) => { t += ms; }, now: () => t, ...deps },
    });
  } catch (e) {
    erro = e;
    out.fail(e);
  }
  const json = globals.json && buf.stdout ? JSON.parse(buf.stdout) : undefined;
  return { ...buf, erro, json, chamadas: falsa.chamadas };
}

const publicou = (r) => r.chamadas.filter((c) => Array.isArray(c) && c[0] === "publish").map((c) => c[1]);

test("sem commit: publica o topo da deploy da Unbox e devolve a produção com alreadyLive false", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  const falsa = apiFalsa({
    producao: [naoPublicada(), publicada(sha, op(sha, "SUCCESS"))],
    publicar: [naoPublicada(op(sha, "PENDING"))],
  });
  const r = await roda(dir, { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.deepEqual(publicou(r), [sha]);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.data.commitSha, sha);
  assert.equal(r.json.data.alreadyLive, false);
  assert.equal(r.json.data.url, PROD);
  assert.match(r.stderr, /Ctrl\+C não cancela/);
  assert.ok(!r.stdout.includes(SENHA) && !r.stderr.includes(SENHA));
});

test("texto: mostra o commit e a URL de produção", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  const falsa = apiFalsa({ producao: [naoPublicada(), publicada(sha, op(sha, "SUCCESS"))], publicar: [naoPublicada(op(sha, "PENDING"))] });
  const r = await roda(dir, { yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.match(r.stdout, /Publicado em produção/);
  assert.match(r.stdout, new RegExp(PROD.replace(/\./g, "\\.")));
});

test("hash curto ou completo, em maiúsculas: publica o commit certo, mesmo fora do topo", async () => {
  const { dir } = projeto();
  const antigo = commit(dir, "antigo");
  commit(dir, "novo");
  for (const arg of [antigo.slice(0, 7), antigo.slice(0, 7).toUpperCase(), antigo]) {
    const falsa = apiFalsa({ producao: [naoPublicada(), publicada(antigo, op(antigo, "SUCCESS"))], publicar: [naoPublicada(op(antigo, "PENDING"))] });
    const r = await roda(dir, { json: true, yes: true }, { args: [arg], falsa });
    assert.equal(r.erro, undefined, r.stderr);
    assert.deepEqual(publicou(r), [antigo]);
  }
});

test("branch com nome de hash não desvia o prefixo para outro commit", async () => {
  const { dir } = projeto();
  const alvo = commit(dir, "alvo");
  const outro = commit(dir, "outro");
  g(dir, "branch", alvo.slice(0, 7), outro);
  const falsa = apiFalsa({ producao: [naoPublicada(), publicada(alvo, op(alvo, "SUCCESS"))], publicar: [naoPublicada(op(alvo, "PENDING"))] });
  const r = await roda(dir, { json: true, yes: true }, { args: [alvo.slice(0, 7)], falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.deepEqual(publicou(r), [alvo]);
});

/**
 * `n` commits na deploy, de uma vez (fast-import, datas fixas: os hashes não mudam entre execuções),
 * enviados à Unbox. Devolve os hashes da deploy da Unbox.
 */
function muitosCommits(dir, n) {
  const base = g(dir, "rev-parse", "deploy");
  let stream = "";
  for (let i = 0; i < n; i++) {
    const msg = `c${i}\n`;
    const conteudo = `${i}\n`;
    stream += `commit refs/heads/deploy\ncommitter T <t@x.invalid> ${1700000000 + i} +0000\ndata ${msg.length}\n${msg}`;
    if (i === 0) stream += `from ${base}\n`;
    stream += `M 644 inline muitos.txt\ndata ${conteudo.length}\n${conteudo}\n`;
  }
  execFileSync("git", ["fast-import", "--quiet", "--force"], { cwd: dir, input: stream });
  g(dir, "push", "-q", "unbox", "deploy");
  return g(dir, "rev-list", "unbox/deploy").split("\n");
}

test("prefixo ambíguo entre commits da deploy: COMMIT_AMBIGUO; objetos de fora da deploy não contam", async () => {
  const { dir } = projeto();
  commit(dir, "base");
  const shas = muitosCommits(dir, 1500);
  const porPrefixo = Map.groupBy(shas, (s) => s.slice(0, 4));
  const [prefixo] = [...porPrefixo].find(([, v]) => v.length > 1);
  let r = await roda(dir, { json: true, yes: true }, { args: [prefixo] });
  assert.equal(r.json.error.code, "COMMIT_AMBIGUO");
  assert.deepEqual(r.chamadas, []);

  // Um prefixo único entre os commits da deploy publica, mesmo que blobs e trees o compartilhem.
  const [unico] = [...porPrefixo].find(([, v]) => v.length === 1);
  const alvo = porPrefixo.get(unico)[0];
  const falsa = apiFalsa({ producao: [naoPublicada(), publicada(alvo, op(alvo, "SUCCESS"))], publicar: [naoPublicada(op(alvo, "PENDING"))] });
  r = await roda(dir, { json: true, yes: true }, { args: [unico], falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.deepEqual(publicou(r), [alvo]);
});

test("commit que não foi enviado: COMMIT_NAO_ENVIADO antes de falar com a API", async () => {
  const { dir } = projeto();
  commit(dir, "enviado");
  const local = commit(dir, "local", { enviar: false });
  const r = await roda(dir, { json: true, yes: true }, { args: [local.slice(0, 8)] });
  assert.equal(r.json.error.code, "COMMIT_NAO_ENVIADO");
  assert.deepEqual(r.chamadas, []);
});

test("argumento que não é hash: erro de uso", async () => {
  const { dir } = projeto();
  const r = await roda(dir, { json: true, yes: true }, { args: ["main"] });
  assert.equal(r.json.error.code, "USAGE");
});

test("sem commit, com commits locais não enviados e árvore suja: avisa e publica o último enviado", async () => {
  const { dir } = projeto();
  const enviado = commit(dir, "enviado");
  commit(dir, "local", { enviar: false });
  escreve(dir, "rascunho.txt", "x\n");
  const falsa = apiFalsa({ producao: [naoPublicada(), publicada(enviado, op(enviado, "SUCCESS"))], publicar: [naoPublicada(op(enviado, "PENDING"))] });
  const r = await roda(dir, { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.deepEqual(publicou(r), [enviado]);
  assert.match(r.stderr, /1 commit ainda não enviado e há mudanças não commitadas/);
});

test("preview com FAILURE: PREVIEW_FALHOU sem chamar a mutation, e o --json traz a produção", async () => {
  const { dir } = projeto();
  commit(dir, "quebrado");
  const r = await roda(dir, { json: true, yes: true }, { falsa: apiFalsa({ previews: ["FAILURE"] }) });
  assert.equal(r.json.error.code, "PREVIEW_FALHOU");
  assert.equal(r.json.data.state, "NOT_PUBLISHED");
  assert.deepEqual(publicou(r), []);
});

test("preview PENDING do topo: espera o preview e publica", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  const falsa = apiFalsa({
    previews: ["PENDING", "PENDING", "SUCCESS"],
    producao: [naoPublicada(), naoPublicada(), publicada(sha, op(sha, "SUCCESS"))],
    publicar: [naoPublicada(op(sha, "PENDING"))],
  });
  const r = await roda(dir, { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.equal(r.chamadas.filter((c) => c === "preview").length, 3);
  assert.deepEqual(publicou(r), [sha]);
});

test("preview PENDING fora do topo: PREVIEW_PENDENTE sem esperar", async () => {
  const { dir } = projeto();
  const antigo = commit(dir, "antigo");
  commit(dir, "novo");
  const r = await roda(dir, { json: true, yes: true }, { args: [antigo.slice(0, 7)], falsa: apiFalsa({ previews: ["PENDING"] }) });
  assert.equal(r.json.error.code, "PREVIEW_PENDENTE");
  assert.equal(r.chamadas.filter((c) => c === "preview").length, 1);
});

test("já no ar: sai com 0 e alreadyLive true, sem mutation e sem olhar o preview", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  const r = await roda(dir, { json: true }, { falsa: apiFalsa({ producao: [publicada(sha)], previews: ["FAILURE"] }) });
  assert.equal(r.erro, undefined, r.stderr);
  assert.equal(r.json.data.alreadyLive, true);
  assert.deepEqual(publicou(r), []);
  assert.ok(!r.chamadas.includes("preview"));
});

test("já no ar, em texto: dica do unbox env", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  const r = await roda(dir, {}, { falsa: apiFalsa({ producao: [publicada(sha)] }) });
  assert.match(r.stdout, /já está no ar/);
  assert.match(r.stdout, /git commit --allow-empty/);
});

test("a mutation responde que o commit já está no ar: alreadyLive true", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  const r = await roda(dir, { json: true, yes: true }, { falsa: apiFalsa({ publicar: [publicada(sha)] }) });
  assert.equal(r.erro, undefined, r.stderr);
  assert.equal(r.json.data.alreadyLive, true);
});

test("publicação do mesmo commit já em andamento: acompanha sem confirmação e sem mutation", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  const falsa = apiFalsa({ producao: [naoPublicada(op(sha, "PENDING")), publicada(sha, op(sha, "SUCCESS"))] });
  const r = await roda(dir, { json: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.deepEqual(publicou(r), []);
  assert.equal(r.json.data.alreadyLive, false);
});

test("publicação pendente há mais de 25 min: PUBLICACAO_PRESA, sem esperar", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  const falsa = apiFalsa({ producao: [naoPublicada(op(sha, "PENDING"))] });
  const r = await roda(dir, { json: true }, { falsa, deps: { now: () => Date.parse(PEDIDO) + 30 * 60000 } });
  assert.equal(r.json.error.code, "PUBLICACAO_PRESA");
  assert.equal(r.chamadas.filter((c) => c === "producao").length, 1);
});

test("sem --yes e sem terminal (ou com --json): CONFIRMACAO_NECESSARIA, nada publicado", async () => {
  const { dir } = projeto();
  commit(dir, "vitrine");
  for (const globals of [{ json: true }, {}]) {
    const falsa = apiFalsa();
    const r = await roda(dir, globals, { falsa });
    assert.equal(r.erro.code, "CONFIRMACAO_NECESSARIA");
    assert.deepEqual(publicou(r), []);
  }
});

test("interativo: mostra o que está no ar e o que entra; recusar cancela", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine nova");
  prompts.inject([false]);
  const r = await roda(dir, {}, { interactive: true });
  assert.equal(r.erro.code, "CANCELADO");
  assert.match(r.stderr, /No ar: {5}a página "Em breve"/);
  assert.match(r.stderr, new RegExp(`Publicar: {2}${sha.slice(0, 7)} {2}vitrine nova`));
  assert.match(r.stderr, /Preview: {3}https:\/\/loja-teste-abc123/);
  assert.deepEqual(publicou(r), []);
});

test("interativo: confirmar publica", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  prompts.inject([true]);
  const falsa = apiFalsa({ producao: [naoPublicada(), publicada(sha, op(sha, "SUCCESS"))], publicar: [naoPublicada(op(sha, "PENDING"))] });
  const r = await roda(dir, {}, { interactive: true, falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.deepEqual(publicou(r), [sha]);
});

test("BUSY com a publicação do mesmo commit (tentativa anterior): acompanha a operação", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  const falsa = apiFalsa({
    producao: [naoPublicada(), naoPublicada(op(sha, "PENDING")), publicada(sha, op(sha, "SUCCESS"))],
    publicar: [erroDoBackend("CUSTOM_STOREFRONT_PRODUCTION_BUSY_ERROR")],
  });
  const r = await roda(dir, { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.equal(r.json.data.commitSha, sha);
});

test("BUSY com outra operação: erro que diz qual e como acompanhá-la", async () => {
  const { dir } = projeto();
  commit(dir, "vitrine");
  const outro = "b".repeat(40);
  const falsa = apiFalsa({
    producao: [naoPublicada(), naoPublicada(op(outro, "PENDING"))],
    publicar: [erroDoBackend("CUSTOM_STOREFRONT_PRODUCTION_BUSY_ERROR")],
  });
  const r = await roda(dir, { json: true, yes: true }, { falsa });
  assert.equal(r.json.error.code, "CUSTOM_STOREFRONT_PRODUCTION_BUSY_ERROR");
  assert.match(r.json.error.message, /unbox publish bbbbbbb/);
  assert.equal(r.json.data.operation.commitSha, outro);
});

test("falha de rede na mutation: repete uma vez; duas falhas viram erro", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  let falsa = apiFalsa({
    producao: [naoPublicada(), publicada(sha, op(sha, "SUCCESS"))],
    publicar: [erroDeRede(), naoPublicada(op(sha, "PENDING"))],
  });
  let r = await roda(dir, { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.equal(publicou(r).length, 2);

  falsa = apiFalsa({ publicar: [erroDeRede(), erroDeRede()] });
  r = await roda(dir, { json: true, yes: true }, { falsa });
  assert.equal(r.json.error.code, "NETWORK");
  assert.equal(publicou(r).length, 2);
});

test("código de backend sem tratamento próprio (falha ao criar o build) é repetido uma vez", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  const falsa = apiFalsa({
    producao: [naoPublicada(), publicada(sha, op(sha, "SUCCESS"))],
    publicar: [erroDoBackend("CUSTOM_STOREFRONT_HOSTING_CREATE_PRODUCTION_DEPLOYMENT_ERROR"), naoPublicada(op(sha, "PENDING"))],
  });
  const r = await roda(dir, { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.equal(publicou(r).length, 2);
});

test("erros síncronos com mensagem própria e sem repetição", async () => {
  const casos = [
    ["CUSTOM_STOREFRONT_DEPLOYMENT_INVALID_ERROR", "CUSTOM_STOREFRONT_DEPLOYMENT_INVALID_ERROR", /Não repita/],
    ["CUSTOM_STOREFRONT_DEPLOYMENT_NOT_FOUND_ERROR", "CUSTOM_STOREFRONT_DEPLOYMENT_NOT_FOUND_ERROR", /90 dias/],
    ["CUSTOM_STOREFRONT_DEPLOYMENT_NOT_READY_ERROR", "PREVIEW_PENDENTE", /não gerou preview/],
  ];
  const { dir } = projeto();
  commit(dir, "vitrine");
  for (const [lancado, code, texto] of casos) {
    const r = await roda(dir, { json: true, yes: true }, { falsa: apiFalsa({ publicar: [erroDoBackend(lancado)] }) });
    assert.equal(r.json.error.code, code);
    assert.match(r.json.error.message, texto);
    assert.equal(publicou(r).length, 1);
  }
  const semPermissao = Object.assign(new Error("A conta não tem permissão"), { code: "MISSING_PERMISSION" });
  const r = await roda(dir, { json: true, yes: true }, { falsa: apiFalsa({ publicar: [semPermissao] }) });
  assert.match(r.json.error.message, /permissão de publicar em produção/);
  assert.equal(publicou(r).length, 1);
});

test("FAILURE no build de produção: código completo do backend, mensagem própria e a produção em data", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  const codigo = "CUSTOM_STOREFRONT_PRODUCTION_BUILD_ERROR";
  const falsa = apiFalsa({
    producao: [naoPublicada(), naoPublicada(op(sha, "FAILURE", { errorCode: codigo }))],
    publicar: [naoPublicada(op(sha, "PENDING"))],
  });
  const r = await roda(dir, { json: true, yes: true }, { falsa });
  assert.equal(r.json.error.code, codigo);
  assert.match(r.json.error.message, /mesmo com o preview ok/);
  assert.equal(r.json.data.operation.errorCode, codigo);
});

test("FAILURE antiga do mesmo commit não se confunde com a publicação nova", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  const antiga = op(sha, "FAILURE", { errorCode: "CUSTOM_STOREFRONT_PRODUCTION_BUILD_ERROR", requestedAt: "2026-10-28T13:00:00.000Z" });
  const nova = (state) => op(sha, state, { requestedAt: "2026-10-28T14:05:00.000Z" });
  const falsa = apiFalsa({
    producao: [naoPublicada(antiga), naoPublicada(nova("PENDING")), publicada(sha, nova("SUCCESS"))],
    publicar: [naoPublicada(nova("PENDING"))],
  });
  const r = await roda(dir, { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.equal(r.json.data.state, "PUBLISHED");
});

test("UNKNOWN durante o PENDING não interrompe o acompanhamento", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  const falsa = apiFalsa({
    producao: [naoPublicada(), { ...naoPublicada(op(sha, "PENDING")), state: "UNKNOWN" }, publicada(sha, op(sha, "SUCCESS"))],
    publicar: [naoPublicada(op(sha, "PENDING"))],
  });
  const r = await roda(dir, { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
});

test("outra operação substitui a sua: sucesso se o commit está no ar, PUBLICACAO_SUBSTITUIDA se não", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  const rollback = { type: "ROLLBACK", state: "SUCCESS", commitSha: null, errorCode: null, requestedAt: "2026-10-28T14:10:00.000Z", finishedAt: null };
  let r = await roda(dir, { json: true, yes: true }, {
    falsa: apiFalsa({ producao: [naoPublicada(), naoPublicada(rollback)], publicar: [naoPublicada(op(sha, "PENDING"))] }),
  });
  assert.equal(r.json.error.code, "PUBLICACAO_SUBSTITUIDA");

  const outraPublicacao = op("c".repeat(40), "PENDING", { requestedAt: "2026-10-28T14:10:00.000Z" });
  r = await roda(dir, { json: true, yes: true }, {
    falsa: apiFalsa({ producao: [naoPublicada(), publicada(sha, outraPublicacao)], publicar: [naoPublicada(op(sha, "PENDING"))] }),
  });
  assert.equal(r.erro, undefined, r.stderr);
  assert.equal(r.json.data.commitSha, sha);
});

test("relógio local adiantado: a publicação recém-pedida não é dada como presa", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  const falsa = apiFalsa({ producao: [naoPublicada(), publicada(sha, op(sha, "SUCCESS"))], publicar: [naoPublicada(op(sha, "PENDING"))] });
  let t = Date.parse(PEDIDO) + 30 * 60000;
  const r = await roda(dir, { json: true, yes: true }, { falsa, deps: { now: () => t, sleep: async (ms) => { t += ms; } } });
  assert.equal(r.erro, undefined, r.stderr);
  assert.equal(r.json.data.commitSha, sha);
});

test("BUSY de uma operação que já terminou na releitura: pede de novo uma vez", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  const terminada = { type: "ROLLBACK", state: "SUCCESS", commitSha: null, errorCode: null, requestedAt: PEDIDO, finishedAt: PEDIDO };
  const falsa = apiFalsa({
    producao: [naoPublicada(), naoPublicada(terminada), publicada(sha, op(sha, "SUCCESS"))],
    publicar: [erroDoBackend("CUSTOM_STOREFRONT_PRODUCTION_BUSY_ERROR"), naoPublicada(op(sha, "PENDING"))],
  });
  let r = await roda(dir, { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.equal(publicou(r).length, 2);

  const sempre = apiFalsa({ producao: [naoPublicada(), naoPublicada(terminada)], publicar: [erroDoBackend("CUSTOM_STOREFRONT_PRODUCTION_BUSY_ERROR")] });
  r = await roda(dir, { json: true, yes: true }, { falsa: sempre });
  assert.equal(r.json.error.code, "CUSTOM_STOREFRONT_PRODUCTION_BUSY_ERROR");
  assert.equal(publicou(r).length, 2);
});

test("teto de 25 min em PENDING: PUBLICACAO_TIMEOUT com o commit", async () => {
  const { dir } = projeto();
  const sha = commit(dir, "vitrine");
  const falsa = apiFalsa({ producao: [naoPublicada(), naoPublicada(op(sha, "PENDING"))], publicar: [naoPublicada(op(sha, "PENDING"))] });
  const r = await roda(dir, { json: true, yes: true }, { falsa });
  assert.equal(r.json.error.code, "PUBLICACAO_TIMEOUT");
  assert.match(r.json.error.message, new RegExp(sha));
});

test("pasta sem vínculo: hash completo publica com aviso; curto para e diz que o completo serve", async () => {
  const sb = sandbox();
  const dir = projetoSemGit(sb);
  escreve(dir, ".env.local", CREDENCIAIS);
  const sha = "d".repeat(40);
  const falsa = apiFalsa({ producao: [naoPublicada(), publicada(sha, op(sha, "SUCCESS"))], publicar: [naoPublicada(op(sha, "PENDING"))] });
  let r = await roda(dir, { json: true, yes: true }, { args: [sha.toUpperCase()], falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.deepEqual(publicou(r), [sha]);
  assert.match(r.stderr, /não conferi o commit no git local/);
  assert.ok(!r.chamadas.includes("shopId"));

  r = await roda(dir, { json: true, yes: true }, { args: ["ddddddd"] });
  assert.equal(r.json.error.code, "NAO_PROVISIONADO");
  assert.match(r.json.error.message, /hash completo/);
});

test("projeto ligado sem a chave, com hash completo: ainda confere a loja do login", async () => {
  const { dir, sb } = projeto();
  const sha = commit(dir, "vitrine");
  fs.rmSync(path.join(sb.raiz, "loja1_ed25519"));
  const r = await roda(dir, { json: true, yes: true }, { args: [sha], falsa: apiFalsa({ shopId: "loja2" }) });
  assert.equal(r.json.error.code, "OUTRA_LOJA");
  assert.match(r.stderr, /não conferi o commit no git local/);
});

test("login de outra loja: OUTRA_LOJA antes de ler a produção", async () => {
  const { dir } = projeto();
  commit(dir, "vitrine");
  const r = await roda(dir, { json: true, yes: true }, { falsa: apiFalsa({ shopId: "loja2" }) });
  assert.equal(r.json.error.code, "OUTRA_LOJA");
  assert.ok(!r.chamadas.includes("producao"));
});
