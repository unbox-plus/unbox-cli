// `unbox deploy`: commita as mudanças, envia a branch `deploy` para a Unbox e devolve a URL do
// preview quando o build termina. Substitui o antigo `ubx save`.
//
// Ordem: tudo que pode parar o comando (branch, vínculo, credenciais, identidade, login, arquivos
// protegidos, build local) vem antes do commit, e nada disso altera o repositório.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { parseArgs } from "../args.js";
import { CliError, UsageError } from "../errors.js";
import { loadProjectEnv, requireCredentials, describeOrigins } from "../env.js";
import { createPartnerApi } from "../partner-api.js";
import { requireProgram } from "../proc.js";
import { gitSshCommand } from "../deploy-key.js";
import { assertKnownGitUrl, writeKnownHosts } from "../known-hosts.js";
import { fetchDeploy, git, repoProblem, repoState } from "../git.js";
import { askIdentity } from "../identity.js";
import { aheadCount, commitAll, deployProblem, protectedChanges, protectedError, pushDeploy, savedKeyPath } from "../push.js";
import { waitDeployment } from "../deployment.js";

export const help = `
  unbox deploy: envia as mudanças para a Unbox e mostra o preview

  Uso:
    unbox deploy [-m <mensagem>] [--build] [--dir <pasta>] [--env-file <arquivo>] [--yes] [--json]

  Roda na branch deploy do projeto (a que o unbox provision criou):
    1. commita tudo o que mudou (git add -A) com a mensagem de -m (padrão: "unbox: deploy");
    2. envia a branch deploy para a Unbox (se a da Unbox estiver à frente, traz o que ela tem e
       envia de novo; nunca força);
    3. espera o build terminar (até ~15 min) e mostra a URL do preview deste commit e, quando a
       loja tiver, o endereço fixo de preview.

  Flags:
    -m, --message <texto>  mensagem do commit (padrão: "unbox: deploy")
    --build                roda npm run build antes de commitar, para pegar erro sem gastar um deploy

  Fora da branch deploy, o comando para sem mexer em nada. Mudanças em .github/, .gitea/ e
  .forgejo/ não vão para a Unbox: o comando para antes do push e diz como desfazer.
  --json devolve { commitSha, state, url, previewUrl }.
`;

const SPEC = {
  message: { type: "string", short: "m" },
  build: { type: "boolean" },
};

const MENSAGEM_PADRAO = "unbox: deploy";
const PREVIEW_ESTAVEL = "query { customStorefront { previewUrl } }";

/** `npm run build` na pasta do projeto. No --json, a saída do build vai para stderr. */
function buildLocal(dir, out) {
  const r = spawnSync("npm", ["run", "build"], {
    cwd: dir,
    stdio: ["ignore", out.json ? 2 : "inherit", "inherit"],
    // O npm do Windows é um .cmd, que só roda por um shell.
    shell: process.platform === "win32",
    windowsHide: true,
  });
  if (r.error) throw new CliError(`Não consegui rodar o npm run build: ${r.error.message}`, "BUILD_FALHOU");
  if (r.status !== 0) throw new CliError("O npm run build falhou (a saída está acima). Nada foi commitado nem enviado.", "BUILD_FALHOU");
}

/** O endereço fixo de preview: melhor esforço. Loja sem o endereço Unbox (ou provisionada antes dele) devolve null. */
async function previewEstavel(api, out) {
  try {
    return (await api.request(PREVIEW_ESTAVEL)).customStorefront?.previewUrl ?? null;
  } catch (e) {
    out.warn(`  Aviso: não consegui ler o endereço fixo de preview agora (${e.code ?? e.message}).`);
    return null;
  }
}

