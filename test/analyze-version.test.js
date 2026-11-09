// `unbox analyze-version`: três árvores sintéticas (helpers/template-fixture), sem rede: o template "atual" vem de
// `deps.templateDir`, o da base de `--base-template`, a latest do npm de `deps.latest`.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runAnalyzeVersion, nomeDaLoja } from "../src/commands/analyze-version.js";
import { TEMPLATE_DIR } from "../src/paths.js";
import { applyPreset, applyStoreName } from "../src/theme.js";
import { deriveBrandTokens } from "../src/colors.js";
import { createOutput } from "../src/output.js";
import { BASE, ATUAL, LOJA, monta, migracaoFalsa } from "./helpers/template-fixture.mjs";
import { escreve } from "./helpers/git-sandbox.mjs";

beforeEach(() => { for (const k of Object.keys(process.env)) if (k.startsWith("UNBOX_")) delete process.env[k]; });

function cenario({ versao = "0.29.0", loja = LOJA(versao) } = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "unbox-analyze-"));
  const base = monta(path.join(raiz, "base"), BASE);
  const atual = monta(path.join(raiz, "atual"), ATUAL);
  const dir = monta(path.join(raiz, "loja"), loja);
  const migracao = path.join(raiz, "MIGRACAO.md");
  fs.writeFileSync(migracao, migracaoFalsa());
  return { raiz, base, atual, dir, migracao };
}

async function roda(c, globals = {}, { args = [], deps = {} } = {}) {
  const buf = { stdout: "", stderr: "" };
  const out = createOutput({ json: Boolean(globals.json), stdout: { write: (s) => { buf.stdout += s; } }, stderr: { write: (s) => { buf.stderr += s; } } });
  let erro;
  try {
    await runAnalyzeVersion(["--base-template", c.base, ...args], { dir: c.dir, ...globals }, { out, deps: { templateDir: c.atual, cliVersion: () => "0.30.0", latest: async () => null, migracao: c.migracao, ...deps } });
  } catch (e) { erro = e; out.fail(e); }
  const json = globals.json ? JSON.parse(buf.stdout) : undefined;
  return { ...buf, json, data: json?.data, erro };
}

