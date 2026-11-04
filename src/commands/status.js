// `unbox status`: num comando só, o provisionamento da loja, o preview do commit atual, o que está
// em produção e o trabalho local que ainda não foi para a Unbox.
//
// Só lê. Na API, só consultas. No git, o único efeito é o `fetch` da deploy da Unbox, que atualiza
// `unbox/deploy` e nada mais: nem branch, nem índice, nem árvore. Fora de um projeto ligado à
// Unbox, mostra só a parte da API.
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "../args.js";
import { UsageError } from "../errors.js";
import { loadProjectEnv, requireCredentials, describeOrigins } from "../env.js";
import { createPartnerApi } from "../partner-api.js";
import { requireProgram } from "../proc.js";
import { gitSshCommand } from "../deploy-key.js";
import { assertKnownGitUrl, writeKnownHosts } from "../known-hosts.js";
import { fetchDeploy, git, repoState } from "../git.js";
import { dirtyTree, savedKeyPath } from "../push.js";
import { CAMPOS_PRODUCAO, curto, quando } from "../production.js";
import { PASSOS } from "../provisioning.js";
import { NON_RETRYABLE, backendCode, nonRetryableError } from "../storefront.js";

export const help = `
  unbox status: o estado da loja, do preview e da produção

  Uso:
    unbox status [--dir <pasta>] [--env-file <arquivo>] [--json]

  Mostra, sem alterar nada:
    1. o provisionamento da loja e o endereço fixo de preview;
    2. o preview do commit atual (na pasta de um projeto ligado à Unbox);
    3. o que está em produção, e a publicação ou o rollback em andamento;
    4. os commits ainda não enviados e as mudanças não commitadas.

  Fora da pasta de um projeto ligado à Unbox, mostra só a parte da API (as credenciais vêm do
  ambiente do terminal ou do --env-file).
  --json devolve { storefront, deployment, production, local, publishable }, e errors quando
  alguma consulta falhar.
`;

const LOJA = "query { customStorefront { _id status currentStep repositorySshUrl previewUrl lastErrorCode } }";
const DEPLOY = "query ($commitSha: String!) { customStorefrontDeployment(commitSha: $commitSha) { commitSha state url } }";
const PRODUCAO = `query { customStorefrontProduction { ${CAMPOS_PRODUCAO} } }`;

const saida = (args, dir) => {
  const r = git(args, { cwd: dir });
  return r.status === 0 ? r.stdout.trim() : undefined;
};

/** O projeto em `dir` está ligado à Unbox (o provision gravou loja e remote)? */
const ligado = (st) => st.isRepo && !st.insideOtherRepo && st.hasCommits && Boolean(st.savedShopId && st.unboxRemoteUrl);

/**
 * Traz a deploy da Unbox, para o "não enviado" ser contra o que ela tem agora. Sem a chave nesta
 * máquina, ou sem rede, compara com a última cópia local: um status não deixa de sair por isso.
 */
function atualizaDeploy(dir, st, out) {
  const keyPath = savedKeyPath(dir);
  try {
    if (!keyPath || !fs.existsSync(keyPath)) throw new Error(`a chave de deploy deste projeto não está nesta máquina${keyPath ? ` (${keyPath})` : ""}`);
    assertKnownGitUrl(st.unboxRemoteUrl);
    fetchDeploy(dir, gitSshCommand(keyPath, writeKnownHosts()));
  } catch (e) {
    out.warn(`  Aviso: não consegui buscar a deploy da Unbox (${e.message}). Comparando com a última cópia local dela.`);
  }
}

/** `{ branch, commitSha, ahead, dirty }` do projeto. `ahead` é null sem nenhuma cópia da deploy da Unbox. */
function estadoLocal(dir, st) {
  const temDeploy = git(["rev-parse", "--verify", "-q", "refs/remotes/unbox/deploy"], { cwd: dir }).status === 0;
  return {
    branch: st.branch ?? null,
    commitSha: saida(["rev-parse", "HEAD"], dir) ?? null,
    ahead: temDeploy ? Number(saida(["rev-list", "--count", "unbox/deploy..HEAD"], dir) ?? 0) : null,
    dirty: dirtyTree(dir),
  };
}

const SECAO = { storefront: "da loja", deployment: "do deploy", production: "da produção" };

const erroDaConsulta = (e) => ({ code: backendCode(e) ?? e?.code ?? "ERRO", message: String(e?.message ?? e) });

/** O commit atual já está na Unbox e o preview dele está pronto, mas não é o que está no ar. */
function publicavel({ deployment, production, local }) {
  return Boolean(
    deployment?.state === "SUCCESS"
      && local?.ahead === 0
      && production
      && production.operation?.state !== "PENDING"
      && production.commitSha !== local.commitSha,
  );
}

// ------------------------------------------------------------------------------------- texto

