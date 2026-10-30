// O git do `unbox deploy`: confere se o projeto está ligado à Unbox e na branch certa, commita e
// envia a `deploy` local para a `deploy` da Unbox.
//
// O push é sempre da `deploy` local para a remota, com o refspec explícito: nunca `HEAD:deploy`
// (de outra branch, ele mandaria um histórico sem relação) e nunca force. Remoto à frente vira uma
// integração e uma nova tentativa, nada mais.
import fs from "node:fs";
import path from "node:path";
import { CliError } from "./errors.js";
import { PROTECTED_DIRS, fetchDeploy, git, hostKeyError, repoProblem } from "./git.js";

const REFSPEC = "refs/heads/deploy:refs/heads/deploy";

const saida = (args, dir) => {
  const r = git(args, { cwd: dir });
  return r.status === 0 ? r.stdout.trim() : undefined;
};

const linhas = (s) => (s ?? "").split("\n").filter(Boolean);

const ultimas = (r, n = 3) => (r.stderr || r.stdout).trim().split("\n").slice(-n).join(" ");

const naoProvisionado = (detalhe) => new CliError(`${detalhe} Rode unbox provision.`, "NAO_PROVISIONADO");

/** A chave de deploy gravada pelo provision (`git config unbox.keyPath`). */
export const savedKeyPath = (dir) => saida(["config", "--get", "unbox.keyPath"], dir);

/**
 * O que impede o deploy neste repositório, só lendo. `st` é o repoState. A branch é conferida antes
 * das outras regras do repoProblem: fora da deploy, "faça commit ou stash" seria a instrução errada.
 */
export function deployProblem(st, keyPath) {
  if (st.insideOtherRepo || st.detached || st.operation) return repoProblem(st);
  if (!st.isRepo || !st.savedShopId || !st.unboxRemoteUrl || !keyPath) {
    return naoProvisionado("Este projeto ainda não está ligado à Unbox.");
  }
  if (st.branch !== "deploy") {
    return new CliError(
      `O deploy roda na branch deploy, e você está na ${st.branch}. Nada foi alterado. Troque de branch e rode de novo:\n` +
        "  git checkout deploy\n" +
        `Para levar as mudanças da ${st.branch} para a deploy: git merge ${st.branch} (já na deploy).`,
      "FORA_DA_DEPLOY",
    );
  }
  const outro = repoProblem(st);
  if (outro) return outro;
  if (!fs.existsSync(keyPath)) {
    return naoProvisionado(`A chave de deploy deste projeto (${keyPath}) não está nesta máquina.`);
  }
  return undefined;
}

/**
 * O que impede o `unbox publish` de conferir o commit no git local, só lendo. O publish não commita
 * nem envia: não importa a branch atual, a árvore suja nem um rebase em andamento; só o vínculo e a
 * chave, para o fetch.
 */
export function publishProblem(st, keyPath) {
  if (st.insideOtherRepo) return repoProblem(st);
  if (!st.isRepo || !st.savedShopId || !st.unboxRemoteUrl || !keyPath) {
    return naoProvisionado("Este projeto ainda não está ligado à Unbox.");
  }
  if (!fs.existsSync(keyPath)) {
    return naoProvisionado(`A chave de deploy deste projeto (${keyPath}) não está nesta máquina.`);
  }
  return undefined;
}

const DEPLOY_DA_UNBOX = "refs/remotes/unbox/deploy";

/**
 * O commit a publicar, procurado só entre os da deploy da Unbox (depois do fetch): uma branch ou tag
 * com nome de hash não interfere, e um commit achado já é um commit enviado. Sem `prefixo`, o topo.
 * Devolve `{ sha, topo }`.
 *
 * Os candidatos vêm de `--disambiguate` (todos os objetos com o prefixo, de qualquer tipo e origem) e
 * ficam os que a deploy da Unbox contém. Listar o histórico da deploy não serve: ela herda o do
 * projeto, e um histórico grande estoura a saída.
 */
