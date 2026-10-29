// `unbox rollback`: volta produção para a publicação anterior (na ordem de publicação), ou para a
// página "Em breve" quando a do ar é a primeira. Sem build novo: a troca é imediata.
//
// A mutation NÃO é idempotente: cada chamada volta mais uma publicação. Por isso ela é chamada uma
// vez só, em qualquer caminho. Quando a resposta se perde, quem decide se o rollback foi aplicado é
// a produção: uma operação ROLLBACK com `requestedAt` diferente do lido antes de pedir (nunca o
// relógio local).
import path from "node:path";
import prompts from "prompts";
import { parseArgs } from "../args.js";
import { CliError, UsageError } from "../errors.js";
import { loadProjectEnv, requireCredentials, describeOrigins } from "../env.js";
import { createPartnerApi } from "../partner-api.js";
import { requireProgram } from "../proc.js";
import { git, otherShopError, repoState } from "../git.js";
import {
  CAMPOS_PRODUCAO, LIMITES, ROLLBACK_TTL, curto, describeLive, describeOperation, describeTarget, isStale, liveCommit, quando,
  readProduction, storefrontUnavailable, waitOperation,
} from "../production.js";
import { NOTHING_TO_ROLLBACK, PRODUCTION_BUSY, ROLLBACK_TARGET_UNAVAILABLE, backendCode } from "../storefront.js";

export const help = `
  unbox rollback: volta produção para a publicação anterior

  Uso:
    unbox rollback [--dir <pasta>] [--env-file <arquivo>] [--yes] [--json]

  Volta para a publicação feita antes da que está no ar (na ordem em que foram publicadas), ou
  para a página "Em breve" quando a do ar é a primeira. Não há build novo: a troca é imediata.
    1. mostra o que está no ar e para onde volta, e pede confirmação (--yes pula);
    2. pede o rollback à Unbox uma vez só: cada rollback volta mais uma publicação, então o
       comando nunca repete o pedido sozinho, nem quando a resposta se perde.
  Para pôr um commit específico no ar, use unbox publish <commit>.
  --json devolve a produção ({ state, commitSha, url, publishedAt, rollbackCommitSha, canRollback,
  operation }); numa falha depois de ler a produção, ela vem em data.
`;

const ROLLBACK = `mutation { rollbackCustomStorefront { ${CAMPOS_PRODUCAO} } }`;

/** O SDK desiste em 15 s; o rollback faz quatro chamadas à hospedagem e não pode ser repetido. */
const PRAZO_DA_MUTATION = 60 * 1000;

export const LIMITES_ROLLBACK = {
  /** Leituras da produção depois de um erro com resposta do servidor. */
  consultas: 3,
  esperaConsulta: 3000,
  /** Sem resposta (timeout, 5xx, conexão caída), o pedido pode estar em voo: procura por até 90 s. */
  janelaEmVoo: 90 * 1000,
  intervaloEmVoo: 10 * 1000,
  /** Acompanhamento de um rollback PENDING (síncrono na Unbox: só fica assim se a troca caiu). */
  pendente: { ...LIMITES, teto: 90 * 1000 },
};

const SHA = /^[0-9a-f]{7,64}$/i;

/** Falhas de rede em que o pedido nem saiu da máquina. */
const NAO_SAIU = /ENOTFOUND|ECONNREFUSED|EAI_AGAIN/;
/** Sessão recusada pelo gateway: o pedido não chegou ao resolver. */
const SESSAO_RECUSADA = /No authenticated user/i;

/** Recusas em que nada chegou ao rollback: não há o que consultar. */
const RECUSAS = new Set(["MISSING_PERMISSION", "SIGN_IN_FAILED", "API_KEY_RECUSADA"]);

const esperaPadrao = (ms) => new Promise((r) => setTimeout(r, ms));

const SEM_YES = "rode unbox rollback sem --yes: ele mostra o que está no ar e o destino antes de confirmar";

/** O que está no ar, sem o "nada publicado ainda": depois de um rollback, já houve publicações. */
const noAr = (view) => (view?.state === "NOT_PUBLISHED" ? "a página \"Em breve\"" : describeLive(view));

/** O destino de uma operação de rollback: o commit (minúsculas) ou null para a página "Em breve". */
const alvoDe = (op) => (op?.commitSha ? op.commitSha.toLowerCase() : null);

const cancelado = () => {
  throw new CliError("Cancelado. Nada mudou em produção.", "CANCELADO");
};

