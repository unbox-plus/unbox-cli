// Programas externos (git, ssh-keygen). Sempre sem shell: os argumentos chegam ao programa como
// foram passados, inclusive o vazio do `ssh-keygen -N ""` e caminhos com espaço, também no Windows.
import { spawnSync } from "node:child_process";
import { CliError } from "./errors.js";

const INSTALAR = {
  git: { code: "GIT_MISSING", dica: "Instale o git (https://git-scm.com/downloads) e rode de novo." },
  "ssh-keygen": {
    code: "SSH_KEYGEN_MISSING",
    dica: "Instale o OpenSSH (no Windows 10+, ele vem como recurso opcional: Configurações > Aplicativos > Recursos opcionais).",
  },
};

/** Roda `cmd args` e devolve `{ status, stdout, stderr }`. Programa ausente vira CliError com instrução. */
export function run(cmd, args, { cwd, env } = {}) {
  const r = spawnSync(cmd, args, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.error) {
    if (r.error.code === "ENOENT") {
      const info = INSTALAR[cmd];
      throw new CliError(`Não encontrei o ${cmd} no PATH. ${info?.dica ?? ""}`.trim(), info?.code ?? "PROGRAMA_AUSENTE");
    }
    throw r.error;
  }
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** Confere que `cmd` existe (lança a mesma CliError de `run` se não existir). */
export function requireProgram(cmd) {
  // `git --version` responde; o ssh-keygen não tem --version e sai com erro de uso, mas sai: basta não ser ENOENT.
  run(cmd, cmd === "git" ? ["--version"] : ["-?"]);
}
