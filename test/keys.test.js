// `unbox keys` e as regras das chaves de deploy: API falsa, ssh-keygen de verdade numa HOME temporária.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { runKeys } from "../src/commands/keys.js";
import { createOutput } from "../src/output.js";
import { fingerprintDe, identificador, leChavePublica, tituloPadrao, TITULO_MAX } from "../src/deploy-keys.js";
import { sandbox, escreve } from "./helpers/git-sandbox.mjs";

const semKeygen = spawnSync("ssh-keygen", ["-?"]).error ? "sem ssh-keygen nesta máquina" : false;
const SENHA = "senha-secreta-1";

beforeEach(() => {
  for (const k of Object.keys(process.env)) if (k.startsWith("UNBOX_")) delete process.env[k];
});

function projeto() {
  const sb = sandbox();
  const dir = path.join(sb.raiz, "loja");
  fs.mkdirSync(dir);
  escreve(dir, ".env.local", `UNBOX_PARTNER_API_KEY=da2-chave-do-parceiro\nUNBOX_USER=api_loja\nUNBOX_PASS=${SENHA}\n`);
  return { sb, dir };
}

/** Um par ed25519 de verdade em `arquivo` (e `arquivo.pub`). */
function par(arquivo) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  execFileSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-C", "teste", "-f", arquivo]);
  return fs.readFileSync(`${arquivo}.pub`, "utf8").trim();
}

