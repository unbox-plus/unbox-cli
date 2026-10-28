#!/usr/bin/env node
// O comando antigo. Continua funcionando, com as mesmas flags, e avisa que o padrão agora é
// `unbox create`. O aviso vai para STDERR: quem lê o stdout num script ou na CI não pode ver a
// saída mudar por causa dele.
import { run } from "../src/main.js";

process.stderr.write(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Aviso: o comando padrão agora é \`unbox create\`.
  create-unbox-store continua funcionando, com as mesmas flags.
  Veja tudo o que a CLI faz com \`unbox --help\`.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

run(["create", ...process.argv.slice(2)], { legacy: true });
