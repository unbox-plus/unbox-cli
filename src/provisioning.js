// O provisionamento da custom storefront na Partners API: chama `provisionCustomStorefront` e
// acompanha `customStorefront` até READY, decidindo quando chamar de novo e quando desistir.
//
// Linha do tempo do backend, que define os prazos daqui: o job faz 4 tentativas com backoff
// exponencial do Bull ((2^n - 1) x 60 s: espera 1, 3 e 7 min). Uma rodada que falha leva ~12 min
// até FAILED. Chamar de novo em PROVISIONING só tem efeito se o job tiver sumido (com ele vivo, o
// enfileiramento com o mesmo id não faz nada). A chave só pode ser trocada com a loja em FAILED.
import { CliError } from "./errors.js";
import {
  ALREADY_PROVISIONED,
  DEPLOY_KEY_IN_USE,
  INVALID_DEPLOY_PUBLIC_KEY,
  NON_RETRYABLE,
  NOT_CONFIGURED,
  backendCode,
  describeStorefront,
  nonRetryableError,
} from "./storefront.js";

const CAMPOS = "_id status currentStep repositorySshUrl lastErrorCode";
const LER = `query { customStorefront { ${CAMPOS} } }`;
const PROVISIONAR = `mutation ($input: ProvisionCustomStorefrontInput!) { provisionCustomStorefront(input: $input) { ${CAMPOS} } }`;

export const LIMITES = {
  esperasIniciais: [1000, 2000],
  intervalo: 5000,
  /** Sem sair de PROVISIONING por este tempo desde a última chamada: chama de novo (job perdido). */
  chamarDeNovoApos: 10 * 60 * 1000,
  /** Teto desde o início: cabe uma rodada com falha (~12 min) e a nova chamada. */
  teto: 30 * 60 * 1000,
  /** Leituras seguidas que podem falhar por rede antes de desistir. */
  falhasDeLeitura: 3,
};

const PASSOS = {
  HOSTING_PROJECT: "criando o projeto de hospedagem",
  HOSTING_PRODUCTION_PLACEHOLDER: "publicando a página inicial de produção",
  HOSTING_PROJECT_SETTINGS: "configurando a hospedagem e o endereço da loja",
  GIT_REPOSITORY: "criando o repositório",
  DEPLOY_CREDENTIALS: "criando as credenciais de deploy",
  REPOSITORY_SETTINGS: "ajustando o repositório",
  DEPLOY_WORKFLOW: "gravando o workflow de deploy",
  PROTECTIONS: "aplicando as proteções da branch deploy",
  DEPLOY_KEY: "registrando a chave de deploy",
};

const transitorio = (e) => ["NETWORK", "TIMEOUT"].includes(e?.code) || /^HTTP_5\d\d$/.test(e?.code ?? "");

const esperaPadrao = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Provisiona e espera READY. `key` é `{ keyPath, pubPath, publicKey }`; `rotate()` troca a chave e
 * devolve a nova. Devolve `{ storefront, key }` (a chave pode ter mudado). `sleep` e `now` existem
 * para os testes.
 */
