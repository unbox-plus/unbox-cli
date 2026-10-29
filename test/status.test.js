// `unbox status`: API falsa por consulta, e git de verdade numa HOME temporária, com o "servidor da
// Unbox" num repositório bare local (ver test/helpers/git-sandbox.mjs).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runStatus } from "../src/commands/status.js";
import { createOutput } from "../src/output.js";
import { linkDeploy, repoState } from "../src/git.js";
import { sandbox, remotoDaUnbox, projetoSemGit, g, escreve, SSH_URL } from "./helpers/git-sandbox.mjs";

const SENHA = "senha-secreta-1";
const CREDENCIAIS = `UNBOX_PARTNER_API_KEY=da2-chave-do-parceiro\nUNBOX_USER=api_loja\nUNBOX_PASS=${SENHA}\n`;
const PREVIEW = "https://preview.loja-teste.myunbox.com.br";
const PRODUCAO_URL = "https://loja-teste.myunbox.com.br";
const URL_COMMIT = "https://loja-teste-abc123.vercel.app";
const NO_AR = "9f8e7d6c5b4a39281706f5e4d3c2b1a098765432";

beforeEach(() => {
  for (const k of Object.keys(process.env)) if (k.startsWith("UNBOX_")) delete process.env[k];
});

/** Projeto provisionado e já enviado: a deploy local igual à da Unbox. */
function projeto() {
  const sb = sandbox();
  const remoto = remotoDaUnbox(sb);
  const dir = projetoSemGit(sb);
  const keyPath = path.join(sb.raiz, "loja1_ed25519");
  fs.writeFileSync(keyPath, "chave falsa\n");
  linkDeploy({ dir, sshUrl: SSH_URL, sshCommand: "ssh", shopId: "loja1", keyPath, st: repoState(dir) });
  g(dir, "add", "-A");
  g(dir, "commit", "-q", "-m", "loja");
  g(dir, "push", "-q", "unbox", "deploy:deploy");
  g(dir, "fetch", "-q", "unbox");
  escreve(dir, ".env.local", CREDENCIAIS);
  return { sb, dir, ...remoto };
}

/** Pasta fora de qualquer projeto, só com as credenciais. */
function pastaSolta() {
  const sb = sandbox();
  const dir = path.join(sb.raiz, "solta");
  escreve(dir, ".env.local", CREDENCIAIS);
  return dir;
}

const loja = (extra = {}) => ({
  _id: "sf1", status: "READY", currentStep: null, repositorySshUrl: SSH_URL, previewUrl: PREVIEW, lastErrorCode: null, ...extra,
});
const producao = (extra = {}) => ({
  state: "NOT_PUBLISHED", commitSha: null, url: PRODUCAO_URL, publishedAt: null, rollbackCommitSha: null, canRollback: false, operation: null, ...extra,
});

/**
 * API falsa. Cada seção é o valor devolvido, ou um Error para a consulta falhar. `deployment` é o
 * `state` do deploy do commit pedido.
 */
function apiFalsa({ storefront = loja(), production = producao(), deployment = "SUCCESS", shopId = "loja1" } = {}) {
  const chamadas = [];
  const responde = (v, chave) => (v instanceof Error ? Promise.reject(v) : Promise.resolve({ [chave]: v }));
  const api = {
    async shopId() { chamadas.push({ op: "shopId" }); return shopId; },
    request(query, vars) {
      chamadas.push({ query, vars });
      if (/customStorefrontDeployment/.test(query)) {
        if (deployment instanceof Error) return Promise.reject(deployment);
        return responde({ commitSha: vars.commitSha, state: deployment, url: deployment === "SUCCESS" ? URL_COMMIT : null }, "customStorefrontDeployment");
      }
      if (/customStorefrontProduction/.test(query)) return responde(production, "customStorefrontProduction");
      return responde(storefront, "customStorefront");
    },
  };
  return { chamadas, createApi: async ({ out }) => { out.addSecrets(SENHA); return api; } };
}

