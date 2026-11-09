// `unbox provision` ponta a ponta: API falsa, git e ssh-keygen de verdade numa HOME temporária.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import prompts from "prompts";
import { runProvision } from "../src/commands/provision.js";
import { fingerprintDe } from "../src/deploy-keys.js";
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

/**
 * API falsa: READY na primeira leitura depois da mutation. `producao` e `ambiente` podem lançar;
 * `ambiente` recebe o input da gravação das variáveis. `chamadas` guarda o nome da operação.
 */
function apiFalsa({
  producao = () => ({ url: "https://loja-teste.myunbox.com.br" }),
  ambiente = (input) => ({ keys: input.set.map((x) => x.key).sort() }),
  // Loja já provisionada por outra máquina: READY desde a primeira leitura, e a mutation de
  // provisionamento recusa outra chave.
  outraMaquina = false,
  chavesNaLoja = [],
  adicionar = (input) => ({ _id: String(10 + chavesNaLoja.length), title: input.title, fingerprint: fingerprintDe(input.deployPublicKey), createdAt: null }),
} = {}) {
  const chamadas = [];
  const adicionadas = [];
  let provisionada = outraMaquina;
  const api = {
    endpoint: "https://partners.teste/graphql",
    async shopId() { chamadas.push("shopId"); return "loja1"; },
    async request(query, vars) {
      chamadas.push(query.match(/\{\s*(\w+)/)[1]);
      if (/setCustomStorefrontEnvironment/.test(query)) return { setCustomStorefrontEnvironment: ambiente(vars.input) };
      if (/customStorefrontDeployKeys/.test(query)) return { customStorefrontDeployKeys: [...chavesNaLoja] };
      if (/addCustomStorefrontDeployKey/.test(query)) {
        const k = adicionar(vars.input);
        adicionadas.push(vars.input);
        chavesNaLoja.push(k);
        return { addCustomStorefrontDeployKey: k };
      }
      if (/provisionCustomStorefront/.test(query)) {
        if (outraMaquina) throw new Error("CUSTOM_STOREFRONT_ALREADY_PROVISIONED_ERROR");
        provisionada = true;
        return { provisionCustomStorefront: { _id: "sf1", status: "PROVISIONING", currentStep: "GIT_REPOSITORY", repositorySshUrl: null, lastErrorCode: null } };
      }
      if (/customStorefrontProduction/.test(query)) return { customStorefrontProduction: producao() };
      return { customStorefront: provisionada ? { _id: "sf1", status: "READY", currentStep: null, repositorySshUrl: SSH_URL, lastErrorCode: null } : null };
    },
  };
  return { api, chamadas, adicionadas, createApi: async ({ out }) => { out.addSecrets(SENHA); return api; } };
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
    data: {
      status: "READY",
      repositorySshUrl: SSH_URL,
      shopId: "loja1",
      productionUrl: "https://loja-teste.myunbox.com.br",
      deployKey: { fingerprint: obj.data.deployKey.fingerprint, added: false },
      env: {
        sent: ["UNBOX_PARTNER_API_KEY", "UNBOX_USER", "UNBOX_PASS"],
        skipped: [],
        fromTerminal: [],
        keys: ["UNBOX_PARTNER_API_KEY", "UNBOX_PASS", "UNBOX_USER"],
      },
    },
  });
  assert.match(obj.data.deployKey.fingerprint, /^SHA256:[A-Za-z0-9+/]{43}$/);
  // A máquina que provisionou não precisa do add: a chave dela já é a do provisionamento.
  assert.ok(!r.chamadas.includes("customStorefrontDeployKeys"));
  assert.ok(!r.chamadas.includes("addCustomStorefrontDeployKey"));
  assert.ok(r.chamadas.includes("setCustomStorefrontEnvironment"));
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

