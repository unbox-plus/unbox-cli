// `unbox publish`: põe em produção um commit cujo preview está pronto e acompanha até o fim.
// Substitui o antigo `ubx publish`, que forçava a preview na production pelo git: agora publicar é
// uma chamada à API por commit, e a Unbox refaz o build com a configuração de produção.
//
// Ordem: git local (só lendo), login, produção e preview, confirmação, mutation, acompanhamento.
// Nada antes da confirmação altera coisa alguma, nem no repositório nem na Unbox.
import path from "node:path";
import prompts from "prompts";
import { parseArgs } from "../args.js";
import { CliError, UsageError } from "../errors.js";
import { loadProjectEnv, requireCredentials, describeOrigins } from "../env.js";
import { createPartnerApi } from "../partner-api.js";
import { requireProgram } from "../proc.js";
import { gitSshCommand } from "../deploy-key.js";
import { assertKnownGitUrl, writeKnownHosts } from "../known-hosts.js";
import { fetchDeploy, git, otherShopError, repoState } from "../git.js";
import { aheadCount, dirtyTree, publishProblem, resolveCommit, savedKeyPath } from "../push.js";
import { waitDeployment } from "../deployment.js";
import {
  CAMPOS_PRODUCAO, curto, describeLive, describeOperation, isStale, outcome, quando, readProduction, storefrontUnavailable, waitOperation,
} from "../production.js";
import {
  DEPLOYMENT_INVALID, DEPLOYMENT_NOT_FOUND, DEPLOYMENT_NOT_READY, NOT_CONFIGURED, NOT_READY, PRODUCTION_BUILD, PRODUCTION_BUSY,
  PRODUCTION_TIMEOUT, backendCode,
} from "../storefront.js";

export const help = `
  unbox publish: publica um commit em produção

  Uso:
    unbox publish [commit] [--dir <pasta>] [--env-file <arquivo>] [--yes] [--json]

  Sem commit, publica o último enviado pelo unbox deploy (o topo da branch deploy da Unbox). O
  commit pode ir com o hash curto ou completo, e precisa estar na branch deploy da Unbox.
    1. confere o preview do commit; se ainda estiver sendo gerado, espera (só pelo último enviado);
    2. mostra o que está no ar e o que vai entrar, e pede confirmação (--yes pula);
    3. a Unbox refaz o build com a configuração de produção (preview ok não garante produção ok) e
       troca o endereço quando termina; o comando acompanha até o fim (até ~25 min).

  Publicar o commit que já está no ar não refaz o build: variáveis mudadas com unbox env pedem um
  commit novo (git commit --allow-empty), unbox deploy e unbox publish.
  Ctrl+C durante o acompanhamento não cancela a publicação: unbox publish <commit> volta a acompanhar.
  Com o hash completo, publica também de uma pasta não ligada à Unbox (bastam as credenciais).
  --json devolve a produção ({ state, commitSha, url, publishedAt, rollbackCommitSha, canRollback,
  operation }) com alreadyLive; numa falha depois de ler a produção, ela vem em data.
`;

const HASH = /^[0-9a-f]{4,64}$/i;
const COMPLETO = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

const PUBLICAR = `mutation ($input: PublishCustomStorefrontInput!) { publishCustomStorefront(input: $input) { ${CAMPOS_PRODUCAO} } }`;
const PREVIEW = "query ($commitSha: String!) { customStorefrontDeployment(commitSha: $commitSha) { commitSha state url } }";

/** Sem o git ligado ou sem o fetch, o hash completo ainda dá para publicar: a Unbox confere o commit. */
const SEM_GIT_LOCAL = new Set(["NAO_PROVISIONADO", "REPO_ANINHADO", "GIT_MISSING", "GIT_FETCH_FALHOU"]);

/** Erros da mutation que têm resposta própria; qualquer outro é repetido uma vez (a chamada é idempotente). */
const TRATADOS = new Set([NOT_READY, NOT_CONFIGURED, PRODUCTION_BUSY, DEPLOYMENT_NOT_READY, DEPLOYMENT_NOT_FOUND, DEPLOYMENT_INVALID]);
const FATAIS = new Set(["MISSING_PERMISSION", "SIGN_IN_FAILED", "API_KEY_RECUSADA"]);
const ESPERA_REPETICAO = 3000;

