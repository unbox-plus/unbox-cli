// `unbox upgrade-template`: aplica a parte MECÂNICA da migração (o que o analyze-version classificou como copiar
// direto, novo no template, foundation e remover) e deixa o resto para o merge manual, com a cópia do template
// ao lado, FORA da árvore do projeto (dentro dela entraria no tsc, no build e no próximo deploy).
//
// O git é o ponto de retorno: o comando exige árvore limpa (inclusive sem untracked) e, se algo falhar no meio,
// `git reset --hard && git clean -fd` devolve a loja ao que era. `.env.local` e o que o .gitignore ignora não
// são tocados por nada aqui. Nada de npm install, build ou commit: o comando termina dizendo o que vem depois.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import prompts from "prompts";
import { parseArgs } from "../args.js";
import { CliError, UsageError } from "../errors.js";
import { requireProgram } from "../proc.js";
import { repoState, git } from "../git.js";
import { configDir, ensureDir } from "../config-dir.js";
import { compareVersions } from "../template-diff.js";
import { fetchTemplate } from "../template-fetch.js";
import { analisar } from "./analyze-version.js";
import { SECOES } from "../migracao.js";

export const help = `
  unbox upgrade-template: aplica a parte mecânica da migração da loja para o template atual

  Uso:
    unbox upgrade-template [--dir <pasta>] [--dry-run] [--base <versão>] [--base-template <pasta>] [--no-network] [--yes] [--force] [--json]

  Parte da mesma análise do unbox analyze-version. Aplica: os arquivos que o template mudou e a loja não
  tocou, os novos no template (sem colisão), a foundation do editor (lib/editable) e as remoções seguras;
  funde o package.json por chave e carimba a versão nova. NÃO toca: o que a loja mudou (reaplicar, reescrita),
  o que o create personalizou, colisões e pastas com lógica da loja. Esses vão para um relatório com a cópia
  do template ao lado, fora do projeto (~/.config/unbox/upgrade/<pasta>/).

  Exige git com árvore limpa (o git é o ponto de retorno). Sem --yes, mostra o plano e pergunta.
  --dry-run                só mostra o plano; não escreve nada
  --force                  segue mesmo quando a régua recomenda refazer a loja
  --base <versão>          a versão-base, quando o carimbo ou o marcador engana
  --base-template <pasta>  o template da base já extraído (versão não publicada, ou sem rede)
  --no-network             não consulta o npm (precisa do cache ou de --base-template)
  Depois: npm install, npx tsc --noEmit, npm run build, o merge dos pendentes e npm run unbox:editavel.
`;

const SPEC = {
  "dry-run": { type: "boolean" },
  force: { type: "boolean" },
  base: { type: "string" },
  "base-template": { type: "string" },
  network: { type: "boolean", negatable: true },
};

/** Uma pasta por loja: o nome e um pedaço do hash do caminho, para duas lojas "loja/" não se sobrescreverem. */
export const pendentesDir = (dir) => path.join(configDir(), "upgrade", `${path.basename(dir)}-${crypto.createHash("sha256").update(path.resolve(dir)).digest("hex").slice(0, 8)}`);

function exigeArvoreLimpa(dir) {
  requireProgram("git");
  const st = repoState(dir);
  if (!st.isRepo) throw new CliError("A pasta não é um repositório git. O upgrade escreve dezenas de arquivos e o git é o ponto de retorno: git init && git add -A && git commit antes.", "SEM_GIT");
  if (st.insideOtherRepo) throw new CliError("A pasta está dentro de outro repositório git (o .git não é o dela). Rode na raiz da loja.", "SEM_GIT");
  if (!st.hasCommits) throw new CliError("O repositório não tem nenhum commit. Faça um (git add -A && git commit) para ter a que voltar.", "ARVORE_SUJA");
  if (st.operation) throw new CliError(`Há uma operação do git em andamento (${st.operation}). Termine ou aborte antes do upgrade.`, "GIT_EM_ANDAMENTO");
  const sujo = git(["status", "--porcelain"], { cwd: dir }).stdout.trim();
  if (sujo) throw new CliError(`A árvore tem mudanças não commitadas (ou arquivos novos):\n${sujo.split("\n").slice(0, 8).map((l) => "    " + l).join("\n")}${sujo.split("\n").length > 8 ? "\n    ..." : ""}\n  Commite ou guarde (git stash -u) antes: o upgrade só é seguro com um ponto de retorno.`, "ARVORE_SUJA");
}

