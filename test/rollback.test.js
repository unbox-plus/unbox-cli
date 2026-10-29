// `unbox rollback`: API falsa; git só no caso da loja ligada (ver test/helpers/git-sandbox.mjs).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import prompts from "prompts";
import { runRollback, decide } from "../src/commands/rollback.js";
import { createOutput } from "../src/output.js";
import { linkDeploy, repoState } from "../src/git.js";
import { sandbox, remotoDaUnbox, projetoSemGit, escreve, SSH_URL } from "./helpers/git-sandbox.mjs";

const SENHA = "senha-secreta-1";
const PROD = "https://loja-teste.myunbox.com.br";
const CREDENCIAIS = `UNBOX_PARTNER_API_KEY=da2-chave-do-parceiro\nUNBOX_USER=api_loja\nUNBOX_PASS=${SENHA}\n`;

const A = "a".repeat(40);
const B = "b".repeat(40);
const C = "c".repeat(40);
const T0 = "2026-10-29T10:00:00.000Z";
const T1 = "2026-10-29T11:00:00.000Z";
const T2 = "2026-10-29T11:00:05.000Z";

beforeEach(() => {
  for (const k of Object.keys(process.env)) if (k.startsWith("UNBOX_")) delete process.env[k];
});

/** Pasta com as credenciais, sem git. */
function pasta() {
  const dir = projetoSemGit(sandbox());
  escreve(dir, ".env.local", CREDENCIAIS);
  return dir;
}

const op = (type, state, commitSha, requestedAt, extra = {}) => ({
  type, state, commitSha, errorCode: null, requestedAt, finishedAt: null, ...extra,
});
const publicacaoAntiga = op("PUBLISH", "SUCCESS", C, T0);

/** C no ar, rollback possível para `alvo` (B por padrão; null = "Em breve"). */
const noAr = (sha = C, { alvo = B, operation = publicacaoAntiga, canRollback = true } = {}) => ({
  state: "PUBLISHED", commitSha: sha, url: PROD, publishedAt: "2026-10-29T09:00:00.000Z", rollbackCommitSha: alvo, canRollback, operation,
});
const emBreve = (operation) => ({
  state: "NOT_PUBLISHED", commitSha: null, url: PROD, publishedAt: null, rollbackCommitSha: null, canRollback: false, operation,
});
/** Depois do rollback para B: B no ar, operação ROLLBACK de T1. */
const voltou = (state = "SUCCESS", { sha = B, alvo = B, requestedAt = T1, ...extra } = {}) =>
  noAr(sha, { alvo: null, canRollback: state !== "PENDING", operation: op("ROLLBACK", state, alvo, requestedAt, extra) });

const erroDoBackend = (codigo) => Object.assign(new Error(codigo), { code: codigo.slice(0, 40) });
const erroDeRede = (causa = "ECONNRESET") => Object.assign(new Error(`Não foi possível conectar a https://api (${causa}).`), { code: "NETWORK" });

/** API falsa: `producao` e `rollback` são consumidos um por chamada e repetem o último. */
function apiFalsa({ producao = [noAr()], rollback = [voltou()], shopId = "loja1" } = {}) {
  const chamadas = [];
  const proximo = (lista, i) => lista[Math.min(i, lista.length - 1)];
  const n = { producao: 0, rollback: 0 };
  let opcoes;
  const api = {
    async shopId() { chamadas.push("shopId"); return shopId; },
    /** A mutation só pode ir por aqui: o `request` renova a sessão e repete. */
    async requestOnce(query, _vars, o) {
      assert.match(query, /rollbackCustomStorefront/);
      opcoes = o;
      chamadas.push("rollback");
      const r = proximo(rollback, n.rollback++);
      if (r instanceof Error) throw r;
      return { rollbackCustomStorefront: r };
    },
    async request(query) {
      assert.doesNotMatch(query, /rollbackCustomStorefront/);
      chamadas.push("producao");
      const r = proximo(producao, n.producao++);
      if (r instanceof Error) throw r;
      return { customStorefrontProduction: r };
    },
  };
  return {
    chamadas,
    opcoes: () => opcoes,
    createApi: async (o) => { o.out.addSecrets(SENHA); return api; },
  };
}

