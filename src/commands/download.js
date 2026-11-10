// `unbox download`: traz para esta máquina uma loja que JÁ existe na Unbox. É o caminho inverso do
// `unbox create` + `unbox provision`: em vez de gerar uma loja e provisioná-la, pergunta as
// credenciais, acha o repositório da loja na Partners API, registra a chave desta máquina, clona e
// deixa a pasta com o mesmo vínculo que o provision deixaria (remote `unbox`, branch `deploy`,
// `unbox.shopId` e `unbox.keyPath` na config), pronta para o `unbox deploy` e o `unbox publish`.
//
// Ordem: as perguntas e o que é local vêm antes do clone, e o clone vem antes do `.env.local`.
// Assim uma falha no meio nunca deixa credencial escrita numa pasta sem loja.
import fs from "node:fs";
import path from "node:path";
import prompts from "prompts";
import { parseArgs } from "../args.js";
import { CliError, UsageError } from "../errors.js";
import { CREDENTIAL_KEYS, describeOrigins, envValue, loadProjectEnv } from "../env.js";
import { createPartnerApi } from "../partner-api.js";
import { requireProgram } from "../proc.js";
import { ensureKey, gitSshCommand, rotateKey } from "../deploy-key.js";
import { fingerprintDe, registraChaveDaMaquina } from "../deploy-keys.js";
import { assertKnownGitUrl, writeKnownHosts } from "../known-hosts.js";
import { cloneDeploy, git, gravaVinculo } from "../git.js";
import { CAMPOS_PRODUCAO, curto, describeLive } from "../production.js";
import { PASSOS } from "../provisioning.js";
import { NON_RETRYABLE, backendCode, nonRetryableError } from "../storefront.js";

export const help = `
  unbox download: baixa para esta máquina uma loja que já existe na Unbox

  Uso:
    unbox download [pasta] [--env-file <arquivo>] [--yes] [--json]
    npx --package=@unbox-plus/cli unbox download

  Pergunta as credenciais da loja (UNBOX_PARTNER_API_KEY, UNBOX_USER e UNBOX_PASS) e a pasta,
  e então:
    1. acha o repositório da loja na Partners API;
    2. adiciona a chave de deploy desta máquina à loja (como o unbox keys add: a loja aceita
       várias chaves, uma por máquina, pessoa ou CI, e as que já estão lá continuam);
    3. clona o repositório na pasta, na branch deploy, com o remote unbox;
    4. grava a loja e a chave na config do repositório (unbox.shopId e unbox.keyPath), como o
       unbox provision faz;
    5. cria um .env.local mínimo com as três credenciais (um que já exista não é alterado);
    6. mostra o estado do deploy do commit baixado e da produção.

  A pasta é o destino do clone. Se ela já existir com arquivos dentro, a loja vai para
  <pasta>/<nome-do-repositório>. Sem pasta, o clone usa o nome do repositório, na pasta atual.

  Com --yes, --json ou fora de um terminal não há perguntas: as três credenciais têm de vir do
  ambiente do terminal (ou de um arquivo apontado por --env-file) e a pasta, do argumento.

  O que o download NÃO faz: npm install, build, deploy nem publicação. A loja baixada roda com
  npm install e npm run dev, e o que você editar vai para a Unbox com unbox deploy.
`;

const LOJA = "query { customStorefront { _id status currentStep repositorySshUrl previewUrl lastErrorCode } }";
const DEPLOY = "query ($commitSha: String!) { customStorefrontDeployment(commitSha: $commitSha) { commitSha state url } }";
const PRODUCAO = `query { customStorefrontProduction { ${CAMPOS_PRODUCAO} } }`;

/** O arquivo de credenciais que o download cria. O --env-file só diz de onde LER as credenciais. */
const ENV_LOCAL = ".env.local";

const cancelado = () => {
  throw new CliError("Cancelado. Nada foi baixado.", "CANCELADO");
};

const obrigatorio = (v) => (String(v ?? "").trim() ? true : "Obrigatório para falar com a Unbox.");

/**
 * As credenciais e a pasta. O que já está no ambiente (ou no --env-file) vira o padrão das
 * perguntas: quem exportou as três no terminal só dá Enter. A pasta só é perguntada quando não
 * veio como argumento.
 */