/** Caminhos que o .gitignore da loja ignora: o git não os devolve num reset, então o upgrade não escreve neles. */
function ignoradosPeloGit(dir, caminhos) {
  if (!caminhos.length) return [];
  const r = spawnSync("git", ["check-ignore", "--stdin", "--no-index"], { cwd: dir, input: caminhos.join("\n") + "\n", encoding: "utf8", windowsHide: true });
  return r.status === 0 ? r.stdout.split("\n").filter(Boolean) : [];
}

function relatorio(d, { aplicado, pasta }) {
  const l = [`# Upgrade do template: ${d.base.versao} → ${d.atual}`, "", `Loja: ${d.dir}`, `Pendentes e cópias: ${pasta}`, ""];
  l.push("## Aplicado", "", `- copiados: ${aplicado.copiar.length}`, `- novos: ${aplicado.novos.length}`, `- foundation do editor: ${aplicado.foundation.length}`, `- removidos: ${aplicado.remover.length}`, `- package.json: ${d.pacote.adicionadas.length} chave(s) nova(s), ${d.pacote.atualizadas.length} atualizada(s); carimbo unbox.templateVersion = ${d.atual}`, "");
  if (d.pacote.divergentes.length || d.pacote.removidas_no_template.length) {
    l.push("### package.json: decida você", "");
    for (const x of d.pacote.divergentes) l.push(`- ${x}`);
    for (const x of d.pacote.removidas_no_template) l.push(`- ${x}`);
    l.push("");
  }
  l.push("## Pendentes (o template atual está em `atual/<arquivo>`; para os personalizados, a base em `base/<arquivo>`)", "");
  const porGrupo = {};
  for (const p of d.plano.pendentes) (porGrupo[p.grupo] ??= []).push(p);
  for (const [g, itens] of Object.entries(porGrupo)) {
    l.push(`### ${g}`, "");
    for (const p of itens) l.push(`- \`${p.arquivo}\`: ${p.motivo}`);
    l.push("");
  }
  if (d.plano.naoResolvidos?.length) {
    l.push("### copiados com import que não resolve (conferir)", "");
    for (const x of d.plano.naoResolvidos) l.push(`- \`${x.arquivo}\`: ${x.imports.join(", ")}`);
    l.push("");
  }
  if (d.fichas.length) {
    l.push("## O que mudou (MIGRACAO.md)", "");
    for (const f of d.fichas) {
      l.push(`### ${f.titulo}`, "");
      for (const s of SECOES) if (f[s]) l.push(`**${s}**`, "", f[s], "");
    }
  }
  l.push("## Ambiente", "", `- entram: ${d.ambiente.entram.join(", ") || "nada"}`, `- saem: ${d.ambiente.saem.join(", ") || "nada"}`, "", "Confira o `.env.local` e, se a publicação é pela CLI, `unbox env`.", "");
  l.push("## Próximos passos", "", "1. `npm install` (o package.json mudou)", "2. `npx tsc --noEmit`, depois `npm run build`", "3. o merge dos pendentes acima, um a um", "4. as variáveis de ambiente", "5. `npm run unbox:editavel` com o servidor no ar", "6. `git diff` para revisar, e o commit", "", "Para desfazer tudo: `git reset --hard && git clean -fd`.", "");
  return l.join("\n");
}

function textoDoPlano(d, pasta) {
  const a = d.plano.aplicar, l = [""];
  l.push(`  Upgrade do template: ${d.base.versao} → ${d.atual}`);
  l.push(`    aplica: ${a.copiar.length} cópia(s), ${a.novos.length} novo(s), ${a.foundation.length} da foundation, ${a.remover.length} remoção(ões), package.json por chave, carimbo ${d.atual}`);
  l.push(`    pendentes: ${d.plano.pendentes.length} (reaplicar ${d.grupos.reaplicar.length}, reescrita ${d.grupos.reescrita.length}, personalizado ${d.grupos.personalizado.length}, colisão/pasta viva ${d.plano.pendentes.filter((p) => ["novo_no_template", "removido_no_template", "foundation"].includes(p.grupo)).length})`);
  l.push(`    relatório e cópias: ${pasta}`);
  if (d.regua.recomendacao === "refazer") l.push(`    AVISO: a régua recomenda REFAZER (${d.regua.corte_duro ? "corte duro" : `${d.regua.sinais_ativos} sinais`}); seguindo com --force`);
  return l.join("\n") + "\n";
}

export async function runUpgradeTemplate(args, globals = {}, { out, deps = {} } = {}) {
  if (globals.help) { process.stdout.write(help); return; }
  const { flags, positional } = parseArgs(args, SPEC);
  if (positional.length) throw new UsageError(`Argumento inesperado: "${positional[0]}". A pasta vai em --dir. Veja unbox upgrade-template --help.`);
  const dir = path.resolve(globals.dir ?? process.cwd());
  const dryRun = Boolean(flags["dry-run"]);

  const d = await analisar(dir, flags, { out, deps, manterTemplate: true });
  try {
    await aplicar(d, { dir, flags, globals, out, deps, dryRun });
  } finally {
    if (d._atualDir) fs.rmSync(d._atualDir, { recursive: true, force: true });
  }
}