async function roda(dir, globals = {}, { args = [], falsa = apiFalsa() } = {}) {
  const buf = { stdout: "", stderr: "" };
  const out = createOutput({
    json: Boolean(globals.json),
    stdout: { write: (s) => { buf.stdout += s; } },
    stderr: { write: (s) => { buf.stderr += s; } },
  });
  let erro;
  try {
    await runStatus(args, { dir, ...globals }, { out, deps: { createApi: falsa.createApi } });
  } catch (e) {
    erro = e;
    out.fail(e);
  }
  const json = globals.json ? JSON.parse(buf.stdout) : undefined;
  return { ...buf, json, data: json?.data, erro, chamadas: falsa.chamadas };
}

const consultas = (r) => r.chamadas.filter((c) => c.query).map((c) => c.query);

test("não provisionada: sugere unbox provision e não mostra deploy nem produção", async () => {
  const dir = pastaSolta();
  const texto = await roda(dir, {}, { falsa: apiFalsa({ storefront: null }) });
  assert.equal(texto.erro, undefined, texto.erro?.message);
  assert.match(texto.stdout, /Ainda não provisionada\. Próximo passo: unbox provision/);
  assert.doesNotMatch(texto.stdout, /Produção/);
  const json = await roda(dir, { json: true }, { falsa: apiFalsa({ storefront: null, production: new Error("CUSTOM_STOREFRONT_NOT_READY_ERROR") }) });
  assert.deepEqual(json.data, { storefront: null, deployment: null, production: null, local: null, publishable: false });
});

test("provisionando: passo e a falha que o servidor vai repetir", async () => {
  const dir = pastaSolta();
  const r = await roda(dir, {}, {
    falsa: apiFalsa({ storefront: loja({ status: "PROVISIONING", currentStep: "GIT_REPOSITORY", lastErrorCode: "CUSTOM_STOREFRONT_GIT_ERROR", previewUrl: null }) }),
  });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.match(r.stdout, /em andamento, criando o repositório/);
  assert.match(r.stdout, /falhou com CUSTOM_STOREFRONT_GIT_ERROR; o servidor vai tentar de novo/);
  assert.doesNotMatch(r.stdout, /Produção/);
});

test("FAILED que repetir resolve: manda rodar unbox provision", async () => {
  const r = await roda(pastaSolta(), {}, {
    falsa: apiFalsa({ storefront: loja({ status: "FAILED", currentStep: "DEPLOY_WORKFLOW", lastErrorCode: "CUSTOM_STOREFRONT_GIT_ERROR" }) }),
  });
  assert.match(r.stdout, /falhou \(CUSTOM_STOREFRONT_GIT_ERROR\)/);
  assert.match(r.stdout, /Rode unbox provision: ele retoma do passo que falhou/);
});

test("FAILED com HOSTING_DOMAIN_IN_USE: fale com a Unbox informando o _id, sem provisionar de novo", async () => {
  const r = await roda(pastaSolta(), {}, {
    falsa: apiFalsa({ storefront: loja({ _id: "sf-42", status: "FAILED", currentStep: "HOSTING_PROJECT_SETTINGS", lastErrorCode: "CUSTOM_STOREFRONT_HOSTING_DOMAIN_IN_USE_ERROR" }) }),
  });
  assert.match(r.stdout, /fale com a Unbox informando _id sf-42/);
  assert.doesNotMatch(r.stdout, /unbox provision/);
});

test("pronta e NOT_PUBLISHED: endereço com \"Em breve\" e preview pronto para publicar", async () => {
  const { dir } = projeto();
  const texto = await roda(dir);
  assert.equal(texto.erro, undefined, texto.erro?.message);
  assert.match(texto.stdout, /ainda não publicada/);
  assert.match(texto.stdout, new RegExp(`Endereço:\\s+${PRODUCAO_URL}\\s+\\(mostra "Em breve" até o primeiro unbox publish\\)`));
  assert.match(texto.stdout, /Há preview pronto para unbox publish/);
  const json = await roda(dir, { json: true });
  assert.equal(json.data.production.state, "NOT_PUBLISHED");
  assert.equal(json.data.production.url, PRODUCAO_URL);
  assert.equal(json.data.publishable, true);
  assert.deepEqual(Object.keys(json.data.local).sort(), ["ahead", "branch", "commitSha", "dirty"]);
  assert.deepEqual({ ahead: json.data.local.ahead, dirty: json.data.local.dirty }, { ahead: 0, dirty: false });
});