test("texto: versão-base pelo carimbo, grupos, editor, comportamento, régua, fichas e próximos passos", async () => {
  const c = cenario();
  const r = await roda(c);
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.match(r.stdout, /Versão-base: 0\.29\.0 \(carimbo\)\s+Template atual: 0\.30\.0/);
  assert.match(r.stdout, /Copiar direto[^\n]*: 2/);
  assert.match(r.stdout, /lib\/unbox\.ts: a loja tem a pasta lib\/unbox\//);
  assert.match(r.stdout, /lib\/unbox\/x\.ts: a loja alterou/);
  assert.match(r.stdout, /Reaplicar[^\n]*: 1\n\s+- lib\/reaplicar\.ts/);
  assert.match(r.stdout, /Reescrita[^\n]*: 1\n\s+- lib\/reescrita\.ts/);
  assert.match(r.stdout, /Personalizados[^\n]*: 2/);
  assert.match(r.stdout, /entra dependencies\.@unbox-plus\/sdk/);
  assert.match(r.stdout, /Rotas do código sem declaração: \/blog, \/sobre/);
  assert.match(r.stdout, /Coleções do lojista em colisão com o código: blog/);
  assert.match(r.stdout, /Catálogo duplicado em lib\/brand\/catalogo\.json/);
  assert.match(r.stdout, /\/sobre\s+só prosa\/JSON\s+→ candidata a página do lojista/);
  assert.match(r.stdout, /Régua: REFATORAR/);
  assert.match(r.stdout, /O que mudou \(MIGRACAO\.md, 1 ficha\(s\)\)\n\s+0\.30\.0/);
  assert.match(r.stdout, /Ambiente: entram NOVA_VAR/);
  assert.match(r.stdout, /unbox upgrade-template aplica/);
  assert.doesNotMatch(r.stdout, /Minha Loja/, "o nome da loja é aplicado à base antes de comparar");
});

test("--json: o contrato, sem as árvores internas", async () => {
  const c = cenario();
  const r = await roda(c, { json: true });
  assert.equal(r.json.ok, true);
  const d = r.data;
  assert.deepEqual(Object.keys(d).sort(), ["ambiente", "atual", "base", "comparado", "dir", "editor", "fichas", "grupos", "latest", "nome", "numeros", "pacote", "plano", "proximos", "regua"]);
  assert.deepEqual(d.base, { versao: "0.29.0", fonte: "carimbo", lacunas: [], publicada: true });
  assert.equal(d.atual, "0.30.0");
  assert.equal(d.nome, "Loja Teste");
  assert.deepEqual(d.plano.aplicar.copiar, ["components/site-header.tsx", "lib/copiar.ts"]);
  assert.deepEqual(d.plano.aplicar.remover, ["lib/removido.ts"]);
  assert.ok(d.plano.pendentes.some((p) => p.arquivo === "lib/unbox.ts" && p.grupo === "novo_no_template"));
  assert.equal(d.regua.recomendacao, "refatorar");
  assert.equal(d.fichas[0].versao, "0.30.0");
});

test("a personalização do create não vira conflito: site-header com o nome da loja é intacto", async () => {
  const c = cenario();
  const r = await roda(c, { json: true });
  assert.ok(!r.data.grupos.reaplicar.some((x) => x.arquivo === "components/site-header.tsx"));
  assert.ok(r.data.grupos.copiar.some((x) => x.arquivo === "components/site-header.tsx") || r.data.grupos.intacto.some((x) => x.arquivo === "components/site-header.tsx"));
});

test("sem carimbo: marcadores; sem nenhum: VERSAO_DESCONHECIDA; --base força", async () => {
  const semCarimbo = LOJA();
  semCarimbo["package.json"] = JSON.stringify({ name: "loja" }) + "\n";
  const c = cenario({ loja: semCarimbo });
  // com lib/editable e o gate, o marcador 0.20.1 bate: a loja é lida como 0.20.1 (sem pacote no npm)
  let r = await roda(c, { json: true });
  assert.equal(r.json.ok, true);
  assert.deepEqual(r.data.base, { versao: "0.20.1", fonte: "marcadores", lacunas: ["0.17.1"], publicada: false });
  assert.equal(r.data.comparado, true, "com --base-template a comparação acontece mesmo sem pacote no npm");
  fs.rmSync(path.join(c.dir, "lib/editable"), { recursive: true });
  fs.rmSync(path.join(c.dir, "scripts/check-editable.mjs"));
  r = await roda(c, { json: true });
  assert.equal(r.json.ok, false);
  assert.equal(r.json.error.code, "VERSAO_DESCONHECIDA");
  r = await roda(c, { json: true }, { args: ["--base", "0.29.0"] });
  assert.equal(r.json.ok, true);
  assert.equal(r.data.base.fonte, "--base");
  // um marcador real da tabela: lib/subscription-items.ts (0.26.0) com os anteriores presentes é o que a loja 0.26 tem
  r = await roda(c, { json: true }, { args: ["--base", "x"] });
  assert.equal(r.json.error.code, "USAGE");
});

test("loja mais nova que a CLI: CLI_DESATUALIZADA, nunca NADA_A_FAZER", async () => {
  const c = cenario({ versao: "0.31.0" });
  const r = await roda(c, { json: true });
  assert.equal(r.json.error.code, "CLI_DESATUALIZADA");
  assert.match(r.json.error.message, /@unbox-plus\/cli@latest/);
});

test("loja já no template atual: nada a migrar, e os grupos de mudança vêm vazios", async () => {
  const c = cenario({ versao: "0.30.0" });
  const r = await roda(c, { json: true });
  assert.equal(r.json.ok, true);
  assert.match(r.data.proximos[0], /já está no template 0\.30\.0/);
  assert.equal(r.data.grupos.copiar.length, 0);
});

test("latest do npm maior que a CLI em uso: avisa para rodar com @latest", async () => {
  const c = cenario();
  const r = await roda(c, {}, { deps: { latest: async () => "0.32.0" } });
  assert.match(r.stdout, /npm já tem 0\.32\.0/);
  assert.match(r.stdout, /@unbox-plus\/cli@latest/);
});

test("pasta que não é loja da CLI: SEM_LOJA; sem package.json: SEM_PACKAGE_JSON", async () => {
  const c = cenario();
  fs.rmSync(path.join(c.dir, "agents"), { recursive: true });
  let r = await roda(c, { json: true });
  assert.equal(r.json.error.code, "SEM_LOJA");
  fs.rmSync(path.join(c.dir, "package.json"));
  r = await roda(c, { json: true });
  assert.equal(r.json.error.code, "SEM_PACKAGE_JSON");
});

test("versão sem pacote no npm e sem --base-template: régua refazer, sem classificação, saída 0", async () => {
  const c = cenario({ versao: "0.20.3" });
  const buf = { stdout: "", stderr: "" };
  const out = createOutput({ json: true, stdout: { write: (s) => { buf.stdout += s; } }, stderr: { write: (s) => { buf.stderr += s; } } });
  await runAnalyzeVersion([], { dir: c.dir, json: true }, { out, deps: { templateDir: c.atual, cliVersion: () => "0.30.0", latest: async () => null, migracao: c.migracao } });
  const j = JSON.parse(buf.stdout);
  assert.equal(j.ok, true);
  assert.equal(j.data.comparado, false);
  assert.equal(j.data.regua.recomendacao, "refazer");
  assert.equal(j.data.regua.corte_duro, true);
  assert.match(j.data.proximos.join(" "), /unbox create/);
});

test("argumento posicional é uso incorreto; --no-network não consulta o npm", async () => {
  const c = cenario();
  let r = await roda(c, {}, { args: ["loja"] });
  assert.equal(r.erro?.code, "USAGE");
  let chamou = false;
  r = await roda(c, { json: true }, { args: ["--no-network"], deps: { latest: async () => { chamou = true; return "9.9.9"; } } });
  assert.equal(chamou, false);
  assert.equal(r.data.latest, null);
});

test("checkout hospedado: os três caminhos ausentes na loja não aparecem como removidos", async () => {
  const atualComCheckout = { ...ATUAL, "app/api/checkout/route.ts": "export const GET = () => 1;\n" };
  const c = cenario();
  monta(c.atual, atualComCheckout);
  escreve(c.base, "app/api/checkout/route.ts", "export const GET = () => 0;\n");
  const r = await roda(c, { json: true });
  const todos = Object.values(r.data.grupos).flat().map((x) => x.arquivo);
  assert.ok(!todos.includes("app/api/checkout/route.ts"));
});

test("ida e volta com o template REAL: uma loja recém-gerada (preset + nome) contra o próprio template não tem conflito nenhum", async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "unbox-roundtrip-"));
  const dir = path.join(raiz, "loja");
  fs.cpSync(TEMPLATE_DIR, dir, { recursive: true });
  fs.renameSync(path.join(dir, "gitignore"), path.join(dir, ".gitignore"));
  for (const f of ["bootstrap.sh", "package-lock.json"]) fs.rmSync(path.join(dir, f), { force: true });
  applyPreset(dir, "promocional", deriveBrandTokens({ primary: "#15803D", cta: "#F3C012", chromeBg: "#FFFFFF" }, "promocional"));
  applyStoreName(dir, "Loja de Teste");
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  pkg.name = "loja-de-teste"; pkg.unbox = { templateVersion: "0.29.0" };
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  const buf = { stdout: "" };
  const out = createOutput({ json: true, stdout: { write: (s) => { buf.stdout += s; } }, stderr: { write: () => {} } });
  await runAnalyzeVersion(["--base-template", TEMPLATE_DIR, "--no-network"], { dir, json: true }, { out, deps: { cliVersion: () => "0.30.0" } });
  const d = JSON.parse(buf.stdout).data;
  assert.equal(d.nome, "Loja de Teste");
  for (const g of ["copiar", "reaplicar", "reescrita", "personalizado", "novo_no_template", "removido_no_template", "removido_pela_loja"]) {
    assert.deepEqual(d.grupos[g].map((x) => x.arquivo), [], `${g} devia estar vazio: o template da base É o atual`);
  }
  // o que o create reescreve aparece como só da loja (tokens, receitas, slug), nunca como conflito
  assert.ok(d.grupos.so_loja.some((x) => x.arquivo === "app/globals.css"));
  assert.ok(d.grupos.so_loja.some((x) => x.arquivo === "components/home/home-recipe.ts"));
  // o nome (e o slug que vem dele) é aplicado ao template antes de comparar: não é diferença
  assert.ok(!d.grupos.so_loja.some((x) => x.arquivo === "components/site-header.tsx"));
  assert.ok(d.grupos.intacto.some((x) => x.arquivo === "lib/editable/config.ts"));
  assert.equal(d.plano.pendentes.length, 0);
});