/**
 * O desfecho do rollback pela produção. `guardado` é o `operation.requestedAt` lido antes de pedir.
 * SUCESSO, PENDENTE, FALHOU (um ROLLBACK novo nesses estados), OUTRA (uma operação nova que não é
 * rollback) ou NAO_APLICADO (nenhuma operação nova).
 */
export function decide(view, guardado) {
  const op = view?.operation;
  if (!op || op.requestedAt === guardado) return "NAO_APLICADO";
  if (op.type !== "ROLLBACK") return "OUTRA";
  if (op.state === "PENDING") return "PENDENTE";
  return op.state === "SUCCESS" ? "SUCESSO" : "FALHOU";
}

/** A pasta é um repositório git próprio? Só para conferir a loja e ler o assunto do commit. */
function projetoLido(dir) {
  try {
    requireProgram("git");
    const st = repoState(dir);
    return st.isRepo && !st.insideOtherRepo ? st : undefined;
  } catch {
    return undefined;
  }
}

function assunto(st, sha) {
  if (!st || !sha || !SHA.test(sha)) return "";
  try {
    const r = git(["log", "-1", "--format=%s", sha, "--"], { cwd: st.dir });
    return r.status === 0 ? r.stdout.trim() : "";
  } catch {
    return "";
  }
}

const ocupadaPor = (op) => {
  const como = op.type === "PUBLISH"
    ? ` Para acompanhá-la, rode unbox publish ${curto(op.commitSha)}.`
    : " Ela pode já ser o rollback que você quer.";
  return new CliError(
    `Já há uma operação em andamento em produção: ${describeOperation(op)}. Nada foi feito.${como} ` +
      `Quando ela terminar, ${SEM_YES} (o destino pode ter mudado).`,
    PRODUCTION_BUSY,
  );
};

/** Por que não há rollback agora, com `canRollback: false`. */
function semRollback(view, now) {
  const op = view.operation;
  if (op?.state === "PENDING") {
    if (op.type === "ROLLBACK" && isStale(op, { now, limites: { teto: ROLLBACK_TTL, folgaRelogio: LIMITES.folgaRelogio } })) {
      return new CliError(
        `Um rollback pedido em ${quando(op.requestedAt)} foi interrompido na Unbox, e ela ainda não libera outro. ` +
          `No ar agora: ${noAr(view)}. Para pôr outro commit no ar, use unbox publish <commit>; persistindo, fale com a Unbox.`,
        "ROLLBACK_INTERROMPIDO",
      );
    }
    return ocupadaPor(op);
  }
  if (view.state === "NOT_PUBLISHED") {
    return new CliError("Produção mostra a página \"Em breve\": não há publicação a desfazer.", NOTHING_TO_ROLLBACK);
  }
  if (view.state === "UNKNOWN") {
    return new CliError(
      "Produção foi alterada fora da Unbox, e o rollback fica indisponível. Para voltar ao controle, publique um commit com unbox publish <commit>.",
      NOTHING_TO_ROLLBACK,
    );
  }
  return new CliError(
    `${curto(view.commitSha)} é a publicação mais antiga que a Unbox guarda: não há para onde voltar. ` +
      "Para pôr outro commit no ar, use unbox publish <commit>.",
    NOTHING_TO_ROLLBACK,
  );
}

function textoConfirmacao(view, st) {
  const alvo = view.rollbackCommitSha;
  const sobre = assunto(st, alvo);
  const linhas = [
    `  No ar:        ${describeLive(view)}`,
    `  Volta para:   ${describeTarget(alvo)}${sobre ? `  ${sobre}` : ""}`,
  ];
  if (view.url) linhas.push(`  Produção:     ${view.url}`);
  if (view.operation?.state === "PENDING") linhas.push(`  Interrompida antes: ${describeOperation(view.operation)}`);
  linhas.push("  Sem build novo: a troca é imediata.");
  return linhas.join("\n");
}

async function confirma(view, st, { yes, naoInterativo, out }) {
  if (yes) return false;
  if (naoInterativo) {
    throw new CliError("O rollback pede confirmação. Para voltar sem perguntar, rode de novo com --yes.", "CONFIRMACAO_NECESSARIA");
  }
  out.warn(`\n${textoConfirmacao(view, st)}\n`);
  const { ok } = await prompts(
    { type: "confirm", name: "ok", message: "Voltar produção?", initial: false, stdout: process.stderr },
    { onCancel: cancelado },
  );
  if (!ok) cancelado();
  return true;
}

/** Os campos que decidem o que o rollback faria: se mudaram durante a confirmação, ela não vale mais. */
const assinatura = (v) => JSON.stringify([
  v?.state, v?.commitSha, v?.canRollback, v?.rollbackCommitSha, v?.operation?.requestedAt, v?.operation?.state,
]);

