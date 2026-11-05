// As chaves de deploy da loja na Partners API. Uma loja aceita várias (até 10 no backend): uma por
// máquina, pessoa ou CI, como a do cliente e a da agência no mesmo projeto. Cada máquina continua
// com o próprio par em ~/.config/unbox/keys/ (deploy-key.js); aqui só se registra, lista e remove a
// parte PÚBLICA. A privada nunca é lida por este módulo, e um arquivo com chave privada é recusado
// antes de qualquer envio.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import { CliError } from "./errors.js";
import {
  DEPLOY_KEYS_LIMIT,
  DEPLOY_KEY_IN_USE,
  DEPLOY_KEY_NOT_FOUND,
  DEPLOY_KEY_TITLE_IN_USE,
  INVALID_DEPLOY_PUBLIC_KEY,
  NOT_READY,
  backendCode,
} from "./storefront.js";

const CAMPOS = "_id title fingerprint createdAt";
const LISTAR = `query { customStorefrontDeployKeys { ${CAMPOS} } }`;
const ADICIONAR = `mutation ($input: AddCustomStorefrontDeployKeyInput!) { addCustomStorefrontDeployKey(input: $input) { ${CAMPOS} } }`;
const REMOVER = `mutation ($input: RemoveCustomStorefrontDeployKeyInput!) { removeCustomStorefrontDeployKey(input: $input) { ${CAMPOS} } }`;

/** O limite de caracteres do título no backend. */
export const TITULO_MAX = 50;

/** `<tipo> <base64> [comentário]` numa linha, como o backend aceita. */
const CHAVE_PUBLICA = /^(ssh-ed25519|ssh-rsa) ([A-Za-z0-9+/]+={0,3})( [^\r\n]*)?$/;
const FINGERPRINT = /^SHA256:[A-Za-z0-9+/]{43}$/;
const MAX_ARQUIVO = 16 * 1024;

/**
 * O fingerprint OpenSSH (`SHA256:...`, o do `ssh-keygen -lf`) de uma chave pública: SHA256 do blob
 * em base64, sem o `=` do fim. É o que o backend devolve na lista, e é por ele que a CLI reconhece
 * a chave desta máquina.
 */
export function fingerprintDe(publicKey) {
  const m = CHAVE_PUBLICA.exec(String(publicKey ?? "").trim());
  if (!m) return undefined;
  return `SHA256:${crypto.createHash("sha256").update(Buffer.from(m[2], "base64")).digest("base64").replace(/=+$/, "")}`;
}

/** `_id` (só dígitos) ou fingerprint: o que o `unbox keys remove` aceita. */
export function identificador(valor) {
  const v = String(valor ?? "").trim();
  if (/^\d{1,20}$/.test(v)) return { _id: v };
  if (FINGERPRINT.test(v)) return { fingerprint: v };
  return undefined;
}

/**
 * O título padrão: `<usuário>@<máquina>` e o começo do fingerprint, para a mesma máquina com uma
 * chave recriada não colidir com o título da anterior (o título é único no repositório).
 */
export function tituloPadrao(fingerprint, { usuario, maquina } = {}) {
  let u = usuario;
  if (u === undefined) {
    try {
      u = os.userInfo().username;
    } catch {
      u = "";
    }
  }
  const m = maquina ?? os.hostname();
  const base = `${u ? `${u}@` : ""}${m || "maquina"}`.replace(/[^\x21-\x7e]+/g, "-").slice(0, TITULO_MAX - 9);
  const sufixo = String(fingerprint ?? "").replace(/^SHA256:/, "").slice(0, 8);
  return sufixo ? `${base} ${sufixo}` : base;
}

/**
 * Lê uma chave pública de um arquivo e devolve `{ publicKey, fingerprint }`. Conteúdo de chave
 * PRIVADA é recusado sem ser repetido na mensagem: o arquivo errado não pode sair da máquina.
 */
