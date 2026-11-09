// O template de uma versão publicada, para o `analyze-version` e o `upgrade-template` compararem com a loja.
//
// Vem do npm (`npm pack @unbox-plus/cli@<v>`: respeita o .npmrc, o registry e o proxy do usuário) e fica em
// cache em `~/.config/unbox/templates/<v>/`. Uma versão publicada no npm é imutável, então o cache não
// apodrece; o único jeito de ele ficar inválido é um crash no meio da extração, e por isso a extração vai para
// `<v>.tmp` e só o `rename` final o torna visível. Versões anteriores à primeira publicada (0.21.3) não existem
// no npm, e a régua manda refazer de qualquer jeito: `TEMPLATE_INDISPONIVEL` antes de qualquer rede.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CliError } from "./errors.js";
import { configDir, ensureDir } from "./config-dir.js";
import { requireProgram } from "./proc.js";
import { PACOTE } from "./template-version.js";

export const templatesDir = () => path.join(configDir(), "templates");

/** O npm do Windows é um .cmd, que só roda por um shell (como o `npm run build` do deploy). */
function npm(args, { cwd }) {
  const r = spawnSync("npm", args, { cwd, encoding: "utf8", shell: process.platform === "win32", windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (r.error) {
    if (r.error.code === "ENOENT") throw new CliError("Não encontrei o npm no PATH. Ele vem com o Node; confira a instalação.", "NPM_MISSING");
    throw r.error;
  }
  return r;
}

/**
 * Pasta com o `template/` da versão. `publicada: false` (da tabela de marcadores) recusa antes da rede.
 * `deps.pack(version, destino)` existe para os testes: devolve o caminho do tarball.
 */
export function fetchTemplate(version, { publicada = true, semRede = false, out, deps = {} } = {}) {
  const dir = path.join(templatesDir(), version);
  const pronto = path.join(dir, "template");
  if (fs.existsSync(path.join(pronto, "package.json"))) return pronto;
  if (!publicada) {
    throw new CliError(`A versão ${version} não tem pacote no npm, então não há template dela para comparar. Com o template em mãos (git archive <tag> template, no repositório da CLI), passe --base-template <pasta>.`, "TEMPLATE_INDISPONIVEL");
  }
  if (semRede) throw new CliError(`O template da ${version} não está em cache (${pronto}) e --no-network não deixa baixá-lo. Rode sem --no-network, ou passe --base-template <pasta>.`, "NETWORK");
  ensureDir(templatesDir());
  const tmp = `${dir}.tmp`;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  out?.progress(`  Baixando o template da ${version} do npm`);
  let tarball;
  if (deps.pack) tarball = deps.pack(version, tmp);
  else {
    // `--pack-destination .` com cwd no tmp: no Windows o npm roda por shell, e um caminho com espaço no argumento quebraria.
    const r = npm(["pack", `${PACOTE}@${version}`, "--pack-destination", ".", "--json"], { cwd: tmp });
    if (r.status !== 0) {
      fs.rmSync(tmp, { recursive: true, force: true });
      const motivo = /E404|404/.test(r.stderr) ? `a versão ${version} não existe no npm` : /ENOTFOUND|EAI_AGAIN|ECONN|ETIMEDOUT|network/i.test(r.stderr) ? "sem rede ou registry fora do ar" : (r.stderr.trim().split("\n").pop() ?? "npm pack falhou");
      throw new CliError(`Não consegui baixar o template da ${version}: ${motivo}. Com a pasta do template em mãos, passe --base-template <pasta>.`, /existe/.test(motivo) ? "TEMPLATE_INDISPONIVEL" : "NETWORK");
    }
    let nome;
    try { nome = JSON.parse(r.stdout)[0].filename; } catch { nome = fs.readdirSync(tmp).find((f) => f.endsWith(".tgz")); }
    tarball = path.join(tmp, nome);
  }
  requireProgram("tar");
  const t = spawnSync("tar", ["-xzf", tarball, "-C", tmp, "package/template"], { encoding: "utf8", windowsHide: true });
  if (t.status !== 0) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new CliError(`Não consegui extrair o template da ${version}: ${(t.stderr || "").trim().split("\n").pop() ?? "tar falhou"}`, "TAR_FALHOU");
  }
  fs.rmSync(tarball, { force: true });
  fs.rmSync(dir, { recursive: true, force: true });
  fs.renameSync(path.join(tmp, "package"), dir);
  fs.rmSync(tmp, { recursive: true, force: true });
  return pronto;
}