async function pergunta(loaded, { perguntaPasta }) {
  const r = await prompts([
    {
      type: "text",
      name: "UNBOX_PARTNER_API_KEY",
      message: "UNBOX_PARTNER_API_KEY: api key única do PARCEIRO (é por ela que a loja fala com a Unbox)",
      initial: loaded.env.UNBOX_PARTNER_API_KEY ?? "",
      validate: obrigatorio,
      stdout: process.stderr,
    },
    {
      type: "text",
      name: "UNBOX_USER",
      message: "UNBOX_USER: o usuário da LOJA que vai ser baixada",
      initial: loaded.env.UNBOX_USER ?? "",
      validate: obrigatorio,
      stdout: process.stderr,
    },
    {
      type: "password",
      name: "UNBOX_PASS",
      message: "UNBOX_PASS",
      initial: loaded.env.UNBOX_PASS ?? "",
      validate: obrigatorio,
      stdout: process.stderr,
    },
    {
      type: perguntaPasta ? "text" : null,
      name: "pasta",
      message: "Pasta em que a loja será baixada (Enter: o nome do repositório, aqui nesta pasta)",
      stdout: process.stderr,
    },
  ], { onCancel: cancelado });
  const pasta = String(r.pasta ?? "").trim();
  return {
    credenciais: Object.fromEntries(CREDENTIAL_KEYS.map((k) => [k, String(r[k] ?? "").trim()])),
    pasta: pasta || undefined,
  };
}

/** Sem terminal para perguntar, as três credenciais têm de estar no ambiente ou no --env-file. */
function exigeCredenciais(loaded) {
  const faltam = CREDENTIAL_KEYS.filter((k) => !loaded.env[k]);
  if (!faltam.length) return Object.fromEntries(CREDENTIAL_KEYS.map((k) => [k, loaded.env[k]]));
  throw new CliError(
    `Sem terminal para perguntar (--json, --yes ou saída redirecionada) e ${faltam.length === 1 ? "falta" : "faltam"} ${faltam.join(", ")}. ` +
      `Exporte as três credenciais no terminal, ou aponte um arquivo que as tenha com --env-file <arquivo>, e rode de novo.`,
    "CREDENCIAIS_AUSENTES",
  );
}

/** A loja precisa estar provisionada: sem repositório na Unbox não há o que clonar. */
function exigeLojaPronta(sf) {
  if (!sf) {
    throw new CliError(
      "Esta loja ainda não tem um storefront na Unbox: não há repositório para baixar. Gere a loja com unbox create e rode unbox provision na pasta dela.",
      "NAO_PROVISIONADO",
    );
  }
  if (sf.status === "PROVISIONING") {
    const passo = sf.currentStep ? PASSOS[sf.currentStep] ?? sf.currentStep : "na fila";
    throw new CliError(
      `O provisionamento da loja ainda está em andamento (${passo}). Acompanhe com unbox status e rode o download quando terminar.`,
      "NAO_PROVISIONADO",
    );
  }
  if (sf.status !== "READY") {
    if (sf.lastErrorCode && NON_RETRYABLE.has(sf.lastErrorCode)) throw nonRetryableError(sf);
    throw new CliError(
      `O provisionamento da loja falhou${sf.lastErrorCode ? ` (${sf.lastErrorCode})` : ""} e o repositório não está pronto. Rode unbox provision na pasta do projeto: ele retoma do passo que falhou.`,
      "NAO_PROVISIONADO",
    );
  }
  if (!sf.repositorySshUrl) {
    throw new CliError("A Unbox não devolveu o endereço do repositório desta loja. Fale com a Unbox.", "SEM_REPOSITORIO");
  }
}

/** O nome do repositório na URL SSH ("...:222/Clientes/loja-x.git" vira "loja-x"). */
export function nomeDoRepositorio(sshUrl, shopId) {
  let nome = "";
  try {
    nome = path.posix.basename(new URL(sshUrl).pathname).replace(/\.git$/, "");
  } catch {
    nome = "";
  }
  return /^[A-Za-z0-9._-]+$/.test(nome) && nome !== "." && nome !== ".." ? nome : `loja-${shopId}`;
}

const ocupada = (p) => fs.existsSync(p) && (!fs.statSync(p).isDirectory() || fs.readdirSync(p).length > 0);

const pastaOcupada = (p) => new CliError(`A pasta ${p} já existe e não está vazia. Nada foi baixado.`, "PASTA_OCUPADA");

/**
 * Onde o clone vai cair. A pasta informada é o destino; informada e já com arquivos dentro, ela é
 * a pasta-mãe e a loja vai para `<pasta>/<nome-do-repositório>` (é o que quem digita `~/lojas`
 * espera). Sem pasta informada, o nome do repositório na pasta atual, e aí uma pasta ocupada é
 * erro: `loja-x/loja-x` não seria o que ninguém pediu.
 */
export function destinoDoClone(pasta, repoName, { cwd = process.cwd() } = {}) {
  if (!pasta) {
    const alvo = path.resolve(cwd, repoName);
    if (ocupada(alvo)) throw pastaOcupada(alvo);
    return alvo;
  }
  const base = path.resolve(cwd, pasta);
  if (fs.existsSync(base) && !fs.statSync(base).isDirectory()) {
    throw new CliError(`${base} existe e não é uma pasta. Informe outra pasta de destino.`, "PASTA_OCUPADA");
  }
  if (!ocupada(base)) return base;
  const dentro = path.join(base, repoName);
  if (ocupada(dentro)) throw pastaOcupada(dentro);
  return dentro;
}

