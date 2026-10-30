// A chave de deploy (ssh-keygen de verdade, numa HOME temporária) e as host keys embutidas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ensureKey, rotateKey, keyPaths, gitSshCommand } from "../src/deploy-key.js";
import { KNOWN_HOSTS, assertKnownGitUrl, writeKnownHosts } from "../src/known-hosts.js";
import { sandbox } from "./helpers/git-sandbox.mjs";

const semKeygen = spawnSync("ssh-keygen", ["-?"]).error ? "sem ssh-keygen nesta máquina" : false;
const posix = process.platform !== "win32";

test("gera uma vez e reaproveita; privada 0600", { skip: semKeygen }, () => {
  sandbox();
  const a = ensureKey("loja1");
  assert.equal(a.created, true);
  assert.match(a.publicKey, /^ssh-ed25519 \S+ unbox-loja1$/);
  const b = ensureKey("loja1");
  assert.equal(b.created, false);
  assert.equal(b.publicKey, a.publicKey);
  if (posix) assert.equal(fs.statSync(a.keyPath).mode & 0o777, 0o600);
  if (posix) assert.equal(fs.statSync(path.dirname(a.keyPath)).mode & 0o777, 0o700);
});

test("pública ausente: regenerada a partir da privada", { skip: semKeygen }, () => {
  sandbox();
  const a = ensureKey("loja1");
  fs.rmSync(a.pubPath);
  const b = ensureKey("loja1");
  assert.equal(b.publicKey.split(" ").slice(0, 2).join(" "), a.publicKey.split(" ").slice(0, 2).join(" "));
});

test("rotate: o par antigo vira .bak e a chave nova é outra", { skip: semKeygen }, () => {
  sandbox();
  const a = ensureKey("loja1");
  const b = rotateKey("loja1");
  assert.notEqual(b.publicKey, a.publicKey);
  assert.ok(fs.existsSync(`${a.keyPath}.bak`));
  assert.ok(fs.existsSync(`${a.keyPath}.bak.pub`));
  const c = rotateKey("loja1");
  assert.notEqual(c.publicKey, b.publicKey);
});

test("shopId que não serve de nome de arquivo é recusado", () => {
  sandbox();
  assert.throws(() => keyPaths("../fora"), (e) => e.code === "SHOP_ID_INVALIDO");
});

test("GIT_SSH_COMMAND: aspas simples, barras normais, sem pergunta e sem chave alheia", () => {
  const cmd = gitSshCommand("C:\\Users\\Ana Maria\\.config\\unbox\\keys\\l_ed25519", "/tmp/k$x/known'hosts");
  assert.match(cmd, /-i 'C:\/Users\/Ana Maria\/\.config\/unbox\/keys\/l_ed25519'/);
  assert.match(cmd, /UserKnownHostsFile='\/tmp\/k\$x\/known'\\''hosts'/);
  for (const o of ["IdentitiesOnly=yes", "StrictHostKeyChecking=yes", "BatchMode=yes"]) assert.ok(cmd.includes(o), o);
});

test("host keys embutidas: os fingerprints são os conferidos com a infra", { skip: semKeygen }, () => {
  sandbox();
  const arq = writeKnownHosts();
  const r = spawnSync("ssh-keygen", ["-lf", arq], { encoding: "utf8" });
  const fps = r.stdout.split("\n").filter(Boolean).map((l) => l.split(" ")[1]).sort();
  assert.deepEqual(fps, [
    "SHA256:5f1GoCQeuJf1EDhZ/9D5+GkNNSY1z+Rxbpd4G1fKvyI",
    "SHA256:FdSnRoIGfh6RG+viu161EYqylPRxW2poPHLxPQT+hj0",
    "SHA256:NyOuDzdvUzrdpSzFYgz18LX3eTuI1Du21MRUpO4c6zw",
  ]);
  assert.equal(KNOWN_HOSTS.length, 3);
});

test("URL do repositório: só git.unbox.com.br:222", () => {
  assertKnownGitUrl("ssh://git@git.unbox.com.br:222/Clientes/x.git");
  for (const u of ["ssh://git@git.unbox.com.br/Clientes/x.git", "ssh://git@outro.exemplo:222/x.git", "https://git.unbox.com.br/x.git", "lixo"]) {
    assert.throws(() => assertKnownGitUrl(u), (e) => e.code === "UNEXPECTED_GIT_HOST", u);
  }
});