const textoFeito = (antes) => (v) => [
  "",
  "✓ Rollback feito",
  "",
  `  No ar:      ${noAr(v)}`,
  `  Antes:      ${describeLive(antes)}`,
  ...(v.url ? [`  Produção:   ${v.url}`, "              a troca pode levar alguns segundos para aparecer"] : []),
  "",
].join("\n");

/**
 * `deps` existe para os testes: `createApi`, `sleep`, `now` e `limites` (ver LIMITES_ROLLBACK).
 */
export async function runRollback(args, globals = {}, { out, interactive = process.stdin.isTTY, deps = {} } = {}) {
  if (globals.help) {
    process.stdout.write(help);
    return;
  }
  const { positional } = parseArgs(args, {});
  if (positional.length) {
    throw new UsageError(
      `Argumento inesperado: "${positional[0]}". O rollback não recebe argumentos; para pôr um commit específico no ar, use unbox publish <commit>.`,
    );
  }

  const naoInterativo = Boolean(globals.json || !interactive);
  const dir = path.resolve(globals.dir ?? process.cwd());
  const st = projetoLido(dir);

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
  const ctx = {
    api,
    st,
    out,
    estado,
    sleep: deps.sleep ?? esperaPadrao,
    now: deps.now ?? Date.now,
    limites: { ...LIMITES_ROLLBACK, ...deps.limites },
  };
  try {
    await volta(ctx, { yes: Boolean(globals.yes), naoInterativo });
  } catch (e) {
    if (estado.view && e && typeof e === "object" && e.data === undefined) e.data = estado.view;
    throw e;
  }
}

async function volta(ctx, { yes, naoInterativo }) {
  const { api, st, out, estado, now } = ctx;

  // 1. O que está no ar e para onde volta.
  let antes = await readProduction(api);
  estado.view = antes;
  if (!antes.canRollback) throw semRollback(antes, now);

  // 2. Confirmação. Se ela ficou aberta, produção pode ter mudado no meio: a pessoa confirmou o
  // destino que viu, e a API volta a partir do que estiver no ar na hora.
  if (await confirma(antes, st, { yes, naoInterativo, out })) {
    const agora = await readProduction(api);
    estado.view = agora;
    if (assinatura(agora) !== assinatura(antes)) {
      throw new CliError(
        `Produção mudou enquanto a confirmação estava aberta (no ar agora: ${noAr(agora)}). Nada foi feito; rode unbox rollback de novo.`,
        "PRODUCAO_MUDOU",
      );
    }
    antes = agora;
  }
  const pedido = { antes, guardado: antes.operation?.requestedAt, alvo: antes.rollbackCommitSha?.toLowerCase() ?? null };

  // 3. A mutation, uma vez.
  out.progress(`  Voltando produção para ${describeTarget(pedido.alvo)}`);
  let resp;
  try {
    resp = (await api.requestOnce(ROLLBACK, {}, { timeoutMs: PRAZO_DA_MUTATION })).rollbackCustomStorefront;
  } catch (e) {
    return erroDaMutation(e, ctx, pedido);
  }
  // Sem dado e sem erro: não dá para saber se o resolver terminou. Como resposta perdida.
  if (!resp) return erroDaMutation(Object.assign(new Error("resposta vazia da Unbox"), { code: "RESPOSTA_VAZIA" }), ctx, pedido);
  estado.view = resp;

  // Resposta sem erro: a troca foi feita. Se a operação não é a deste pedido, a Unbox montou a
  // resposta com a produção lida antes de tomar o lock, e outra operação já a substituiu.
  const desfecho = decide(resp, pedido.guardado);
  if (desfecho === "PENDENTE" || desfecho === "FALHOU") return reporta(desfecho, resp, ctx, pedido);
  if (desfecho !== "SUCESSO") out.warn("  Aviso: outra operação começou em produção logo depois do rollback.");
  return feito(resp, ctx, pedido);
}

/** Lê a produção com algumas tentativas; undefined se todas falharem. */
async function releProducao({ api, sleep, limites, estado }, tentativas = limites.consultas) {
  for (let i = 0; i < tentativas; i++) {
    if (i) await sleep(limites.esperaConsulta);
    try {
      estado.view = await readProduction(api);
      return estado.view;
    } catch {
      // segue tentando: ler não muda nada
    }
  }
  return undefined;
}

