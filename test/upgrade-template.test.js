// `unbox upgrade-template` com git de verdade numa HOME temporária (helpers/git-sandbox): os pendentes vão para
// ~/.config/unbox/upgrade/<pasta>/ dessa HOME. Sem rede: template atual por `deps.templateDir`, base por --base-template.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { runUpgradeTemplate, pendentesDir } from "../src/commands/upgrade-template.js";
import { fetchTemplate, templatesDir } from "../src/template-fetch.js";
import { createOutput } from "../src/output.js";
import { sandbox, g, escreve } from "./helpers/git-sandbox.mjs";
import { BASE, ATUAL, LOJA, monta, migracaoFalsa, lerPkg } from "./helpers/template-fixture.mjs";

beforeEach(() => { for (const k of Object.keys(process.env)) if (k.startsWith("UNBOX_")) delete process.env[k]; });

function cenario({ versao = "0.29.0", commit = true } = {}) {
  const sb = sandbox();
  const base = monta(path.join(sb.raiz, "base"), BASE);
  const atual = monta(path.join(sb.raiz, "atual"), ATUAL);
  const dir = monta(path.join(sb.raiz, "loja"), LOJA(versao));
  escreve(dir, ".env.local", "SEGREDO=1\n");
  g(dir, "init", "-q");
  if (commit) { g(dir, "add", "-A"); g(dir, "commit", "-q", "-m", "loja"); }
  const migracao = path.join(sb.raiz, "MIGRACAO.md");
  fs.writeFileSync(migracao, migracaoFalsa());
  return { sb, base, atual, dir, migracao };
}

async function roda(c, globals = {}, { args = [], deps = {}, semBase = false } = {}) {
  const buf = { stdout: "", stderr: "" };
  const out = createOutput({ json: Boolean(globals.json), stdout: { write: (s) => { buf.stdout += s; } }, stderr: { write: (s) => { buf.stderr += s; } } });
  let erro;
  try {
    await runUpgradeTemplate([...(semBase ? [] : ["--base-template", c.base]), ...args], { dir: c.dir, ...globals }, { out, deps: { templateDir: c.atual, cliVersion: () => "0.30.0", latest: async () => null, migracao: c.migracao, ...deps } });
  } catch (e) { erro = e; out.fail(e); }
  const json = globals.json ? JSON.parse(buf.stdout) : undefined;
  return { ...buf, json, data: json?.data, erro };
}
const le = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");

test("--dry-run mostra o plano e não escreve nada, nem a pasta de pendentes", async () => {
  const c = cenario();
  const antes = g(c.dir, "status", "--porcelain");
  const r = await roda(c, {}, { args: ["--dry-run"] });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.match(r.stdout, /Upgrade do template: 0\.29\.0 → 0\.30\.0/);
  assert.match(r.stdout, /aplica: 2 cópia\(s\), 1 novo\(s\), 2 da foundation, 1 remoção\(ões\)/);
  assert.match(r.stdout, /nada foi escrito/);
  assert.equal(g(c.dir, "status", "--porcelain"), antes);
  assert.ok(!fs.existsSync(pendentesDir(c.dir)));
  assert.equal(le(c.dir, "lib/copiar.ts"), BASE["lib/copiar.ts"]);
});

test("árvore suja recusa (ARVORE_SUJA), inclusive por arquivo novo não rastreado; sem commit também", async () => {
  const c = cenario();
  escreve(c.dir, "novo.txt", "x\n");
  let r = await roda(c, { json: true, yes: true });
  assert.equal(r.json.error.code, "ARVORE_SUJA");
  assert.match(r.json.error.message, /novo\.txt/);
  const c2 = cenario({ commit: false });
  r = await roda(c2, { json: true, yes: true });
  assert.equal(r.json.error.code, "ARVORE_SUJA");
});

test("sem git: SEM_GIT; dentro de outro repositório: SEM_GIT", async () => {
  const c = cenario();
  fs.rmSync(path.join(c.dir, ".git"), { recursive: true });
  let r = await roda(c, { json: true, yes: true });
  assert.equal(r.json.error.code, "SEM_GIT");
  g(c.sb.raiz, "init", "-q");
  r = await roda(c, { json: true, yes: true });
  assert.equal(r.json.error.code, "SEM_GIT");
  assert.match(r.json.error.message, /outro repositório/);
});