export async function provisionAndWait({ api, key, rotate, out, sleep = esperaPadrao, now = Date.now, limites = LIMITES }) {
  const inicio = now();
  let atual = key;
  let girou = false;
  let repetiuFalha = false;
  let chamouDeNovo = false;
  let ultimaChamada = inicio;
  let ultimoAviso = "";

  const avisa = (msg) => {
    if (msg !== ultimoAviso) out?.progress(msg);
    ultimoAviso = msg;
  };

  async function ler() {
    for (let falhas = 0; ; falhas++) {
      try {
        return (await api.request(LER)).customStorefront;
      } catch (e) {
        if (!transitorio(e) || falhas + 1 >= limites.falhasDeLeitura) {
          if (transitorio(e)) {
            throw new CliError(
              `Perdi o contato com a Unbox no meio do provisionamento (${e.message}). Ele continua no servidor: rode o comando de novo, é seguro.`,
              e.code,
            );
          }
          throw e;
        }
        await sleep(limites.intervalo);
      }
    }
  }

  async function chamar() {
    ultimaChamada = now();
    for (let tentativa = 0; ; tentativa++) {
      try {
        return (await api.request(PROVISIONAR, { input: { deployPublicKey: atual.publicKey } })).provisionCustomStorefront;
      } catch (e) {
        const codigo = backendCode(e);
        if (codigo === ALREADY_PROVISIONED) {
          throw new CliError(
            "Esta loja já foi provisionada com outra chave de deploy, que está na máquina onde o `unbox provision` rodou pela primeira vez. " +
              "Rode os comandos de deploy naquela máquina, ou peça à Unbox a troca da chave informando a chave pública desta máquina: " +
              atual.pubPath,
            ALREADY_PROVISIONED,
          );
        }
        if (codigo === NOT_CONFIGURED) {
          throw new CliError("O provisionamento não está configurado neste ambiente da Unbox. Fale com a Unbox.", NOT_CONFIGURED);
        }
        if (codigo === INVALID_DEPLOY_PUBLIC_KEY) {
          throw new CliError(`A Unbox recusou a chave pública ${atual.pubPath}. Apague o par de chaves e rode de novo.`, INVALID_DEPLOY_PUBLIC_KEY);
        }
        // A mutation é idempotente com a mesma chave: uma falha de rede pode ser repetida.
        if (transitorio(e) && tentativa === 0) continue;
        throw e;
      }
    }
  }

  function trocaChave() {
    atual = rotate();
    girou = true;
    out?.warn(`  A chave de deploy anterior está em uso em outro repositório. Gerei outra: ${atual.pubPath}`);
  }

  // Leitura antes da mutation: READY não precisa dela, e uma chave já recusada é trocada antes de
  // esperar mais uma rodada inteira com ela.
  let sf = await ler();
  if (sf?.status !== "READY") {
    if (sf?.lastErrorCode && NON_RETRYABLE.has(sf.lastErrorCode)) throw nonRetryableError(sf);
    if (sf?.status === "FAILED" && sf.lastErrorCode === DEPLOY_KEY_IN_USE) trocaChave();
    sf = await chamar();
  }

  for (let i = 0; ; i++) {
    if (sf?.status === "READY") return { storefront: sf, key: atual };
    if (sf?.lastErrorCode && NON_RETRYABLE.has(sf.lastErrorCode)) throw nonRetryableError(sf);

    if (sf?.status === "FAILED") {
      if (sf.lastErrorCode === DEPLOY_KEY_IN_USE) {
        if (girou) {
          throw new CliError(`A chave de deploy nova também foi recusada. Fale com a Unbox informando ${describeStorefront(sf)}.`, DEPLOY_KEY_IN_USE);
        }
        trocaChave();
      } else if (repetiuFalha) {
        throw new CliError(
          `O provisionamento falhou de novo. Fale com a Unbox informando ${describeStorefront(sf)}.`,
          sf.lastErrorCode || "PROVISIONING_FAILED",
        );
      } else {
        repetiuFalha = true;
        out?.warn(`  O provisionamento falhou (${sf.lastErrorCode ?? "sem código"}). Tentando de novo a partir do passo que falhou.`);
      }
      sf = await chamar();
      continue;
    }

    // PROVISIONING (ou ainda nada registrado)
    const agora = now();
    if (agora - inicio >= limites.teto) {
      throw new CliError(
        `O provisionamento passou de ${Math.round(limites.teto / 60000)} min. Ele continua no servidor: rode o comando de novo mais tarde, é seguro. ` +
          `Se continuar assim, fale com a Unbox informando ${describeStorefront(sf)}.`,
        "PROVISIONING_TIMEOUT",
      );
    }
    if (!chamouDeNovo && agora - ultimaChamada >= limites.chamarDeNovoApos) {
      chamouDeNovo = true;
      sf = await chamar();
      continue;
    }

    const passo = sf?.currentStep ? PASSOS[sf.currentStep] ?? sf.currentStep : "na fila";
    avisa(sf?.lastErrorCode
      ? `  Provisionando: ${passo} (a última tentativa falhou com ${sf.lastErrorCode}; o servidor vai tentar de novo)`
      : `  Provisionando: ${passo}`);

    await sleep(limites.esperasIniciais[i] ?? limites.intervalo);
    sf = await ler();
  }
}
