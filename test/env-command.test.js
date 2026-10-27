// `unbox env` ponta a ponta com API falsa: o que vai em cada chamada, o que sai, e que nenhum valor
// aparece em stdout, stderr ou --json, em nenhum caminho.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runEnv } from "../src/commands/env.js";
import { createOutput } from "../src/output.js";

const SENHA = "senha-secreta-1";
const CREDENCIAIS = `UNBOX_PARTNER_API_KEY=da2-chave-do-parceiro\nUNBOX_USER=api_loja\nUNBOX_PASS=${SENHA}\n`;
// Curto (o filtro da saída ignora segredos com menos de 6 caracteres), longo, com acento e com `\$`.
const VALORES = { CURTO: "q9z", LONGO: "valor-longo-e-secreto-42", ACENTO: "ção-secreta", DOLAR: "pre$fixo" };
const ARQUIVO_VALORES = 'CURTO=q9z\nLONGO=valor-longo-e-secreto-42\nACENTO="ção-secreta"\nDOLAR=`pre\\$fixo`\n';

beforeEach(() => {
  for (const k of Object.keys(process.env)) if (k.startsWith("UNBOX_")) delete process.env[k];
});
afterEach(() => {
  delete process.env.UNBOX_DEBUG;
});

function projeto(conteudo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "unbox-env-cmd-"));
  if (conteudo !== undefined) fs.writeFileSync(path.join(dir, ".env.local"), conteudo);
  return dir;
}

/**
 * API falsa. `gravar(input)` devolve `{ keys }` ou lança; `listar()` devolve as chaves. `chamadas`
 * guarda a operação e o input de cada uma.
 */
function apiFalsa({ gravar, listar = () => [] } = {}) {
  const chamadas = [];
  let hospedagem = [];
  const api = {
    endpoint: "https://partners.teste/graphql",
    async shopId() { return "loja1"; },
    async request(query, vars) {
      if (/setCustomStorefrontEnvironment/.test(query)) {
        chamadas.push({ op: "gravar", input: vars.input });
        if (gravar) return { setCustomStorefrontEnvironment: gravar(vars.input) };
        const tira = new Set(vars.input.unset ?? []);
        hospedagem = [...new Set([...hospedagem.filter((k) => !tira.has(k)), ...(vars.input.set ?? []).map((x) => x.key)])].sort();
        return { setCustomStorefrontEnvironment: { keys: hospedagem } };
      }
      chamadas.push({ op: "listar" });
      return { customStorefrontEnvironment: { keys: listar() } };
    },
  };
  return { api, chamadas, createApi: async ({ out }) => { out.addSecrets(SENHA); return api; } };
}

async function roda(dir, args = [], { json = true, falsa = apiFalsa(), globals = {} } = {}) {
  const buf = { stdout: "", stderr: "" };
  const out = createOutput({
    json,
    stdout: { write: (s) => { buf.stdout += s; } },
    stderr: { write: (s) => { buf.stderr += s; } },
  });
  let erro;
  try {
    await runEnv(args, { dir, json, ...globals }, { out, deps: { createApi: falsa.createApi } });
  } catch (e) {
    erro = e;
    out.fail(e);
  }
  return { ...buf, erro, chamadas: falsa.chamadas };
}

function semValores(r, valores = Object.values(VALORES)) {
  for (const s of [r.stdout, r.stderr]) {
    for (const v of [...valores, SENHA]) assert.ok(!s.includes(v), `valor "${v}" na saída:\n${s}`);
  }
}

test("envia as chaves do arquivo, com os valores na chamada e só os nomes na saída", async () => {
  const dir = projeto(CREDENCIAIS + ARQUIVO_VALORES + "NEXT_PUBLIC_SITE_URL=http://localhost:3000\nVAZIA=\n");
  const r = await roda(dir);
  assert.equal(r.erro, undefined, r.erro?.message);
  const gravacoes = r.chamadas.filter((c) => c.op === "gravar");
  assert.equal(gravacoes.length, 1);
  assert.deepEqual(Object.fromEntries(gravacoes[0].input.set.map((x) => [x.key, x.value])), {
    UNBOX_PARTNER_API_KEY: "da2-chave-do-parceiro",
    UNBOX_USER: "api_loja",
    UNBOX_PASS: SENHA,
    ...VALORES,
  });
  const obj = JSON.parse(r.stdout);
  assert.equal(obj.ok, true);
  assert.deepEqual(obj.data.sent, ["UNBOX_PARTNER_API_KEY", "UNBOX_USER", "UNBOX_PASS", "CURTO", "LONGO", "ACENTO", "DOLAR"]);
  assert.deepEqual(obj.data.skipped, [
    { key: "NEXT_PUBLIC_SITE_URL", reason: "gerenciada" },
    { key: "VAZIA", reason: "vazia" },
  ]);
  assert.match(r.stderr, /NEXT_PUBLIC_SITE_URL não foi enviada: é gerenciada pela Unbox/);
  semValores(r, [...Object.values(VALORES), "api_loja", "da2-chave-do-parceiro"]);
});