test("--json sem --yes: CONFIRMACAO_NECESSARIA, e nada escrito", async () => {
  const c = cenario();
  const r = await roda(c, { json: true });
  assert.equal(r.json.ok, false);
  assert.equal(r.json.error.code, "CONFIRMACAO_NECESSARIA");
  assert.equal(g(c.dir, "status", "--porcelain"), "");
});

test("aplica: copia, novos, foundation, remove o seguro, funde o package.json, carimba; pendentes fora do projeto com as cópias", async () => {
  const c = cenario();
  const r = await roda(c, { yes: true });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.equal(le(c.dir, "lib/copiar.ts"), ATUAL["lib/copiar.ts"]);
  assert.equal(le(c.dir, "lib/novo.ts"), ATUAL["lib/novo.ts"]);
  assert.equal(le(c.dir, "lib/editable/document.ts"), ATUAL["lib/editable/document.ts"]);
  assert.equal(le(c.dir, "scripts/check-editable.mjs"), ATUAL["scripts/check-editable.mjs"]);
  assert.ok(!fs.existsSync(path.join(c.dir, "lib/removido.ts")));
  // o que fica: a mudança da loja, o personalizado, a pasta viva, o importado, o novo que colide e o novo com import ausente
  assert.equal(le(c.dir, "lib/reaplicar.ts"), LOJA()["lib/reaplicar.ts"]);
  assert.equal(le(c.dir, "lib/reescrita.ts"), LOJA()["lib/reescrita.ts"]);
  assert.equal(le(c.dir, "app/globals.css"), BASE["app/globals.css"]);
  assert.equal(le(c.dir, "lib/editable/config.ts"), LOJA()["lib/editable/config.ts"]);
  assert.ok(fs.existsSync(path.join(c.dir, "lib/unbox/y.ts")));
  assert.ok(fs.existsSync(path.join(c.dir, "lib/removido-importado.ts")));
  assert.ok(!fs.existsSync(path.join(c.dir, "lib/unbox.ts")));
  assert.ok(!fs.existsSync(path.join(c.dir, "lib/novo-importa-ausente.ts")));
  assert.equal(le(c.dir, ".env.local"), "SEGREDO=1\n");
  const pkg = lerPkg(c.dir);
  assert.equal(pkg.name, "loja-teste");
  assert.equal(pkg.unbox.templateVersion, "0.30.0");
  assert.equal(pkg.dependencies["@unbox-plus/sdk"], "^0.4.1");
  assert.equal(pkg.dependencies.zod, "^4");
  assert.equal(pkg.scripts["test:meu"], "node t");
  const pasta = pendentesDir(c.dir);
  assert.ok(pasta.startsWith(c.sb.home), "os pendentes ficam na HOME, fora do projeto");
  assert.ok(!fs.existsSync(path.join(c.dir, ".unbox-upgrade")));
  const rel = le(pasta, "RELATORIO.md");
  assert.match(rel, /### reaplicar\n\n- `lib\/reaplicar\.ts`/);
  assert.match(rel, /`lib\/unbox\.ts`: a loja tem a pasta/);
  assert.match(rel, /`lib\/novo-importa-ausente\.ts`: importa @\/lib\/nao-existe/);
  assert.match(rel, /entram: NOVA_VAR/);
  assert.equal(le(pasta, "atual/lib/reaplicar.ts"), ATUAL["lib/reaplicar.ts"]);
  assert.equal(le(pasta, "atual/lib/unbox.ts"), ATUAL["lib/unbox.ts"]);
  assert.equal(le(pasta, "atual/app/globals.css"), ATUAL["app/globals.css"]);
  assert.equal(le(pasta, "base/app/globals.css"), BASE["app/globals.css"]);
  assert.match(r.stdout, /Aplicado\. A loja está carimbada como 0\.30\.0/);
  assert.match(r.stdout, /git reset --hard && git clean -fd/);
  // e o git é mesmo o ponto de retorno: tudo o que mudou aparece no status
  const status = g(c.dir, "status", "--porcelain");
  assert.match(status, /M lib\/copiar\.ts/);
  assert.match(status, /\?\? lib\/novo\.ts/);
  assert.match(status, /D lib\/removido\.ts/);
});

test("segunda rodada depois do commit: nada a fazer (saída 0); --json idem", async () => {
  const c = cenario();
  await roda(c, { yes: true });
  g(c.dir, "add", "-A"); g(c.dir, "commit", "-q", "-m", "upgrade");
  const r = await roda(c, { json: true, yes: true });
  assert.equal(r.json.ok, true);
  assert.equal(r.data.nadaAFazer, true);
});

test("régua refazer: recusa com REFAZER_RECOMENDADO; --force segue; abaixo de 0.21.3 nem com --force (sem template)", async () => {
  const c = cenario({ versao: "0.29.0" });
  // três sinais: 10 reescritas, foundation editada e integração própria não bastam (base ≥ 0.25); use reescritas + foundation + sem_primitivo/rotas
  for (let i = 0; i < 10; i++) {
    escreve(c.base, `lib/re${i}.ts`, Array.from({ length: 40 }, (_, k) => `export const a${k} = ${k};`).join("\n") + "\n");
    escreve(c.atual, `lib/re${i}.ts`, Array.from({ length: 40 }, (_, k) => `export const a${k} = ${k + 1};`).join("\n") + "\n");
    escreve(c.dir, `lib/re${i}.ts`, Array.from({ length: 40 }, (_, k) => `export const b${k} = ${k};`).join("\n") + "\n");
  }
  escreve(c.dir, "lib/editable/document.ts", "export const doc = 1; // editado\n");
  for (let i = 0; i < 30; i++) escreve(c.dir, `components/brand/c${i}.tsx`, "export function C() { return <p>x</p>; }\n");
  for (let i = 0; i < 8; i++) escreve(c.dir, `app/(loja)/r${i}/page.tsx`, "export default function R() { return <p>r</p>; }\n");
  g(c.dir, "add", "-A"); g(c.dir, "commit", "-q", "-m", "muita customização");
  let r = await roda(c, { json: true, yes: true });
  assert.equal(r.json.error.code, "REFAZER_RECOMENDADO");
  assert.equal(g(c.dir, "status", "--porcelain"), "");
  r = await roda(c, { json: true, yes: true }, { args: ["--force"] });
  assert.equal(r.json.ok, true, JSON.stringify(r.json.error));
  const c2 = cenario({ versao: "0.20.3" });
  r = await roda(c2, { json: true, yes: true }, { args: ["--force"], semBase: true });
  assert.equal(r.json.error.code, "TEMPLATE_INDISPONIVEL");
});

test("template-fetch: cache na HOME é usado sem rede; versão não publicada recusa antes de chamar o npm", () => {
  sandbox();
  const v = "0.24.0";
  const cache = path.join(templatesDir(), v, "template");
  fs.mkdirSync(cache, { recursive: true });
  fs.writeFileSync(path.join(cache, "package.json"), "{}");
  let chamou = false;
  assert.equal(fetchTemplate(v, { deps: { pack: () => { chamou = true; } } }), cache);
  assert.equal(chamou, false);
  assert.throws(() => fetchTemplate("0.20.3", { publicada: false, deps: { pack: () => { chamou = true; } } }), (e) => e.code === "TEMPLATE_INDISPONIVEL");
  assert.equal(chamou, false);
});

test("template-fetch: extrai só package/template do tarball e torna o cache visível por rename", () => {
  const sb = sandbox();
  const v = "0.99.0";
  const pack = (versao, destino) => {
    const pkgDir = path.join(sb.raiz, "pkg", "package");
    escreve(pkgDir, "template/package.json", '{"name":"storefront"}\n');
    escreve(pkgDir, "template/gitignore", ".env*\n");
    escreve(pkgDir, "src/main.js", "// nao vem\n");
    const tgz = path.join(destino, `unbox-plus-cli-${versao}.tgz`);
    execFileSync("tar", ["-czf", tgz, "-C", path.join(sb.raiz, "pkg"), "package"]);
    return tgz;
  };
  const dir = fetchTemplate(v, { deps: { pack } });
  assert.equal(dir, path.join(templatesDir(), v, "template"));
  assert.ok(fs.existsSync(path.join(dir, "gitignore")));
  assert.ok(!fs.existsSync(path.join(templatesDir(), v, "src")));
  assert.ok(!fs.existsSync(path.join(templatesDir(), `${v}.tmp`)));
});

test("copia do template COM o nome da loja, nunca do cru: o slug e o nome que o create gravou ficam", async () => {
  const c = cenario();
  // a base e o atual trazem "Minha Loja"; a loja tem "Loja Teste"; o atual mudou o arquivo (v = 2) → copiar
  const r = await roda(c, { yes: true });
  assert.equal(r.erro, undefined, r.erro?.message);
  const header = le(c.dir, "components/site-header.tsx");
  assert.match(header, /"Loja Teste"/);
  assert.doesNotMatch(header, /Minha Loja/);
  assert.match(header, /export const v = 2/);
});

test("gitignore do template entra como .gitignore; package.json inválido recusa antes de escrever", async () => {
  const c = cenario();
  escreve(c.atual, "gitignore", ".env*\n.unbox-cache/\n");
  g(c.dir, "add", "-A"); g(c.dir, "commit", "-q", "-m", "x", "--allow-empty");
  let r = await roda(c, { yes: true });
  assert.equal(r.erro, undefined, r.erro?.message);
  assert.equal(le(c.dir, ".gitignore"), ".env*\n.unbox-cache/\n");
  assert.ok(!fs.existsSync(path.join(c.dir, "gitignore")));
  const c2 = cenario();
  fs.writeFileSync(path.join(c2.dir, "package.json"), '{"name":"x",}');
  g(c2.dir, "add", "-A"); g(c2.dir, "commit", "-q", "-m", "quebra");
  r = await roda(c2, { json: true, yes: true });
  assert.equal(r.json.error.code, "PACKAGE_JSON_INVALIDO");
  assert.equal(le(c2.dir, "package.json"), '{"name":"x",}');
});

test("caminho ignorado pelo .gitignore da loja: recusa, porque o git não o devolveria num reset", async () => {
  const c = cenario();
  escreve(c.dir, ".gitignore", ".env*\nlib/novo.ts\n");
  g(c.dir, "add", "-A"); g(c.dir, "commit", "-q", "-m", "ignora o novo");
  const r = await roda(c, { json: true, yes: true });
  assert.equal(r.json.error.code, "ARVORE_SUJA");
  assert.match(r.json.error.message, /lib\/novo\.ts/);
  assert.equal(g(c.dir, "status", "--porcelain"), "");
});

test("o relatório lista as chaves do package.json que divergem e as que o template tirou", async () => {
  const c = cenario();
  const pkg = lerPkg(c.dir);
  pkg.dependencies.next = "14.0.0";
  fs.writeFileSync(path.join(c.dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  escreve(c.base, "package.json", JSON.stringify({ name: "storefront", scripts: { dev: "next dev", build: "next build", antigo: "x" }, dependencies: { next: "15.5.24" } }, null, 2) + "\n");
  pkg.scripts.antigo = "x";
  fs.writeFileSync(path.join(c.dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  g(c.dir, "add", "-A"); g(c.dir, "commit", "-q", "-m", "diverge");
  const r = await roda(c, { yes: true });
  assert.equal(r.erro, undefined, r.erro?.message);
  const rel = le(pendentesDir(c.dir), "RELATORIO.md");
  assert.match(rel, /### package\.json: decida você/);
  assert.match(rel, /dependencies\.next: loja 14\.0\.0, template 15\.5\.30/);
  assert.match(rel, /scripts\.antigo \(o template tirou; a loja ainda tem\)/);
  assert.equal(lerPkg(c.dir).dependencies.next, "14.0.0", "divergente fica como a loja deixou");
  assert.equal(lerPkg(c.dir).scripts.antigo, "x");
});

test("os pendentes ficam numa pasta por loja (nome + hash do caminho), e uma rodada nova substitui a anterior inteira", async () => {
  const c = cenario();
  const pasta = pendentesDir(c.dir);
  assert.match(path.basename(pasta), /^loja-[0-9a-f]{8}$/);
  await roda(c, { yes: true });
  assert.ok(fs.existsSync(path.join(pasta, "RELATORIO.md")));
  assert.ok(!fs.existsSync(`${pasta}.tmp`));
});