test("variáveis: valores do .env.local não viram *** no shopId nem nos endereços", { skip: semKeygen }, async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoSemGit(sb);
  // Valores que aparecem dentro do resultado do provision: se a CLI os registrasse como segredo, o
  // filtro da saída trocaria pedaços do shopId e das URLs por ***.
  escreve(dir, ".env.local", [
    "UNBOX_PARTNER_API_KEY=da2-chave-do-parceiro",
    "UNBOX_USER=api_loja",
    `UNBOX_PASS=${SENHA}`,
    "UNBOX_SHOP_ID=loja1",
    "UNBOX_SHOP_SLUG=loja-teste",
    "UNBOX_PARTNER_GRAPHQL_URL=https://partners.teste/graphql",
    "NEXT_PUBLIC_SITE_URL=http://localhost:3000",
    "",
  ].join("\n"));
  const r = await roda(dir, { json: true });
  assert.equal(r.erro, undefined, r.erro?.message);
  const { data } = JSON.parse(r.stdout);
  assert.equal(data.productionUrl, "https://loja-teste.myunbox.com.br");
  assert.equal(data.repositorySshUrl, SSH_URL);
  assert.ok(!r.stdout.includes("***"));
  assert.ok(data.env.sent.includes("UNBOX_SHOP_SLUG"));
  assert.deepEqual(data.env.skipped, [{ key: "NEXT_PUBLIC_SITE_URL", reason: "gerenciada" }]);
  assert.match(r.stderr, /NEXT_PUBLIC_SITE_URL não foi enviada: é gerenciada pela Unbox/);
});

test("variáveis que falham viram aviso: o provision termina com sucesso", { skip: semKeygen }, async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoSemGit(sb);
  credenciais(dir);
  const falsa = apiFalsa({
    ambiente: (input) => {
      throw new Error(`CUSTOM_STOREFRONT_HOSTING_SET_ENVIRONMENT_ERROR ${JSON.stringify(input)}`);
    },
  });
  const r = await roda(dir, { json: true }, { falsa });
  assert.equal(r.erro, undefined, r.erro?.message);
  const obj = JSON.parse(r.stdout);
  assert.equal(obj.ok, true);
  assert.equal(obj.data.env.error.code, "CUSTOM_STOREFRONT_HOSTING_SET_ENVIRONMENT_ERROR");
  assert.match(r.stderr, /não consegui enviar as variáveis .*rode unbox env/);
  for (const s of [r.stdout, r.stderr]) {
    assert.ok(!s.includes(SENHA));
    assert.ok(!s.includes("api_loja"));
  }
});

test("texto: a linha das variáveis no lugar do aviso antigo", { skip: semKeygen }, async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoSemGit(sb);
  credenciais(dir);
  const r = await roda(dir, {});
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.match(r.stdout, /Variáveis: {4}3 enviadas para a hospedagem/);
  assert.doesNotMatch(r.stdout, /ainda não vão para a hospedagem/);
});

test("texto: vazias contadas à parte das que pedem ação", { skip: semKeygen }, async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoSemGit(sb);
  escreve(dir, ".env.local", `UNBOX_PARTNER_API_KEY=da2-chave-do-parceiro\nUNBOX_USER=api_loja\nUNBOX_PASS=${SENHA}\nGA_ID=\nPIXEL_ID=\nTZ=America/Sao_Paulo\n`);
  const r = await roda(dir, {});
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.match(r.stdout, /Variáveis: {4}3 enviadas para a hospedagem, 2 vazias, 1 não enviada \(veja os avisos\)/);
  assert.match(r.stderr, /2 variáveis vazias no \.env\.local/);
});

test("variáveis que falham no meio: o texto diz quantas foram, o --json lista os nomes", { skip: semKeygen }, async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoSemGit(sb);
  const extras = Array.from({ length: 48 }, (_, i) => `VAR_${i}=v${i}`).join("\n");
  escreve(dir, ".env.local", `UNBOX_PARTNER_API_KEY=da2-chave-do-parceiro\nUNBOX_USER=api_loja\nUNBOX_PASS=${SENHA}\n${extras}\n`);
  let n = 0;
  const falsa = apiFalsa({
    ambiente: (input) => {
      if (++n === 2) throw new Error("CUSTOM_STOREFRONT_HOSTING_SET_ENVIRONMENT_ERROR");
      return { keys: input.set.map((x) => x.key) };
    },
  });
  const json = await roda(dir, { json: true }, { falsa });
  assert.equal(json.erro, undefined, json.erro?.message);
  const { env } = JSON.parse(json.stdout).data;
  assert.equal(env.sent.length, 50);
  assert.equal(env.error.code, "CUSTOM_STOREFRONT_HOSTING_SET_ENVIRONMENT_ERROR");
});

