// A conexão dos comandos da CLI com a Partners API. É uma camada fina sobre o `@unbox-plus/sdk`, o
// mesmo pacote que a loja usa: signIn, os dois cabeçalhos, o token puro no Authorization, a
// renovação do token vencido e a leitura do JWT moram lá, num lugar só. O que mora AQUI é o que é
// da CLI: transformar a recusa da API numa mensagem que diga o que fazer, com um `code` estável
// para quem lê o --json, sem deixar credencial nenhuma escapar na saída.
//
// O SDK é importado dentro de `createPartnerApi`, e não no topo: o `unbox create` não fala com a
// API e não precisa carregá-lo.
import { CliError } from "./errors.js";

export const DEFAULT_GRAPHQL_URL = "https://partners.unbox.com.br/graphql";

export const MISSING_PERMISSION_MESSAGE =
  "A conta não tem permissão para esta operação; peça a liberação à Unbox.";

export class PartnerApiError extends CliError {
  constructor(message, code, cause) {
    super(message, code);
    this.name = "PartnerApiError";
    if (cause) this.cause = cause;
  }
}

function primeiroErro(e) {
  return Array.isArray(e?.errors) ? e.errors[0] : undefined;
}

/** "Unauthorized - Missing required permissions" → "UNAUTHORIZED". */
function codigoDaMensagem(msg) {
  const cabeca = String(msg).split(" - ")[0].split(":")[0].trim();
  const slug = cabeca.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  return slug.slice(0, 40) || "ERRO";
}

/** Converte o que o SDK (ou o fetch) lançou num PartnerApiError com código e mensagem úteis. */
export function toPartnerApiError(e, { sdk, endpoint }) {
  if (e instanceof CliError) return e;
  if (sdk.isMissingPermissionError(e)) return new PartnerApiError(MISSING_PERMISSION_MESSAGE, "MISSING_PERMISSION", e);

  const timeout = sdk.isUnboxTimeout(e)
    || e?.name === "TimeoutError" || e?.name === "AbortError";
  if (timeout) return new PartnerApiError(`A Unbox não respondeu dentro do prazo (${endpoint}). Tente de novo.`, "TIMEOUT", e);

  // fetch do Node: "fetch failed" com a causa de rede em `cause` (ENOTFOUND, ECONNREFUSED...).
  if (e?.message === "fetch failed" || e?.cause?.code) {
    const codigo = e?.cause?.code ?? e?.cause?.errors?.[0]?.code ?? e?.cause?.message;
    const causa = codigo ? ` (${codigo})` : "";
    return new PartnerApiError(`Não foi possível conectar a ${endpoint}${causa}. Confira a rede e o UNBOX_PARTNER_GRAPHQL_URL.`, "NETWORK", e);
  }

  // O SDK prefixa com "signIn" o que falhou no login. A mensagem tem de apontar a credencial certa:
  // "recusou o login" com a senha certa manda a pessoa trocar o que não está errado.
  if (/^signIn\b/.test(e?.message ?? "")) {
    const motivo = String(e.message).replace(/^signIn:?\s*/, "") || "sem detalhe";
    if (/^HTTP_5\d\d$/.test(e?.code ?? "")) {
      return new PartnerApiError(`A Unbox não conseguiu responder ao login (${motivo.slice(0, 120)}). Tente de novo em instantes.`, e.code, e);
    }
    // O login só leva a api key: recusa do próprio gateway (medido: "You are not authorized to make
    // this call.", errorType UnauthorizedException) é a UNBOX_PARTNER_API_KEY, não usuário e senha.
    if (primeiroErro(e)?.errorType === "UnauthorizedException") {
      return new PartnerApiError(`A Unbox recusou a UNBOX_PARTNER_API_KEY (${motivo}). Confira a chave e se ela é do mesmo ambiente do UNBOX_PARTNER_GRAPHQL_URL.`, "API_KEY_RECUSADA", e);
    }
    if (/INVALID_CREDENTIALS_ERROR/.test(motivo)) {
      return new PartnerApiError("Usuário ou senha incorretos: confira UNBOX_USER e UNBOX_PASS (INVALID_CREDENTIALS_ERROR).", "SIGN_IN_FAILED", e);
    }
    return new PartnerApiError(`A Unbox recusou o login com UNBOX_USER/UNBOX_PASS: ${motivo}`, "SIGN_IN_FAILED", e);
  }

  const primeiro = primeiroErro(e);
  const code = (typeof e?.code === "string" && e.code)
    || primeiro?.extensions?.code
    || primeiro?.errorType
    || codigoDaMensagem(primeiro?.message ?? e?.message ?? "");
  const message = String(e?.message ?? e).slice(0, 300);
  return new PartnerApiError(message, String(code), e);
}

/**
 * Conecta à Partners API com as credenciais do projeto. `env` já passou por `requireCredentials`
 * (src/env.js); `out` é a saída do comando, que aprende os segredos para nunca imprimi-los.
 */
export async function createPartnerApi({ env, out }) {
  const sdk = await import("@unbox-plus/sdk");
  const creds = {
    ...sdk.credentialsFromEnv(env),
    // Token PURO no Authorization, sempre. Sem isto o SDK mede o formato e pode memorizar
    // "Bearer", e antes da primeira mutation faz uma consulta extra (shopBySlug) que uma conta
    // só de deploy pode não ter.
    authScheme: "raw",
  };
  const endpoint = creds.partnerGqlUrl || DEFAULT_GRAPHQL_URL;
  out?.addSecrets(creds.pass, creds.partnerApiKey);
  const store = sdk.connectUnboxStore(creds);

  const traduzido = async (fn) => {
    try {
      return await fn();
    } catch (e) {
      throw toPartnerApiError(e, { sdk, endpoint });
    }
  };
  const conhece = (client) => {
    if (client?.token) out?.addSecrets(client.token);
    return client;
  };

  return {
    endpoint,

    /** Uma operação GraphQL. Renova o token uma vez se a sessão tiver vencido (no SDK). */
    request(query, variables = {}) {
      return traduzido(() => store.withStoreClient((client) => conhece(client).gql(query, variables)));
    },

    /**
     * shopId da sessão, lido do claim `arn:unbox:shopId` do token, e não do UNBOX_SHOP_ID do env:
     * é a loja em que o login realmente entrou. Se o env disser outra, avisa.
     */
    async shopId() {
      const client = conhece(await traduzido(() => store.getStoreClient()));
      const { shopId } = sdk.shopClaimsFromToken(client.token);
      if (env.UNBOX_SHOP_ID && shopId && env.UNBOX_SHOP_ID !== shopId) {
        out?.warn(`  Aviso: o UNBOX_SHOP_ID do ambiente (${env.UNBOX_SHOP_ID}) não é a loja do login (${shopId}). Vale a do login.`);
      }
      return shopId;
    },
  };
}