const esperaPadrao = (ms) => new Promise((r) => setTimeout(r, ms));

const cancelado = () => {
  throw new CliError("Cancelado. Nada foi publicado.", "CANCELADO");
};

const previewPendente = (sha) => new CliError(
  `O preview do commit ${curto(sha)} não está pronto. Ou ainda está sendo gerado (espere e rode de novo), ou o commit ` +
    "não gerou preview: só o último commit de cada envio gera. Para publicar o último enviado, rode unbox publish sem commit.",
  "PREVIEW_PENDENTE",
);

const contateComCommit = (sha) => `fale com a Unbox informando o commit ${sha}`;

/** A falha de uma publicação que começou, pelo `operation.errorCode`. */
function falhaDaPublicacao(errorCode, sha) {
  if (errorCode === PRODUCTION_BUILD) {
    return new CliError(
      `O build de produção do commit ${curto(sha)} falhou, mesmo com o preview ok. Produção continua com o que estava no ar. ` +
        "Revise o que muda entre preview e produção (variáveis de ambiente, VERCEL_ENV, NEXT_PUBLIC_SITE_URL), corrija, " +
        "rode unbox deploy e publique de novo.",
      errorCode,
    );
  }
  if (errorCode === PRODUCTION_TIMEOUT) {
    return new CliError(
      `A publicação de ${curto(sha)} não terminou em 20 min na Unbox. Rode unbox publish ${curto(sha)} de novo; persistindo, ${contateComCommit(sha)}.`,
      errorCode,
    );
  }
  if (errorCode === DEPLOYMENT_INVALID) return commitInvalido(sha);
  return new CliError(
    `A publicação de ${curto(sha)} falhou (${errorCode ?? "sem código"}). Em geral produção continua com o que estava no ar ` +
      `(o --json mostra state e commitSha). Rode unbox publish ${curto(sha)} de novo; persistindo, ${contateComCommit(sha)}.`,
    errorCode ?? "PUBLICACAO_FALHOU",
  );
}

const commitInvalido = (sha) => new CliError(
  `O commit ${curto(sha)} não pode ser publicado nesta loja. Não repita: ${contateComCommit(sha)}.`,
  DEPLOYMENT_INVALID,
);

/** Os erros síncronos da mutation com resposta própria (o BUSY é tratado por quem chama). */
function erroDaMutation(e, sha) {
  if (e?.code === "MISSING_PERMISSION") {
    return new CliError(
      "A conta do UNBOX_USER não tem permissão de publicar em produção (é separada da de deploy). Peça a liberação à Unbox.",
      "MISSING_PERMISSION",
    );
  }
  const codigo = backendCode(e);
  if (codigo === DEPLOYMENT_NOT_READY) return previewPendente(sha);
  if (codigo === DEPLOYMENT_NOT_FOUND) {
    return new CliError(
      `O commit ${curto(sha)} não tem preview: o deploy falhou, ou o preview tem mais de 90 dias e foi removido. ` +
        "Crie um commit (git commit --allow-empty -m \"unbox: republica\"), rode unbox deploy e publique esse commit.",
      DEPLOYMENT_NOT_FOUND,
    );
  }
  if (codigo === DEPLOYMENT_INVALID) return commitInvalido(sha);
  return storefrontUnavailable(e) ?? e;
}

/**
 * O commit no git local: fetch da deploy da Unbox e o hash procurado nela. Devolve `{ st, sha, eTopo }`.
 * Só lê: não importa a branch atual nem o estado da árvore. O repoState lido fica em `lido.st` também
 * quando algo depois dele falha: o fallback do hash completo ainda confere a loja com ele.
 */
function commitLocal(dir, prefixo, out, lido) {
  requireProgram("git");
  const st = repoState(dir);
  lido.st = st;
  const keyPath = st.isRepo && !st.insideOtherRepo ? savedKeyPath(dir) : undefined;
  const problema = publishProblem(st, keyPath);
  if (problema) throw problema;
  assertKnownGitUrl(st.unboxRemoteUrl);
  fetchDeploy(dir, gitSshCommand(keyPath, writeKnownHosts()));
  const { sha, topo } = resolveCommit(dir, prefixo);

  if (!prefixo) {
    const pendentes = [];
    const n = aheadCount(dir);
    if (n) pendentes.push(`a deploy local tem ${n} commit${n > 1 ? "s" : ""} ainda não enviado${n > 1 ? "s" : ""}`);
    if (st.branch === "deploy" && dirtyTree(dir)) pendentes.push("há mudanças não commitadas");
    if (pendentes.length) {
      out.warn(
        `  Aviso: ${pendentes.join(" e ")}. O que vai ao ar é o último enviado (${curto(topo)}); para incluir o resto, rode unbox deploy antes.`,
      );
    }
  }
  return { st, sha, eTopo: sha === topo };
}

