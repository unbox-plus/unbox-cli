// O git do projeto: o que a CLI lê dele antes de mexer em qualquer coisa (repoState) e o vínculo
// com o repositório da loja na Unbox (linkDeploy).
//
// O vínculo nunca mexe nas branches de quem usa: a `deploy` é criada AO LADO da branch atual, que
// fica com o mesmo nome, o mesmo histórico e as mesmas pastas. E nunca grava `core.sshCommand`: ele
// valeria para todos os remotes, e um `origin` por SSH (GitHub) passaria a falhar. Quem fala com a
// Unbox passa GIT_SSH_COMMAND em cada chamada (ver deploy-key.js).
import fs from "node:fs";
import path from "node:path";
import { CliError } from "./errors.js";
import { run } from "./proc.js";

export const PROTECTED_DIRS = [".github", ".gitea", ".forgejo"];
const EXCLUDE_LINES = PROTECTED_DIRS.map((d) => `/${d}/`);
const OPERACOES = ["MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD", "REVERT_HEAD", "BISECT_LOG"];
const MENSAGEM_VINCULO = "unbox: vincula projeto";

/** Roda o git em `cwd`. Nunca pergunta nada no terminal (GIT_TERMINAL_PROMPT=0). */
export function git(args, { cwd, sshCommand } = {}) {
  const env = { GIT_TERMINAL_PROMPT: "0" };
  if (sshCommand) env.GIT_SSH_COMMAND = sshCommand;
  return run("git", args, { cwd, env });
}

/** Como `git`, mas falha vira CliError com o que o git disse. */
function gitOk(args, opts, code = "GIT_FALHOU") {
  const r = git(args, opts);
  if (r.status !== 0) {
    const detalhe = (r.stderr || r.stdout).trim().split("\n").slice(-3).join(" ");
    throw new CliError(`git ${args[0]} falhou: ${detalhe}`, code);
  }
  return r.stdout.trim();
}

const saida = (args, cwd) => {
  const r = git(args, { cwd });
  return r.status === 0 ? r.stdout.trim() : undefined;
};

const mesmoCaminho = (a, b) => {
  try {
    return fs.realpathSync.native(a) === fs.realpathSync.native(b);
  } catch {
    return false;
  }
};

/**
 * O estado do git em `dir`, só lendo. É o que decide, antes de qualquer chamada à API, se o vínculo
 * pode ser feito e de que jeito.
 */
export function repoState(dir) {
  const st = { dir, isRepo: false, protectedPaths: [] };
  for (const d of PROTECTED_DIRS) {
    if (fs.existsSync(path.join(dir, d))) st.protectedPaths.push(`${d}/`);
  }
  if (saida(["rev-parse", "--is-inside-work-tree"], dir) !== "true") return st;

  const top = saida(["rev-parse", "--show-toplevel"], dir);
  st.isRepo = true;
  st.insideOtherRepo = !mesmoCaminho(top, dir);
  st.toplevel = top;
  if (st.insideOtherRepo) return st;

  st.hasCommits = git(["rev-parse", "--verify", "-q", "HEAD"], { cwd: dir }).status === 0;
  st.branch = saida(["symbolic-ref", "-q", "--short", "HEAD"], dir);
  st.detached = st.hasCommits && !st.branch;
  st.operation = OPERACOES.find((op) => {
    const p = saida(["rev-parse", "--git-path", op], dir);
    return p && fs.existsSync(path.resolve(dir, p));
  });
  st.gitDir = path.resolve(dir, saida(["rev-parse", "--git-dir"], dir));
  st.deployExists = git(["rev-parse", "--verify", "-q", "refs/heads/deploy"], { cwd: dir }).status === 0;
  st.deployTracksUnbox = saida(["config", "--get", "branch.deploy.remote"], dir) === "unbox"
    && saida(["config", "--get", "branch.deploy.merge"], dir) === "refs/heads/deploy";
  st.unboxRemoteUrl = saida(["config", "--get", "remote.unbox.url"], dir);
  st.savedShopId = saida(["config", "--get", "unbox.shopId"], dir);
  st.clean = st.hasCommits ? saida(["status", "--porcelain", "--untracked-files=no"], dir) === "" : true;
  st.hasIdentity = git(["var", "GIT_COMMITTER_IDENT"], { cwd: dir }).status === 0
    && git(["var", "GIT_AUTHOR_IDENT"], { cwd: dir }).status === 0;
  if (st.hasCommits) {
    const rastreados = saida(["ls-tree", "-r", "--name-only", "HEAD", "--", ...PROTECTED_DIRS], dir);
    for (const f of (rastreados ?? "").split("\n").filter(Boolean)) {
      if (!st.protectedPaths.includes(f)) st.protectedPaths.push(f);
    }
  }
  return st;
}

/**
 * Como o vínculo vai ser feito:
 *   "novo"        pasta sem git, ou repositório sem commits (o caso do `unbox create`)
 *   "merge"       repositório com commits e sem `deploy`
 *   "reexecucao"  a `deploy` já existe e rastreia `unbox/deploy`
 * A `deploy` que existe e não rastreia `unbox/deploy` é do usuário: nunca é sobrescrita.
 */
