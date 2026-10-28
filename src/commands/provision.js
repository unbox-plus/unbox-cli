// `unbox provision`: provisiona o repositório e a hospedagem da loja na Unbox e liga o git do
// projeto à branch `deploy`, pronto para o `unbox deploy`.
//
// Ordem: tudo que é local e pode dar errado (git, credenciais, estado do repositório, perguntas)
// vem antes da primeira chamada à API, para ninguém esperar minutos de provisionamento e só
// depois descobrir um problema na própria pasta.
import path from "node:path";
import prompts from "prompts";
import { parseArgs } from "../args.js";
import { CliError, UsageError } from "../errors.js";
import { loadProjectEnv, requireCredentials, describeOrigins } from "../env.js";
import { createPartnerApi } from "../partner-api.js";
import { requireProgram } from "../proc.js";
import { ensureKey, rotateKey, gitSshCommand } from "../deploy-key.js";
import { assertKnownGitUrl, writeKnownHosts } from "../known-hosts.js";
import { provisionAndWait } from "../provisioning.js";
import { linkDeploy, linkMode, needsCommit, repoProblem, repoState } from "../git.js";
import { askIdentity } from "../identity.js";

export const help = `
  unbox provision: provisiona a loja na Unbox e liga o projeto à branch deploy

  Uso:
    unbox provision [--dir <pasta>] [--env-file <arquivo>] [--yes] [--json]

  Roda na pasta do projeto (a gerada pelo unbox create, ou um projeto seu com git):
    1. cria o repositório e a hospedagem da loja na Unbox e espera ficarem prontos
       (alguns minutos; se falhar, tenta de novo quando faz sentido);
    2. cria a branch deploy AO LADO da sua branch atual, que não é alterada;
    3. deixa tudo pronto para o unbox deploy.

  A chave de deploy fica em ~/.config/unbox/keys/<loja>_ed25519, só nesta máquina.
  As pastas .github/, .gitea/ e .forgejo/ não vão para a Unbox: ficam fora da branch deploy
  (o .forgejo/ é o da Unbox) e continuam na sua branch.

  Rodar de novo é seguro: mesma chave, nada duplicado.
`;

const CAMPOS_PRODUCAO = "query { customStorefrontProduction { url } }";

function perguntaOuFalha(naoInterativo, err) {
  if (naoInterativo) throw err;
}

const cancelado = () => {
  throw new CliError("Cancelado. Nada foi alterado.", "CANCELADO");
};

/** Faltando identidade git e havendo commit a fazer: pergunta (e grava no repositório) ou para. */
async function garanteIdentidade(st, { naoInterativo, out }) {
  if (st.hasIdentity) return;
  if (!needsCommit(st)) {
    out.warn("  Aviso: o git desta máquina não tem nome e e-mail configurados. O unbox deploy vai precisar deles.");
    return;
  }
  await askIdentity(st.dir, { naoInterativo, motivo: "o vínculo cria um commit" });
}

/** Pastas que o servidor recusa: com confirmação, ficam fora da deploy. */
async function confirmaPastas(st, { naoInterativo, yes }) {
  if (linkMode(st) === "reexecucao" || !st.protectedPaths.length) return;
  if (yes) return;
  const lista = st.protectedPaths.map((p) => `    ${p}`).join("\n");
  const explicacao =
    `Estes arquivos não vão para a Unbox (o servidor recusa .github/, .gitea/ e .forgejo/; o GitHub Actions não roda lá):\n${lista}\n` +
    "Eles ficam fora da branch deploy (o .forgejo/ passa a ser o da Unbox) e continuam na sua branch.";
  perguntaOuFalha(naoInterativo, new CliError(`${explicacao}\nPara seguir assim, rode de novo com --yes.`, "PROTECTED_PATHS"));
  process.stderr.write(`\n  ${explicacao.replace(/\n/g, "\n  ")}\n\n`);
  const { ok } = await prompts({ type: "confirm", name: "ok", message: "Seguir?", initial: true, stdout: process.stderr }, { onCancel: cancelado });
  if (!ok) cancelado();
}

