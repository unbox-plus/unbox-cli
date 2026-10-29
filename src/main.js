// O despachante do `unbox`: separa as flags globais, acha o comando, roda, e converte o que der
// errado num código de saída. É o único lugar que decide código de saída:
//
//   0  ok
//   1  a operação falhou (e, no create, também o uso incorreto, como sempre foi)
//   2  uso incorreto: comando ou flag que não existe, valor faltando
//
// O processo termina por `process.exitCode`, nunca por `process.exit` logo depois de escrever:
// com stdout num pipe, sair na hora pode cortar o JSON no meio.
import fs from "node:fs";
import path from "node:path";
import { extractGlobals } from "./args.js";
import { createOutput } from "./output.js";
import { UsageError } from "./errors.js";
import { PACKAGE_ROOT } from "./paths.js";
import * as create from "./commands/create.js";
import * as provision from "./commands/provision.js";
import * as deploy from "./commands/deploy.js";
import * as env from "./commands/env.js";
import * as publish from "./commands/publish.js";
import * as rollback from "./commands/rollback.js";

/**
 * Os comandos que EXISTEM. Só entra aqui (e na ajuda) o que está implementado: cada comando novo
 * (provision, env, deploy, publish, rollback, status) acrescenta a sua linha.
 */
const COMMANDS = {
  create: {
    resumo: "gera um storefront novo a partir do template (o antigo create-unbox-store)",
    uso: "create [pasta]",
    help: create.help,
    run: (args, globals, ctx) => create.runCreate(args, globals, ctx),
    // O create é anterior ao contrato de saída 2 e mantém o 1 que sempre teve.
    usageExit: 1,
  },
  provision: {
    resumo: "provisiona a loja na Unbox e liga o projeto à branch deploy",
    uso: "provision",
    help: provision.help,
    run: (args, globals, ctx) => provision.runProvision(args, globals, ctx),
  },
  env: {
    resumo: "envia as variáveis do .env.local para a hospedagem da loja",
    uso: "env [--list | --unset <CHAVE>...]",
    help: env.help,
    run: (args, globals, ctx) => env.runEnv(args, globals, ctx),
  },
  deploy: {
    resumo: "commita, envia a branch deploy para a Unbox e mostra a URL do preview",
    uso: "deploy [-m <msg>]",
    help: deploy.help,
    run: (args, globals, ctx) => deploy.runDeploy(args, globals, ctx),
  },
  publish: {
    resumo: "publica em produção um commit com preview pronto e acompanha até o fim",
    uso: "publish [commit]",
    help: publish.help,
    run: (args, globals, ctx) => publish.runPublish(args, globals, ctx),
  },
  rollback: {
    resumo: "volta produção para a publicação anterior (ou para a página \"Em breve\")",
    uso: "rollback",
    help: rollback.help,
    run: (args, globals, ctx) => rollback.runRollback(args, globals, ctx),
  },
};

/** Só os comandos registrados: `unbox constructor` não pode achar o protótipo do objeto. */
function comando(nome) {
  return nome && Object.hasOwn(COMMANDS, nome) ? COMMANDS[nome] : undefined;
}

function version() {
  try {
    return JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8")).version;
  } catch {
    return "";
  }
}

export function mainHelp() {
  const largura = Math.max(...Object.values(COMMANDS).map((c) => c.uso.length));
  const linhas = Object.values(COMMANDS).map((c) => `    ${c.uso.padEnd(largura)}   ${c.resumo}`);
  return `
  unbox ${version()}: a CLI das lojas Unbox

  Uso:
    unbox <comando> [flags]
    npx --package=@unbox-plus/cli unbox <comando> [flags]

  Comandos:
${linhas.join("\n")}

  Flags globais (valem antes ou depois do comando):
    --help, -h            ajuda (do comando, quando vem com um)
    --json                saída para agentes e scripts: um único objeto JSON em stdout
    --yes, -y             não pede confirmação
    --dir <caminho>       pasta do projeto (padrão: a atual)
    --env-file <arquivo>  arquivo das credenciais e variáveis, relativo ao --dir (padrão: .env.local)

  Códigos de saída: 0 ok, 1 a operação falhou, 2 uso incorreto.

  Ajuda de um comando: unbox <comando> --help
`;
}

/** Roda o CLI com `argv` (sem o `node` e o caminho do script). Devolve o código de saída. */
export async function run(argv, { legacy = false } = {}) {
  // Antes de saber se é --json, o modo é decidido pelo argv cru: um erro já no parse das globais
  // também precisa sair como JSON quando pediram JSON.
  let out = createOutput({ json: argv.includes("--json") });
  // O código do erro de uso é do comando, e um erro já nas globais (`unbox create --dir`) precisa
  // dele antes do parse terminar.
  let usageExit = comando(argv.find((a) => !a.startsWith("-")))?.usageExit ?? 2;
  try {
    const { globals, rest } = extractGlobals(argv);
    out = createOutput({ json: Boolean(globals.json) });

    const nome = rest.find((a) => !a.startsWith("-"));
    if (!nome) {
      if (globals.help && !rest.length) {
        process.stdout.write(mainHelp());
        return finish(0);
      }
      if (out.json) throw new UsageError("Informe um comando. Veja unbox --help.");
      process.stderr.write(mainHelp());
      return finish(2);
    }
    const cmd = comando(nome);
    if (!cmd) {
      const sugestao = Object.keys(COMMANDS).find((c) => c.startsWith(nome.slice(0, 2)));
      throw new UsageError(`Comando desconhecido: "${nome}".${sugestao ? ` Você quis dizer "${sugestao}"?` : ""} Veja unbox --help.`);
    }
    usageExit = cmd.usageExit ?? 2;
    const args = rest.slice(0);
    args.splice(rest.indexOf(nome), 1);

    await cmd.run(args, globals, { legacy, out });
    return finish(0);
  } catch (err) {
    out.fail(err);
    if (err instanceof UsageError) return finish(usageExit);
    return finish(1);
  }
}

function finish(code) {
  process.exitCode = code;
  return code;
}