test("previewUrl preenchido aparece no texto e no --json; null some do texto", async () => {
  const { dir } = projeto();
  const com = await roda(dir);
  assert.match(com.stdout, new RegExp(`Preview fixo:\\s+${PREVIEW}`));
  assert.equal((await roda(dir, { json: true })).data.storefront.previewUrl, PREVIEW);
  const sem = await roda(dir, {}, { falsa: apiFalsa({ storefront: loja({ previewUrl: null }) }) });
  assert.doesNotMatch(sem.stdout, /Preview fixo/);
});

test("publicada com o commit atual: sem destaque; com outro commit: destaca o unbox publish", async () => {
  const { dir } = projeto();
  const head = g(dir, "rev-parse", "HEAD");
  const mesmo = await roda(dir, { json: true }, {
    falsa: apiFalsa({ production: producao({ state: "PUBLISHED", commitSha: head, publishedAt: "2026-10-28T17:03:00Z", canRollback: true, rollbackCommitSha: null }) }),
  });
  assert.equal(mesmo.data.publishable, false);

  const outro = await roda(dir, {}, {
    falsa: apiFalsa({ production: producao({ state: "PUBLISHED", commitSha: NO_AR, publishedAt: "2026-10-28T17:03:00Z", canRollback: true, rollbackCommitSha: null }) }),
  });
  assert.match(outro.stdout, /publicada: commit 9f8e7d6, em \d\d\/\d\d\/2026/);
  assert.match(outro.stdout, /Rollback:\s+disponível \(volta para a página inicial\)/);
  assert.match(outro.stdout, new RegExp(`unbox publish \\(${head.slice(0, 7)} ≠ 9f8e7d6 no ar\\)`));
});

test("operação em andamento: mostra a publicação e não destaca o publish", async () => {
  const { dir } = projeto();
  const head = g(dir, "rev-parse", "HEAD");
  const r = await roda(dir, {}, {
    falsa: apiFalsa({
      production: producao({
        state: "PUBLISHED", commitSha: NO_AR,
        operation: { type: "PUBLISH", state: "PENDING", commitSha: head, errorCode: null, requestedAt: "2026-10-29T12:00:00Z", finishedAt: null },
      }),
    }),
  });
  assert.match(r.stdout, new RegExp(`Operação:\\s+publicação de ${head.slice(0, 7)} em andamento desde`));
  assert.doesNotMatch(r.stdout, /Há preview pronto/);
});

test("rollback que falhou: código e produção inalterada", async () => {
  const r = await roda(pastaSolta(), {}, {
    falsa: apiFalsa({
      production: producao({
        state: "PUBLISHED", commitSha: NO_AR,
        operation: { type: "ROLLBACK", state: "FAILURE", commitSha: null, errorCode: "CUSTOM_STOREFRONT_HOSTING_ERROR", requestedAt: "2026-10-29T12:00:00Z", finishedAt: "2026-10-29T12:01:00Z" },
      }),
    }),
  });
  assert.match(r.stdout, /rollback para a página inicial falhou \(CUSTOM_STOREFRONT_HOSTING_ERROR\).*produção não mudou/);
});

test("UNKNOWN: rollback indisponível e como voltar ao controle", async () => {
  const r = await roda(pastaSolta(), {}, { falsa: apiFalsa({ production: producao({ state: "UNKNOWN" }) }) });
  assert.match(r.stdout, /alterada fora da Unbox \(rollback indisponível\)/);
  assert.match(r.stdout, /publique um commit com unbox publish/);
});

