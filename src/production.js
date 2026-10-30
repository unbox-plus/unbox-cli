// A produção da custom storefront: o que o endereço de produção exibe (`customStorefrontProduction`)
// e o acompanhamento de uma publicação ou rollback até sair de PENDING. Compartilhado pelos comandos
// que mexem em produção (publish, rollback) e pelo que só a mostra (status).
//
// A operação acompanhada é reconhecida por quem chama (`isMine`): tipo, commit e `requestedAt`. Se a
// última operação deixa de ser a sua, a sua já terminou e outra começou.
import { CliError } from "./errors.js";
import { NOT_CONFIGURED, NOT_READY, backendCode } from "./storefront.js";

export const CAMPOS_PRODUCAO =
  "state commitSha url publishedAt rollbackCommitSha canRollback operation { type state commitSha errorCode requestedAt finishedAt }";

const LER = `query { customStorefrontProduction { ${CAMPOS_PRODUCAO} } }`;

export const LIMITES = {
  esperaInicial: 5000,
  intervalo: 10000,
  /** A Unbox fecha a operação com TIMEOUT aos 20 min; com folga, a CLI para aos 25. */
  teto: 25 * 60 * 1000,
  /** Desvio tolerado entre o relógio local e o `requestedAt` do servidor. */
  folgaRelogio: 60 * 1000,
  /** Leituras seguidas que podem falhar antes de desistir. */
  falhasDeLeitura: 6,
};

/** Erros em que ler de novo não muda nada. */
const FATAIS = new Set(["MISSING_PERMISSION", "SIGN_IN_FAILED", "API_KEY_RECUSADA", NOT_READY, NOT_CONFIGURED]);

const esperaPadrao = (ms) => new Promise((r) => setTimeout(r, ms));

export const curto = (sha) => String(sha ?? "").slice(0, 7);

/** Data e hora em pt-BR ("28/10/2026, 14:03"), para as mensagens. */
export const quando = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

/** A loja sem custom storefront pronta, ou o serviço desligado no ambiente: CliError com o que fazer. */
export function storefrontUnavailable(err) {
  const codigo = backendCode(err);
  if (codigo === NOT_READY) {
    return new CliError("A loja não está provisionada na Unbox (ou o provisionamento não terminou). Rode unbox provision.", NOT_READY);
  }
  if (codigo === NOT_CONFIGURED) {
    return new CliError("A hospedagem das lojas não está configurada neste ambiente da Unbox. Fale com a Unbox.", NOT_CONFIGURED);
  }
  return undefined;
}

/** A view de produção da loja do login. */
export async function readProduction(api) {
  try {
    return (await api.request(LER)).customStorefrontProduction;
  } catch (e) {
    throw storefrontUnavailable(e) ?? e;
  }
}

/** "abc1234 (publicado em 28/10/2026 14:03)", "Em breve" ou "alterado fora da Unbox". */
export function describeLive(view) {
  if (view?.state === "PUBLISHED") {
    return view.publishedAt ? `${curto(view.commitSha)} (publicado em ${quando(view.publishedAt)})` : curto(view.commitSha);
  }
  if (view?.state === "UNKNOWN") return "alterado fora da Unbox (estado UNKNOWN)";
  return "a página \"Em breve\" (nada publicado ainda)";
}

/** "publicação de abc1234 desde 28/10/2026 14:03" ou "rollback para ... desde ...". */
export function describeOperation(op) {
  const alvo = op.type === "PUBLISH"
    ? `publicação de ${curto(op.commitSha)}`
    : `rollback para ${op.commitSha ? curto(op.commitSha) : "a página \"Em breve\""}`;
  return `${alvo} desde ${quando(op.requestedAt)}`;
}

/**
 * O desfecho da operação `isMine` na view: SUCCESS, FAILURE, SUBSTITUIDA (a última operação já é
 * outra) ou undefined, se ainda PENDING.
 */
export function outcome(view, isMine) {
  const op = view?.operation;
  if (!op || !isMine(op)) return "SUBSTITUIDA";
  return op.state === "PENDING" ? undefined : op.state;
}

/** Até quando vale acompanhar uma operação pedida em `requestedAt`. */
const prazoDoPedido = (requestedAt, limites) => {
  const pedido = Date.parse(requestedAt);
  return Number.isFinite(pedido) ? pedido + limites.teto + limites.folgaRelogio : Infinity;
};

/** A operação está PENDING há mais tempo do que a Unbox leva para fechá-la: não adianta esperar. */
export const isStale = (op, { now = Date.now, limites = LIMITES } = {}) => now() > prazoDoPedido(op?.requestedAt, limites);

/**
 * Consulta a produção até a operação `isMine` sair de PENDING. Devolve `{ view, outcome }`, com
 * `outcome` SUCCESS, FAILURE, SUBSTITUIDA ou TETO; neste, `view` é a última lida. O teto conta do
 * início do acompanhamento e, com `requestedAt` (só numa operação retomada, porque compara o relógio
 * local com o do servidor), também dele, o que vencer primeiro: retomar uma operação antiga não soma
 * mais 25 min. `rotulo` ("Publicação de abc1234") vai no progresso. `sleep` e `now` existem para
 * os testes.
 */
export async function waitOperation({ api, isMine, requestedAt, rotulo, out, sleep = esperaPadrao, now = Date.now, limites = LIMITES }) {
  const inicio = now();
  const limite = Math.min(inicio + limites.teto, prazoDoPedido(requestedAt, limites));
  let falhas = 0;
  let ultima;
  let ultimoMinuto = 0;

  for (let i = 0; ; i++) {
    await sleep(i === 0 ? limites.esperaInicial : limites.intervalo);

    try {
      ultima = await readProduction(api);
      falhas = 0;
      const fim = outcome(ultima, isMine);
      if (fim) return { view: ultima, outcome: fim };
    } catch (e) {
      if (FATAIS.has(e?.code)) throw e;
      if (++falhas >= limites.falhasDeLeitura) {
        throw new CliError(`${rotulo} segue na Unbox, mas não consegui acompanhá-la (${e.message}).`, e.code ?? "PRODUCAO_CONSULTA_FALHOU");
      }
    }

    const decorrido = now() - inicio;
    if (now() >= limite) return { view: ultima, outcome: "TETO" };
    const minuto = Math.floor(decorrido / 60000);
    if (minuto > ultimoMinuto) {
      out?.progress(`  ${rotulo} ainda em andamento (${minuto} min)`);
      ultimoMinuto = minuto;
    }
  }
}
