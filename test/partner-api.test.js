// A conexão com a Partners API, com o SDK de verdade e um `fetch` falso que registra cada chamada.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as sdk from "@unbox-plus/sdk";
import { createPartnerApi, toPartnerApiError, MISSING_PERMISSION_MESSAGE } from "../src/partner-api.js";
import { createOutput } from "../src/output.js";

const ENV = {
  UNBOX_PARTNER_API_KEY: "da2-chave-do-parceiro",
  UNBOX_USER: "api_loja",
  UNBOX_PASS: "senha-secreta-1",
  UNBOX_PARTNER_GRAPHQL_URL: "https://partners.teste/graphql",
};

function jwt(claims) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64({ exp: Math.floor(Date.now() / 1000) + 86400, ...claims })}.sig`;
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let chamadas;
let respostas; // fila para as operações que não são signIn
let tokens;
const fetchOriginal = globalThis.fetch;

beforeEach(() => {
  chamadas = [];
  respostas = [];
  tokens = [jwt({ "arn:unbox:shopId": "loja-1" }), jwt({ "arn:unbox:shopId": "loja-1", n: 2 })];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    const signIn = /signIn/.test(body.query);
    chamadas.push({ url, headers: init.headers, signIn, query: body.query, variables: body.variables });
    if (signIn) {
      const prox = respostas.signIn?.shift();
      if (prox) return prox();
      return json({ data: { signIn: { access_token: tokens.shift() ?? tokens[0], id_token: "x" } } });
    }
    const prox = respostas.shift();
    if (!prox) throw new Error("fetch falso sem resposta na fila");
    return prox();
  };
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

function saida() {
  const buf = { stdout: "", stderr: "" };
  const out = createOutput({
    json: true,
    stdout: { write: (s) => { buf.stdout += s; } },
    stderr: { write: (s) => { buf.stderr += s; } },
  });
  return { out, buf };
}

test("signIn uma vez, x-api-key em toda chamada e token puro no Authorization", async () => {
  respostas.push(() => json({ data: { customStorefront: null } }), () => json({ data: { customStorefront: { status: "READY" } } }));
  const { out } = saida();
  const api = await createPartnerApi({ env: ENV, out });
  assert.deepEqual(await api.request("query { customStorefront { status } }"), { customStorefront: null });
  assert.deepEqual(await api.request("query { customStorefront { status } }"), { customStorefront: { status: "READY" } });

  assert.equal(chamadas.filter((c) => c.signIn).length, 1);
  assert.equal(chamadas[0].url, ENV.UNBOX_PARTNER_GRAPHQL_URL);
  for (const c of chamadas) assert.equal(c.headers["x-api-key"], ENV.UNBOX_PARTNER_API_KEY);
  for (const c of chamadas.filter((c) => !c.signIn)) {
    assert.ok(c.headers.Authorization && !/^Bearer /.test(c.headers.Authorization), "token puro, sem Bearer");
  }
  assert.deepEqual(chamadas[0].variables, { i: { username: "api_loja", password: "senha-secreta-1" } });
});

test("shopId vem do claim do token, e diverge do env com aviso", async () => {
  const { out, buf } = saida();
  const api = await createPartnerApi({ env: { ...ENV, UNBOX_SHOP_ID: "outra-loja" }, out });
  assert.equal(await api.shopId(), "loja-1");
  assert.match(buf.stderr, /UNBOX_SHOP_ID do ambiente \(outra-loja\) não é a loja do login \(loja-1\)/);
});

test("conta sem permissão: código MISSING_PERMISSION e a mensagem que diz o que fazer", async () => {
  const recusa = () => json({ data: null, errors: [{ message: "Unauthorized - Missing required permissions" }] });
  respostas.push(recusa, recusa, recusa);
  const { out } = saida();
  const api = await createPartnerApi({ env: ENV, out });
  await assert.rejects(api.request("query { customStorefront { status } }"), (e) => {
    assert.equal(e.code, "MISSING_PERMISSION");
    assert.equal(e.message, MISSING_PERMISSION_MESSAGE);
    return true;
  });
});

test("sem permissão não renova o token nem usa Bearer", async () => {
  respostas.push(() => json({ data: null, errors: [{ message: "Unauthorized - Missing required permissions" }] }));
  const { out } = saida();
  const api = await createPartnerApi({ env: ENV, out });
  await assert.rejects(api.request("query { customStorefront { status } }"));
  assert.equal(chamadas.filter((c) => c.signIn).length, 1, "um signIn só");
  assert.equal(chamadas.filter((c) => !c.signIn).length, 1, "nenhuma repetição");
});

test("sessão vencida: renova uma vez e repete, sempre com token puro", async () => {
  respostas.push(
    () => json({ data: null, errors: [{ message: "Unauthorized - No authenticated user" }] }),
    () => json({ data: { customStorefront: { status: "READY" } } }),
  );
  const { out } = saida();
  const api = await createPartnerApi({ env: ENV, out });
  assert.deepEqual(await api.request("query { customStorefront { status } }"), { customStorefront: { status: "READY" } });
  assert.equal(chamadas.filter((c) => c.signIn).length, 2, "dois signIn");
  assert.equal(chamadas.filter((c) => !c.signIn).length, 2, "uma repetição");
  for (const c of chamadas.filter((c) => !c.signIn)) assert.ok(!/^Bearer /.test(c.headers.Authorization));
});

test("mutation não dispara a sonda shopBySlug", async () => {
  respostas.push(() => json({ data: { provisionCustomStorefront: { status: "PROVISIONING" } } }));
  const { out } = saida();
  const api = await createPartnerApi({ env: ENV, out });
  await api.request("mutation { provisionCustomStorefront(input: {}) { status } }");
  assert.ok(!chamadas.some((c) => /shopBySlug/.test(c.query)));
});

test("senha errada: SIGN_IN_FAILED com a mensagem do servidor, sem segredo na saída", async () => {
  respostas.signIn = [() => json({ data: null, errors: [{ message: "Incorrect username or password. (senha-secreta-1)" }] })];
  const { out, buf } = saida();
  const api = await createPartnerApi({ env: ENV, out });
  let erro;
  await api.request("query { customStorefront { status } }").catch((e) => { erro = e; });
  assert.equal(erro.code, "SIGN_IN_FAILED");
  assert.match(erro.message, /Incorrect username or password/);
  out.fail(erro);
  assert.ok(!buf.stdout.includes("senha-secreta-1"), "a senha ecoada pelo servidor sai filtrada");
  assert.ok(!buf.stdout.includes("da2-chave-do-parceiro"));
});

test("rede fora: NETWORK com o endereço", async () => {
  globalThis.fetch = async () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }); };
  const { out } = saida();
  const api = await createPartnerApi({ env: ENV, out });
  await assert.rejects(api.request("query { x }"), (e) => e.code === "NETWORK" && /partners\.teste.*ECONNREFUSED/.test(e.message));
});

test("toPartnerApiError: code do SDK, extensions.code, errorType e cabeça da mensagem", () => {
  const de = (errors, message = "m") => toPartnerApiError(Object.assign(new sdk.UnboxError(message, errors)), { sdk, endpoint: "e" });
  assert.equal(de([{ message: "x", extensions: { code: "CUSTOM_STOREFRONT_NOT_READY_ERROR" } }]).code, "CUSTOM_STOREFRONT_NOT_READY_ERROR");
  assert.equal(de([{ message: "x", errorType: "Unauthorized" }]).code, "Unauthorized");
  assert.equal(de([{ message: "Unauthorized - Algo novo" }], "Unauthorized - Algo novo").code, "UNAUTHORIZED");
  const timeout = toPartnerApiError(new sdk.UnboxError(sdk.UNBOX_TIMEOUT, [{ message: sdk.UNBOX_TIMEOUT }]), { sdk, endpoint: "e" });
  assert.equal(timeout.code, "TIMEOUT");
  const http = toPartnerApiError(Object.assign(new Error("signIn: HTTP 502: <html>"), { code: "HTTP_502" }), { sdk, endpoint: "e" });
  assert.equal(http.code, "HTTP_502");
  assert.doesNotMatch(http.message, /recusou/);
});

test("login com 502 do gateway: HTTP_502, sem dizer que a senha foi recusada", async () => {
  respostas.signIn = [() => new Response("<html>Bad Gateway</html>", { status: 502 })];
  const { out } = saida();
  const api = await createPartnerApi({ env: ENV, out });
  await assert.rejects(api.request("query { customStorefront { status } }"), (e) => {
    assert.equal(e.code, "HTTP_502");
    assert.doesNotMatch(e.message, /recusou/);
    return true;
  });
});

test("5xx do Core atrás do AppSync (errorType HttpError): HTTP_502, que quem espera trata como passageiro", async () => {
  const coreHttp = (status) => () => json({ data: null, errors: [{ message: `Core HTTP error: ${status}`, errorType: "HttpError" }] });
  respostas.push(coreHttp(502), coreHttp(404));
  const { out } = saida();
  const api = await createPartnerApi({ env: ENV, out });
  await assert.rejects(api.request("query { customStorefront { status } }"), (e) => {
    assert.equal(e.code, "HTTP_502");
    assert.match(e.message, /não conseguiu responder \(Core HTTP error: 502\)/);
    return true;
  });
  // 4xx não é passageiro: segue o errorType, como antes.
  await assert.rejects(api.request("query { customStorefront { status } }"), (e) => e.code === "HttpError");
});

test("403 sem errors[] (api key errada): HTTP_403, e não MISSING_PERMISSION", async () => {
  respostas.push(() => json({ message: "Forbidden" }, 403));
  const { out } = saida();
  const api = await createPartnerApi({ env: ENV, out });
  await assert.rejects(api.request("query { customStorefront { status } }"), (e) => e.code === "HTTP_403");
  assert.equal(chamadas.filter((c) => !c.signIn).length, 1, "sem repetição");
});

// Respostas medidas no stage (AppSync de parceiros apontando para o Core de stage).
test("api key recusada pelo gateway no login: API_KEY_RECUSADA, sem culpar usuário e senha", async () => {
  respostas.signIn = [() => json({ data: null, errors: [{ errorType: "UnauthorizedException", message: "You are not authorized to make this call." }] }, 401)];
  const { out } = saida();
  const api = await createPartnerApi({ env: ENV, out });
  await assert.rejects(api.request("query { customStorefront { status } }"), (e) => {
    assert.equal(e.code, "API_KEY_RECUSADA");
    assert.match(e.message, /UNBOX_PARTNER_API_KEY/);
    assert.doesNotMatch(e.message, /UNBOX_PASS/);
    return true;
  });
});

test("usuário ou senha incorretos: mensagem que diz isso, com o código do servidor", async () => {
  respostas.signIn = [() => json({ data: { signIn: null }, errors: [{ message: "INVALID_CREDENTIALS_ERROR", errorType: "INTERNAL_SERVER_ERROR" }] })];
  const { out } = saida();
  const api = await createPartnerApi({ env: ENV, out });
  await assert.rejects(api.request("query { x }"), (e) => e.code === "SIGN_IN_FAILED" && /Usuário ou senha incorretos/.test(e.message));
});