/** Endereço de produção: melhor esforço. A consulta passa pela hospedagem e pode falhar sem que o vínculo tenha falhado. */
async function enderecoDeProducao(api, out) {
  try {
    return (await api.request(CAMPOS_PRODUCAO)).customStorefrontProduction?.url ?? null;
  } catch (e) {
    out.warn(`  Aviso: não consegui ler o endereço de produção agora (${e.code ?? e.message}). Rodar o unbox provision de novo mostra o endereço; é seguro.`);
    return null;
  }
}

function texto(d, extra) {
  const linhas = ["", "✓ Loja provisionada e projeto ligado à Unbox", ""];
  linhas.push(`  Repositório:  ${d.repositorySshUrl}`);
  if (d.productionUrl) linhas.push(`  Endereço:     ${d.productionUrl}  (mostra "Em breve" até o primeiro unbox publish)`);
  linhas.push(`  Branch:       deploy, rastreando unbox/deploy`);
  if (extra.originalBranch && extra.mode === "merge") {
    linhas.push(`                a sua branch ${extra.originalBranch} ficou como estava; trabalhe na deploy`);
  }
  if (extra.removed.length) {
    linhas.push(`  Fora da deploy (continuam na ${extra.originalBranch}): ${extra.removed.join(", ")}`);
  }
  linhas.push("", "  As variáveis do .env.local ainda não vão para a hospedagem: sem elas o build da loja falha.");
  linhas.push("  Próximo passo: unbox deploy", "");
  return linhas.join("\n");
}

/**
 * `deps` existe para os testes: `createApi`, `sleep`, `now`, `limites`.
 */
export async function runProvision(args, globals = {}, { out, interactive = process.stdin.isTTY, deps = {} } = {}) {
  if (globals.help) {
    process.stdout.write(help);
    return;
  }
  const { positional } = parseArgs(args, {});
  if (positional.length) throw new UsageError(`Argumento inesperado: "${positional[0]}". A pasta vai em --dir. Veja unbox provision --help.`);

  const naoInterativo = Boolean(globals.yes || globals.json || !interactive);
  const dir = path.resolve(globals.dir ?? process.cwd());

  // 1. Locais, sem API.
  requireProgram("git");
  requireProgram("ssh-keygen");
  const loaded = loadProjectEnv({ dir, envFile: globals["env-file"] ?? ".env.local" });
  const env = requireCredentials(loaded);
  out.progress(`  Credenciais: ${describeOrigins(loaded)}`);

  const st = repoState(dir);
  const problema = repoProblem(st);
  if (problema) throw problema;
  await confirmaPastas(st, { naoInterativo, yes: globals.yes });
  await garanteIdentidade(st, { naoInterativo, out });

  // 2. API: login, loja e chave.
  const api = await (deps.createApi ?? createPartnerApi)({ env, out });
  const shopId = await api.shopId();
  const outraLoja = repoProblem(st, shopId);
  if (outraLoja) throw outraLoja;
  out.progress(`  Loja: ${shopId}`);

  const key = ensureKey(shopId);
  if (key.created) out.progress(`  Chave de deploy criada: ${key.pubPath}`);

  const { storefront, key: chave } = await provisionAndWait({
    api,
    key,
    rotate: () => rotateKey(shopId),
    out,
    ...(deps.sleep && { sleep: deps.sleep }),
    ...(deps.now && { now: deps.now }),
    ...(deps.limites && { limites: deps.limites }),
  });

  // 3. Git.
  const sshUrl = storefront.repositorySshUrl;
  assertKnownGitUrl(sshUrl);
  const knownHosts = writeKnownHosts();
  out.progress("  Ligando o projeto à branch deploy da Unbox");
  const vinculo = linkDeploy({
    dir,
    sshUrl,
    sshCommand: gitSshCommand(chave.keyPath, knownHosts),
    shopId,
    keyPath: chave.keyPath,
    st,
  });

  const productionUrl = await enderecoDeProducao(api, out);
  const data = { status: storefront.status, repositorySshUrl: sshUrl, shopId, productionUrl };
  out.result(data, (d) => texto(d, vinculo));
}
