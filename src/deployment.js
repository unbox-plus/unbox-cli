// O acompanhamento do deploy de um commit enviado: `customStorefrontDeployment(commitSha)` até
// SUCCESS ou FAILURE.
//
// Só o último commit de cada push gera deploy, e cada push gera um preview com URL própria: quem
// chama consulta sempre o topo da deploy que acabou de enviar. PENDING cobre a fila, o build
// rodando e o commit que o runner ainda não pegou; um commit que não gerou deploy fica PENDING para
// sempre, e é por isso que há teto.
import { CliError } from "./errors.js";
import { NOT_CONFIGURED, NOT_READY, backendCode } from "./storefront.js";

const LER = "query ($commitSha: String!) { customStorefrontDeployment(commitSha: $commitSha) { commitSha state url } }";

export const LIMITES = {
  /** 2 s, mais 5 s e, daí, a cada 10 s. */
  esperasIniciais: [2000, 5000],
  intervalo: 10000,
  teto: 15 * 60 * 1000,
  /** Leituras seguidas que podem falhar antes de desistir (a doc da API manda tentar no próximo intervalo). */
  falhasDeLeitura: 6,
};

/** Erros em que ler de novo não muda nada: login, permissão, loja sem custom storefront. */
const FATAIS = new Set(["MISSING_PERMISSION", "SIGN_IN_FAILED", "API_KEY_RECUSADA"]);

const esperaPadrao = (ms) => new Promise((r) => setTimeout(r, ms));

const curto = (sha) => sha.slice(0, 7);

/**
 * Espera o deploy de `commitSha` terminar e devolve `{ commitSha, state, url }` com SUCCESS. FAILURE
 * e o teto em PENDING viram CliError. `sleep` e `now` existem para os testes.
 */
export async function waitDeployment({ api, commitSha, out, sleep = esperaPadrao, now = Date.now, limites = LIMITES }) {
  const inicio = now();
  let falhas = 0;
  let ultimoMinuto = -1;

  for (let i = 0; ; i++) {
    await sleep(limites.esperasIniciais[i] ?? limites.intervalo);

    let dep;
    try {
      dep = (await api.request(LER, { commitSha })).customStorefrontDeployment;
      falhas = 0;
    } catch (e) {
      const codigo = backendCode(e);
      if (codigo === NOT_READY) {
        throw new CliError("A loja não está provisionada na Unbox (ou o provisionamento não terminou). Rode unbox provision.", NOT_READY);
      }
      if (codigo === NOT_CONFIGURED) {
        throw new CliError("O deploy não está configurado neste ambiente da Unbox. Fale com a Unbox.", NOT_CONFIGURED);
      }
      if (FATAIS.has(e?.code)) throw e;
      if (++falhas >= limites.falhasDeLeitura) {
        throw new CliError(
          `O commit ${commitSha} foi enviado e o deploy segue na Unbox, mas não consegui acompanhá-lo (${e.message}). ` +
            "Se continuar assim, fale com a Unbox informando o commit.",
          e.code ?? "DEPLOY_CONSULTA_FALHOU",
        );
      }
      dep = undefined;
    }

    if (dep?.state === "SUCCESS") return { commitSha: dep.commitSha ?? commitSha, state: dep.state, url: dep.url ?? null };
    if (dep?.state === "FAILURE") {
      throw new CliError(
        `O build do commit ${curto(commitSha)} falhou na Unbox. Corrija e rode unbox deploy de novo ` +
          "(unbox deploy --build roda o build aqui antes do push e mostra o erro). " +
          "Build que passa aqui e falha na Unbox costuma ser variável de ambiente faltando na hospedagem.",
        "DEPLOY_FAILURE",
      );
    }

    const decorrido = now() - inicio;
    if (decorrido >= limites.teto) {
      throw new CliError(
        `O deploy do commit ${commitSha} não terminou em ${Math.round(limites.teto / 60000)} min. ` +
          "Fale com a Unbox informando o commit.",
        "DEPLOY_TIMEOUT",
      );
    }
    const minuto = Math.floor(decorrido / 60000);
    if (minuto !== ultimoMinuto) {
      out?.progress(minuto
        ? `  Deploy de ${curto(commitSha)} ainda em andamento (${minuto} min)`
        : `  Aguardando o deploy de ${curto(commitSha)} (na fila ou rodando)`);
      ultimoMinuto = minuto;
    }
  }
}
