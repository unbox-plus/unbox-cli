// As host keys do servidor git da Unbox, embutidas. O push só confia nelas: nunca aceita a chave
// que o servidor apresentar na primeira conexão, porque é justamente aí que alguém no meio do
// caminho se passaria pelo servidor.
//
// Fingerprints, conferidos no próprio servidor:
//   ED25519  SHA256:5f1GoCQeuJf1EDhZ/9D5+GkNNSY1z+Rxbpd4G1fKvyI
//   ECDSA    SHA256:NyOuDzdvUzrdpSzFYgz18LX3eTuI1Du21MRUpO4c6zw
//   RSA      SHA256:FdSnRoIGfh6RG+viu161EYqylPRxW2poPHLxPQT+hj0
// Trocar as chaves do servidor exige antes uma versão da CLI com as antigas e as novas juntas.
import fs from "node:fs";
import { CliError } from "./errors.js";
import { configDir, ensureDir, knownHostsPath } from "./config-dir.js";

export const GIT_HOST = "git.unbox.com.br";
export const GIT_PORT = 222;

export const KNOWN_HOSTS = [
  "[git.unbox.com.br]:222 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAsV9BGIOC64OLuNqMrwzKhjSu9WN1owuDP6GEQVoCKh",
  "[git.unbox.com.br]:222 ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBAfzVl0QXUWX8G1CZ8ZnbYjj4DTqeUHgV2MYtlShZ5RoMePFiBIQePJ9aSMaIjFPXmuOc9FgGUknDEhfJ1N3sf8=",
  "[git.unbox.com.br]:222 ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC50qXIEYam4HcdDZnTA8DXVOZIVUufekSLWkORJQMITCtcUlmQ/wgYIKpNxFF/4uyER0oFRXQvHkhn67N0NMO8kAsGLHe93HE7BUTHuQzmxfWpyitWQ4U2MlvYc+3/19XsrjLfEv1RZt/dYpCLDCyL/i8cyk2cw22iYkorQWGxIATczguP0xjKr66CNpDjNAKFCdzBMxzyisI6jRMWqC9gnyVY0kH2wCFBMTDq47SdFXXNQjwUwIPg/SkCTv1+o78gWaK1hSZ0+j8GxYufpy2KXGIVYpXCLlXucIvJhbUcdHK9IV9yFax3lwEXy7GyzImTrVKpbe48mQWoubwn6Sks5R3tq2oeWlQCvzW8K/0ddmQr7i4TS9oVxmjPJchXXMHXkl/ilUY4170n6gO/3Q9L9zpYAU+ywMG9Xdh2ZnFF5NVk7h++Rj0GKMf8BGDKkhsy47gcTn5Zme31X302EQdJVCix3R4CJcyoy3vXq2mwNJalXuyVMy5db4O0GNLWeGc=",
];

/** Grava o known_hosts da CLI inteiro, a cada execução: o arquivo é só dela. */
export function writeKnownHosts() {
  ensureDir(configDir());
  fs.writeFileSync(knownHostsPath(), KNOWN_HOSTS.join("\n") + "\n", { mode: 0o600 });
  return knownHostsPath();
}

/**
 * Confere que a URL que a API devolveu aponta para o servidor cujas chaves a CLI conhece. Outro host
 * ou porta não é "a chave do servidor mudou": é outra configuração, e a mensagem tem de dizer isso.
 */
export function assertKnownGitUrl(sshUrl) {
  let u;
  try {
    u = new URL(sshUrl);
  } catch {
    throw new CliError(`A Unbox devolveu um endereço de repositório inválido: ${sshUrl}`, "UNEXPECTED_GIT_HOST");
  }
  const porta = u.port ? Number(u.port) : 22;
  if (u.protocol !== "ssh:" || u.hostname !== GIT_HOST || porta !== GIT_PORT) {
    throw new CliError(
      `O repositório da loja está em ${u.hostname}:${porta}, e esta versão da CLI só conhece ${GIT_HOST}:${GIT_PORT}. ` +
        "Atualize a CLI; se o erro continuar, fale com a Unbox.",
      "UNEXPECTED_GIT_HOST",
    );
  }
}
