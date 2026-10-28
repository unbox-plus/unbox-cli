// A pasta da CLI na máquina de quem usa: ~/.config/unbox. Guarda as chaves de deploy (uma por loja)
// e o known_hosts com as host keys do servidor git da Unbox. Só a pessoa lê (0700).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function configDir() {
  return path.join(os.homedir(), ".config", "unbox");
}

export function keysDir() {
  return path.join(configDir(), "keys");
}

export function knownHostsPath() {
  return path.join(configDir(), "known_hosts");
}

/** Cria a pasta (e as de cima) com 0700. No Windows o modo não se aplica; quem protege é a pasta do usuário. */
export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") fs.chmodSync(p, 0o700);
}