/** O commit está no ar, ou já está sendo publicado? */
function situacao(view, sha) {
  const op = view?.operation;
  if (op?.state === "PENDING" && op.type === "PUBLISH" && op.commitSha?.toLowerCase() === sha) return "EM_ANDAMENTO";
  if (view?.state === "PUBLISHED" && view.commitSha?.toLowerCase() === sha) return "NO_AR";
  return undefined;
}

async function lerPreview(api, sha) {
  try {
    return (await api.request(PREVIEW, { commitSha: sha })).customStorefrontDeployment;
  } catch (e) {
    throw storefrontUnavailable(e) ?? e;
  }
}

function textoConfirmacao({ view, sha, assunto, preview }) {
  const linhas = [
    `  No ar:     ${describeLive(view)}`,
    `  Publicar:  ${curto(sha)}${assunto ? `  ${assunto}` : ""}`,
  ];
  if (preview?.url) linhas.push(`  Preview:   ${preview.url}`);
  if (view?.url) linhas.push(`  Produção:  ${view.url}`);
  if (view?.operation?.state === "PENDING") linhas.push(`  Em andamento: ${describeOperation(view.operation)}`);
  linhas.push("  A Unbox refaz o build com a configuração de produção: preview ok não garante produção ok.");
  return linhas.join("\n");
}

async function confirma(ctx, { yes, naoInterativo, out }) {
  if (yes) return;
  if (naoInterativo) {
    throw new CliError("Publicar em produção pede confirmação. Para publicar sem perguntar, rode de novo com --yes.", "CONFIRMACAO_NECESSARIA");
  }
  out.warn(`\n${textoConfirmacao(ctx)}\n`);
  const { ok } = await prompts(
    { type: "confirm", name: "ok", message: "Publicar em produção?", initial: false, stdout: process.stderr },
    { onCancel: cancelado },
  );
  if (!ok) cancelado();
}

const textoPublicado = (v) => [
  "",
  "✓ Publicado em produção",
  "",
  `  Commit:    ${v.commitSha}`,
  ...(v.url ? [`  Produção:  ${v.url}`, "             o novo conteúdo pode levar até 1 min para aparecer"] : []),
  "",
].join("\n");

const textoJaNoAr = (v) => [
  "",
  `  O commit ${curto(v.commitSha)} já está no ar: nada a publicar.`,
  ...(v.url ? [`  Produção:  ${v.url}`] : []),
  "",
  "  Variáveis mudadas com unbox env só valem num build novo: crie um commit",
  "  (git commit --allow-empty -m \"unbox: aplica variáveis\"), rode unbox deploy e publique esse commit.",
  "",
].join("\n");

/**
 * `deps` existe para os testes: `createApi`, `sleep`, `now`, `limites` (do acompanhamento da
 * produção) e `limitesPreview` (da espera pelo preview).
 */