export function resolveCommit(dir, prefixo) {
  const topo = saida(["rev-parse", "--verify", "-q", DEPLOY_DA_UNBOX], dir);
  if (!topo) throw naoProvisionado("Não achei a branch deploy da Unbox neste repositório.");
  if (!prefixo) return { sha: topo, topo };

  const candidatos = linhas(saida(["rev-parse", `--disambiguate=${prefixo.toLowerCase()}`], dir));
  const achados = candidatos.filter((c) => git(["merge-base", "--is-ancestor", c, DEPLOY_DA_UNBOX], { cwd: dir }).status === 0);
  if (achados.length === 1) return { sha: achados[0], topo };
  if (achados.length > 1) {
    const lista = achados.slice(0, 5).map((s) => s.slice(0, 12)).join(", ");
    throw new CliError(
      `O hash ${prefixo} corresponde a ${achados.length} commits da deploy da Unbox (${lista}${achados.length > 5 ? ", ..." : ""}). Use mais caracteres.`,
      "COMMIT_AMBIGUO",
    );
  }
  throw new CliError(
    `O commit ${prefixo} não está na branch deploy da Unbox. Se ainda não foi enviado, rode unbox deploy; ` +
      "se a deploy foi rebaseada no envio, o hash mudou: veja os commits enviados com git log --oneline unbox/deploy.",
    "COMMIT_NAO_ENVIADO",
  );
}

/** Mudanças não commitadas, inclusive arquivos novos (o `unbox deploy` leva todos). */
export const dirtyTree = (dir) => (saida(["status", "--porcelain"], dir) ?? "") !== "";

/**
 * Arquivos de .forgejo/, .github/ e .gitea/ que o push levaria: o que a deploy local mudou desde a
 * base comum com a da Unbox, contando a árvore de trabalho (é ela que vai para o commit) e os não
 * rastreados que o `add -A` pegaria. A base comum, e não a ponta da Unbox: um .forgejo que a Unbox
 * atualizou não é mudança de quem usa.
 */
export function protectedChanges(dir) {
  const base = saida(["merge-base", "unbox/deploy", "HEAD"], dir) ?? "unbox/deploy";
  const mudados = linhas(saida(["diff", "--name-only", base, "--", ...PROTECTED_DIRS], dir));
  const novos = linhas(saida(["ls-files", "--others", "--exclude-standard", "--", ...PROTECTED_DIRS], dir));
  return [...new Set([...mudados, ...novos])].sort();
}

export function protectedError(arquivos) {
  const pastas = new Set(arquivos.map((f) => f.split("/")[0]));
  const como = [];
  if (pastas.has(".forgejo")) como.push("  git checkout unbox/deploy -- .forgejo    (volta o .forgejo/ ao da Unbox)");
  const outras = [...pastas].filter((p) => p !== ".forgejo");
  if (outras.length) como.push(`  git rm -r -q --cached ${outras.join(" ")}    (tira da deploy; os arquivos ficam na pasta)`);
  return new CliError(
    "O servidor da Unbox recusa mudanças em .forgejo/, .github/ e .gitea/, e o deploy levaria estas:\n" +
      arquivos.map((f) => `    ${f}`).join("\n") +
      "\nNada foi enviado. Desfaça e rode de novo:\n" + como.join("\n"),
    "ARQUIVO_PROTEGIDO",
  );
}

/**
 * `git add -A` e commit, se houver o que commitar. Devolve se commitou. `--no-verify`: os hooks do
 * projeto (husky, commitlint) recusariam a mensagem padrão, e não são para este commit.
 */
export function commitAll(dir, mensagem) {
  const add = git(["add", "-A"], { cwd: dir });
  if (add.status !== 0) throw new CliError(`git add falhou: ${ultimas(add)}`, "GIT_FALHOU");
  if (git(["diff", "--cached", "--quiet"], { cwd: dir }).status === 0) return false;
  const r = git(["commit", "-q", "--no-verify", "-m", mensagem], { cwd: dir });
  if (r.status !== 0) {
    throw new CliError(`O commit falhou: ${ultimas(r)}. Nada foi enviado; as mudanças ficaram no índice (git add).`, "COMMIT_FALHOU");
  }
  return true;
}

