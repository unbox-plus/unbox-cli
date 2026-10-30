// Regressão do create: a loja gerada pelo código novo, nas duas entradas (`unbox create` e o legado
// `create-unbox-store`), tem de ser IGUAL, byte a byte, à gerada pelo código anterior à mudança.
//
// O código anterior sai do git (`git merge-base HEAD develop`, ou UNBOX_BASE_REF): bin/, src/ e
// package.json daquele commit, com o template e o node_modules ATUAIS (symlink), para que só o
// código do CLI esteja sendo comparado. Cada geração roda num processo filho com o wizard injetado
// (test/helpers/inject.mjs), então os caminhos que o --yes pula (credenciais, .mcp.json,
// checkout hospedado, domínio inválido) também são comparados.
//
// O que é sorteado a cada geração não é ignorado: é conferido no formato e depois normalizado.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INJECT = path.join(RAIZ, "test/helpers/inject.mjs");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "unbox-create-"));
const BASE = path.join(TMP, "base");

function baseRef() {
  if (process.env.UNBOX_BASE_REF) return process.env.UNBOX_BASE_REF;
  for (const alvo of ["develop", "origin/develop"]) {
    try {
      return execFileSync("git", ["merge-base", "HEAD", alvo], { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch { /* tenta o próximo */ }
  }
  return null;
}

const REF = baseRef();
const semGit = REF ? false : "sem git ou sem develop para comparar (defina UNBOX_BASE_REF)";

before(() => {
  if (!REF) return;
  fs.mkdirSync(BASE);
  const tar = execFileSync("git", ["archive", REF, "bin", "src", "package.json"], { cwd: RAIZ });
  execFileSync("tar", ["-x", "-C", BASE], { input: tar });
  fs.symlinkSync(path.join(RAIZ, "template"), path.join(BASE, "template"));
  fs.symlinkSync(path.join(RAIZ, "node_modules"), path.join(BASE, "node_modules"));
});

/** Gera a loja `loja` numa pasta nova e devolve { dir, status, stdout, stderr }. */
function gerar(rotulo, script, args, respostas) {
  const cwd = fs.mkdtempSync(path.join(TMP, `${rotulo}-`));
  const r = spawnSync(process.execPath, ["--import", INJECT, script, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, UNBOX_TEST_ANSWERS: respostas ? JSON.stringify(respostas) : "" },
    timeout: 60_000,
  });
  return { dir: path.join(cwd, "loja"), status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function arvore(dir) {
  const out = new Map();
  const andar = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) andar(p);
      else out.set(path.relative(dir, p), fs.readFileSync(p));
    }
  };
  andar(dir);
  return out;
}

/** Confere o formato do que é sorteado e troca por um marcador fixo. */
function normalizar(rel, buf) {
  let s = buf.toString("utf8");
  if (rel === ".env.local") {
    const pega = (k) => s.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1];
    assert.match(pega("SESSION_SECRET"), /^[0-9a-f]{64}$/, "SESSION_SECRET");
    assert.match(pega("REVALIDATE_SECRET"), /^[0-9a-f]{48}$/, "REVALIDATE_SECRET");
    assert.match(pega("PREVIEW_PASSWORD"), /^[A-Za-z0-9_-]{8}$/, "PREVIEW_PASSWORD");
    s = s.replace(/^(SESSION_SECRET|REVALIDATE_SECRET|PREVIEW_PASSWORD)=.*$/gm, "$1=<sorteado>");
    return s;
  }
  if (rel === path.join("lib", "segredo-da-loja.ts")) {
    assert.match(s, /export const SEGREDO_DA_LOJA = "[0-9a-f]{64}";/);
    return s.replace(/SEGREDO_DA_LOJA = "[0-9a-f]{64}"/, 'SEGREDO_DA_LOJA = "<sorteado>"');
  }
  if (rel === path.join("marca", "briefing.json")) {
    const b = JSON.parse(s);
    assert.ok(!Number.isNaN(Date.parse(b.criadoEm)), "criadoEm é data");
    b.criadoEm = "<data>";
    return JSON.stringify(b, null, 2);
  }
  return buf;
}

/** O segredo da loja é o mesmo SESSION_SECRET do .env.local. */
function segredoConfere(dir) {
  const env = fs.readFileSync(path.join(dir, ".env.local"), "utf8").match(/^SESSION_SECRET=(.*)$/m)[1];
  const ts = fs.readFileSync(path.join(dir, "lib/segredo-da-loja.ts"), "utf8");
  assert.ok(ts.includes(`"${env}"`), "SEGREDO_DA_LOJA === SESSION_SECRET");
}