test("nenhuma variável enviada: o texto avisa que o build vai falhar", { skip: semKeygen }, async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoSemGit(sb);
  process.env.UNBOX_PARTNER_API_KEY = "da2-chave-do-parceiro";
  process.env.UNBOX_USER = "api_loja";
  process.env.UNBOX_PASS = SENHA;
  const r = await roda(dir, {});
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.match(r.stdout, /Variáveis: {4}nenhuma enviada; sem elas o build da loja falha/);
});

test("segunda máquina (loja pronta com a chave de outra): adiciona a chave desta como mais uma e liga o projeto", { skip: semKeygen }, async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoSemGit(sb);
  credenciais(dir);
  const outra = { _id: "1", title: "cli-loja-teste", fingerprint: "SHA256:" + "A".repeat(43), createdAt: "2026-10-01T00:00:00Z" };
  const falsa = apiFalsa({ outraMaquina: true, chavesNaLoja: [outra] });
  const r = await roda(dir, { json: true }, { falsa });
  assert.equal(r.erro, undefined, r.erro?.message);
  const obj = JSON.parse(r.stdout);
  assert.equal(obj.data.deployKey.added, true);
  assert.equal(falsa.adicionadas.length, 1);
  const pub = fs.readFileSync(path.join(sb.home, ".config/unbox/keys/loja1_ed25519.pub"), "utf8").trim();
  assert.equal(falsa.adicionadas[0].deployPublicKey, pub);
  assert.ok(falsa.adicionadas[0].title.length <= 50);
  assert.equal(obj.data.deployKey.fingerprint, fingerprintDe(pub));
  assert.match(r.stderr, /adicionada à loja/);
  assert.equal(g(dir, "symbolic-ref", "--short", "HEAD"), "deploy");
});

test("segunda máquina, de novo: a chave já está na loja, nada é adicionado", { skip: semKeygen }, async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoSemGit(sb);
  credenciais(dir);
  const primeira = apiFalsa({ outraMaquina: true });
  assert.equal((await roda(dir, { json: true }, { falsa: primeira })).erro, undefined);
  // agora a lista da loja tem a chave desta máquina
  const pub = fs.readFileSync(path.join(sb.home, ".config/unbox/keys/loja1_ed25519.pub"), "utf8").trim();
  const jaLa = apiFalsa({ outraMaquina: true, chavesNaLoja: [{ _id: "7", title: "x", fingerprint: fingerprintDe(pub), createdAt: null }] });
  const r = await roda(dir, { json: true }, { falsa: jaLa });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.equal(JSON.parse(r.stdout).data.deployKey.added, false);
  assert.equal(jaLa.adicionadas.length, 0);
});

test("segunda máquina com a chave em uso em outro repositório: gera outra e adiciona a nova", { skip: semKeygen }, async () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoSemGit(sb);
  credenciais(dir);
  let n = 0;
  const falsa = apiFalsa({
    outraMaquina: true,
    adicionar: (input) => {
      if (++n === 1) throw new Error("CUSTOM_STOREFRONT_DEPLOY_KEY_IN_USE_ERROR");
      return { _id: "11", title: input.title, fingerprint: fingerprintDe(input.deployPublicKey), createdAt: null };
    },
  });
  const r = await roda(dir, { json: true }, { falsa });
  assert.equal(r.erro, undefined, r.erro?.message);
  const pub = fs.readFileSync(path.join(sb.home, ".config/unbox/keys/loja1_ed25519.pub"), "utf8").trim();
  assert.equal(falsa.adicionadas.length, 1);
  assert.equal(falsa.adicionadas[0].deployPublicKey, pub);
  assert.ok(fs.existsSync(path.join(sb.home, ".config/unbox/keys/loja1_ed25519.bak")));
  assert.match(r.stderr, /em uso em outro repositório/);
});