/**
 * O `.env.local` mínimo da loja baixada: só as credenciais que o download recebeu, mais a
 * UNBOX_PARTNER_GRAPHQL_URL quando o ambiente aponta outro servidor (sem ela, a loja baixada
 * falaria com a produção da Unbox). O resto das variáveis está no `.env.example` do projeto e na
 * hospedagem (`unbox env --list`). Um arquivo que já exista NÃO é alterado: ele pode ser o de
 * outra loja, ou ter mais coisa dentro.
 */
export function escreveEnvLocal(dir, credenciais, { graphqlUrl } = {}) {
  const caminho = path.join(dir, ENV_LOCAL);
  const valores = { ...credenciais, ...(graphqlUrl ? { UNBOX_PARTNER_GRAPHQL_URL: graphqlUrl } : {}) };
  if (fs.existsSync(caminho)) return { nome: ENV_LOCAL, caminho, escrito: false, chaves: [] };
  const linhas = [
    "# Criado pelo unbox download: só as credenciais da Unbox.",
    "# As outras variáveis da loja estão no .env.example e na hospedagem (unbox env --list).",
    ...Object.entries(valores).map(([k, v]) => `${k}=${envValue(v)}`),
    "",
  ];
  // 0600: o arquivo guarda a senha da loja e fica fora do git (.gitignore do template).
  fs.writeFileSync(caminho, linhas.join("\n"), { mode: 0o600 });
  return { nome: ENV_LOCAL, caminho, escrito: true, chaves: Object.keys(valores) };
}

// ------------------------------------------------------------------------------------- texto

function linhasDoDeploy(d) {
  const l = [`  Deploy do commit baixado (${curto(d.commitSha)})`];
  if (d.errors?.deployment) return [...l, `    Estado:  não consegui ler (${d.errors.deployment.code})`];
  const dep = d.deployment;
  if (!dep) return [...l, "    Estado:  sem deploy registrado para este commit"];
  if (dep.state === "SUCCESS") return [...l, `    Estado:  pronto   ${dep.url ?? ""}`.trimEnd()];
  if (dep.state === "FAILURE") return [...l, "    Estado:  o build deste commit falhou na Unbox; o próximo unbox deploy envia de novo"];
  return [...l, "    Estado:  em andamento (na fila ou rodando)"];
}

function linhasDaProducao(d) {
  const l = ["  Produção"];
  if (d.errors?.production) return [...l, `    Estado:  não consegui ler (${d.errors.production.code})`];
  if (!d.production) return [];
  l.push(`    No ar:     ${describeLive(d.production)}`);
  if (d.production.url) l.push(`    Endereço:  ${d.production.url}`);
  if (d.production.operation?.state === "PENDING") l.push("    Operação:  há uma publicação ou rollback em andamento (unbox status mostra)");
  return l;
}

function texto(d) {
  const linhas = ["", "✓ Loja baixada e ligada à Unbox", ""];
  linhas.push(`  Pasta:        ${d.dir}`);
  linhas.push(`  Repositório:  ${d.repositorySshUrl}`);
  linhas.push(`  Loja:         ${d.shopId}`);
  linhas.push(`  Branch:       deploy, rastreando unbox/deploy (commit ${curto(d.commitSha)})`);
  if (d.deployKey) {
    linhas.push(`  Chave:        ${d.deployKey.fingerprint}${d.deployKey.added ? " (adicionada à loja agora, ao lado das que já estavam)" : " (já estava na loja)"}`);
  }
  linhas.push(`  Credenciais:  ${d.envFile.escrito ? `${d.envFile.nome} criado com ${d.envFile.chaves.join(", ")}` : `${d.envFile.nome} já existia na pasta e não foi alterado`}`);
  if (d.storefront?.previewUrl) linhas.push(`  Preview fixo: ${d.storefront.previewUrl}`);
  linhas.push("");
  for (const bloco of [linhasDoDeploy(d), linhasDaProducao(d)]) {
    if (bloco.length) linhas.push(...bloco, "");
  }
  linhas.push("  A loja está pronta para edição e para os comandos de deploy e publicação:", "");
  linhas.push(`    cd ${d.dir}`);
  linhas.push("    npm install");
  linhas.push("    unbox deploy     # envia o que você editar e devolve a URL do preview");
  linhas.push("    unbox publish    # o preview conferido vai para produção");
  linhas.push("");
  return linhas.join("\n");
}

// ---------------------------------------------------------------------------------- comando

/**
 * `deps` existe para os testes: `createApi`.
 */