export function linkMode(st) {
  if (!st.isRepo || !st.hasCommits) return "novo";
  if (st.deployExists) return st.deployTracksUnbox ? "reexecucao" : "deploy-alheia";
  return "merge";
}

/** O que ainda não dá para fazer neste repositório. Devolve um CliError, ou nada. */
export function repoProblem(st, shopId) {
  if (st.insideOtherRepo) {
    return new CliError(
      `A pasta ${st.dir} está dentro de outro repositório git (${st.toplevel}). Rode o comando na raiz do projeto da loja, ou faça dela um repositório próprio.`,
      "REPO_ANINHADO",
    );
  }
  if (!st.isRepo) return undefined;
  if (st.detached) {
    return new CliError("O repositório está com o HEAD destacado (fora de uma branch). Volte para uma branch (git switch <branch>) e rode de novo.", "HEAD_DESTACADO");
  }
  if (st.operation) {
    return new CliError(`Há uma operação do git em andamento (${st.operation}). Termine ou aborte (por exemplo git merge --abort) e rode de novo.`, "GIT_EM_ANDAMENTO");
  }
  if (linkMode(st) === "deploy-alheia") {
    return new CliError(
      "Já existe uma branch `deploy` neste repositório que não rastreia a da Unbox. Renomeie a sua (git branch -m deploy <outro-nome>) e rode de novo; nada foi alterado.",
      "DEPLOY_ALHEIA",
    );
  }
  if (st.unboxRemoteUrl && !st.savedShopId) {
    return new CliError(
      `Já existe um remote \`unbox\` (${st.unboxRemoteUrl}) que não foi criado pela CLI. Renomeie ou remova esse remote e rode de novo.`,
      "REMOTE_ALHEIO",
    );
  }
  if (shopId && st.savedShopId && st.savedShopId !== shopId) {
    return new CliError(
      `Este projeto já está ligado a outra loja (${st.savedShopId}), e o login é da loja ${shopId}. Confira as credenciais do .env.local.`,
      "OUTRA_LOJA",
    );
  }
  // Árvore limpa só quando o vínculo certamente mexe nela: o merge da primeira vez, ou a troca para a
  // deploy numa nova execução. Numa nova execução já na deploy, mudanças locais são o normal (o
  // projeto do unbox create só é commitado no primeiro unbox deploy); se a Unbox tiver commits novos
  // para mesclar, linkDeploy confere de novo depois do fetch.
  const mode = linkMode(st);
  if ((mode === "merge" || (mode === "reexecucao" && st.branch !== "deploy")) && !st.clean) {
    return arvoreSuja();
  }
  return undefined;
}

const arvoreSuja = () => new CliError("Há mudanças não commitadas no repositório. Faça commit ou git stash e rode de novo.", "ARVORE_SUJA");

/** O vínculo vai criar um commit? Só aí a identidade git é obrigatória. */
export const needsCommit = (st) => linkMode(st) === "merge";

function hostKeyError(stderr) {
  if (/Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/i.test(stderr)) {
    return new CliError(
      "A chave do servidor git da Unbox não confere com a que esta CLI conhece. Atualize a CLI; se ela já estiver na última versão, " +
        "fale com a Unbox antes de qualquer outra coisa (pode ser alguém se passando pelo servidor). Não apague o known_hosts.",
      "HOST_KEY_MISMATCH",
    );
  }
  return undefined;
}

function fetchDeploy(dir, sshCommand) {
  const r = git(["fetch", "-q", "unbox", "deploy"], { cwd: dir, sshCommand });
  if (r.status !== 0) {
    throw hostKeyError(r.stderr) ?? new CliError(`Não consegui buscar a branch deploy da Unbox: ${r.stderr.trim().split("\n").slice(-2).join(" ")}`, "GIT_FETCH_FALHOU");
  }
}

function escreveExclude(gitDir) {
  const arq = path.join(gitDir, "info", "exclude");
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  const atual = fs.existsSync(arq) ? fs.readFileSync(arq, "utf8") : "";
  const linhas = atual.split(/\r?\n/);
  const faltam = EXCLUDE_LINES.filter((l) => !linhas.includes(l));
  if (!faltam.length) return;
  const prefixo = atual && !atual.endsWith("\n") ? "\n" : "";
  fs.appendFileSync(arq, `${prefixo}# unbox: pastas que o servidor recusa no push\n${faltam.join("\n")}\n`);
}

/**
 * Liga o repositório em `dir` à branch `deploy` da Unbox. `st` é o repoState lido antes (e já
 * validado por repoProblem). Devolve `{ mode, originalBranch, removed }`.
 */
