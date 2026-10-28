// O vínculo do git com a branch deploy da Unbox, com git de verdade (ver test/helpers/git-sandbox.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repoState, repoProblem, linkDeploy, linkMode, needsCommit } from "../src/git.js";
import { sandbox, remotoDaUnbox, projetoComCommits, projetoSemGit, g, escreve, arvore, SSH_URL } from "./helpers/git-sandbox.mjs";

const vincula = (dir, st = repoState(dir)) => linkDeploy({ dir, sshUrl: SSH_URL, sshCommand: "ssh", shopId: "loja1", keyPath: "/chaves/loja1_ed25519", st });
const config = (dir, k) => { try { return g(dir, "config", "--get", k); } catch { return undefined; } };

test("pasta do unbox create, sem git: nasce na deploy rastreando unbox/deploy, arquivos intactos", () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoSemGit(sb);
  const st = repoState(dir);
  assert.equal(linkMode(st), "novo");
  assert.equal(needsCommit(st), false);
  const r = vincula(dir, st);
  assert.equal(r.mode, "novo");
  assert.equal(g(dir, "symbolic-ref", "--short", "HEAD"), "deploy");
  assert.equal(g(dir, "rev-parse", "--abbrev-ref", "deploy@{upstream}"), "unbox/deploy");
  assert.equal(fs.readFileSync(path.join(dir, "README.md"), "utf8"), "# minha loja\n");
  assert.ok(fs.existsSync(path.join(dir, ".forgejo/workflows/deploy.yml")));
  assert.equal(config(dir, "unbox.shopId"), "loja1");
  assert.equal(config(dir, "unbox.keyPath"), "/chaves/loja1_ed25519");
  assert.equal(config(dir, "core.sshCommand"), undefined);
});

test("repositório com commits e README próprio: main intacta, deploy nova sem conflito", () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoComCommits(sb);
  const mainAntes = g(dir, "rev-parse", "main");
  const r = vincula(dir);
  assert.equal(r.mode, "merge");
  assert.equal(g(dir, "rev-parse", "main"), mainAntes);
  assert.equal(g(dir, "symbolic-ref", "--short", "HEAD"), "deploy");
  assert.equal(g(dir, "rev-parse", "--abbrev-ref", "deploy@{upstream}"), "unbox/deploy");
  assert.deepEqual(arvore(dir, "deploy"), [".forgejo/workflows/deploy.yml", "README.md", "app.txt"]);
  assert.equal(g(dir, "show", "deploy:README.md"), "# minha loja");
  // A deploy descende de unbox/deploy (push fast-forward) e da main.
  g(dir, "merge-base", "--is-ancestor", "unbox/deploy", "deploy");
  g(dir, "merge-base", "--is-ancestor", "main", "deploy");
  assert.equal(g(dir, "diff", "--name-only", "unbox/deploy..deploy", "--", ".forgejo", ".github", ".gitea"), "");
  assert.equal(config(dir, "core.sshCommand"), undefined);
});

test(".github e .forgejo próprios: saem da deploy, continuam na main, e o exclude é gravado", () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoComCommits(sb, {
    "README.md": "# minha loja\n",
    ".github/workflows/ci.yml": "on: push\n",
    ".forgejo/workflows/meu.yml": "on: push\n",
  });
  escreve(dir, ".github/rascunho.md", "não rastreado\n");
  const st = repoState(dir);
  assert.ok(st.protectedPaths.includes(".github/workflows/ci.yml"));
  const r = vincula(dir, st);
  assert.deepEqual(r.removed, [".github/workflows/ci.yml"]);
  assert.deepEqual(arvore(dir, "deploy"), [".forgejo/workflows/deploy.yml", "README.md"]);
  assert.deepEqual(arvore(dir, "main"), [".forgejo/workflows/meu.yml", ".github/workflows/ci.yml", "README.md"]);
  const exclude = fs.readFileSync(path.join(dir, ".git/info/exclude"), "utf8");
  for (const l of ["/.github/", "/.gitea/", "/.forgejo/"]) assert.ok(exclude.includes(l), l);
  // O arquivo não rastreado continua na pasta e não entra num add -A.
  assert.ok(fs.existsSync(path.join(dir, ".github/rascunho.md")));
  g(dir, "add", "-A");
  assert.equal(g(dir, "diff", "--cached", "--name-only"), "");
});

test("hook pre-commit do projeto não impede o vínculo", () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoComCommits(sb);
  escreve(dir, ".git/hooks/pre-commit", "#!/bin/sh\nexit 1\n");
  fs.chmodSync(path.join(dir, ".git/hooks/pre-commit"), 0o755);
  assert.equal(vincula(dir).mode, "merge");
});

test("rodar de novo é idempotente", () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoComCommits(sb);
  vincula(dir);
  const deploy = g(dir, "rev-parse", "deploy");
  const st = repoState(dir);
  assert.equal(linkMode(st), "reexecucao");
  assert.equal(repoProblem(st, "loja1"), undefined);
  assert.equal(vincula(dir, st).mode, "reexecucao");
  assert.equal(g(dir, "rev-parse", "deploy"), deploy);
  assert.equal(fs.readFileSync(path.join(dir, ".git/info/exclude"), "utf8").match(/\/\.github\//g).length, 1);
});

test("rodar de novo da main volta para a deploy", () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoComCommits(sb);
  vincula(dir);
  g(dir, "checkout", "-q", "main");
  vincula(dir);
  assert.equal(g(dir, "symbolic-ref", "--short", "HEAD"), "deploy");
});