function linhasDaLoja(sf, erro) {
  const l = ["  Loja"];
  if (erro) return [...l, `    Não consegui ler o estado da loja (${erro.code}).`];
  if (!sf) return [...l, "    Ainda não provisionada. Próximo passo: unbox provision"];

  if (sf.status === "PROVISIONING") {
    const passo = sf.currentStep ? PASSOS[sf.currentStep] ?? sf.currentStep : "na fila";
    l.push(`    Provisionamento:  em andamento, ${passo}`);
    if (sf.lastErrorCode) l.push(`                      a última tentativa falhou com ${sf.lastErrorCode}; o servidor vai tentar de novo`);
    l.push("    Para acompanhar até o fim: unbox provision (rodar de novo é seguro)");
    return l;
  }
  if (sf.status === "FAILED") {
    l.push(`    Provisionamento:  falhou${sf.lastErrorCode ? ` (${sf.lastErrorCode})` : ""}`);
    if (sf.lastErrorCode && NON_RETRYABLE.has(sf.lastErrorCode)) l.push(`    ${nonRetryableError(sf).message}`);
    else l.push("    Rode unbox provision: ele retoma do passo que falhou.");
    return l;
  }
  l.push("    Provisionamento:  pronta");
  if (sf.repositorySshUrl) l.push(`    Repositório:      ${sf.repositorySshUrl}`);
  if (sf.previewUrl) {
    l.push(`    Preview fixo:     ${sf.previewUrl}`);
    l.push("                      mostra sempre o deploy mais recente que terminou com sucesso");
  }
  return l;
}

function linhasDoPreview(dep, erro, local) {
  const l = [`  Preview do commit atual (${curto(local.commitSha)})`];
  if (erro) return [...l, `    Não consegui ler o deploy deste commit (${erro.code}).`];
  // Commit que não foi enviado fica PENDING para sempre: "em andamento" seria mentira.
  if (local.ahead > 0 && dep?.state !== "SUCCESS" && dep?.state !== "FAILURE") {
    return [...l, "    Estado:  não enviado (rode unbox deploy)"];
  }
  if (dep?.state === "SUCCESS") return [...l, `    Estado:  pronto   ${dep.url ?? ""}`.trimEnd()];
  if (dep?.state === "FAILURE") return [...l, "    Estado:  o build falhou na Unbox. Corrija e rode unbox deploy (--build mostra o erro aqui)."];
  return [...l, "    Estado:  em andamento (na fila ou rodando)"];
}

function linhasDaOperacao(op) {
  if (!op || op.state === "SUCCESS") return [];
  const alvo = op.type === "ROLLBACK"
    ? `rollback para ${op.commitSha ? curto(op.commitSha) : "a página inicial"}`
    : `publicação de ${curto(op.commitSha)}`;
  if (op.state === "PENDING") return [`    Operação:  ${alvo} em andamento desde ${quando(op.requestedAt)}`];
  return [`    Operação:  ${alvo} falhou${op.errorCode ? ` (${op.errorCode})` : ""}${op.finishedAt ? ` em ${quando(op.finishedAt)}` : ""}; produção não mudou`];
}

function linhasDaProducao(p, erro) {
  const l = ["  Produção"];
  if (erro) return [...l, `    Não consegui ler o estado da produção (${erro.code}).`];
  if (!p) return [];

  if (p.state === "NOT_PUBLISHED") {
    l.push("    Estado:    ainda não publicada");
    if (p.url) l.push(`    Endereço:  ${p.url}  (mostra "Em breve" até o primeiro unbox publish)`);
  } else if (p.state === "PUBLISHED") {
    l.push(`    Estado:    publicada: commit ${curto(p.commitSha)}${p.publishedAt ? `, em ${quando(p.publishedAt)}` : ""}`);
    if (p.url) l.push(`    Endereço:  ${p.url}`);
  } else {
    l.push("    Estado:    alterada fora da Unbox (rollback indisponível)");
    if (p.url) l.push(`    Endereço:  ${p.url}`);
    if (p.operation?.state === "PENDING") {
      l.push("               durante uma publicação isto aparece por alguns segundos; consulte de novo");
    } else {
      l.push("               para voltar ao controle, publique um commit com unbox publish;");
      l.push("               se você não reconhece a alteração, fale com a Unbox");
    }
  }
  if (p.state !== "NOT_PUBLISHED") {
    if (p.canRollback) l.push(`    Rollback:  disponível (volta para ${p.rollbackCommitSha ? curto(p.rollbackCommitSha) : "a página inicial"})`);
    else if (p.state === "PUBLISHED") l.push("    Rollback:  indisponível agora");
  }
  return [...l, ...linhasDaOperacao(p.operation)];
}

