// O acompanhamento do provisionamento, com uma API falsa e um relógio falso. As linhas do tempo
// seguem o backend: uma rodada que falha leva ~12 min até FAILED.
import { test } from "node:test";
import assert from "node:assert/strict";
import { provisionAndWait } from "../src/provisioning.js";
import { backendCode, NON_RETRYABLE } from "../src/storefront.js";
import { PartnerApiError, toPartnerApiError } from "../src/partner-api.js";

const MIN = 60 * 1000;
const COD = (c) => `CUSTOM_STOREFRONT_${c}_ERROR`;
const sf = (status, extra = {}) => ({ _id: "sf1", status, currentStep: status === "READY" ? null : "GIT_REPOSITORY", repositorySshUrl: status === "READY" ? "ssh://git@git.unbox.com.br:222/Clientes/x.git" : null, lastErrorCode: null, ...extra });

/**
 * `linha(t, rodadas)` diz o estado da loja no minuto `t` (relógio falso). Como no backend, uma
 * mutation só começa rodada nova quando a loja não existe ou está em FAILED; com o job vivo
 * (PROVISIONING), ela não muda nada. `rodadas` tem o minuto de início de cada rodada.
 * `mutation(t, n)` pode lançar ou devolver o estado; o padrão devolve o da `linha`.
 */
function cenario({ inicial = null, linha, mutation }) {
  let t = 0;
  const chamadas = [];
  const chaves = [];
  const rodadas = [];
  const estado = () => (rodadas.length ? linha(t / MIN, rodadas) : inicial);
  const api = {
    async request(query, vars) {
      if (/^mutation/.test(query)) {
        chamadas.push({ t: t / MIN, chave: vars.input.deployPublicKey });
        if (mutation) return { provisionCustomStorefront: mutation(t / MIN, chamadas.length) };
        const antes = estado();
        if (!antes || antes.status === "FAILED") rodadas.push(t / MIN);
        return { provisionCustomStorefront: estado() };
      }
      return { customStorefront: estado() };
    },
  };
  let n = 0;
  const rotate = () => {
    n++;
    const k = { keyPath: `/k${n}`, pubPath: `/k${n}.pub`, publicKey: `ssh-ed25519 CHAVE${n}` };
    chaves.push(k);
    return k;
  };
  const avisos = [];
  const out = { progress: (m) => avisos.push(m), warn: (m) => avisos.push(m) };
  const run = () => provisionAndWait({
    api,
    key: { keyPath: "/k0", pubPath: "/k0.pub", publicKey: "ssh-ed25519 CHAVE0" },
    rotate,
    out,
    sleep: async (ms) => { t += ms; },
    now: () => t,
  });
  return { run, chamadas, chaves, avisos, agora: () => t / MIN };
}

test("leitura inicial em READY: não chama a mutation", async () => {
  const c = cenario({ inicial: sf("READY"), linha: () => sf("READY") });
  const r = await c.run();
  assert.equal(r.storefront.status, "READY");
  assert.equal(c.chamadas.length, 0);
});

test("PROVISIONING vira READY: uma mutation e progresso com o passo", async () => {
  const c = cenario({ linha: (t) => (t < 2 ? sf("PROVISIONING") : sf("READY")) });
  const r = await c.run();
  assert.equal(r.storefront.status, "READY");
  assert.equal(c.chamadas.length, 1);
  assert.ok(c.avisos.some((a) => /criando o repositório/.test(a)));
});

test("código que não se repete já em PROVISIONING: para na hora, sem nova mutation", async () => {
  const c = cenario({ linha: (t) => (t < 1 ? sf("PROVISIONING") : sf("PROVISIONING", { lastErrorCode: COD("HOSTING_DOMAIN_IN_USE") })) });
  await assert.rejects(c.run(), (e) => e.code === COD("HOSTING_DOMAIN_IN_USE") && /_id sf1/.test(e.message));
  assert.equal(c.chamadas.length, 1);
  assert.ok(c.agora() < 2);
});

test("FAILED genérico aos 12 min: uma nova mutation; o segundo FAILED para", async () => {
  const c = cenario({ linha: (t, r) => (t - r.at(-1) < 12 ? sf("PROVISIONING") : sf("FAILED", { lastErrorCode: COD("HOSTING_GET_PROJECT") })) });
  await assert.rejects(c.run(), (e) => e.code === COD("HOSTING_GET_PROJECT") && /falhou de novo/.test(e.message));
  // a primeira, a de 10 min (job vivo, sem efeito) e a depois do FAILED
  assert.equal(c.chamadas.length, 3);
  assert.ok(c.agora() < 30, `parou aos ${c.agora()} min`);
});