export async function runPublish(args, globals = {}, { out, interactive = process.stdin.isTTY, deps = {} } = {}) {
  if (globals.help) {
    process.stdout.write(help);
    return;
  }
  const { positional } = parseArgs(args, {});
  if (positional.length > 1) throw new UsageError(`Argumento inesperado: "${positional[1]}". Informe um commit só. Veja unbox publish --help.`);
  const prefixo = positional[0]?.trim();
  if (prefixo !== undefined && !HASH.test(prefixo)) {
    throw new UsageError(`"${prefixo}" não é um hash de commit. Informe o hash, curto (4 caracteres ou mais) ou completo, como o git log mostra.`);
  }

  const naoInterativo = Boolean(globals.json || !interactive);
  const dir = path.resolve(globals.dir ?? process.cwd());
  const sleep = deps.sleep ?? esperaPadrao;
  const now = deps.now ?? Date.now;

  // 1. Git local, só lendo.
  let local;
  const lido = {};
  try {
    local = commitLocal(dir, prefixo, out, lido);
  } catch (e) {
    if (!SEM_GIT_LOCAL.has(e?.code)) throw e;
    if (!prefixo || !COMPLETO.test(prefixo)) {
      throw new CliError(`${e.message}\nCom o hash completo do commit, dá para publicar sem isso.`, e.code);
    }
    // Só o motivo: a instrução que acompanha o erro ("Rode unbox provision.") não vale aqui.
    const motivo = e.message.split("\n")[0].replace(/\s+(Rode|Instale)\b.*$/, "").replace(/[.:]$/, "");
    out.warn(`  Aviso: ${motivo}, então não conferi o commit no git local; a Unbox confere.`);
    local = { st: lido.st, sha: prefixo.toLowerCase(), eTopo: false };
  }
  const { st, sha, eTopo } = local;

  // 2. Credenciais e login: a loja do login tem de ser a do projeto.
  const loaded = loadProjectEnv({ dir, envFile: globals["env-file"] ?? ".env.local" });
  const env = requireCredentials(loaded);
  out.progress(`  Credenciais: ${describeOrigins(loaded)}`);
  const api = await (deps.createApi ?? createPartnerApi)({ env, out });
  if (st?.savedShopId) {
    const outraLoja = otherShopError(st, await api.shopId());
    if (outraLoja) throw outraLoja;
  }

  // Daqui em diante, um erro leva junto (no --json) a última produção lida.
  const estado = { view: undefined };
  try {
    await publica({ api, sha, eTopo, st, dir, estado, out, sleep, now, deps, yes: Boolean(globals.yes), naoInterativo });
  } catch (e) {
    if (estado.view && e && typeof e === "object" && e.data === undefined) e.data = estado.view;
    throw e;
  }
}

async function publica({ api, sha, eTopo, st, dir, estado, out, sleep, now, deps, yes, naoInterativo }) {
  const acompanhaComo = { api, sha, estado, out, sleep, now, deps };

  // 3. Produção primeiro: um commit no ar (ou sendo publicado) não depende mais do preview.
  estado.view = await readProduction(api);
  let s = situacao(estado.view, sha);
  let preview;
  if (!s) {
    preview = await lerPreview(api, sha);
    if (preview?.state === "FAILURE") {
      throw new CliError(`O build de preview do commit ${curto(sha)} falhou. Corrija e rode unbox deploy.`, "PREVIEW_FALHOU");
    }
    if (preview?.state !== "SUCCESS") {
      if (!eTopo) throw previewPendente(sha);
      preview = await waitDeployment({
        api,
        commitSha: sha,
        out,
        sleep,
        now,
        ...(deps.limitesPreview && { limites: deps.limitesPreview }),
      });
      estado.view = await readProduction(api);
      s = situacao(estado.view, sha);
    }
  }

  if (s === "NO_AR") return jaNoAr(estado.view, out);
  if (s === "EM_ANDAMENTO") {
    out.progress(`  A publicação de ${curto(sha)} já está em andamento.`);
    return acompanha(estado.view, acompanhaComo, { adotada: true });
  }

  // 4. Confirmação.
  const assunto = st?.isRepo && !st.insideOtherRepo ? git(["log", "-1", "--format=%s", sha], { cwd: dir }).stdout.trim() : "";
  await confirma({ view: estado.view, sha, assunto, preview }, { yes, naoInterativo, out });

  // 5. A mutation. Repetir é seguro: idempotente por commit.
  out.progress(`  Publicando ${curto(sha)}`);
  let resp;
  let repetiuOcupada = false;
  for (let tentativa = 1; ; tentativa++) {
    try {
      resp = (await api.request(PUBLICAR, { input: { commitSha: sha } })).publishCustomStorefront;
      break;
    } catch (e) {
      const codigo = backendCode(e);
      if (codigo === PRODUCTION_BUSY) {
        const agora = await ocupada(acompanhaComo, { podeRepetir: !repetiuOcupada });
        if (agora !== "REPETIR") return agora;
        repetiuOcupada = true;
        continue;
      }
      const repetivel = codigo ? !TRATADOS.has(codigo) : !FATAIS.has(e?.code);
      if (tentativa === 1 && repetivel) {
        out.progress(`  A Unbox não confirmou o pedido (${codigo ?? e.code ?? e.message}); tentando de novo`);
        await sleep(ESPERA_REPETICAO);
        continue;
      }
      throw erroDaMutation(e, sha);
    }
  }
  estado.view = resp;
  if (situacao(resp, sha) === "NO_AR") return jaNoAr(resp, out);
  return acompanha(resp, acompanhaComo);
}