export function linkDeploy({ dir, sshUrl, sshCommand, shopId, keyPath, st }) {
  const mode = linkMode(st);
  if (!st.isRepo) gitOk(["init", "-q"], { cwd: dir });
  const gitDir = st.gitDir ?? path.resolve(dir, gitOk(["rev-parse", "--git-dir"], { cwd: dir }));

  if (st.unboxRemoteUrl) {
    if (st.unboxRemoteUrl !== sshUrl) gitOk(["remote", "set-url", "unbox", sshUrl], { cwd: dir });
  } else {
    gitOk(["remote", "add", "unbox", sshUrl], { cwd: dir });
  }
  // Logo junto do remote: se algo falhar daqui em diante (rede, host key), a próxima execução
  // reconhece o remote como da CLI e segue, em vez de pará-lo como alheio.
  gitOk(["config", "unbox.shopId", shopId], { cwd: dir });
  gitOk(["config", "unbox.keyPath", keyPath], { cwd: dir });
  fetchDeploy(dir, sshCommand);
  escreveExclude(gitDir);

  let removed = [];
  if (mode === "novo") {
    // Sem commits: o repositório nasce na deploy, com o histórico da Unbox. Os arquivos da pasta
    // ficam como estão; o README.md do Core fica só no índice até o primeiro commit do usuário.
    gitOk(["symbolic-ref", "HEAD", "refs/heads/deploy"], { cwd: dir });
    gitOk(["reset", "-q", "unbox/deploy"], { cwd: dir });
    gitOk(["checkout", "unbox/deploy", "--", ".forgejo"], { cwd: dir });
    gitOk(["branch", "-q", "-u", "unbox/deploy"], { cwd: dir });
  } else if (mode === "merge") {
    removed = mesclaAoLado(dir, st.branch);
  } else {
    // Nova execução: traz o que a Unbox tiver de novo, que normalmente é nada.
    if (st.branch !== "deploy") gitOk(["checkout", "-q", "deploy"], { cwd: dir });
    const emDia = git(["merge-base", "--is-ancestor", "unbox/deploy", "HEAD"], { cwd: dir }).status === 0;
    if (emDia) return { mode, originalBranch: st.branch, removed };
    // Daqui em diante há merge: precisa de árvore limpa e, se não for fast-forward, de identidade.
    if (saida(["status", "--porcelain", "--untracked-files=no"], dir) !== "") throw arvoreSuja();
    const r = git(["merge", "-q", "--ff", "--no-verify", "--no-edit", "unbox/deploy"], { cwd: dir });
    if (r.status !== 0) {
      if (fs.existsSync(path.join(gitDir, "MERGE_HEAD"))) git(["merge", "--abort"], { cwd: dir });
      throw new CliError(
        `A branch deploy local e a da Unbox divergiram e o merge automático falhou: ${r.stderr.trim().split("\n").slice(-2).join(" ")}. Resolva com git merge unbox/deploy.`,
        "MERGE_FALHOU",
      );
    }
  }

  return { mode, originalBranch: st.branch, removed };
}

/**
 * Cria a `deploy` ao lado de `origem` com o histórico do usuário mesclado ao da Unbox.
 * `-s ours`: a árvore continua a do usuário, sem conflito possível (nem com o README.md que o Core
 * cria). No mesmo commit, saem as pastas que o servidor recusa e o .forgejo passa a ser o da
 * Unbox. Medido no Forgejo (c25 do gap1-protection-test.sh): a proteção olha o diff final do
 * push, então o histórico antigo com .github/ não impede o push. Em qualquer falha, desfaz.
 */
function mesclaAoLado(dir, origem) {
  const removed = (git(["ls-files", "--", ".github", ".gitea", ".forgejo"], { cwd: dir }).stdout || "")
    .split("\n").filter(Boolean);
  // --no-track: não herdar o upstream da branch de origem (branch.autoSetupMerge=inherit). O
  // upstream certo é gravado já, para uma interrupção não deixar uma deploy sem rastreio.
  gitOk(["checkout", "-q", "--no-track", "-b", "deploy"], { cwd: dir });
  try {
    gitOk(["branch", "-q", "-u", "unbox/deploy"], { cwd: dir });
    gitOk(["merge", "-q", "-s", "ours", "--no-ff", "--no-commit", "--allow-unrelated-histories", "unbox/deploy"], { cwd: dir }, "MERGE_FALHOU");
    gitOk(["rm", "-r", "-q", "--ignore-unmatch", ...PROTECTED_DIRS], { cwd: dir });
    gitOk(["checkout", "unbox/deploy", "--", ".forgejo"], { cwd: dir });
    // --no-verify: os hooks do projeto (husky, lint-staged, commitlint) não são para este commit.
    gitOk(["commit", "-q", "--no-verify", "-m", MENSAGEM_VINCULO], { cwd: dir }, "COMMIT_FALHOU");
  } catch (e) {
    const p = saida(["rev-parse", "--git-path", "MERGE_HEAD"], dir);
    if (p && fs.existsSync(path.resolve(dir, p))) git(["merge", "--abort"], { cwd: dir });
    else git(["reset", "-q", "--hard", "HEAD"], { cwd: dir });
    git(["checkout", "-q", origem], { cwd: dir });
    git(["branch", "-q", "-D", "deploy"], { cwd: dir });
    throw new CliError(`${e.message}. Nada foi alterado: a branch ${origem} ficou como estava.`, e.code ?? "VINCULO_FALHOU");
  }
  return removed.filter((f) => !f.startsWith(".forgejo/"));
}