async function erroDaMutation(e, ctx, pedido) {
  const { out } = ctx;
  if (RECUSAS.has(e?.code)) {
    if (e.code === "MISSING_PERMISSION") {
      throw new CliError(
        "A conta do UNBOX_USER não tem permissão de publicar em produção (o rollback usa a mesma). Peça a liberação à Unbox.",
        "MISSING_PERMISSION",
      );
    }
    throw e;
  }
  const indisponivel = storefrontUnavailable(e);
  if (indisponivel) throw indisponivel;

  const codigo = backendCode(e);
  if (codigo === NOTHING_TO_ROLLBACK) {
    const view = await releProducao(ctx, 1);
    throw new CliError(
      `Não há para onde voltar agora: produção mudou desde a leitura.${view ? ` No ar: ${noAr(view)}.` : ""}`,
      NOTHING_TO_ROLLBACK,
    );
  }
  if (codigo === PRODUCTION_BUSY) {
    const view = await releProducao(ctx, 1);
    if (view?.operation?.state === "PENDING") throw ocupadaPor(view.operation);
    if (view) {
      throw new CliError(
        `A operação que ocupava produção terminou, e o destino do rollback pode ter mudado. No ar agora: ${noAr(view)}. ` +
          `Nada foi feito; ${SEM_YES}.`,
        PRODUCTION_BUSY,
      );
    }
    throw new CliError(`Já há uma operação em andamento em produção. Nada foi feito; espere terminar e ${SEM_YES}.`, PRODUCTION_BUSY);
  }
  if (codigo === ROLLBACK_TARGET_UNAVAILABLE) {
    const view = await releProducao(ctx, 1);
    const minha = view && decide(view, pedido.guardado) === "FALHOU";
    throw destinoIndisponivel(minha ? alvoDe(view.operation) : pedido.alvo, view);
  }

  // Só um código do backend prova que o resolver terminou; sem ele (timeout, 5xx, conexão caída no
  // meio, timeout do gateway, resposta vazia), o pedido pode estar em voo, com o servidor ainda
  // trabalhando. Sem o pedido ter saído, ou com o resolver terminado, uma leitura decide.
  const naoSaiu = (e?.code === "NETWORK" && NAO_SAIU.test(e.message ?? "")) || SESSAO_RECUSADA.test(e?.message ?? "");
  const emVoo = !naoSaiu && !codigo;
  const motivo = codigo ?? e?.code ?? e?.message ?? "sem detalhe";
  out.progress(`  A Unbox não confirmou o rollback (${motivo}); conferindo a produção, sem pedir de novo`);

  let view;
  let desfecho = "NAO_APLICADO";
  if (emVoo) {
    const { now, sleep, limites } = ctx;
    const ate = now() + limites.janelaEmVoo;
    for (let i = 0; ; i++) {
      if (i) await sleep(limites.intervaloEmVoo);
      view = (await releProducao(ctx, 1)) ?? view;
      if (view) desfecho = decide(view, pedido.guardado);
      if (desfecho !== "NAO_APLICADO" || now() >= ate) break;
    }
    if (desfecho === "NAO_APLICADO") throw incerto(motivo, view);
  } else {
    view = await releProducao(ctx);
    if (!view) throw incerto(motivo, view);
    desfecho = decide(view, pedido.guardado);
  }

  if (desfecho === "NAO_APLICADO") {
    throw new CliError(
      `O rollback não foi aplicado (${motivo}). No ar segue ${noAr(view)}. Para tentar de novo, ${SEM_YES}.`,
      e?.code ?? codigo ?? "ROLLBACK_FALHOU",
    );
  }
  if (desfecho === "SUCESSO") out.progress("  A resposta não chegou, mas o rollback foi aplicado");
  return reporta(desfecho, view, ctx, pedido);
}

const incerto = (motivo, view) => new CliError(
  `Não sei se o rollback foi aplicado (${motivo}).${view ? ` No ar agora: ${noAr(view)}.` : ""} ` +
    `Não repita às cegas: ${SEM_YES}.`,
  "ROLLBACK_INCERTO",
);

function destinoIndisponivel(alvo, view) {
  const segue = view ? ` Produção segue com ${noAr(view)}.` : "";
  if (!alvo) {
    return new CliError(
      `A página "Em breve" não está mais disponível na hospedagem.${segue} Fale com a Unbox.`,
      ROLLBACK_TARGET_UNAVAILABLE,
    );
  }
  return new CliError(
    `A publicação de destino (${curto(alvo)}) não existe mais na hospedagem.${segue} Para pôr esse commit no ar, rode ` +
      `unbox publish ${curto(alvo)} (se o preview tiver mais de 90 dias, crie um commit novo, rode unbox deploy e publique-o).`,
    ROLLBACK_TARGET_UNAVAILABLE,
  );
}

