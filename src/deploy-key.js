// A chave de deploy da loja: um par ed25519 por loja em ~/.config/unbox/keys/<shopId>_ed25519.
// É a única credencial do push. A privada nunca sai desta máquina nem aparece na saída; para a
// Unbox vai só a pública (no provisionCustomStorefront).
import fs from "node:fs";
import path from "node:path";
import { CliError } from "./errors.js";
import { ensureDir, keysDir, knownHostsPath } from "./config-dir.js";
import { run } from "./proc.js";

/** O shopId vira nome de arquivo: só caracteres que não mudam de pasta nem quebram o caminho. */
function nomeSeguro(shopId) {
  if (!/^[A-Za-z0-9_-]+$/.test(String(shopId ?? ""))) {
    throw new CliError(`Identificador de loja inesperado no login (${shopId}). Fale com a Unbox.`, "SHOP_ID_INVALIDO");
  }
  return shopId;
}

export function keyPaths(shopId) {
  const keyPath = path.join(keysDir(), `${nomeSeguro(shopId)}_ed25519`);
  return { keyPath, pubPath: `${keyPath}.pub` };
}

function keygen(args) {
  const r = run("ssh-keygen", args);
  if (r.status !== 0) {
    throw new CliError(`O ssh-keygen falhou: ${(r.stderr || r.stdout).trim().slice(0, 300)}`, "SSH_KEYGEN_FALHOU");
  }
  return r.stdout;
}

function protege(keyPath) {
  // Chave privada legível por outros faz o ssh recusar o uso dela.
  if (process.platform !== "win32") fs.chmodSync(keyPath, 0o600);
}

/**
 * Garante o par da loja e devolve `{ keyPath, pubPath, publicKey, created }`. Gera só se a privada
 * não existir: rodar de novo reaproveita a mesma chave, e a mutation é idempotente com ela.
 */
export function ensureKey(shopId) {
  const { keyPath, pubPath } = keyPaths(shopId);
  ensureDir(keysDir());
  let created = false;
  if (!fs.existsSync(keyPath)) {
    keygen(["-q", "-t", "ed25519", "-N", "", "-C", `unbox-${shopId}`, "-f", keyPath]);
    created = true;
  } else if (!fs.existsSync(pubPath)) {
    // A pública some (cópia incompleta, limpeza manual): ela sai da privada.
    fs.writeFileSync(pubPath, keygen(["-y", "-f", keyPath]).trim() + "\n");
  }
  protege(keyPath);
  const publicKey = fs.readFileSync(pubPath, "utf8").trim().split(/\r?\n/)[0];
  return { keyPath, pubPath, publicKey, created };
}

/**
 * Troca a chave da loja: o par atual vira `.bak` e um novo é gerado. Só para quando o servidor
 * recusou a chave por já estar em uso em outro repositório (DEPLOY_KEY_IN_USE).
 */
export function rotateKey(shopId, { agora = new Date() } = {}) {
  const { keyPath, pubPath } = keyPaths(shopId);
  if (fs.existsSync(keyPath)) {
    let bak = `${keyPath}.bak`;
    if (fs.existsSync(bak)) bak = `${keyPath}.${agora.toISOString().replace(/[:.]/g, "-")}.bak`;
    fs.renameSync(keyPath, bak);
    if (fs.existsSync(pubPath)) fs.renameSync(pubPath, `${bak}.pub`);
  }
  return ensureKey(shopId);
}

/** Aspas simples para o sh: nada dentro é expandido; uma aspa simples vira '\''. */
function aspas(s) {
  return `'${String(s).replace(/\\/g, "/").replace(/'/g, `'\\''`)}'`;
}

/**
 * O GIT_SSH_COMMAND das chamadas ao git que falam com a Unbox. Vai por variável de ambiente em cada
 * chamada, e não em `core.sshCommand`, que valeria para todos os remotes do repositório (um
 * `origin` por SSH no GitHub passaria a falhar). O git passa o valor por um sh, inclusive no
 * Windows; por isso as barras normais e as aspas simples. `StrictHostKeyChecking=yes` e
 * `BatchMode=yes` garantem que nunca há pergunta: chave do servidor diferente ou desconhecida falha.
 */
export function gitSshCommand(keyPath, knownHosts = knownHostsPath()) {
  return [
    "ssh",
    "-i", aspas(keyPath),
    "-o", "IdentitiesOnly=yes",
    "-o", `UserKnownHostsFile=${aspas(knownHosts)}`,
    "-o", "StrictHostKeyChecking=yes",
    "-o", "BatchMode=yes",
  ].join(" ");
}