test("nomeDaLoja: o literal do código vence o briefing; sem nada, null", () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "unbox-nome-"));
  escreve(raiz, "marca/briefing.json", JSON.stringify({ nome: "Do Briefing" }));
  assert.equal(nomeDaLoja(raiz), "Do Briefing");
  escreve(raiz, "lib/seo-das-rotas.ts", 'export const NOME_NO_TITULO = "Do Seo";\n');
  assert.equal(nomeDaLoja(raiz), "Do Seo");
  escreve(raiz, "app/api/unbox/paginas/route.ts", 'nome: process.env.NEXT_PUBLIC_SITE_NAME || "popai-snack",\n');
  assert.equal(nomeDaLoja(raiz), "popai-snack");
  assert.equal(nomeDaLoja(fs.mkdtempSync(path.join(os.tmpdir(), "unbox-vazio-"))), null);
});

test("package.json inválido: PACKAGE_JSON_INVALIDO antes de qualquer comparação; --dir inexistente: SEM_PACKAGE_JSON", async () => {
  const c = cenario();
  fs.writeFileSync(path.join(c.dir, "package.json"), '{"name":"x",}');
  let r = await roda(c, { json: true });
  assert.equal(r.json.error.code, "PACKAGE_JSON_INVALIDO");
  r = await roda({ ...c, dir: path.join(c.dir, "nao-existe") }, { json: true });
  assert.equal(r.json.error.code, "SEM_PACKAGE_JSON");
});

test("--no-network sem cache e sem --base-template: NETWORK, sem chamar o npm", async () => {
  const c = cenario();
  const buf = { stdout: "" };
  const out = createOutput({ json: true, stdout: { write: (s) => { buf.stdout += s; } }, stderr: { write: () => {} } });
  process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), "unbox-home-")); // cache vazio
  let chamou = false;
  try {
    await runAnalyzeVersion(["--no-network"], { dir: c.dir, json: true }, { out, deps: { templateDir: c.atual, cliVersion: () => "0.30.0", latest: async () => null, migracao: c.migracao, pack: () => { chamou = true; } } });
  } catch (e) { out.fail(e); }
  const j = JSON.parse(buf.stdout);
  assert.equal(j.ok, false);
  assert.equal(j.error.code, "NETWORK");
  assert.equal(chamou, false);
});