async function roda(dir, globals = {}, { args = [], interactive = false, falsa = apiFalsa(), deps = {} } = {}) {
  const buf = { stdout: "", stderr: "" };
  const out = createOutput({
    json: Boolean(globals.json),
    stdout: { write: (s) => { buf.stdout += s; } },
    stderr: { write: (s) => { buf.stderr += s; } },
  });
  let t = Date.parse("2026-10-29T11:00:00.000Z");
  let erro;
  try {
    await runRollback(args, { dir, ...globals }, {
      out,
      interactive,
      deps: { createApi: falsa.createApi, sleep: async (ms) => { t += ms; }, now: () => t, ...deps },
    });
  } catch (e) {
    erro = e;
    out.fail(e);
  }
  const json = globals.json && buf.stdout ? JSON.parse(buf.stdout) : undefined;
  return { ...buf, erro, json, chamadas: falsa.chamadas, falsa };
}

const rollbacks = (r) => r.chamadas.filter((c) => c === "rollback").length;

test("decide: cada desfecho pela operação e pelo requestedAt guardado", () => {
  assert.equal(decide(noAr(), T0), "NAO_APLICADO");
  assert.equal(decide({ operation: null }, undefined), "NAO_APLICADO");
  assert.equal(decide(voltou(), T0), "SUCESSO");
  assert.equal(decide(voltou(), undefined), "SUCESSO");
  assert.equal(decide(voltou("PENDING"), T0), "PENDENTE");
  assert.equal(decide(voltou("FAILURE"), T0), "FALHOU");
  assert.equal(decide(noAr(C, { operation: op("PUBLISH", "PENDING", A, T1) }), T0), "OUTRA");
  assert.equal(decide(voltou(), T1), "NAO_APLICADO");
});

test("com --yes --json: chama o rollback uma vez e devolve a produção", async () => {
  const r = await roda(pasta(), { json: true, yes: true });
  assert.equal(r.erro, undefined, r.stderr);
  assert.deepEqual(r.chamadas, ["producao", "rollback"]);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.data.commitSha, B);
  assert.equal(r.json.data.operation.type, "ROLLBACK");
  assert.equal(r.falsa.opcoes().timeoutMs, 60000, "só a mutation espera 60 s");
});

test("texto: mostra o que voltou ao ar e o que estava antes", async () => {
  const r = await roda(pasta(), { yes: true });
  assert.equal(r.erro, undefined, r.stderr);
  assert.match(r.stdout, /Rollback feito/);
  assert.match(r.stdout, /No ar: +bbbbbbb/);
  assert.match(r.stdout, /Antes: +ccccccc/);
  assert.match(r.stdout, new RegExp(PROD));
});