test("deploy que não rastreia a da Unbox: para sem mudar nada", () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoComCommits(sb);
  g(dir, "branch", "deploy");
  const st = repoState(dir);
  assert.equal(repoProblem(st)?.code, "DEPLOY_ALHEIA");
});

test("commit do vínculo que falha: volta para a main, apaga a deploy e não deixa merge pela metade", () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoComCommits(sb);
  g(dir, "config", "commit.gpgsign", "true");
  g(dir, "config", "gpg.program", "programa-que-nao-existe");
  assert.throws(() => vincula(dir), (e) => e.code === "COMMIT_FALHOU" && /main ficou como estava/.test(e.message));
  assert.equal(g(dir, "symbolic-ref", "--short", "HEAD"), "main");
  assert.throws(() => g(dir, "rev-parse", "--verify", "-q", "refs/heads/deploy"));
  assert.equal(fs.existsSync(path.join(dir, ".git/MERGE_HEAD")), false);
  assert.equal(g(dir, "status", "--porcelain", "--untracked-files=no"), "");
});

test("sem identidade git e com commit a fazer: needsCommit e hasIdentity falso", () => {
  const sb = sandbox({ identidade: false });
  remotoDaUnbox(sb);
  const dir = projetoComCommits(sb);
  const st = repoState(dir);
  assert.equal(st.hasIdentity, false);
  assert.equal(needsCommit(st), true);
});

test("pasta dentro de outro repositório, HEAD destacado e operação em andamento: param", () => {
  const sb = sandbox();
  const dir = projetoComCommits(sb);
  const sub = path.join(dir, "sub");
  fs.mkdirSync(sub);
  assert.equal(repoProblem(repoState(sub))?.code, "REPO_ANINHADO");

  g(dir, "checkout", "-q", "--detach");
  assert.equal(repoProblem(repoState(dir))?.code, "HEAD_DESTACADO");
  g(dir, "checkout", "-q", "main");

  fs.writeFileSync(path.join(dir, ".git/MERGE_HEAD"), g(dir, "rev-parse", "HEAD") + "\n");
  assert.equal(repoProblem(repoState(dir))?.code, "GIT_EM_ANDAMENTO");
});

test("árvore suja, remote unbox alheio e outra loja: param", () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoComCommits(sb);
  escreve(dir, "app.txt", "mudou\n");
  assert.equal(repoProblem(repoState(dir))?.code, "ARVORE_SUJA");
  g(dir, "checkout", "-q", "--", "app.txt");

  g(dir, "remote", "add", "unbox", "https://exemplo.invalid/x.git");
  assert.equal(repoProblem(repoState(dir))?.code, "REMOTE_ALHEIO");
  g(dir, "remote", "remove", "unbox");

  vincula(dir);
  assert.equal(repoProblem(repoState(dir), "loja2")?.code, "OUTRA_LOJA");
});

test("fetch que falha deixa o remote reconhecível: a próxima execução segue", () => {
  const sb = sandbox();
  const dir = projetoComCommits(sb);
  // Sem remotoDaUnbox: a URL SSH não aponta para lugar nenhum e o fetch falha.
  assert.throws(() => linkDeploy({ dir, sshUrl: SSH_URL, sshCommand: "false", shopId: "loja1", keyPath: "/k", st: repoState(dir) }), (e) => e.code === "GIT_FETCH_FALHOU");
  assert.equal(repoProblem(repoState(dir), "loja1"), undefined);
  remotoDaUnbox(sb);
  assert.equal(vincula(dir).mode, "merge");
});

test("nova execução na pasta do unbox create, com arquivos ainda não commitados: segue sem mexer", () => {
  const sb = sandbox();
  remotoDaUnbox(sb);
  const dir = projetoSemGit(sb);
  vincula(dir);
  // O README.md do usuário difere do que o Core pôs no índice: a árvore "suja" é o normal aqui.
  const st = repoState(dir);
  assert.equal(st.clean, false);
  assert.equal(repoProblem(st, "loja1"), undefined);
  assert.equal(needsCommit(st), false);
  const antes = g(dir, "rev-parse", "deploy");
  assert.equal(vincula(dir, st).mode, "reexecucao");
  assert.equal(g(dir, "rev-parse", "deploy"), antes);
  assert.equal(fs.readFileSync(path.join(dir, "README.md"), "utf8"), "# minha loja\n");
});

test("nova execução com commits novos na Unbox e árvore suja: para antes do merge", () => {
  const sb = sandbox();
  const { bare, semente } = remotoDaUnbox(sb);
  const dir = projetoComCommits(sb);
  vincula(dir);
  escreve(semente, "novo.txt", "x\n");
  g(semente, "add", "-A");
  g(semente, "commit", "-q", "-m", "novo na unbox");
  g(semente, "push", "-q", bare, "deploy");
  escreve(dir, "app.txt", "mudou\n");
  const st = repoState(dir);
  assert.equal(repoProblem(st, "loja1"), undefined);
  assert.throws(() => vincula(dir, st), (e) => e.code === "ARVORE_SUJA");
  g(dir, "checkout", "-q", "--", "app.txt");
  vincula(dir);
  assert.equal(g(dir, "show", "deploy:novo.txt"), "x");
});