test("vazias: uma linha só com os nomes, sem um aviso por chave", async () => {
  const dir = projeto(CREDENCIAIS + ARQUIVO_VALORES + "GA_ID=\nPIXEL_ID=\nWHATSAPP=\nTZ=America/Sao_Paulo\n");
  const r = await roda(dir, [], { json: false });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.match(r.stderr, /3 variáveis vazias no \.env\.local, não enviadas \(opcionais em branco\): GA_ID, PIXEL_ID, WHATSAPP\./);
  assert.doesNotMatch(r.stderr, /Aviso: GA_ID/);
  assert.match(r.stderr, /Aviso: TZ não foi enviada: o nome é reservado/);
  assert.match(r.stdout, /Não enviadas \(1\): TZ/);
  assert.match(r.stdout, /Vazias no arquivo, não enviadas: 3/);
});

test("texto: enviadas, não enviadas e o próximo passo", async () => {
  const dir = projeto(CREDENCIAIS + ARQUIVO_VALORES + "TZ=America/Sao_Paulo\n");
  const r = await roda(dir, [], { json: false });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.match(r.stdout, /Enviadas \(7\): UNBOX_PARTNER_API_KEY/);
  assert.match(r.stdout, /Não enviadas \(1\): TZ/);
  assert.match(r.stdout, /rode unbox deploy \(e depois unbox publish\)/);
  semValores(r);
});

test("51 chaves: duas chamadas, de 50 e de 1", async () => {
  const extras = Array.from({ length: 48 }, (_, i) => `VAR_${i}=v${i}`).join("\n");
  const dir = projeto(CREDENCIAIS + extras + "\n");
  const r = await roda(dir);
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.deepEqual(r.chamadas.filter((c) => c.op === "gravar").map((c) => c.input.set.length), [50, 1]);
  assert.equal(JSON.parse(r.stdout).data.sent.length, 51);
});

test("valor do terminal vence e é avisado; credencial só no terminal é avisada e não vai", async () => {
  const dir = projeto("UNBOX_PARTNER_API_KEY=da2-chave-do-parceiro\nUNBOX_USER=api_loja\nLONGO=do-arquivo\n");
  process.env.UNBOX_PASS = SENHA;
  process.env.LONGO = VALORES.LONGO;
  try {
    const r = await roda(dir);
    assert.equal(r.erro, undefined, r.erro?.message);
    const set = r.chamadas.find((c) => c.op === "gravar").input.set;
    assert.equal(set.find((x) => x.key === "LONGO").value, VALORES.LONGO);
    assert.ok(!set.some((x) => x.key === "UNBOX_PASS"));
    assert.deepEqual(JSON.parse(r.stdout).data.fromTerminal, ["LONGO"]);
    assert.match(r.stderr, /valor do ambiente do terminal.*: LONGO/);
    assert.match(r.stderr, /UNBOX_PASS está só no ambiente do terminal.*vai falhar no login/);
    semValores(r);
  } finally {
    delete process.env.LONGO;
  }
});

test("nada a enviar: não chama a gravação", async () => {
  process.env.UNBOX_PARTNER_API_KEY = "da2-chave-do-parceiro";
  process.env.UNBOX_USER = "api_loja";
  process.env.UNBOX_PASS = SENHA;
  const dir = projeto("NEXT_PUBLIC_SITE_URL=http://localhost:3000\n");
  const r = await roda(dir);
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.deepEqual(r.chamadas, []);
  assert.deepEqual(JSON.parse(r.stdout).data.sent, []);
});

test(".env.local ausente: ENV_FILE_AUSENTE, mesmo com as credenciais no terminal", async () => {
  process.env.UNBOX_PARTNER_API_KEY = "da2-chave-do-parceiro";
  process.env.UNBOX_USER = "api_loja";
  process.env.UNBOX_PASS = SENHA;
  const r = await roda(projeto());
  assert.equal(r.erro?.code, "ENV_FILE_AUSENTE");
  assert.deepEqual(r.chamadas, []);
});

test("erro da API que ecoa o input: mensagem da CLI, sem nenhum valor, nem com UNBOX_DEBUG", async () => {
  process.env.UNBOX_DEBUG = "1";
  const dir = projeto(CREDENCIAIS + ARQUIVO_VALORES);
  const falsa = apiFalsa({
    gravar: (input) => {
      throw Object.assign(new Error(`Validation error: argument 'input' with value ${JSON.stringify(input)}`), {
        errors: [{ message: JSON.stringify(input) }],
      });
    },
  });
  const r = await roda(dir, [], { falsa });
  assert.equal(r.erro?.code, "ENV_RECUSADO");
  assert.equal(JSON.parse(r.stdout).error.code, "ENV_RECUSADO");
  semValores(r, [...Object.values(VALORES), "api_loja", "da2-chave-do-parceiro"]);
});