/** SUCESSO, PENDENTE, FALHOU ou OUTRA de um ROLLBACK que se sabe ser o deste pedido (ou o único novo). */
async function reporta(desfecho, view, ctx, pedido) {
  const { api, out, estado, sleep, now, limites } = ctx;
  if (desfecho === "SUCESSO") return feito(view, ctx, pedido);
  if (desfecho === "OUTRA") {
    throw new CliError(
      `Outra operação começou em produção${view.operation ? ` (${describeOperation(view.operation)})` : ""} e não dá para saber ` +
        "se o rollback foi aplicado. " +
        `No ar agora: ${noAr(view)}. Confira antes de repetir: ${SEM_YES}.`,
      "ROLLBACK_SUBSTITUIDO",
    );
  }

  const op = view.operation;
  const alvo = alvoDe(op);
  let atual = view;
  let fim = desfecho === "FALHOU" ? "FAILURE" : undefined;
  if (desfecho === "PENDENTE") {
    out.progress("  O rollback ainda não terminou na Unbox; conferindo a produção por até 1 min e meio, sem pedir de novo");
    const r = await waitOperation({
      api,
      isMine: (o) => o?.type === "ROLLBACK" && o.requestedAt === op.requestedAt,
      rotulo: `O rollback para ${describeTarget(alvo)}`,
      out,
      sleep,
      now,
      limites: limites.pendente,
    }).catch((e) => {
      // Sem conseguir ler, o rollback pode estar em curso: nunca devolver um código "passageiro".
      throw incerto(e?.code ?? e?.message ?? "leitura falhou", estado.view);
    });
    if (r.view) {
      atual = r.view;
      estado.view = atual;
    }
    if (r.outcome === "SUCCESS") return feito(atual, ctx, pedido);
    fim = r.outcome;
  }

  // A operação não fechou como SUCCESS, mas o que conta é o que está no ar.
  const live = liveCommit(atual);
  if (live === alvo) {
    out.warn(
      `  Aviso: a Unbox registrou o rollback como ${fim === "FAILURE" ? "falho" : "não concluído"}, mas ${describeTarget(alvo)} ` +
        "está no ar. Não rode de novo: ele voltaria mais uma publicação.",
    );
    return feito(atual, ctx, pedido);
  }
  if (fim === "SUBSTITUIDA") return reporta("OUTRA", atual, ctx, pedido);
  if (fim === "FAILURE" && atual.operation?.errorCode === ROLLBACK_TARGET_UNAVAILABLE) throw destinoIndisponivel(alvo, atual);
  // Nem o destino nem o que estava antes: não dá para dizer o que aconteceu.
  if (live !== liveCommit(pedido.antes)) {
    throw incerto(fim === "FAILURE" ? atual.operation?.errorCode ?? "falha sem código" : "a troca ficou pendente", atual);
  }
  if (fim === "FAILURE") {
    const codigo = atual.operation?.errorCode ?? "ROLLBACK_FALHOU";
    throw new CliError(
      `O rollback falhou na Unbox (${codigo}). No ar segue ${noAr(atual)}. Para tentar de novo, ${SEM_YES}; persistindo, fale com a Unbox.`,
      codigo,
    );
  }
  throw new CliError(
    `O rollback para ${describeTarget(alvo)} segue pendente na Unbox depois de 1 min e meio e ainda não está no ar ` +
      `(no ar: ${noAr(atual)}); pode ainda ser aplicado. Não repeti. Confira antes de qualquer coisa: ${SEM_YES} ` +
      "(se a Unbox ainda não liberou outro rollback, ele diz).",
    "ROLLBACK_INCERTO",
  );
}

function feito(view, { out }, pedido) {
  const op = view.operation;
  const minha = decide(view, pedido.guardado) === "SUCESSO";
  if (minha && alvoDe(op) !== pedido.alvo) {
    out.warn(
      `  Aviso: produção mudou entre a leitura e o rollback: voltou para ${describeTarget(alvoDe(op))}, e não para ${describeTarget(pedido.alvo)}.`,
    );
  }
  if (minha && liveCommit(view) !== alvoDe(op)) {
    out.warn(`  A Unbox registrou a volta para ${describeTarget(alvoDe(op))}; o endereço pode levar alguns segundos para mostrá-la.`);
  }
  out.result(view, textoFeito(pedido.antes));
}