/** Commits da deploy local que a da Unbox ainda não tem. */
export const aheadCount = (dir) => Number(saida(["rev-list", "--count", "unbox/deploy..deploy"], dir) ?? 0);

const atrasado = (stderr) => /\[rejected\][^\n]*\((fetch first|non-fast-forward)\)|Updates were rejected because the (remote contains work|tip of your current branch is behind)/.test(stderr);

function erroDoPush(stderr) {
  const host = hostKeyError(stderr);
  if (host) return host;
  if (/Permission denied \(publickey/.test(stderr)) {
    return new CliError(
      "O servidor da Unbox recusou a chave de deploy deste projeto. Rode unbox provision (ele confere a chave) e depois unbox deploy.",
      "CHAVE_RECUSADA",
    );
  }
  const remoto = stderr.split("\n").filter((l) => /^remote:/.test(l) && l.replace(/^remote:\s*/, "").trim()).map((l) => l.trim());
  if (/\[remote rejected\]|pre-receive hook declined|protected/i.test(stderr)) {
    return new CliError(`O servidor da Unbox recusou o push.${remoto.length ? `\n  ${remoto.slice(-4).join("\n  ")}` : ""}`, "PUSH_RECUSADO");
  }
  return new CliError(`O push falhou: ${stderr.trim().split("\n").slice(-3).join(" ")}`, "PUSH_FALHOU");
}

const emAndamento = (dir, op) => {
  const p = saida(["rev-parse", "--git-path", op], dir);
  return p && fs.existsSync(path.resolve(dir, p));
};

/**
 * Traz o que a Unbox tem de novo para a deploy local. Rebase, como num `git pull --rebase`; mas, se
 * os commits a enviar tiverem um merge (o do vínculo, antes do primeiro deploy de um projeto com
 * histórico), merge: o rebase achataria o histórico inteiro da branch de origem sobre a da Unbox.
 * Conflito desfaz a operação e para.
 */
function integra(dir) {
  const comMerge = Number(saida(["rev-list", "--merges", "--count", "unbox/deploy..deploy"], dir) ?? 0) > 0;
  const modo = comMerge ? "merge" : "rebase";
  const r = comMerge
    ? git(["merge", "-q", "--ff", "--no-edit", "--no-verify", "unbox/deploy"], { cwd: dir })
    : git(["rebase", "-q", "--no-autostash", "unbox/deploy"], { cwd: dir });
  if (r.status === 0) return modo;
  if (comMerge && emAndamento(dir, "MERGE_HEAD")) git(["merge", "--abort"], { cwd: dir });
  if (!comMerge && (emAndamento(dir, "rebase-merge") || emAndamento(dir, "rebase-apply"))) git(["rebase", "--abort"], { cwd: dir });
  throw new CliError(
    `A branch deploy da Unbox recebeu commits que conflitam com os seus, e o ${modo} automático falhou: ${ultimas(r, 2)}. ` +
      `Nada foi enviado e a deploy local ficou como estava. Resolva com git ${modo} unbox/deploy e rode unbox deploy de novo.`,
    modo === "merge" ? "MERGE_CONFLITO" : "REBASE_CONFLITO",
  );
}

/**
 * Envia a deploy local. Recusado por o remoto estar à frente: busca, integra (uma vez) e tenta de
 * novo. Devolve `{ integrado }`: "rebase", "merge" ou null.
 */
export function pushDeploy(dir, sshCommand) {
  const push = () => git(["push", "-q", "--no-verify", "unbox", REFSPEC], { cwd: dir, sshCommand });
  let r = push();
  if (r.status === 0) return { integrado: null };
  if (!atrasado(r.stderr)) throw erroDoPush(r.stderr);

  fetchDeploy(dir, sshCommand);
  const integrado = integra(dir);
  r = push();
  if (r.status !== 0) throw erroDoPush(r.stderr);
  return { integrado };
}