export function leChavePublica(arquivo) {
  let st;
  try {
    st = fs.statSync(arquivo);
  } catch {
    throw new CliError(`Não achei o arquivo ${arquivo}.`, "CHAVE_INVALIDA");
  }
  if (!st.isFile() || st.size > MAX_ARQUIVO) {
    throw new CliError(`${arquivo} não é uma chave pública SSH (esperado um .pub com uma linha ssh-ed25519 ou ssh-rsa).`, "CHAVE_INVALIDA");
  }
  const conteudo = fs.readFileSync(arquivo, "utf8");
  if (/PRIVATE KEY/.test(conteudo)) {
    const pub = fs.existsSync(`${arquivo}.pub`) ? ` Use ${arquivo}.pub.` : " Use o arquivo .pub do par.";
    throw new CliError(`${arquivo} é uma chave PRIVADA e não foi enviada.${pub}`, "CHAVE_PRIVADA");
  }
  const linhas = conteudo.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const publicKey = linhas[0];
  const fingerprint = linhas.length === 1 ? fingerprintDe(publicKey) : undefined;
  if (!fingerprint) {
    throw new CliError(`${arquivo} não é uma chave pública SSH (esperado um .pub com uma linha ssh-ed25519 ou ssh-rsa).`, "CHAVE_INVALIDA");
  }
  return { publicKey, fingerprint };
}

/** O erro da API em mensagem da CLI. O que não for das chaves volta como veio. */
export function erroDaChave(e, { title } = {}) {
  const codigo = backendCode(e);
  if (codigo === NOT_READY) {
    return new CliError("A loja ainda não está provisionada (ou o provisionamento não terminou). Rode unbox provision.", NOT_READY);
  }
  if (codigo === DEPLOY_KEYS_LIMIT) {
    return new CliError("A loja já tem o máximo de chaves de deploy. Veja as chaves com unbox keys e remova uma que não esteja mais em uso com unbox keys remove <fingerprint>.", DEPLOY_KEYS_LIMIT);
  }
  if (codigo === DEPLOY_KEY_TITLE_IN_USE) {
    return new CliError(`Já existe outra chave com o título "${title}" nesta loja. Escolha outro com --title.`, DEPLOY_KEY_TITLE_IN_USE);
  }
  if (codigo === DEPLOY_KEY_NOT_FOUND) {
    return new CliError("Essa chave não está (mais) na loja. Veja as chaves com unbox keys.", DEPLOY_KEY_NOT_FOUND);
  }
  if (codigo === DEPLOY_KEY_IN_USE) {
    return new CliError("Essa chave já é usada em outro repositório da Unbox e não pode ser adicionada a esta loja. Use outra chave.", DEPLOY_KEY_IN_USE);
  }
  if (codigo === INVALID_DEPLOY_PUBLIC_KEY) {
    return new CliError("A Unbox recusou a chave pública (esperado ssh-ed25519 ou ssh-rsa numa linha).", INVALID_DEPLOY_PUBLIC_KEY);
  }
  return e;
}

/** As chaves da loja, mais antiga primeiro. */
export async function listaChaves(api) {
  try {
    return (await api.request(LISTAR)).customStorefrontDeployKeys ?? [];
  } catch (e) {
    throw erroDaChave(e);
  }
}

/**
 * Garante a chave pública na loja. Devolve `{ key, added }`: `added` falso quando ela já estava lá
 * (nada é gravado). O add do backend também é idempotente; a leitura antes é para dizer a verdade
 * na saída ("adicionada" só quando foi).
 */
export async function registraChave(api, { publicKey, title }) {
  const fingerprint = fingerprintDe(publicKey);
  const existente = (await listaChaves(api)).find((k) => k.fingerprint === fingerprint);
  if (existente) return { key: existente, added: false };
  const titulo = title ?? tituloPadrao(fingerprint);
  try {
    const key = (await api.request(ADICIONAR, { input: { deployPublicKey: publicKey, title: titulo } })).addCustomStorefrontDeployKey;
    return { key, added: true };
  } catch (e) {
    throw erroDaChave(e, { title: titulo });
  }
}

/** Remove pela `_id` ou pelo fingerprint. Devolve a chave removida. */
export async function removeChave(api, alvo) {
  try {
    return (await api.request(REMOVER, { input: alvo })).removeCustomStorefrontDeployKey;
  } catch (e) {
    throw erroDaChave(e);
  }
}
