// Nome e e-mail do git para os commits que a CLI faz em nome de quem usa (o do vínculo, no
// provision; o do deploy). Nunca uma identidade fictícia: o commit é da pessoa e precisa do autor
// real. No terminal, pergunta e grava SÓ no repositório; sem terminal, com --json ou --yes, para com
// o `git config --global` pronto para copiar.
import prompts from "prompts";
import { CliError } from "./errors.js";
import { git } from "./git.js";

/**
 * Pergunta e grava a identidade no repositório, ou lança GIT_IDENTITY_MISSING. `motivo` completa
 * "O git desta máquina não tem nome e e-mail, e ...".
 */
export async function askIdentity(dir, { naoInterativo, motivo }) {
  if (naoInterativo) {
    throw new CliError(
      `O git desta máquina não tem nome e e-mail, e ${motivo}. Configure e rode de novo:\n` +
        '  git config --global user.name "Seu Nome"\n  git config --global user.email "voce@exemplo.com"',
      "GIT_IDENTITY_MISSING",
    );
  }
  const r = await prompts([
    { type: "text", name: "nome", message: "Seu nome, para os commits deste projeto", stdout: process.stderr, validate: (v) => (v.trim() ? true : "Informe o nome") },
    { type: "text", name: "email", message: "Seu e-mail, para os commits deste projeto", stdout: process.stderr, validate: (v) => (/^\S+@\S+$/.test(v.trim()) ? true : "Informe um e-mail") },
  ], { onCancel: () => { throw new CliError("Cancelado. Nada foi alterado.", "CANCELADO"); } });
  git(["config", "user.name", r.nome.trim()], { cwd: dir });
  git(["config", "user.email", r.email.trim()], { cwd: dir });
}