test("FAILED genérico e depois READY: termina bem com a nova mutation", async () => {
  const c = cenario({ linha: (t, r) => (r.length === 1 ? (t < 12 ? sf("PROVISIONING") : sf("FAILED", { lastErrorCode: COD("LOCK_LOST") })) : sf("READY")) });
  assert.equal((await c.run()).storefront.status, "READY");
  assert.equal(c.chamadas.length, 3);
});

test("DEPLOY_KEY_IN_USE em FAILED: gira a chave e chama com a nova", async () => {
  const c = cenario({ linha: (t, r) => (r.length === 1 ? (t < 12 ? sf("PROVISIONING") : sf("FAILED", { lastErrorCode: COD("DEPLOY_KEY_IN_USE") })) : sf("READY")) });
  const r = await c.run();
  assert.equal(r.key.publicKey, "ssh-ed25519 CHAVE1");
  assert.equal(c.chamadas.at(-1).chave, "ssh-ed25519 CHAVE1");
  assert.ok(c.chamadas.slice(0, -1).every((x) => x.chave === "ssh-ed25519 CHAVE0"));
});

test("leitura inicial em FAILED com DEPLOY_KEY_IN_USE: gira antes da primeira mutation", async () => {
  const c = cenario({ inicial: sf("FAILED", { lastErrorCode: COD("DEPLOY_KEY_IN_USE") }), linha: () => sf("READY") });
  await c.run();
  assert.deepEqual(c.chamadas.map((x) => x.chave), ["ssh-ed25519 CHAVE1"]);
});

test("PROVISIONING por 10 min desde a mutation: chama de novo uma vez, com a mesma chave", async () => {
  const c = cenario({ linha: (t) => (t < 11 ? sf("PROVISIONING") : sf("READY")) });
  await c.run();
  assert.equal(c.chamadas.length, 2);
  assert.ok(c.chamadas[1].t >= 10);
  assert.equal(c.chamadas[1].chave, c.chamadas[0].chave);
});

test("teto de 30 min: para dizendo que rodar de novo é seguro", async () => {
  const c = cenario({ linha: () => sf("PROVISIONING") });
  await assert.rejects(c.run(), (e) => e.code === "PROVISIONING_TIMEOUT" && /rode o comando de novo/.test(e.message));
  assert.ok(c.agora() >= 30 && c.agora() < 31);
});

test("ALREADY_PROVISIONED: não gira a chave e mostra o caminho da pública", async () => {
  const erro = new PartnerApiError("Unauthorized", "X", new Error(COD("ALREADY_PROVISIONED")));
  const c = cenario({ linha: () => sf("PROVISIONING"), mutation: () => { throw erro; } });
  await assert.rejects(c.run(), (e) => e.code === COD("ALREADY_PROVISIONED") && /\/k0\.pub/.test(e.message));
  assert.equal(c.chaves.length, 0);
});

test("falha de rede na mutation: repete uma vez", async () => {
  let n = 0;
  const c = cenario({
    linha: () => sf("READY"),
    mutation: () => {
      if (++n === 1) throw new PartnerApiError("fetch failed", "NETWORK");
      return sf("READY");
    },
  });
  assert.equal((await c.run()).storefront.status, "READY");
});

test("backendCode: lê da mensagem e da cause, inclusive o código de 43 caracteres e o do Joi", () => {
  const sdk = { isMissingPermissionError: () => false, isUnboxTimeout: () => false };
  const doSdk = Object.assign(new Error(COD("ALREADY_PROVISIONED")), { errors: [{ message: COD("ALREADY_PROVISIONED") }] });
  const traduzido = toPartnerApiError(doSdk, { sdk, endpoint: "x" });
  assert.notEqual(traduzido.code, COD("ALREADY_PROVISIONED")); // o code do cliente corta em 40
  assert.equal(backendCode(traduzido), COD("ALREADY_PROVISIONED"));
  assert.equal(backendCode(new Error("deployPublicKey must be a single-line ssh-ed25519 or ssh-rsa public key")), COD("INVALID_DEPLOY_PUBLIC_KEY"));
  assert.equal(backendCode(new Error("outra coisa")), undefined);
  assert.equal(NON_RETRYABLE.size, 8);
});