test("loja não provisionada: orienta o unbox provision", async () => {
  const dir = projeto(CREDENCIAIS);
  const falsa = apiFalsa({ gravar: () => { throw new Error("CUSTOM_STOREFRONT_NOT_READY_ERROR"); } });
  const r = await roda(dir, [], { falsa });
  assert.equal(r.erro?.code, "CUSTOM_STOREFRONT_NOT_READY_ERROR");
  assert.match(r.erro.message, /rode unbox provision/);
});

test("reservada nova no backend: a bisseção acha a chave, pula com aviso e grava o resto", async () => {
  const extras = Array.from({ length: 10 }, (_, i) => `VAR_${i}=v${i}`);
  extras.splice(6, 0, "NOVA_RESERVADA=x1");
  const dir = projeto(CREDENCIAIS + extras.join("\n") + "\n");
  const gravadas = new Set();
  const falsa = apiFalsa({
    gravar: (input) => {
      if (input.set.some((x) => x.key === "NOVA_RESERVADA")) throw new Error("CUSTOM_STOREFRONT_ENVIRONMENT_KEY_RESERVED_ERROR");
      for (const x of input.set) gravadas.add(x.key);
      return { keys: [...gravadas].sort() };
    },
  });
  const r = await roda(dir, [], { falsa });
  assert.equal(r.erro, undefined, r.erro?.message);
  const { data } = JSON.parse(r.stdout);
  assert.equal(data.sent.length, 13);
  assert.ok(!data.sent.includes("NOVA_RESERVADA"));
  assert.deepEqual(data.skipped, [{ key: "NOVA_RESERVADA", reason: "reservada_nova" }]);
  assert.equal(gravadas.size, 13);
  assert.match(r.stderr, /NOVA_RESERVADA não foi enviada: a Unbox passou a reservar este nome.*Atualize a CLI/);
});

test("hospedagem falha no segundo lote: diz quantas variáveis já foram gravadas e que o lote pode ter ficado parcial", async () => {
  const extras = Array.from({ length: 48 }, (_, i) => `VAR_${i}=v${i}`).join("\n");
  const dir = projeto(CREDENCIAIS + extras + "\n");
  let n = 0;
  const falsa = apiFalsa({
    gravar: (input) => {
      if (++n === 2) throw new Error("CUSTOM_STOREFRONT_HOSTING_SET_ENVIRONMENT_ERROR");
      return { keys: input.set.map((x) => x.key) };
    },
  });
  const r = await roda(dir, [], { falsa });
  assert.equal(r.erro?.code, "CUSTOM_STOREFRONT_HOSTING_SET_ENVIRONMENT_ERROR");
  assert.match(r.erro.message, /pode ter ficado parcial/);
  assert.match(r.erro.message, /50 de 51 variáveis já foram gravadas/);
  assert.equal(r.erro.feitas.length, 50);
});

test("bisseção que falha no meio por outro motivo conta o que a outra metade já gravou", async () => {
  const extras = Array.from({ length: 9 }, (_, i) => `VAR_${i}=v${i}`);
  extras.push("NOVA_RESERVADA=x1");
  const dir = projeto(CREDENCIAIS + extras.join("\n") + "\n");
  const falsa = apiFalsa({
    gravar: (input) => {
      if (input.set.length > 6 && input.set.some((x) => x.key === "NOVA_RESERVADA")) throw new Error("CUSTOM_STOREFRONT_ENVIRONMENT_KEY_RESERVED_ERROR");
      if (input.set.some((x) => x.key === "NOVA_RESERVADA")) throw new Error("CUSTOM_STOREFRONT_HOSTING_SET_ENVIRONMENT_ERROR");
      return { keys: input.set.map((x) => x.key) };
    },
  });
  const r = await roda(dir, [], { falsa });
  assert.equal(r.erro?.code, "CUSTOM_STOREFRONT_HOSTING_SET_ENVIRONMENT_ERROR");
  // 13 chaves: a primeira metade (7) foi gravada antes de a segunda falhar.
  assert.match(r.erro.message, /7 de 13 variáveis já foram gravadas/);
});

test("--unset que falha na hospedagem também avisa que pode ter ficado parcial", async () => {
  const dir = projeto(CREDENCIAIS);
  const falsa = apiFalsa({
    listar: () => ["A_VAR"],
    gravar: () => { throw new Error("CUSTOM_STOREFRONT_HOSTING_REMOVE_ENVIRONMENT_ERROR"); },
  });
  const r = await roda(dir, ["--unset", "A_VAR"], { falsa });
  assert.equal(r.erro?.code, "CUSTOM_STOREFRONT_HOSTING_REMOVE_ENVIRONMENT_ERROR");
  assert.match(r.erro.message, /pode ter ficado parcial/);
});

