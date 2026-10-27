// As regras do `unbox env` que não dependem de rede nem de disco: quais chaves do .env.local vão
// para a hospedagem, quais ficam e por quê, e como achar a variável que a validação da API recusou.
//
// Regra do módulo: nenhum VALOR sai daqui em mensagem. Tudo que vira texto leva só o nome da chave.
import { CREDENTIAL_KEYS } from "./env.js";
import { UsageError } from "./errors.js";
import { mensagensDoErro } from "./storefront.js";

/**
 * Nomes que a Unbox ou a hospedagem gerenciam, e que a loja não pode definir nem remover. Cópia da
 * lista do backend (custom-storefront, `CUSTOM_STOREFRONT_RESERVED_ENVIRONMENT_KEYS` e `..._PREFIXES`):
 * aqui ela é só o filtro, para não perder o lote inteiro por uma chave. A palavra final é da API, e
 * uma reservada que o backend acrescentar depois é achada pela bisseção do comando.
 */
export const RESERVED_KEYS = ["NEXT_PUBLIC_SITE_URL", "TZ"];
export const RESERVED_PREFIXES = ["VERCEL_", "NEXT_PUBLIC_VERCEL_", "NOW_", "AWS_", "LAMBDA_"];

/** A que a Unbox vai preencher com o endereço da loja: aviso próprio, sem cara de erro. */
export const MANAGED_KEY = "NEXT_PUBLIC_SITE_URL";

/** Os limites da validação da API. O do valor é em CARACTERES (`.length`), como no backend. */
export const KEY_RE = /^[A-Z][A-Z0-9_]*$/;
export const KEY_MAX = 256;
export const VALUE_MAX = 16384;
export const LIMITE_LOTE = 50;

export function isReserved(key) {
  return RESERVED_KEYS.includes(key) || RESERVED_PREFIXES.some((p) => key.startsWith(p));
}

function nomeValido(key) {
  return key.length <= KEY_MAX && KEY_RE.test(key);
}

/** Por que uma chave do arquivo não vai, ou `null` se vai. */
function motivo(key, value) {
  if (key === MANAGED_KEY) return "gerenciada";
  if (isReserved(key)) return "reservada";
  if (!nomeValido(key)) return "nome_invalido";
  if (value === undefined || value === "") return "vazia";
  if (value.length > VALUE_MAX) return "valor_grande";
  return null;
}

/**
 * O que o `unbox env` envia: as chaves do ARQUIVO (nunca o ambiente inteiro), com o valor que o
 * `next dev` vê. `fromTerminal` são as que o terminal sobrescreveu.
 */
export function planSet(loaded) {
  const set = [];
  const skipped = [];
  const fromTerminal = [];
  for (const key of loaded.fileKeys ?? []) {
    const value = loaded.env[key];
    let reason = motivo(key, value);
    // `export X=` no terminal vence o arquivo (como no Next) e esvazia a chave: o aviso tem de
    // apontar o terminal, e não o arquivo.
    if (reason === "vazia" && loaded.origem[key] === "ambiente") reason = "vazia_terminal";
    if (reason) {
      skipped.push({ key, reason });
      continue;
    }
    set.push({ key, value });
    if (loaded.origem[key] === "ambiente") fromTerminal.push(key);
  }
  return { set, skipped, fromTerminal };
}

/** As credenciais do login que o arquivo não tem: vieram só do terminal e não vão para o build. */
export function credenciaisSoNoTerminal(loaded) {
  const doArquivo = new Set(loaded.fileKeys ?? []);
  return CREDENTIAL_KEYS.filter((k) => loaded.env[k] && !doArquivo.has(k));
}

export function lotes(lista, n = LIMITE_LOTE) {
  const saida = [];
  for (let i = 0; i < lista.length; i += n) saida.push(lista.slice(i, i + n));
  return saida;
}

/** As chaves do `--unset`, conferidas antes de qualquer chamada. Repetida é inofensiva: some. */
export function validaUnset(keys) {
  if (!keys.length) throw new UsageError("Informe as chaves a remover: unbox env --unset CHAVE [CHAVE...].");
  for (const key of keys) {
    if (key === MANAGED_KEY || isReserved(key)) {
      throw new UsageError(`${key} é gerenciada pela Unbox ou pela hospedagem e não pode ser removida.`);
    }
    if (!nomeValido(key)) {
      throw new UsageError(`Nome de variável inválido: "${key}". Use letras maiúsculas, dígitos e _, começando por letra.`);
    }
  }
  return [...new Set(keys)];
}

const TEXTO = {
  gerenciada: (k) => `${k} não foi enviada: é gerenciada pela Unbox (vai receber o endereço de produção da loja).`,
  reservada: (k) => `${k} não foi enviada: o nome é reservado pela Unbox ou pela hospedagem.`,
  reservada_nova: (k) =>
    `${k} não foi enviada: a Unbox passou a reservar este nome e esta versão da CLI ainda não sabia. Atualize a CLI ou fale com a Unbox.`,
  nome_invalido: (k) => `${k} não foi enviada: o nome precisa de letras maiúsculas, dígitos e _, começando por letra (até ${KEY_MAX}).`,
  vazia: (k) => `${k} não foi enviada: está vazia (no arquivo ou depois de expandir $VAR).`,
  vazia_terminal: (k) => `${k} não foi enviada: está vazia no ambiente do terminal, que vence o arquivo. Rode unset ${k} e de novo o unbox env.`,
  valor_grande: (k) => `${k} não foi enviada: o valor passa de ${VALUE_MAX} caracteres.`,
};

export function mensagemPulada({ key, reason }) {
  return (TEXTO[reason] ?? ((k) => `${k} não foi enviada.`))(key);
}

/**
 * As puladas por estarem vazias ficam à parte: o template traz dezenas de opcionais em branco
 * (pixel, GA, WhatsApp...), deixar em branco é escolha, e um aviso por chave escondia o que pede ação.
 */
export function separaVazias(skipped) {
  const vazias = [];
  const outras = [];
  for (const item of skipped) (item.reason === "vazia" ? vazias : outras).push(item);
  return { vazias: vazias.map((s) => s.key), outras };
}

export function mensagemVazias(keys, envFile) {
  const n = keys.length;
  return `${n} ${n === 1 ? "variável vazia" : "variáveis vazias"} no ${envFile}, não ${n === 1 ? "enviada" : "enviadas"} (opcionais em branco): ${keys.join(", ")}.`;
}

const INDICE = /"(set|unset)\[(\d+)\]/;

/**
 * A posição que a validação da API (Joi) recusou: `"set[3].key" must ...` ou
 * `"set[1]" contains a duplicate value`. A mensagem não tem código; o índice é o que identifica a
 * variável, e o nome vem do lote, não do texto do erro.
 */
export function joiIndex(err) {
  for (const m of mensagensDoErro(err)) {
    const achado = m.match(INDICE);
    if (achado) return { campo: achado[1], i: Number(achado[2]) };
  }
  return undefined;
}
