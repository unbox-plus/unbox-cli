// O acompanhamento de uma operação em produção (src/production.js), com API falsa e relógio injetado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeLive, isStale, outcome, waitOperation } from "../src/production.js";

const PEDIDO = "2026-10-28T14:00:00.000Z";
const op = (state, extra = {}) => ({ type: "PUBLISH", state, commitSha: "a".repeat(40), requestedAt: PEDIDO, errorCode: null, ...extra });
const view = (operation, state = "NOT_PUBLISHED") => ({ state, commitSha: null, url: "https://x.myunbox.com.br", operation });
const isMine = (o) => o?.type === "PUBLISH" && o.requestedAt === PEDIDO;

/** `leituras`: views ou Errors, uma por consulta (repete a última). */
function roda(leituras, { now0 = 0, requestedAt = PEDIDO } = {}) {
  let i = 0;
  let t = now0;
  const progresso = [];
  const api = {
    async request() {
      const r = leituras[Math.min(i++, leituras.length - 1)];
      if (r instanceof Error) throw r;
      return { customStorefrontProduction: r };
    },
  };
  const p = waitOperation({
    api, isMine, requestedAt, rotulo: "A publicação de aaaaaaa",
    out: { progress: (m) => progresso.push(m) },
    sleep: async (ms) => { t += ms; }, now: () => t,
  });
  return { p, leituras: () => i, tempo: () => t, progresso };
}

test("outcome: PENDING segue, SUCCESS/FAILURE terminam, outra operação é SUBSTITUIDA", () => {
  assert.equal(outcome(view(op("PENDING")), isMine), undefined);
  assert.equal(outcome(view(op("SUCCESS")), isMine), "SUCCESS");
  assert.equal(outcome(view(op("FAILURE")), isMine), "FAILURE");
  assert.equal(outcome(view(op("PENDING", { requestedAt: "2026-10-28T15:00:00.000Z" })), isMine), "SUBSTITUIDA");
  assert.equal(outcome(view(null), isMine), "SUBSTITUIDA");
});

test("UNKNOWN e falhas de leitura passageiras não interrompem", async () => {
  const r = roda([view(op("PENDING"), "UNKNOWN"), new Error("rede"), view(op("SUCCESS"), "PUBLISHED")]);
  const { outcome: fim } = await r.p;
  assert.equal(fim, "SUCCESS");
  assert.equal(r.leituras(), 3);
});

test("leituras falhando seguidas: desiste dizendo que a operação segue", async () => {
  const r = roda([Object.assign(new Error("caiu"), { code: "NETWORK" })]);
  await assert.rejects(r.p, (e) => e.code === "NETWORK" && /segue na Unbox/.test(e.message));
  assert.equal(r.leituras(), 6);
});

test("erro fatal (sem permissão) propaga na hora", async () => {
  const r = roda([Object.assign(new Error("sem permissão"), { code: "MISSING_PERMISSION" })]);
  await assert.rejects(r.p, (e) => e.code === "MISSING_PERMISSION");
  assert.equal(r.leituras(), 1);
});

test("teto: 25 min do início do acompanhamento, com progresso por minuto", async () => {
  const r = roda([view(op("PENDING"))]);
  const { outcome: fim, view: ultima } = await r.p;
  assert.equal(fim, "TETO");
  assert.equal(ultima.operation.state, "PENDING");
  assert.ok(r.tempo() >= 25 * 60000 && r.tempo() < 26 * 60000);
  assert.match(r.progresso[0], /ainda em andamento \(1 min\)/);
});

test("teto: retomar uma operação pedida há 20 min espera só o que falta", async () => {
  const inicio = Date.parse(PEDIDO) + 20 * 60000;
  const r = roda([view(op("PENDING"))], { now0: inicio });
  assert.equal((await r.p).outcome, "TETO");
  assert.ok(r.tempo() - inicio <= 7 * 60000, `esperou ${(r.tempo() - inicio) / 60000} min`);
});

test("isStale: pendente além de 25 min (com folga de 1 min) desde o pedido", () => {
  const pedido = Date.parse(PEDIDO);
  assert.equal(isStale(op("PENDING"), { now: () => pedido + 20 * 60000 }), false);
  assert.equal(isStale(op("PENDING"), { now: () => pedido + 27 * 60000 }), true);
});

test("describeLive: Em breve, UNKNOWN e publicado", () => {
  assert.match(describeLive(view(null)), /Em breve/);
  assert.match(describeLive(view(null, "UNKNOWN")), /fora da Unbox/);
  assert.match(describeLive({ state: "PUBLISHED", commitSha: "b".repeat(40), publishedAt: PEDIDO }), /^bbbbbbb \(publicado em /);
});