function texto(d) {
  const linhas = ["", "✓ Preview pronto", ""];
  linhas.push(`  Commit:   ${d.commitSha}`);
  if (d.url) linhas.push(`  Preview:  ${d.url}`);
  if (d.previewUrl) {
    linhas.push(`  Fixo:     ${d.previewUrl}`);
    linhas.push("            mostra sempre o deploy mais recente que terminou com sucesso, que pode ser um mais novo que este");
  }
  linhas.push("");
  return linhas.join("\n");
}

/**
 * `deps` existe para os testes: `createApi`, `sleep`, `now`, `limites`, `build`.
 */
export async function runDeploy(args, globals = {}, { out, interactive = process.stdin.isTTY, deps = {} } = {}) {
  if (globals.help) {
    process.stdout.write(help);
    return;
  }
  const { flags, positional } = parseArgs(args, SPEC);
  if (positional.length) throw new UsageError(`Argumento inesperado: "${positional[0]}". A mensagem vai em -m e a pasta em --dir. Veja unbox deploy --help.`);
  const mensagem = flags.message?.trim() || MENSAGEM_PADRAO;

  const naoInterativo = Boolean(globals.yes || globals.json || !interactive);
  const dir = path.resolve(globals.dir ?? process.cwd());

  // 1. Locais, sem API e sem alterar nada.
  requireProgram("git");
  const st = repoState(dir);
  const keyPath = st.isRepo && !st.insideOtherRepo ? savedKeyPath(dir) : undefined;
  const problema = deployProblem(st, keyPath);
  if (problema) throw problema;
  assertKnownGitUrl(st.unboxRemoteUrl);

  const loaded = loadProjectEnv({ dir, envFile: globals["env-file"] ?? ".env.local" });
  const env = requireCredentials(loaded);
  out.progress(`  Credenciais: ${describeOrigins(loaded)}`);

  // O commit e uma possível integração com a deploy da Unbox precisam de autor real.
  if (!st.hasIdentity) await askIdentity(dir, { naoInterativo, motivo: "o deploy cria um commit" });

  // 2. Login: a loja do login tem de ser a do projeto.
  const api = await (deps.createApi ?? createPartnerApi)({ env, out });
  const outraLoja = repoProblem(st, await api.shopId());
  if (outraLoja) throw outraLoja;

  // 3. O que a Unbox tem, e o que o push levaria.
  const sshCommand = gitSshCommand(keyPath, writeKnownHosts());
  fetchDeploy(dir, sshCommand);
  const protegidos = protectedChanges(dir);
  if (protegidos.length) throw protectedError(protegidos);

  if (flags.build) {
    out.progress("  Rodando npm run build");
    (deps.build ?? buildLocal)(dir, out);
  }

  // 4. Commit e push.
  const commitou = commitAll(dir, mensagem);
  if (!commitou && aheadCount(dir) === 0) {
    const commitSha = git(["rev-parse", "deploy"], { cwd: dir }).stdout.trim();
    out.result(
      { commitSha, state: null, url: null, previewUrl: null },
      () => "\n  Nada a enviar: sem mudanças e sem commits novos na branch deploy.\n",
    );
    return;
  }
  out.progress("  Enviando a branch deploy para a Unbox");
  const { integrado } = pushDeploy(dir, sshCommand);
  if (integrado) out.progress(`  A deploy da Unbox estava à frente: ${integrado === "rebase" ? "seus commits foram reaplicados sobre ela" : "ela foi mesclada à sua"} e o envio repetido.`);

  // 5. O deploy do topo que acabou de ser enviado (só o último commit de cada push gera deploy).
  const commitSha = git(["rev-parse", "deploy"], { cwd: dir }).stdout.trim();
  const dep = await waitDeployment({
    api,
    commitSha,
    out,
    ...(deps.sleep && { sleep: deps.sleep }),
    ...(deps.now && { now: deps.now }),
    ...(deps.limites && { limites: deps.limites }),
  });
  const previewUrl = await previewEstavel(api, out);
  out.result({ commitSha: dep.commitSha, state: dep.state, url: dep.url, previewUrl }, texto);
}