export async function runDownload(args, globals = {}, { out, interactive = process.stdin.isTTY, deps = {} } = {}) {
  if (globals.help) {
    process.stdout.write(help);
    return;
  }
  if (globals.dir) {
    throw new UsageError("O download não usa --dir: a pasta de destino é o argumento, `unbox download <pasta>`.");
  }
  const { positional } = parseArgs(args, {});
  if (positional.length > 1) {
    throw new UsageError(`Argumento inesperado: "${positional[1]}". O download recebe uma pasta só. Veja unbox download --help.`);
  }
  const naoInterativo = Boolean(globals.yes || globals.json || !interactive);

  // 1. Local, sem API: os programas e as credenciais.
  requireProgram("git");
  requireProgram("ssh-keygen");

  const loaded = loadProjectEnv({ dir: process.cwd(), envFile: globals["env-file"] ?? ENV_LOCAL });
  let pasta = positional[0];
  let credenciais;
  if (naoInterativo) {
    credenciais = exigeCredenciais(loaded);
    out.progress(`  Credenciais: ${describeOrigins(loaded)}`);
  } else {
    const respostas = await pergunta(loaded, { perguntaPasta: !pasta });
    credenciais = respostas.credenciais;
    pasta = pasta ?? respostas.pasta;
  }
  // Antes de qualquer saída: nem a senha nem a api key podem aparecer numa mensagem de erro.
  out.addSecrets(credenciais.UNBOX_PASS, credenciais.UNBOX_PARTNER_API_KEY);
  const env = { ...loaded.env, ...credenciais };

  // 2. API: login, loja e chave desta máquina.
  const api = await (deps.createApi ?? createPartnerApi)({ env, out });
  const shopId = await api.shopId();
  out.progress(`  Loja: ${shopId}`);

  const sf = (await api.request(LOJA)).customStorefront;
  exigeLojaPronta(sf);
  const sshUrl = sf.repositorySshUrl;
  assertKnownGitUrl(sshUrl);
  const dir = destinoDoClone(pasta, nomeDoRepositorio(sshUrl, shopId));

  const key = ensureKey(shopId);
  if (key.created) out.progress(`  Chave de deploy criada: ${key.pubPath}`);
  const { chave, added } = await registraChaveDaMaquina(api, key, { rotate: () => rotateKey(shopId), out });

  // 3. Git: o clone e o vínculo que os outros comandos procuram.
  out.progress(`  Clonando o repositório da loja em ${dir}`);
  cloneDeploy({ sshUrl, dest: dir, sshCommand: gitSshCommand(chave.keyPath, writeKnownHosts()) });
  gravaVinculo(dir, { shopId, keyPath: chave.keyPath });
  const commitSha = git(["rev-parse", "HEAD"], { cwd: dir }).stdout.trim() || null;

  // 4. As credenciais na pasta da loja, agora que ela existe.
  const envFile = escreveEnvLocal(dir, credenciais, { graphqlUrl: loaded.env.UNBOX_PARTNER_GRAPHQL_URL });
  if (!envFile.escrito) out.warn(`  Aviso: ${envFile.caminho} já existia e não foi alterado. Confira se as credenciais dentro dele são desta loja.`);

  // 5. O estado do deploy e da produção: a loja já está no disco, e uma consulta que falhe aqui
  // não desfaz nada. Vira aviso, não erro.
  const consultas = { production: api.request(PRODUCAO).then((r) => r.customStorefrontProduction ?? null) };
  if (commitSha) consultas.deployment = api.request(DEPLOY, { commitSha }).then((r) => r.customStorefrontDeployment ?? null);
  const nomes = Object.keys(consultas);
  const resultados = await Promise.allSettled(Object.values(consultas));

  const data = {
    dir,
    shopId,
    repositorySshUrl: sshUrl,
    branch: "deploy",
    commitSha,
    deployKey: { fingerprint: fingerprintDe(chave.publicKey) ?? null, added },
    envFile: { nome: envFile.nome, caminho: envFile.caminho, escrito: envFile.escrito, chaves: envFile.chaves },
    storefront: { status: sf.status, previewUrl: sf.previewUrl ?? null },
    deployment: null,
    production: null,
  };
  const errors = {};
  resultados.forEach((r, i) => {
    if (r.status === "fulfilled") data[nomes[i]] = r.value;
    else errors[nomes[i]] = { code: backendCode(r.reason) ?? r.reason?.code ?? "ERRO", message: String(r.reason?.message ?? r.reason) };
  });
  if (Object.keys(errors).length) {
    data.errors = errors;
    for (const [n, e] of Object.entries(errors)) {
      out.warn(`  Aviso: a consulta ${n === "production" ? "da produção" : "do deploy"} falhou (${e.code}): ${e.message}`);
    }
  }
  out.result(data, texto);
}