function apiFalsa(chaves = []) {
  const chamadas = [];
  const api = {
    endpoint: "https://partners.teste/graphql",
    async shopId() { return "loja1"; },
    async request(query, vars) {
      chamadas.push({ op: query.match(/\{\s*(\w+)/)[1], input: vars?.input });
      if (/customStorefrontDeployKeys/.test(query)) return { customStorefrontDeployKeys: [...chaves] };
      if (/addCustomStorefrontDeployKey/.test(query)) {
        const k = { _id: String(100 + chaves.length), title: vars.input.title, fingerprint: fingerprintDe(vars.input.deployPublicKey), createdAt: "2026-11-05T00:00:00Z" };
        chaves.push(k);
        return { addCustomStorefrontDeployKey: k };
      }
      if (/removeCustomStorefrontDeployKey/.test(query)) {
        const i = chaves.findIndex((k) => k._id === vars.input._id);
        if (i < 0) throw new Error("CUSTOM_STOREFRONT_DEPLOY_KEY_NOT_FOUND_ERROR");
        return { removeCustomStorefrontDeployKey: chaves.splice(i, 1)[0] };
      }
      throw new Error(`consulta inesperada: ${query}`);
    },
  };
  return { api, chamadas, chaves, createApi: async ({ out }) => { out.addSecrets(SENHA); return api; } };
}

async function roda(args, globals, { falsa, interactive = false }) {
  const buf = { stdout: "", stderr: "" };
  const out = createOutput({
    json: Boolean(globals.json),
    stdout: { write: (s) => { buf.stdout += s; } },
    stderr: { write: (s) => { buf.stderr += s; } },
  });
  let erro;
  try {
    await runKeys(args, globals, { out, interactive, deps: { createApi: falsa.createApi } });
  } catch (e) {
    erro = e;
    out.fail(e);
  }
  return { ...buf, erro, json: buf.stdout && globals.json ? JSON.parse(buf.stdout) : undefined };
}

const outra = { _id: "1", title: "cli-loja-teste", fingerprint: `SHA256:${"A".repeat(43)}`, createdAt: "2026-10-01T00:00:00Z" };

test("fingerprint em JS puro é o mesmo do ssh-keygen -lf", { skip: semKeygen }, () => {
  const { sb } = projeto();
  const arq = path.join(sb.raiz, "k", "id_ed25519");
  const pub = par(arq);
  const doKeygen = execFileSync("ssh-keygen", ["-lf", `${arq}.pub`], { encoding: "utf8" }).split(" ")[1];
  assert.equal(fingerprintDe(pub), doKeygen);
});

test("título padrão cabe no limite e carrega o começo do fingerprint", () => {
  const fp = `SHA256:${"b".repeat(43)}`;
  const t = tituloPadrao(fp, { usuario: "u".repeat(80), maquina: "m".repeat(80) });
  assert.ok(t.length <= TITULO_MAX, t);
  assert.ok(t.endsWith(" bbbbbbbb"));
  assert.equal(tituloPadrao(fp, { usuario: "diego", maquina: "note com espaço" }), "diego@note-com-espa-o bbbbbbbb");
});

test("identificador: id ou fingerprint; o resto não", () => {
  assert.deepEqual(identificador("42"), { _id: "42" });
  assert.deepEqual(identificador(outra.fingerprint), { fingerprint: outra.fingerprint });
  assert.equal(identificador("SHA256:curto"), undefined);
  assert.equal(identificador("abc"), undefined);
});

test("chave privada no add é recusada e não vai para a API", { skip: semKeygen }, async () => {
  const { sb, dir } = projeto();
  const arq = path.join(sb.raiz, "k", "id_ed25519");
  par(arq);
  assert.throws(() => leChavePublica(arq), (e) => e.code === "CHAVE_PRIVADA" && /id_ed25519\.pub/.test(e.message));
  const falsa = apiFalsa([outra]);
  const r = await roda(["add", arq], { dir, json: true }, { falsa });
  assert.equal(r.erro?.code, "CHAVE_PRIVADA");
  assert.ok(!r.stdout.includes("PRIVATE"));
  assert.deepEqual(falsa.chamadas, []);
});

test("lista: marca a chave desta máquina", { skip: semKeygen }, async () => {
  const { sb, dir } = projeto();
  const pub = par(path.join(sb.home, ".config/unbox/keys/loja1_ed25519"));
  const desta = { _id: "2", title: "diego@note", fingerprint: fingerprintDe(pub), createdAt: null };
  const r = await roda([], { dir, json: true }, { falsa: apiFalsa([outra, desta]) });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.deepEqual(r.json.data.keys.map((k) => [k._id, k.thisMachine]), [["1", false], ["2", true]]);
  const texto = await roda(["list"], { dir }, { falsa: apiFalsa([outra, desta]) });
  assert.match(texto.stdout, /diego@note .*← esta máquina/);
  assert.ok(!texto.stdout.includes(SENHA));
});

test("add de um .pub de outra pessoa, com título; repetir não duplica", { skip: semKeygen }, async () => {
  const { sb, dir } = projeto();
  par(path.join(sb.raiz, "ci", "ci_ed25519"));
  const falsa = apiFalsa([outra]);
  const r = await roda(["add", path.join(sb.raiz, "ci", "ci_ed25519.pub"), "--title", "ci-github"], { dir, json: true }, { falsa });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.equal(r.json.data.added, true);
  assert.equal(r.json.data.key.title, "ci-github");
  assert.equal(falsa.chaves.length, 2);
  const de_novo = await roda(["add", path.join(sb.raiz, "ci", "ci_ed25519.pub")], { dir, json: true }, { falsa });
  assert.equal(de_novo.json.data.added, false);
  assert.equal(falsa.chamadas.filter((c) => c.op === "addCustomStorefrontDeployKey").length, 1);
});

test("add sem arquivo: gera e adiciona a chave desta máquina", { skip: semKeygen }, async () => {
  const { sb, dir } = projeto();
  const falsa = apiFalsa([outra]);
  const r = await roda(["add"], { dir, json: true }, { falsa });
  assert.equal(r.erro, undefined, r.erro?.message);
  const pub = fs.readFileSync(path.join(sb.home, ".config/unbox/keys/loja1_ed25519.pub"), "utf8").trim();
  assert.equal(r.json.data.key.fingerprint, fingerprintDe(pub));
  assert.ok(r.json.data.key.title.length <= TITULO_MAX);
});

test("remove: sem --yes fora de um terminal pede confirmação e não remove", async () => {
  const { dir } = projeto();
  const falsa = apiFalsa([outra, { ...outra, _id: "2", fingerprint: `SHA256:${"C".repeat(43)}` }]);
  const r = await roda(["remove", outra.fingerprint], { dir, json: true }, { falsa });
  assert.equal(r.erro?.code, "CONFIRMACAO_NECESSARIA");
  assert.equal(falsa.chaves.length, 2);
});

test("remove com --yes: pelo fingerprint ou pelo id, e avisa quando é a última", async () => {
  const { dir } = projeto();
  const segunda = { ...outra, _id: "2", title: "agencia", fingerprint: `SHA256:${"C".repeat(43)}` };
  const falsa = apiFalsa([outra, segunda]);
  const r = await roda(["remove", segunda.fingerprint], { dir, json: true, yes: true }, { falsa });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.equal(r.json.data.removed._id, "2");
  const ultima = await roda(["remove", "1"], { dir, json: true, yes: true }, { falsa });
  assert.equal(ultima.json.data.removed._id, "1");
  assert.match(ultima.stderr, /única chave/);
  assert.equal(falsa.chaves.length, 0);
});

test("remove de chave que não está na loja e uso incorreto", async () => {
  const { dir } = projeto();
  const falsa = apiFalsa([outra]);
  const r = await roda(["remove", "99"], { dir, json: true, yes: true }, { falsa });
  assert.equal(r.erro?.code, "CUSTOM_STOREFRONT_DEPLOY_KEY_NOT_FOUND_ERROR");
  assert.equal((await roda(["remove", "xyz"], { dir, json: true }, { falsa })).erro?.code, "USAGE");
  assert.equal((await roda(["apaga"], { dir, json: true }, { falsa })).erro?.name, "UsageError");
  assert.equal((await roda(["list", "--title", "x"], { dir, json: true }, { falsa })).erro?.name, "UsageError");
});

test("limite de chaves vira instrução de remover uma", { skip: semKeygen }, async () => {
  const { sb, dir } = projeto();
  par(path.join(sb.raiz, "ci", "ci_ed25519"));
  const falsa = apiFalsa([outra]);
  falsa.api.request = async (query) => {
    if (/customStorefrontDeployKeys/.test(query)) return { customStorefrontDeployKeys: [outra] };
    throw new Error("CUSTOM_STOREFRONT_DEPLOY_KEYS_LIMIT_ERROR");
  };
  const r = await roda(["add", path.join(sb.raiz, "ci", "ci_ed25519.pub")], { dir, json: true }, { falsa });
  assert.equal(r.erro?.code, "CUSTOM_STOREFRONT_DEPLOY_KEYS_LIMIT_ERROR");
  assert.match(r.erro.message, /unbox keys remove/);
});
