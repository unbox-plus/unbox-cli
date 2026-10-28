// Git isolado para os testes do provision: HOME, config global e config de sistema próprios, numa
// pasta temporária. Nada do ~/.gitconfig nem do ~/.config/unbox de quem roda os testes é lido ou
// alterado.
//
// O "servidor da Unbox" é um repositório bare local semeado como o Core semeia (README.md do
// auto_init e .forgejo/workflows/deploy.yml na branch deploy). A URL SSH de verdade é trocada por
// ele com `url.<bare>.insteadOf` na config global isolada: o código testado vê a mesma URL que a
// API devolve, e o git busca do disco.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const SSH_URL = "ssh://git@git.unbox.com.br:222/Clientes/loja-teste.git";

const IDENTIDADE = ["-c", "user.name=Teste", "-c", "user.email=teste@exemplo.invalid"];

/** Prepara o ambiente isolado. `identidade: false` deixa o git sem nome e e-mail. */
export function sandbox({ identidade = true } = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "unbox-provision-"));
  const home = path.join(raiz, "home");
  fs.mkdirSync(home);
  const gitconfig = path.join(raiz, "gitconfig");
  fs.writeFileSync(gitconfig, identidade ? "[user]\n\tname = Teste\n\temail = teste@exemplo.invalid\n" : "");
  Object.assign(process.env, {
    HOME: home,
    USERPROFILE: home,
    GIT_CONFIG_GLOBAL: gitconfig,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
  });
  for (const k of ["GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL", "EMAIL", "GIT_SSH_COMMAND"]) {
    delete process.env[k];
  }
  // Sem identidade, o git ainda tenta montar uma a partir do usuário e do hostname da máquina;
  // isto o obriga a exigir a configurada.
  execFileSync("git", ["config", "--global", "user.useConfigOnly", "true"]);
  return { raiz, home, gitconfig };
}

/** git em `cwd`, com identidade fixa (para montar cenários sem depender da do sandbox). */
export function g(cwd, ...args) {
  return execFileSync("git", [...IDENTIDADE, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function escreve(dir, rel, conteudo) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, conteudo);
}

/** O repositório da loja "na Unbox": bare, com a deploy semeada, e a URL SSH apontando para ele. */
export function remotoDaUnbox(sb) {
  const bare = path.join(sb.raiz, "unbox.git");
  execFileSync("git", ["init", "-q", "--bare", "-b", "deploy", bare]);
  const semente = path.join(sb.raiz, "semente");
  execFileSync("git", ["init", "-q", "-b", "deploy", semente]);
  escreve(semente, "README.md", "# loja-teste\n");
  g(semente, "add", "-A");
  g(semente, "commit", "-q", "-m", "Initial commit");
  escreve(semente, ".forgejo/workflows/deploy.yml", "on:\n  push:\n    branches: [deploy]\n");
  g(semente, "add", "-A");
  g(semente, "commit", "-q", "-m", "core: template de deploy");
  g(semente, "push", "-q", bare, "deploy");
  execFileSync("git", ["config", "--global", `url.${bare}.insteadOf`, SSH_URL]);
  return { bare, semente };
}

/** Um projeto "do usuário" com commits na main. `arquivos` é { caminho: conteúdo }. */
export function projetoComCommits(sb, arquivos = { "README.md": "# minha loja\n", "app.txt": "app\n" }) {
  const dir = path.join(sb.raiz, "projeto");
  execFileSync("git", ["init", "-q", "-b", "main", dir]);
  for (const [rel, c] of Object.entries(arquivos)) escreve(dir, rel, c);
  g(dir, "add", "-A");
  g(dir, "commit", "-q", "-m", "inicio");
  return dir;
}

/** Uma pasta como a que o `unbox create` deixa: arquivos, sem git. */
export function projetoSemGit(sb) {
  const dir = path.join(sb.raiz, "projeto");
  escreve(dir, "README.md", "# minha loja\n");
  escreve(dir, "app.txt", "app\n");
  escreve(dir, ".gitignore", ".env*\n");
  return dir;
}

export const arvore = (dir, ref) => g(dir, "ls-tree", "-r", "--name-only", ref).split("\n").filter(Boolean).sort();