async function aplicar(d, { dir, flags, globals, out, deps, dryRun }) {
  if (compareVersions(d.base.versao, d.atual) === 0) {
    out.result({ base: d.base, atual: d.atual, aplicado: null, nadaAFazer: true }, () => `\n  A loja já está no template ${d.atual}. Nada a fazer.\n`);
    return;
  }
  if (!d.comparado) {
    throw new CliError(d.regua.corte_duro
      ? `A ${d.base.versao} não tem pacote no npm e está abaixo do corte (0.22.0): a régua manda refazer, com unbox create numa pasta nova e a marca portada (MIGRACAO.md).`
      : `A ${d.base.versao} não tem pacote no npm: sem o template dela não há o que aplicar. Passe --base-template <pasta> (git archive <tag> template, no repositório da CLI).`, "TEMPLATE_INDISPONIVEL");
  }
  if (d.regua.recomendacao === "refazer" && !flags.force) {
    throw new CliError(`A régua recomenda REFAZER esta loja (${d.regua.corte_duro ? `base ${d.base.versao} abaixo do corte 0.22.0` : `${d.regua.sinais_ativos} de 5 sinais`}): unbox create numa pasta nova e portar a marca. Veja unbox analyze-version. Para aplicar a parte mecânica mesmo assim: --force.`, "REFAZER_RECOMENDADO");
  }
  if (!dryRun) exigeArvoreLimpa(dir);

  // O template de onde se copia é o que a análise comparou: COM o nome da loja aplicado, nunca o cru (senão o
  // "minhaloja" e o "Minha Loja" que o create trocou voltariam para a loja).
  const tplAtual = d._atualDir;
  // Imports dos copiados contra a árvore resultante: o que não resolve vira pendente.
  const plano = d.plano;
  const naoResolvidos = [];
  for (const k of ["copiar", "novos"]) {
    plano.aplicar[k] = plano.aplicar[k].filter((x) => {
      const buf = fs.readFileSync(path.join(tplAtual, x.arquivo === ".gitignore" ? "gitignore" : x.arquivo));
      const faltam = plano.naoResolve(x.arquivo, buf);
      if (!faltam.length) return true;
      naoResolvidos.push({ arquivo: x.arquivo, imports: faltam });
      plano.pendentes.push({ ...x, grupo: k === "copiar" ? "copiar" : "novo_no_template", motivo: `importa ${faltam.join(", ")}, que não existe na loja depois do upgrade` });
      return false;
    });
  }
  plano.naoResolvidos = naoResolvidos;
  const pasta = pendentesDir(dir);

  if (dryRun) {
    out.result({ dryRun: true, base: d.base, atual: d.atual, aplicar: Object.fromEntries(Object.entries(plano.aplicar).map(([k, v]) => [k, v.map((x) => x.arquivo)])), pendentes: plano.pendentes.map(({ arquivo, grupo, motivo }) => ({ arquivo, grupo, motivo })), regua: d.regua }, () => textoDoPlano(d, pasta) + "\n  (--dry-run: nada foi escrito)\n");
    return;
  }

  // Confirmação, como no publish.
  const naoInterativo = Boolean(globals.yes) || out.json || !process.stdin.isTTY;
  if (!globals.yes) {
    if (naoInterativo) throw new CliError("O upgrade pede confirmação. Veja o plano com --dry-run e rode de novo com --yes.", "CONFIRMACAO_NECESSARIA");
    out.warn(textoDoPlano(d, pasta));
    const { ok } = await prompts({ type: "confirm", name: "ok", message: "Aplicar o upgrade?", initial: false, stdout: process.stderr }, { onCancel: () => { throw new CliError("Cancelado.", "CANCELADO"); } });
    if (!ok) throw new CliError("Cancelado.", "CANCELADO");
  }

  // Nada que o .gitignore da loja ignore é escrito ou apagado: o git não o devolveria num reset.
  const alvos = [...plano.aplicar.copiar, ...plano.aplicar.novos, ...plano.aplicar.foundation, ...plano.aplicar.remover].map((x) => x.arquivo);
  const ignorados = ignoradosPeloGit(dir, alvos);
  if (ignorados.length) {
    throw new CliError(`O .gitignore da loja ignora caminhos que o upgrade escreveria, e o git não os devolveria num reset: ${ignorados.slice(0, 5).join(", ")}${ignorados.length > 5 ? "…" : ""}. Tire-os do .gitignore (ou commite-os) e rode de novo.`, "ARVORE_SUJA");
  }

  // 1. Pendentes primeiro (fora do projeto; só adiciona). Numa pasta temporária, que só vira a definitiva no fim:
  // uma rodada que falha no meio não apaga o relatório da anterior.
  const pastaTmp = `${pasta}.tmp`;
  fs.rmSync(pastaTmp, { recursive: true, force: true });
  ensureDir(pastaTmp);
  const grava = (sub, rel, origem) => {
    const alvo = path.join(pastaTmp, sub, rel);
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.copyFileSync(origem, alvo);
  };
  for (const p of plano.pendentes) {
    const relTpl = p.arquivo === ".gitignore" ? "gitignore" : p.arquivo;
    if (fs.existsSync(path.join(tplAtual, relTpl))) grava("atual", p.arquivo, path.join(tplAtual, relTpl));
  }
  // os personalizados precisam também da base, que já foi apagada depois da análise: regrava-se a partir do diff da análise não dá; a base vem de novo do cache.
  if (d.grupos.personalizado.length) {
    try {
      const baseDir = flags["base-template"] ? path.resolve(flags["base-template"]) : (deps.fetchTemplate ?? fetchTemplate)(d.base.versao, { publicada: d.base.publicada, semRede: flags.network === false, out, deps });
      for (const p of d.grupos.personalizado) {
        const relTpl = p.arquivo === ".gitignore" ? "gitignore" : p.arquivo;
        if (fs.existsSync(path.join(baseDir, relTpl))) grava("base", p.arquivo, path.join(baseDir, relTpl));
      }
    } catch (e) {
      out.warn(`  Aviso: não consegui guardar a cópia da base dos personalizados (${e.message}).`);
    }
  }
  fs.writeFileSync(path.join(pastaTmp, "RELATORIO.md"), relatorio(d, { aplicado: plano.aplicar, pasta }));

  // 2. Cópias, 3. remoções, 4. package.json com o carimbo por último.
  const escreve = (rel) => {
    const relTpl = rel === ".gitignore" ? "gitignore" : rel;
    const alvo = path.join(dir, rel);
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.copyFileSync(path.join(tplAtual, relTpl), alvo);
  };
  try {
    for (const x of [...plano.aplicar.copiar, ...plano.aplicar.novos, ...plano.aplicar.foundation]) escreve(x.arquivo);
    for (const r of plano.aplicar.remover) {
      fs.rmSync(path.join(dir, r.arquivo), { force: true });
      let p = path.dirname(path.join(dir, r.arquivo));
      while (p !== dir && fs.existsSync(p) && fs.readdirSync(p).length === 0) { fs.rmdirSync(p); p = path.dirname(p); }
    }
    const pkg = d._pacote.pkg;
    pkg.unbox = { ...(pkg.unbox ?? {}), templateVersion: d.atual };
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
    fs.rmSync(pasta, { recursive: true, force: true });
    fs.renameSync(pastaTmp, pasta);
  } catch (e) {
    throw new CliError(`Falha no meio do upgrade (${e.message}). Volte ao ponto de retorno: git reset --hard && git clean -fd`, "UPGRADE_FALHOU");
  }

  const aplicado = Object.fromEntries(Object.entries(plano.aplicar).map(([k, v]) => [k, v.map((x) => x.arquivo)]));
  out.result(
    { base: d.base, atual: d.atual, aplicado, pendentes: plano.pendentes.map(({ arquivo, grupo, motivo }) => ({ arquivo, grupo, motivo })), relatorio: path.join(pasta, "RELATORIO.md"), ambiente: d.ambiente },
    () => [
      textoDoPlano(d, pasta),
      `  Aplicado. A loja está carimbada como ${d.atual}; os pendentes e as cópias estão em ${pasta}.`,
      "",
      "  Próximos passos:",
      "    1. npm install",
      "    2. npx tsc --noEmit, depois npm run build",
      `    3. o merge dos ${plano.pendentes.length} pendente(s) (RELATORIO.md diz o que fazer com cada um)`,
      d.ambiente.entram.length || d.ambiente.saem.length ? `    4. .env.local: entram ${d.ambiente.entram.join(", ") || "nada"}; saem ${d.ambiente.saem.join(", ") || "nada"}` : "    4. nenhuma variável de ambiente nova",
      "    5. npm run unbox:editavel com o servidor no ar",
      "    6. git diff para revisar, e o commit. Para desfazer tudo: git reset --hard && git clean -fd",
      "",
    ].join("\n"),
  );
}

