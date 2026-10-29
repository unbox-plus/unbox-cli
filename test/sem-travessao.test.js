// Travessão no texto que a CLI imprime. O gate do `prepack` já cobra isso, mas lê linha a linha e
// zera o estado de aspas em cada uma: dentro de uma template literal de várias linhas (a ajuda dos
// comandos), um `//` de URL ou um `/*` de `src/*` faz ele tratar o resto como comentário e não ver.
// Aqui a régua é mais simples e mais dura: nos arquivos novos, nenhum travessão em lugar nenhum;
// no create, que trouxe os comentários antigos, nenhum fora de linha de comentário.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TRAVESSAO = "—";

const SEM_NENHUM = [
  "bin/unbox.js", "bin/cli.js", "src/main.js", "src/args.js", "src/output.js",
  "src/env.js", "src/partner-api.js", "src/paths.js", "src/errors.js",
  "src/commands/provision.js", "src/proc.js", "src/config-dir.js", "src/known-hosts.js",
  "src/deploy-key.js", "src/storefront.js", "src/provisioning.js", "src/git.js",
  "src/commands/deploy.js", "src/deployment.js", "src/push.js", "src/identity.js",
  "src/commands/env.js", "src/environment.js",
];

test("arquivos novos da CLI sem travessão", () => {
  for (const rel of SEM_NENHUM) {
    const linhas = fs.readFileSync(path.join(RAIZ, rel), "utf8").split("\n");
    linhas.forEach((l, i) => assert.ok(!l.includes(TRAVESSAO), `${rel}:${i + 1}: ${l.trim()}`));
  }
});

test("create sem travessão fora de comentário", () => {
  const rel = "src/commands/create.js";
  const linhas = fs.readFileSync(path.join(RAIZ, rel), "utf8").split("\n");
  linhas.forEach((l, i) => {
    const codigo = l.replace(/^\s*(\/\/|\*|\/\*).*$/, "").replace(/\s\/\/\s.*$/, "");
    assert.ok(!codigo.includes(TRAVESSAO), `${rel}:${i + 1}: ${l.trim()}`);
  });
});