test("fora de um projeto ligado: só a API, local null e sem consulta de deploy", async () => {
  const solta = await roda(pastaSolta(), { json: true });
  assert.equal(solta.erro, undefined, solta.erro?.message);
  assert.equal(solta.data.local, null);
  assert.ok(!consultas(solta).some((q) => /customStorefrontDeployment/.test(q)));

  // git sem o remote unbox
  const sb = sandbox();
  const dir = path.join(sb.raiz, "outro");
  fs.mkdirSync(dir);
  g(dir, "init", "-q");
  escreve(dir, "a.txt", "a\n");
  g(dir, "add", "-A");
  g(dir, "commit", "-q", "-m", "a");
  escreve(dir, ".env.local", CREDENCIAIS);
  const semVinculo = await roda(dir, { json: true });
  assert.equal(semVinculo.data.local, null);
});

test("local: commits não enviados, mudanças e branch fora da deploy", async () => {
  const { dir } = projeto();
  escreve(dir, "app.txt", "mudou\n");
  g(dir, "commit", "-q", "-am", "um");
  escreve(dir, "app.txt", "mudou de novo\n");
  g(dir, "commit", "-q", "-am", "dois");
  escreve(dir, "novo.txt", "não rastreado\n");

  const r = await roda(dir, {}, { falsa: apiFalsa({ deployment: "PENDING" }) });
  assert.match(r.stdout, /2 commits não enviados; alterações não commitadas/);
  assert.match(r.stdout, /Para enviar: unbox deploy/);
  assert.match(r.stdout, /Estado:\s+não enviado \(rode unbox deploy\)/);
  assert.doesNotMatch(r.stdout, /Há preview pronto/);

  g(dir, "checkout", "-q", "-b", "outra");
  const fora = await roda(dir);
  assert.match(fora.stdout, /Local \(branch outra\)/);
  assert.match(fora.stdout, /O deploy roda na branch deploy: git checkout deploy/);
});

test("uma consulta falha: as outras aparecem, errors no --json e saída 0", async () => {
  const { dir } = projeto();
  const falha = Object.assign(new Error("Falha temporária"), { code: "HTTP_502" });
  const r = await roda(dir, { json: true }, { falsa: apiFalsa({ production: falha }) });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.equal(r.json.ok, true);
  assert.equal(r.data.production, null);
  assert.equal(r.data.storefront.status, "READY");
  assert.equal(r.data.deployment.state, "SUCCESS");
  assert.deepEqual(r.data.errors, { production: { code: "HTTP_502", message: "Falha temporária" } });
  assert.match(r.stderr, /a consulta da produção falhou/);
});

test("todas as consultas falham: erro com saída 1", async () => {
  const sem = Object.assign(new Error("A conta não tem permissão"), { code: "MISSING_PERMISSION" });
  const r = await roda(pastaSolta(), { json: true }, { falsa: apiFalsa({ storefront: sem, production: sem }) });
  assert.equal(r.erro?.code, "MISSING_PERMISSION");
  assert.equal(r.json.ok, false);
});

test("só leitura: nenhum ref, índice ou arquivo muda, nenhuma mutation e nenhum segredo na saída", async () => {
  const { dir, bare } = projeto();
  escreve(dir, "app.txt", "mudou\n");
  const foto = () => ({
    refs: g(dir, "for-each-ref", "--format=%(refname) %(objectname)", "refs/heads"),
    head: g(dir, "symbolic-ref", "HEAD"),
    status: g(dir, "status", "--porcelain"),
    index: g(dir, "ls-files", "-s"),
    bare: g(bare, "rev-parse", "deploy"),
  });
  const antes = foto();
  const r = await roda(dir, { json: true });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.deepEqual(foto(), antes);
  assert.ok(consultas(r).every((q) => /^query\b/.test(q)));
  for (const s of [r.stdout, r.stderr]) assert.ok(!s.includes(SENHA));
});

test("projeto de outra loja: avisa e omite a parte local", async () => {
  const { dir } = projeto();
  const r = await roda(dir, { json: true }, { falsa: apiFalsa({ shopId: "loja2" }) });
  assert.equal(r.data.local, null);
  assert.match(r.stderr, /ligado a outra loja \(loja1\)/);
});

test("argumento posicional é uso incorreto", async () => {
  const r = await roda(pastaSolta(), { json: true }, { args: ["pasta"] });
  assert.equal(r.erro?.code, "USAGE");
});