function jaNoAr(view, out) {
  out.result({ ...view, alreadyLive: true }, textoJaNoAr);
}

/**
 * BUSY: há uma operação em andamento. Se for a publicação deste mesmo commit (uma tentativa anterior
 * que chegou primeiro), é a sua: acompanha. Se a que bloqueava já terminou, devolve "REPETIR" (uma
 * vez: a confirmação já foi dada). Senão, diz qual é e como acompanhá-la.
 */
async function ocupada(ctx, { podeRepetir }) {
  const { api, sha, estado, out } = ctx;
  estado.view = await readProduction(api);
  const s = situacao(estado.view, sha);
  if (s === "EM_ANDAMENTO") return acompanha(estado.view, ctx, { adotada: true });
  // Antes da confirmação o commit não estava no ar: quem o pôs foi uma tentativa deste comando.
  if (s === "NO_AR") return out.result({ ...estado.view, alreadyLive: false }, textoPublicado);
  const op = estado.view?.operation;
  if (op?.state !== "PENDING" && podeRepetir) {
    out.progress("  A operação que ocupava produção já terminou; pedindo de novo");
    return "REPETIR";
  }
  const qual = op?.state === "PENDING" ? `: ${describeOperation(op)}` : "";
  const como = op?.state === "PENDING" && op.type === "PUBLISH" ? ` Para acompanhá-la, rode unbox publish ${curto(op.commitSha)}.` : "";
  throw new CliError(`Já há uma operação em andamento em produção${qual}. Espere terminar e rode de novo.${como}`, PRODUCTION_BUSY);
}

/**
 * Acompanha a publicação de `sha` que está em `view0.operation` até o fim, e reporta. O prazo pelo
 * `requestedAt` (do relógio do servidor) só vale para uma operação `adotada`, já em andamento antes
 * deste comando: na que ele acabou de pedir, um relógio local adiantado a daria por presa.
 */
async function acompanha(view0, { api, sha, estado, out, sleep, now, deps }, { adotada = false } = {}) {
  const pedido = view0.operation?.requestedAt;
  const isMine = (op) => op?.type === "PUBLISH" && op.commitSha?.toLowerCase() === sha && op.requestedAt === pedido;

  let view = view0;
  let fim = outcome(view0, isMine);
  if (!fim) {
    const limites = deps.limites;
    if (adotada && isStale(view0.operation, { now, ...(limites && { limites }) })) {
      throw new CliError(
        `A publicação de ${curto(sha)} está pendente desde ${quando(pedido)} e não andou. ` +
          `Não adianta esperar: ${contateComCommit(sha)}.`,
        "PUBLICACAO_PRESA",
      );
    }
    out.progress(
      `  Acompanhando a publicação de ${curto(sha)} (o build de produção costuma levar 1 a 2 min). ` +
        `Ctrl+C não cancela: ela segue na Unbox, e unbox publish ${curto(sha)} volta a acompanhar.`,
    );
    ({ view, outcome: fim } = await waitOperation({
      api,
      isMine,
      ...(adotada && { requestedAt: pedido }),
      rotulo: `A publicação de ${curto(sha)}`,
      out,
      sleep,
      now,
      ...(limites && { limites }),
    }));
    if (view) estado.view = view;
  }

  if (fim === "SUCCESS" || (fim === "SUBSTITUIDA" && situacao(view, sha) === "NO_AR")) {
    out.result({ ...view, alreadyLive: false }, textoPublicado);
    return;
  }
  if (fim === "FAILURE") throw falhaDaPublicacao(view.operation.errorCode, sha);
  if (fim === "TETO") {
    throw new CliError(`A publicação de ${curto(sha)} não terminou em 25 min e segue na Unbox; ${contateComCommit(sha)}.`, "PUBLICACAO_TIMEOUT");
  }
  throw new CliError(
    `Outra operação em produção começou antes de a publicação de ${curto(sha)} ser confirmada. No ar agora: ${describeLive(view)}. ` +
      `Se ainda precisar, rode unbox publish ${curto(sha)} de novo.`,
    "PUBLICACAO_SUBSTITUIDA",
  );
}