function mesmaLoja(esperado, obtido, rotulo) {
  assert.equal(obtido.status, esperado.status, `${rotulo}: código de saída`);
  if (esperado.status !== 0) return;
  segredoConfere(obtido.dir);
  const a = arvore(esperado.dir);
  const b = arvore(obtido.dir);
  assert.deepEqual([...b.keys()].sort(), [...a.keys()].sort(), `${rotulo}: mesmos arquivos`);
  for (const [rel, conteudo] of a) {
    const x = normalizar(rel, conteudo);
    const y = normalizar(rel, b.get(rel));
    assert.ok(Buffer.isBuffer(x) ? x.equals(y) : x === y, `${rotulo}: ${rel} difere`);
  }
}

// A ordem das respostas é a ordem das perguntas do wizard; a pasta vem como argumento.
const CORES = ["Loja de Teste", "#15803D", "#F3C012", "https://exemplo.com.br", "@exemplo", "aumentar o ticket médio"];
const CENARIOS = [
  ...["essencial", "promocional", "editorial", "boutique"].map((estilo) => ({
    nome: `--yes, estilo ${estilo}`, args: ["loja", "--yes", "--no-install", "--estilo", estilo],
  })),
  {
    nome: "wizard com credenciais difíceis e token do MCP",
    args: ["loja", "--no-install"],
    respostas: [...CORES, "boutique", true, "custom", "da2-chave", "api_loja", "p$ss`w#rd $1 'x'", "SHOP1", "minha-loja", "mcp-token-123"],
    // Prova de que o wizard foi mesmo respondido, e não pulado nos dois lados.
    confere: (dir) => {
      assert.ok(fs.existsSync(path.join(dir, ".mcp.json")), ".mcp.json gerado");
      const env = fs.readFileSync(path.join(dir, ".env.local"), "utf8");
      assert.match(env, /^UNBOX_USER=api_loja$/m);
      assert.match(env, /^NEXT_PUBLIC_SITE_NAME=`Loja de Teste`$/m);
      assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "marca/briefing.json"), "utf8")).estilo, "boutique");
    },
  },
  {
    nome: "wizard com checkout hospedado",
    args: ["loja", "--no-install"],
    respostas: [...CORES, "editorial", false, "unbox", "https://minhaloja.com.br/"],
    confere: (dir) => {
      assert.ok(!fs.existsSync(path.join(dir, "components/checkout")), "checkout customizado removido");
      assert.match(fs.readFileSync(path.join(dir, ".env.local"), "utf8"), /^UNBOX_HOSTED_CHECKOUT_URL=https:\/\/minhaloja\.com\.br\/carrinho\/finalizar-pedido$/m);
    },
  },
  {
    nome: "wizard com domínio inválido (mantém o checkout customizável)",
    args: ["loja", "--no-install"],
    respostas: [...CORES, "promocional", false, "unbox", "minha loja/caminho"],
    confere: (dir) => {
      assert.ok(fs.existsSync(path.join(dir, "components/checkout")), "checkout customizado mantido");
      assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "marca/briefing.json"), "utf8")).estilo, "promocional");
    },
  },
  {
    nome: "wizard com --estilo na linha de comando",
    args: ["loja", "--no-install", "--estilo", "essencial"],
    respostas: ["Outra Loja", "#000000", "#FFFFFF", "", "", "", false, "custom"],
  },
  { nome: "estilo inexistente", args: ["loja", "--yes", "--no-install", "--estilo", "nenhum"] },
  { nome: "flag desconhecida", args: ["loja", "--yes", "--estylo", "boutique"] },
];

for (const c of CENARIOS) {
  test(`create igual ao anterior: ${c.nome}`, { skip: semGit }, () => {
    const antigo = gerar("antigo", path.join(BASE, "bin/cli.js"), c.args, c.respostas);
    const legado = gerar("legado", path.join(RAIZ, "bin/cli.js"), c.args, c.respostas);
    const novo = gerar("novo", path.join(RAIZ, "bin/unbox.js"), ["create", ...c.args], c.respostas);
    mesmaLoja(antigo, legado, "create-unbox-store");
    mesmaLoja(antigo, novo, "unbox create");
    if (c.confere) c.confere(novo.dir);
    if (antigo.status !== 0) assert.equal(antigo.status, 1, "erro de uso no create sai com 1");
  });
}

test("aviso de depreciação: só no legado e só em stderr", { skip: semGit }, () => {
  const legado = gerar("aviso-legado", path.join(RAIZ, "bin/cli.js"), ["loja", "--yes", "--no-install"]);
  const novo = gerar("aviso-novo", path.join(RAIZ, "bin/unbox.js"), ["create", "loja", "--yes", "--no-install"]);
  assert.match(legado.stderr, /o comando padrão agora é `unbox create`/);
  assert.doesNotMatch(legado.stdout, /comando padrão agora/);
  assert.doesNotMatch(novo.stderr + novo.stdout, /comando padrão agora/);
});