test("volta para a página Em breve quando a do ar é a primeira", async () => {
  const falsa = apiFalsa({
    producao: [noAr(C, { alvo: null })],
    rollback: [emBreve(op("ROLLBACK", "SUCCESS", null, T1))],
  });
  const r = await roda(pasta(), { yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.match(r.stdout, /No ar: +a página "Em breve"\n/);
  assert.doesNotMatch(r.stdout + r.stderr, /Aviso/);
});

for (const [nome, view, codigo, texto] of [
  ["Em breve", emBreve(null), "CUSTOM_STOREFRONT_NOTHING_TO_ROLLBACK_ERROR", /não há publicação a desfazer/],
  ["UNKNOWN", { ...noAr(), state: "UNKNOWN", commitSha: null, canRollback: false, rollbackCommitSha: null }, "CUSTOM_STOREFRONT_NOTHING_TO_ROLLBACK_ERROR", /fora da Unbox/],
  ["a mais antiga", noAr(C, { alvo: null, canRollback: false }), "CUSTOM_STOREFRONT_NOTHING_TO_ROLLBACK_ERROR", /mais antiga/],
  ["publicação em andamento", noAr(C, { alvo: null, canRollback: false, operation: op("PUBLISH", "PENDING", A, T1) }), "CUSTOM_STOREFRONT_PRODUCTION_BUSY_ERROR", /unbox publish aaaaaaa/],
  ["rollback recente", noAr(C, { alvo: null, canRollback: false, operation: op("ROLLBACK", "PENDING", B, T1) }), "CUSTOM_STOREFRONT_PRODUCTION_BUSY_ERROR", /em andamento/],
  ["rollback abandonado", noAr(C, { alvo: null, canRollback: false, operation: op("ROLLBACK", "PENDING", B, T0) }), "ROLLBACK_INTERROMPIDO", /interrompido/],
]) {
  test(`canRollback false (${nome}): explica e não chama a API`, async () => {
    const r = await roda(pasta(), { json: true, yes: true }, { falsa: apiFalsa({ producao: [view] }) });
    assert.equal(rollbacks(r), 0);
    assert.equal(r.json.error.code, codigo);
    assert.match(r.json.error.message, texto);
    assert.equal(r.json.data.state, view.state);
  });
}

test("sem --yes no --json: pede confirmação e não chama o rollback", async () => {
  const r = await roda(pasta(), { json: true });
  assert.equal(r.json.error.code, "CONFIRMACAO_NECESSARIA");
  assert.equal(rollbacks(r), 0);
});

test("confirmação negada: cancela sem chamar o rollback", async () => {
  prompts.inject([false]);
  const r = await roda(pasta(), {}, { interactive: true });
  assert.equal(r.erro?.code, "CANCELADO");
  assert.equal(rollbacks(r), 0);
  assert.match(r.stderr, /Volta para: +bbbbbbb/);
});

test("confirmação aceita: relê a produção e só então pede", async () => {
  prompts.inject([true]);
  const r = await roda(pasta(), {}, { interactive: true });
  assert.equal(r.erro, undefined, r.stderr);
  assert.deepEqual(r.chamadas, ["producao", "producao", "rollback"]);
});

test("produção mudou enquanto a confirmação estava aberta: não pede o rollback", async () => {
  prompts.inject([true]);
  const falsa = apiFalsa({ producao: [noAr(), noAr(B, { alvo: A, operation: op("ROLLBACK", "SUCCESS", B, T1) })] });
  const r = await roda(pasta(), {}, { interactive: true, falsa });
  assert.equal(r.erro?.code, "PRODUCAO_MUDOU");
  assert.equal(rollbacks(r), 0);
});

test("confirmação mostra um rollback interrompido antes", async () => {
  prompts.inject([false]);
  const falsa = apiFalsa({ producao: [noAr(C, { operation: op("ROLLBACK", "PENDING", B, T0) })] });
  const r = await roda(pasta(), {}, { interactive: true, falsa });
  assert.match(r.stderr, /Interrompida antes: rollback para bbbbbbb/);
});

test("conexão caída e a produção mostra o rollback novo: aplicado, sem repetir", async () => {
  const falsa = apiFalsa({ rollback: [erroDeRede()], producao: [noAr(), voltou()] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.equal(rollbacks(r), 1);
  assert.equal(r.json.data.commitSha, B);
  assert.match(r.stderr, /A resposta não chegou, mas o rollback foi aplicado/);
});

test("timeout: o rollback aparece só na segunda consulta; aplicado, sem repetir", async () => {
  const falsa = apiFalsa({ rollback: [erroDoBackend("TIMEOUT")], producao: [noAr(), noAr(), voltou()] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.equal(rollbacks(r), 1);
  assert.equal(r.json.data.commitSha, B);
});

test("timeout e nada novo em 90 s: incerto, nunca não aplicado", async () => {
  const falsa = apiFalsa({ rollback: [erroDoBackend("TIMEOUT")], producao: [noAr()] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.json.error.code, "ROLLBACK_INCERTO");
  assert.match(r.json.error.message, /sem --yes/);
  assert.equal(rollbacks(r), 1);
});

test("pedido que nem saiu (ECONNREFUSED) e nada novo: não aplicado", async () => {
  const falsa = apiFalsa({ rollback: [erroDeRede("ECONNREFUSED")], producao: [noAr()] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.json.error.code, "NETWORK");
  assert.match(r.json.error.message, /não foi aplicado.*No ar segue ccccccc/s);
  assert.equal(rollbacks(r), 1);
});

test("erro com código do backend sem tratamento próprio e consulta sem operação nova: não aplicado", async () => {
  const falsa = apiFalsa({ rollback: [erroDoBackend("CUSTOM_STOREFRONT_UNEXPECTED_ERROR")], producao: [noAr()] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.match(r.json.error.message, /não foi aplicado/);
  assert.equal(r.chamadas.filter((c) => c === "producao").length, 2);
  assert.equal(rollbacks(r), 1);
});

test("a consulta falha depois do erro: incerto, sem repetir", async () => {
  const falsa = apiFalsa({ rollback: [erroDeRede("ECONNREFUSED")], producao: [noAr(), erroDeRede("ECONNREFUSED")] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.json.error.code, "ROLLBACK_INCERTO");
  assert.equal(rollbacks(r), 1);
});

test("HOSTING_PROMOTE_ERROR com a operação FAILURE e produção intacta: falha com o código", async () => {
  const falsa = apiFalsa({
    rollback: [erroDoBackend("CUSTOM_STOREFRONT_HOSTING_PROMOTE_ERROR")],
    producao: [noAr(), noAr(C, { alvo: B, operation: op("ROLLBACK", "FAILURE", B, T1, { errorCode: "CUSTOM_STOREFRONT_HOSTING_PROMOTE_ERROR" }) })],
  });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.json.error.code, "CUSTOM_STOREFRONT_HOSTING_PROMOTE_ERROR");
  assert.match(r.json.error.message, /No ar segue ccccccc/);
  assert.equal(rollbacks(r), 1);
});

test("FAILURE registrado, mas o destino está no ar: feito, com aviso para não repetir", async () => {
  const falsa = apiFalsa({
    rollback: [erroDoBackend("CUSTOM_STOREFRONT_HOSTING_PROMOTE_ERROR")],
    producao: [noAr(), voltou("FAILURE", { errorCode: "CUSTOM_STOREFRONT_HOSTING_PROMOTE_ERROR" })],
  });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.match(r.stderr, /Não rode de novo/);
});

test("resposta sem erro com a operação antiga (montada antes do lock): feito, com aviso", async () => {
  const falsa = apiFalsa({ rollback: [noAr(B, { alvo: null, operation: publicacaoAntiga })] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.deepEqual(r.chamadas, ["producao", "rollback"]);
  assert.match(r.stderr, /outra operação começou/);
});

test("resposta PENDING: acompanha sem repetir e reporta quando termina", async () => {
  const falsa = apiFalsa({ rollback: [voltou("PENDING", { sha: C })], producao: [noAr(), voltou("PENDING", { sha: C }), voltou()] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.equal(rollbacks(r), 1);
  assert.equal(r.json.data.commitSha, B);
});

test("resposta PENDING que não sai e produção intacta: incerto (pode ainda entrar), sem repetir", async () => {
  const pendente = voltou("PENDING", { sha: C });
  const falsa = apiFalsa({ rollback: [pendente], producao: [noAr(), pendente] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.json.error.code, "ROLLBACK_INCERTO");
  assert.match(r.json.error.message, /pode ainda ser aplicado.*sem --yes/s);
  assert.equal(rollbacks(r), 1);
});

test("resposta PENDING e as leituras falham: incerto, nunca o código de rede", async () => {
  const falsa = apiFalsa({ rollback: [voltou("PENDING", { sha: C })], producao: [noAr(), erroDeRede("ECONNREFUSED")] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.json.error.code, "ROLLBACK_INCERTO");
  assert.equal(rollbacks(r), 1);
});

test("erro sem código do backend (timeout do gateway) e nada novo: incerto, não 'não aplicado'", async () => {
  const falsa = apiFalsa({ rollback: [Object.assign(new Error("Execution timed out."), { code: "EXECUTIONTIMEOUT" })], producao: [noAr()] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.json.error.code, "ROLLBACK_INCERTO");
  assert.equal(rollbacks(r), 1);
});

test("HTTP 502 e o rollback aparece na janela: aplicado", async () => {
  const falsa = apiFalsa({ rollback: [erroDoBackend("HTTP_502")], producao: [noAr(), noAr(), noAr(), voltou()] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.equal(rollbacks(r), 1);
});

test("timeout e todas as leituras da janela falham: incerto, sem produção para mostrar", async () => {
  const falsa = apiFalsa({ rollback: [erroDoBackend("TIMEOUT")], producao: [noAr(), erroDeRede()] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.json.error.code, "ROLLBACK_INCERTO");
  assert.doesNotMatch(r.json.error.message, /No ar agora/);
});

test("sessão recusada pelo gateway: o pedido não chegou; uma leitura decide", async () => {
  const falsa = apiFalsa({ rollback: [Object.assign(new Error("Unauthorized - No authenticated user"), { code: "UNAUTHORIZED" })], producao: [noAr()] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.match(r.json.error.message, /não foi aplicado/);
  assert.equal(r.chamadas.filter((c) => c === "producao").length, 2);
});

test("resposta vazia sem erro: tratada como perdida, a produção decide", async () => {
  const falsa = apiFalsa({ rollback: [null], producao: [noAr(), voltou()] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.equal(r.json.data.commitSha, B);
  assert.equal(rollbacks(r), 1);
});

test("resposta perdida e a consulta mostra outra operação: substituído, sem repetir", async () => {
  const falsa = apiFalsa({ rollback: [erroDeRede()], producao: [noAr(), noAr(A, { operation: op("PUBLISH", "PENDING", A, T2) })] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.json.error.code, "ROLLBACK_SUBSTITUIDO");
  assert.match(r.json.error.message, /publicação de aaaaaaa/);
});

test("resposta perdida, rollback PENDING na consulta que termina: aplicado", async () => {
  const falsa = apiFalsa({ rollback: [erroDeRede()], producao: [noAr(), voltou("PENDING", { sha: C }), voltou()] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.equal(rollbacks(r), 1);
});

test("FAILURE e o que está no ar não é nem o destino nem o de antes: incerto", async () => {
  const falsa = apiFalsa({ rollback: [erroDoBackend("CUSTOM_STOREFRONT_HOSTING_PROMOTE_ERROR")], producao: [noAr(), voltou("FAILURE", { sha: A, errorCode: "X" })] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.json.error.code, "ROLLBACK_INCERTO");
});

test("sem operação anterior (requestedAt guardado vazio): qualquer rollback novo conta", async () => {
  const falsa = apiFalsa({ rollback: [erroDeRede()], producao: [noAr(C, { operation: null }), voltou()] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
});

test("resposta PENDING que não sai, mas o destino está no ar: feito, com aviso", async () => {
  const falsa = apiFalsa({ rollback: [voltou("PENDING")], producao: [noAr(), voltou("PENDING")] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.match(r.stderr, /não concluído/);
});

test("o rollback voltou para outro destino que o confirmado: avisa", async () => {
  const falsa = apiFalsa({ rollback: [voltou("SUCCESS", { sha: A, alvo: A })] });
  const r = await roda(pasta(), { yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.stderr);
  assert.match(r.stderr, /voltou para aaaaaaa, e não para bbbbbbb/);
});

test("NOTHING_TO_ROLLBACK, BUSY e TARGET_UNAVAILABLE: mensagens próprias, sem repetir", async () => {
  const casos = [
    [erroDoBackend("CUSTOM_STOREFRONT_NOTHING_TO_ROLLBACK_ERROR"), [noAr(), emBreve(null)], /mudou desde a leitura/],
    [erroDoBackend("CUSTOM_STOREFRONT_PRODUCTION_BUSY_ERROR"), [noAr(), noAr(C, { operation: op("PUBLISH", "PENDING", A, T2) })], /unbox publish aaaaaaa.*sem --yes/s],
    [erroDoBackend("CUSTOM_STOREFRONT_PRODUCTION_BUSY_ERROR"), [noAr(), noAr(C, { operation: op("ROLLBACK", "PENDING", B, T2) })], /pode já ser o rollback que você quer/],
    [erroDoBackend("CUSTOM_STOREFRONT_PRODUCTION_BUSY_ERROR"), [noAr(), noAr(A, { operation: op("PUBLISH", "SUCCESS", A, T2) })], /terminou.*sem --yes/s],
    [erroDoBackend("CUSTOM_STOREFRONT_ROLLBACK_TARGET_UNAVAILABLE_ERROR"), [noAr(), noAr(C, { operation: op("ROLLBACK", "FAILURE", B, T1) })], /bbbbbbb\) não existe mais.*unbox publish bbbbbbb/s],
  ];
  for (const [erro, producao, texto] of casos) {
    const r = await roda(pasta(), { json: true, yes: true }, { falsa: apiFalsa({ rollback: [erro], producao }) });
    assert.match(r.json.error.message, texto);
    assert.equal(rollbacks(r), 1);
  }
});

test("TARGET_UNAVAILABLE para a página Em breve: fala com a Unbox", async () => {
  const falsa = apiFalsa({
    rollback: [erroDoBackend("CUSTOM_STOREFRONT_ROLLBACK_TARGET_UNAVAILABLE_ERROR")],
    producao: [noAr(C, { alvo: null }), noAr(C, { alvo: null, operation: op("ROLLBACK", "FAILURE", null, T1) })],
  });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.match(r.json.error.message, /"Em breve" não está mais disponível/);
});

test("sem permissão de publicar: mensagem própria", async () => {
  const falsa = apiFalsa({ rollback: [Object.assign(new Error("sem permissão"), { code: "MISSING_PERMISSION" })] });
  const r = await roda(pasta(), { json: true, yes: true }, { falsa });
  assert.equal(r.json.error.code, "MISSING_PERMISSION");
  assert.match(r.json.error.message, /permissão de publicar/);
  assert.equal(r.chamadas.filter((c) => c === "producao").length, 1);
});

test("argumento: uso incorreto, aponta o unbox publish", async () => {
  const r = await roda(pasta(), { json: true, yes: true }, { args: ["abc1234"] });
  assert.equal(r.erro?.name, "UsageError");
  assert.match(r.erro.message, /unbox publish/);
  assert.equal(r.chamadas.length, 0);
});

test("projeto ligado a outra loja: para antes de ler a produção", async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoSemGit(sb);
  const keyPath = path.join(sb.raiz, "loja1_ed25519");
  fs.writeFileSync(keyPath, "chave falsa\n");
  linkDeploy({ dir, sshUrl: SSH_URL, sshCommand: "ssh", shopId: "loja1", keyPath, st: repoState(dir) });
  escreve(dir, ".env.local", CREDENCIAIS);
  const r = await roda(dir, { json: true, yes: true }, { falsa: apiFalsa({ shopId: "loja2" }) });
  assert.equal(r.json.error.code, "OUTRA_LOJA");
  assert.deepEqual(r.chamadas, ["shopId"]);
});