function linhasLocais(local) {
  const l = [`  Local (branch ${local.branch ?? "nenhuma: HEAD destacado"})`];
  if (local.branch !== "deploy") l.push("    O deploy roda na branch deploy: git checkout deploy");
  const pendencias = [];
  if (local.ahead > 0) pendencias.push(`${local.ahead} ${local.ahead === 1 ? "commit não enviado" : "commits não enviados"}`);
  if (local.dirty) pendencias.push("alterações não commitadas");
  if (local.ahead === null) pendencias.push("sem cópia da deploy da Unbox para comparar");
  if (!pendencias.length) l.push("    em dia com a Unbox; sem alterações não commitadas");
  else {
    l.push(`    ${pendencias.join("; ")}`);
    if (local.ahead > 0 || local.dirty) l.push("    Para enviar: unbox deploy");
  }
  return l;
}

function texto(d) {
  const blocos = [linhasDaLoja(d.storefront, d.errors?.storefront)];
  const pronta = d.storefront?.status === "READY" || d.errors?.storefront;
  if (pronta && d.local?.commitSha && (d.deployment || d.errors?.deployment)) {
    blocos.push(linhasDoPreview(d.deployment, d.errors?.deployment, d.local));
  }
  if (pronta) blocos.push(linhasDaProducao(d.production, d.errors?.production));
  if (d.local) blocos.push(linhasLocais(d.local));
  const linhas = [""];
  for (const b of blocos.filter((x) => x.length)) linhas.push(...b, "");
  if (d.publishable) {
    const noAr = d.production.commitSha ? `${curto(d.local.commitSha)} ≠ ${curto(d.production.commitSha)} no ar` : `${curto(d.local.commitSha)}`;
    linhas.push(`  → Há preview pronto para unbox publish (${noAr}).`, "");
  }
  return linhas.join("\n");
}

// ---------------------------------------------------------------------------------- comando

/**
 * `deps` existe para os testes: `createApi`.
 */
export async function runStatus(args, globals = {}, { out, deps = {} } = {}) {
  if (globals.help) {
    process.stdout.write(help);
    return;
  }
  const { positional } = parseArgs(args, {});
  if (positional.length) throw new UsageError(`Argumento inesperado: "${positional[0]}". A pasta vai em --dir. Veja unbox status --help.`);
  const dir = path.resolve(globals.dir ?? process.cwd());

  // 1. Credenciais e git local, antes do login.
  const loaded = loadProjectEnv({ dir, envFile: globals["env-file"] ?? ".env.local" });
  const env = requireCredentials(loaded);
  out.progress(`  Credenciais: ${describeOrigins(loaded)}`);

  let st;
  let local = null;
  if (fs.existsSync(dir)) {
    requireProgram("git");
    st = repoState(dir);
    if (ligado(st)) {
      atualizaDeploy(dir, st, out);
      local = estadoLocal(dir, st);
    }
  }

  // 2. Login uma vez só, antes das consultas em paralelo.
  const api = await (deps.createApi ?? createPartnerApi)({ env, out });
  const shopId = await api.shopId();
  if (local && shopId && st.savedShopId !== shopId) {
    out.warn(`  Aviso: este projeto está ligado a outra loja (${st.savedShopId}), e o login é da loja ${shopId}. A parte local não é mostrada.`);
    local = null;
  }

  // 3. As três consultas em paralelo; a falha de uma não impede as outras.
  const consultas = {
    storefront: api.request(LOJA).then((r) => r.customStorefront ?? null),
    production: api.request(PRODUCAO).then((r) => r.customStorefrontProduction ?? null),
  };
  if (local?.commitSha) {
    consultas.deployment = api.request(DEPLOY, { commitSha: local.commitSha }).then((r) => r.customStorefrontDeployment ?? null);
  }
  const nomes = Object.keys(consultas);
  const resultados = await Promise.allSettled(Object.values(consultas));

  const data = { storefront: null, deployment: null, production: null, local };
  const errors = {};
  resultados.forEach((r, i) => {
    if (r.status === "fulfilled") data[nomes[i]] = r.value;
    else errors[nomes[i]] = r.reason;
  });
  if (nomes.every((n) => errors[n])) throw errors.storefront;

  // Loja que não está pronta: deploy e produção só responderiam NOT_READY.
  if (!errors.storefront && data.storefront?.status !== "READY") {
    data.deployment = null;
    data.production = null;
    delete errors.deployment;
    delete errors.production;
  }

  data.publishable = publicavel(data);
  if (Object.keys(errors).length) {
    data.errors = Object.fromEntries(Object.entries(errors).map(([n, e]) => [n, erroDaConsulta(e)]));
    for (const [n, e] of Object.entries(data.errors)) out.warn(`  Aviso: a consulta ${SECAO[n]} falhou (${e.code}): ${e.message}`);
  }
  out.result(data, texto);
}
