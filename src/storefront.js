// As regras do provisionamento da custom storefront que não dependem de rede nem de disco: quais
// códigos do backend não adianta repetir, como achar o código num erro, e o que dizer em cada caso.
import { CliError } from "./errors.js";

const nome = (c) => `CUSTOM_STOREFRONT_${c}_ERROR`;

/**
 * Códigos em que chamar a mutation de novo não resolve: dado da loja, estado inconsistente no
 * Forgejo ou na Vercel, limite ou configuração do backend. Qualquer outro código (inclusive um que
 * o backend venha a criar) é repetido uma vez: custa no máximo uma rodada a mais.
 */
export const NON_RETRYABLE = new Set([
  "HOSTING_DOMAIN_IN_USE",
  "INVALID_SHOP_SLUG",
  "DEPLOY_WORKFLOW_MISMATCH",
  "GIT_REPOSITORY_OWNER_MISMATCH",
  "HOSTING_DOMAIN_MISCONFIGURED",
  "HOSTING_ENVIRONMENT_LIMIT",
  "INVALID_DEPLOY_CLI_VERSION",
  "INVALID_PREVIEW_DOMAIN",
].map(nome));

export const DEPLOY_KEY_IN_USE = nome("DEPLOY_KEY_IN_USE");
export const ALREADY_PROVISIONED = nome("ALREADY_PROVISIONED");
export const NOT_CONFIGURED = nome("NOT_CONFIGURED");
export const NOT_READY = nome("NOT_READY");
export const INVALID_DEPLOY_PUBLIC_KEY = nome("INVALID_DEPLOY_PUBLIC_KEY");

const CODIGO = /CUSTOM_STOREFRONT_[A-Z0-9_]+_ERROR/;

/**
 * O código do backend num erro da API. Lido da MENSAGEM, e não de `err.code`: o `code` que o
 * partner-api.js monta vem do gateway ou da mensagem cortada em 40 caracteres, e
 * CUSTOM_STOREFRONT_ALREADY_PROVISIONED_ERROR tem 43. A `cause` guarda o erro do SDK inteiro.
 */
export function backendCode(err) {
  for (const m of mensagensDoErro(err)) {
    const achado = m.match(CODIGO);
    if (achado) return achado[0];
    // A validação do input (Joi) não tem código: a mensagem é o que identifica.
    if (/deployPublicKey must be/.test(m)) return INVALID_DEPLOY_PUBLIC_KEY;
  }
  return undefined;
}

/**
 * As mensagens de um erro da API, onde o SDK pode tê-las posto: `message`, `errors[].message` e a
 * cadeia de `cause` (até 4 níveis).
 */
export function* mensagensDoErro(err) {
  for (let e = err, i = 0; e && i < 4; e = e.cause, i++) {
    yield String(e.message ?? "");
    if (Array.isArray(e.errors)) for (const x of e.errors) yield String(x?.message ?? "");
  }
}

const ORIENTACAO = {
  [nome("HOSTING_DOMAIN_IN_USE")]: "O endereço da loja (<slug>.myunbox.com.br) já está em uso ou é reservado pela Unbox.",
  [nome("INVALID_SHOP_SLUG")]: "O identificador (slug) da loja não forma um nome de repositório ou domínio válido.",
  [nome("DEPLOY_WORKFLOW_MISMATCH")]: "O workflow de deploy do repositório da loja foi alterado e não confere com o da Unbox.",
  [nome("GIT_REPOSITORY_OWNER_MISMATCH")]: "Já existe um repositório com o nome da loja em outro dono no servidor git.",
  [nome("HOSTING_DOMAIN_MISCONFIGURED")]: "O domínio da loja está ligado a outro ambiente na hospedagem.",
  [nome("HOSTING_ENVIRONMENT_LIMIT")]: "A conta de hospedagem da Unbox atingiu o limite de ambientes.",
  [nome("INVALID_DEPLOY_CLI_VERSION")]: "Configuração do provisionamento inválida na Unbox (versão da CLI de deploy).",
  [nome("INVALID_PREVIEW_DOMAIN")]: "Configuração do provisionamento inválida na Unbox (domínio de preview).",
};

/** "_id ..., passo ..., código ...", para a pessoa repassar à Unbox. */
export function describeStorefront(sf) {
  const partes = [];
  if (sf?._id) partes.push(`_id ${sf._id}`);
  if (sf?.currentStep) partes.push(`passo ${sf.currentStep}`);
  if (sf?.lastErrorCode) partes.push(`código ${sf.lastErrorCode}`);
  return partes.join(", ");
}

/** A falha definitiva de um código que não se repete. */
export function nonRetryableError(sf) {
  const motivo = ORIENTACAO[sf.lastErrorCode] ?? "O provisionamento falhou de um jeito que repetir não resolve.";
  return new CliError(
    `${motivo} Repetir não resolve: fale com a Unbox informando ${describeStorefront(sf)}.`,
    sf.lastErrorCode,
  );
}