test("variável vazia no terminal vence o arquivo: o aviso aponta o terminal", async () => {
  const dir = projeto(CREDENCIAIS + "SLUG_UNBOX_TESTE=loja-x\n");
  process.env.SLUG_UNBOX_TESTE = "";
  try {
    const r = await roda(dir);
    assert.equal(r.erro, undefined, r.erro?.message);
    assert.deepEqual(JSON.parse(r.stdout).data.skipped, [{ key: "SLUG_UNBOX_TESTE", reason: "vazia_terminal" }]);
    assert.match(r.stderr, /vazia no ambiente do terminal, que vence o arquivo/);
  } finally {
    delete process.env.SLUG_UNBOX_TESTE;
  }
});

test("validação do backend com índice: diz QUAL variável, sem ecoar o texto do servidor", async () => {
  const dir = projeto(CREDENCIAIS + ARQUIVO_VALORES);
  const falsa = apiFalsa({
    gravar: () => { throw Object.assign(new Error("GraphQL"), { cause: { errors: [{ message: '"set[4].value" length must be less than or equal to 16384 characters long' }] } }); },
  });
  const r = await roda(dir, [], { falsa });
  assert.equal(r.erro?.code, "ENV_INVALIDA");
  assert.match(r.erro.message, /recusou a variável LONGO\./);
  assert.doesNotMatch(r.erro.message, /16384/);
});

test("--unset: remove só o que existe, avisa o que continua no arquivo", async () => {
  const dir = projeto(CREDENCIAIS + "A_VAR=x\n");
  const falsa = apiFalsa({
    listar: () => ["A_VAR", "C_VAR"],
    gravar: (input) => ({ keys: ["A_VAR", "C_VAR"].filter((k) => !input.unset.includes(k)) }),
  });
  const r = await roda(dir, ["--unset", "A_VAR", "B_VAR"], { falsa });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.deepEqual(r.chamadas.filter((c) => c.op === "gravar").map((c) => c.input), [{ unset: ["A_VAR"] }]);
  assert.deepEqual(JSON.parse(r.stdout).data, { removed: ["A_VAR"], notFound: ["B_VAR"], keys: ["C_VAR"] });
  assert.match(r.stderr, /A_VAR continua no \.env\.local e volta no próximo unbox env/);
});

test("--unset não precisa do .env.local (credenciais no terminal)", async () => {
  process.env.UNBOX_PARTNER_API_KEY = "da2-chave-do-parceiro";
  process.env.UNBOX_USER = "api_loja";
  process.env.UNBOX_PASS = SENHA;
  const r = await roda(projeto(), ["--unset", "X_VAR"]);
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.deepEqual(JSON.parse(r.stdout).data, { removed: [], notFound: ["X_VAR"], keys: [] });
});

test("uso incorreto: --unset sem chaves, reservada, inválida, --list com --unset, posicional solto", async () => {
  const dir = projeto(CREDENCIAIS);
  for (const args of [["--unset"], ["--unset", "TZ"], ["--unset", "minuscula"], ["--list", "--unset", "A"], ["A_VAR"], ["--unset=A"]]) {
    const r = await roda(dir, args);
    assert.equal(r.erro?.code, "USAGE", `${args.join(" ")}: ${r.erro?.message}`);
    assert.deepEqual(r.chamadas, [], args.join(" "));
  }
});

test("--list: na hospedagem, não enviadas, puladas e só na hospedagem", async () => {
  const dir = projeto(CREDENCIAIS + "NOVA_VAR=x\nTZ=America/Sao_Paulo\n");
  const falsa = apiFalsa({ listar: () => ["ANTIGA_VAR", "NEXT_PUBLIC_SITE_URL", "UNBOX_PASS", "UNBOX_PARTNER_API_KEY", "UNBOX_USER"] });
  const r = await roda(dir, ["--list"], { falsa });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.deepEqual(JSON.parse(r.stdout).data, {
    keys: ["ANTIGA_VAR", "NEXT_PUBLIC_SITE_URL", "UNBOX_PASS", "UNBOX_PARTNER_API_KEY", "UNBOX_USER"],
    notSent: ["NOVA_VAR"],
    skipped: [{ key: "TZ", reason: "reservada" }],
    remoteOnly: ["ANTIGA_VAR"],
  });
  assert.ok(!r.chamadas.some((c) => c.op === "gravar"));
});

test("--list em texto avisa que a comparação é só pelo nome", async () => {
  const dir = projeto(CREDENCIAIS);
  const r = await roda(dir, ["--list"], { json: false });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.match(r.stdout, /só pelo nome/);
  semValores(r);
});
