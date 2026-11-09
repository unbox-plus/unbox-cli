// `unbox keys`: as chaves de deploy da loja. Uma loja aceita várias (uma por máquina, pessoa ou CI),
// como a do cliente e a da agência no mesmo projeto. O `unbox provision` já adiciona a chave da
// máquina em que roda; este comando é para ver quem tem acesso, adicionar uma chave que não é desta
// máquina (de um CI, de alguém que não roda a CLI) e tirar uma que não deve mais enviar código.
//
// Só a parte pública passa por aqui. Arquivo com chave privada é recusado antes de qualquer envio.
import fs from "node:fs";
import path from "node:path";
import prompts from "prompts";
import { parseArgs } from "../args.js";
import { CliError, UsageError } from "../errors.js";
import { loadProjectEnv, requireCredentials, describeOrigins } from "../env.js";
import { createPartnerApi } from "../partner-api.js";
import { requireProgram } from "../proc.js";
import { ensureKey, keyPaths } from "../deploy-key.js";
import {
  TITULO_MAX,
  fingerprintDe,
  identificador,
  leChavePublica,
  listaChaves,
  registraChave,
  removeChave,
} from "../deploy-keys.js";
import { DEPLOY_KEY_NOT_FOUND } from "../storefront.js";

export const help = `
  unbox keys: as chaves de deploy da loja

  Uso:
    unbox keys                                  lista as chaves (a desta máquina vem marcada)
    unbox keys add [arquivo.pub] [--title <t>]  adiciona uma chave pública à loja
    unbox keys remove <fingerprint|id> [--yes]  remove uma chave da loja
    [--dir <pasta>] [--env-file <arquivo>] [--json]

  A loja aceita várias chaves de deploy, uma por máquina, pessoa ou CI (a do cliente e a da
  agência, por exemplo). Cada uma envia código para a loja; tirar uma não mexe nas outras.

  add sem arquivo adiciona a chave desta máquina (~/.config/unbox/keys/<shopId>_ed25519.pub,
  gerada se faltar); o unbox provision já faz isso. Com arquivo, adiciona a chave pública de
  outra pessoa ou de um CI (ssh-ed25519 ou ssh-rsa). O título padrão é usuário@máquina; com
  --title, até ${TITULO_MAX} caracteres, único na loja. Adicionar uma chave que já está lá não muda nada.

  remove recebe o fingerprint (SHA256:..., como na lista ou no ssh-keygen -lf) ou o id da lista,
  e pede confirmação; --yes pula (com --json, ou fora de um terminal, o --yes é obrigatório).
  Quem usava a chave removida passa a ter o envio recusado.

  --json devolve { keys }, { key, added } ou { removed }.
`;

const SPEC = {
  title: { type: "string" },
};

const cancelado = () => {
  throw new CliError("Cancelado. Nada foi alterado.", "CANCELADO");
};

/** O fingerprint da chave desta máquina para a loja, se o par existir aqui. Não gera nada. */
function fingerprintLocal(shopId) {
  try {
    const { pubPath } = keyPaths(shopId);
    if (!fs.existsSync(pubPath)) return undefined;
    return fingerprintDe(fs.readFileSync(pubPath, "utf8").trim().split(/\r?\n/)[0]);
  } catch {
    return undefined;
  }
}

const quando = (d) => (d ? String(d).slice(0, 10) : "");

function textoLista({ keys }) {
  if (!keys.length) return "\n  A loja não tem nenhuma chave de deploy. Adicione a desta máquina com unbox keys add (ou rode unbox provision).\n";
  const largura = Math.max(...keys.map((k) => k.title.length));
  const linhas = ["", `  Chaves de deploy da loja (${keys.length}):`, ""];
  for (const k of keys) {
    const marca = k.thisMachine ? "  ← esta máquina" : "";
    linhas.push(`  ${k.title.padEnd(largura)}  ${k.fingerprint}  ${quando(k.createdAt)}  id ${k._id}${marca}`);
  }
  if (!keys.some((k) => k.thisMachine)) linhas.push("", "  A chave desta máquina não está na loja: unbox keys add (ou unbox provision) a adiciona.");
  linhas.push("");
  return linhas.join("\n");
}

async function lista(api, shopId, out) {
  const local = fingerprintLocal(shopId);
  const keys = (await listaChaves(api)).map((k) => ({ ...k, thisMachine: Boolean(local && k.fingerprint === local) }));
  out.result({ keys }, textoLista);
}

async function adiciona(api, shopId, { arquivo, title, dir, out }) {
  if (title !== undefined && (!title.trim() || title.trim().length > TITULO_MAX)) {
    throw new UsageError(`O --title precisa ter de 1 a ${TITULO_MAX} caracteres.`);
  }
  let publicKey;
  let origem;
  if (arquivo) {
    origem = path.resolve(dir, arquivo);
    ({ publicKey } = leChavePublica(origem));
  } else {
    requireProgram("ssh-keygen");
    const k = ensureKey(shopId);
    if (k.created) out.progress(`  Chave de deploy criada: ${k.pubPath}`);
    publicKey = k.publicKey;
    origem = k.pubPath;
  }
  const { key, added } = await registraChave(api, { publicKey, title: title?.trim() });
  out.result({ key, added }, () => (added
    ? `\n✓ Chave adicionada à loja: ${key.title}\n\n  Fingerprint: ${key.fingerprint}\n  Arquivo:     ${origem}\n`
    : `\n  A chave já estava na loja, como "${key.title}". Nada mudou.\n\n  Fingerprint: ${key.fingerprint}\n`));
}

async function remove(api, shopId, { alvo, yes, naoInterativo, out }) {
  const id = identificador(alvo);
  const keys = await listaChaves(api);
  const key = keys.find((k) => (id._id ? k._id === id._id : k.fingerprint === id.fingerprint));
  if (!key) throw new CliError(`Nenhuma chave da loja com ${id._id ? `id ${id._id}` : id.fingerprint}. Veja as chaves com unbox keys.`, DEPLOY_KEY_NOT_FOUND);

  const desta = key.fingerprint === fingerprintLocal(shopId);
  const avisos = [];
  if (desta) avisos.push("É a chave DESTA máquina: depois disso, unbox deploy daqui é recusado até rodar unbox provision de novo.");
  if (keys.length === 1) avisos.push("É a única chave da loja: ninguém mais consegue enviar código até alguém rodar unbox provision ou unbox keys add.");

  if (!yes) {
    if (naoInterativo) {
      throw new CliError(`Remover a chave "${key.title}" pede confirmação. Para remover sem perguntar, rode de novo com --yes.`, "CONFIRMACAO_NECESSARIA");
    }
    out.warn(`\n  Remover a chave "${key.title}" (${key.fingerprint}) da loja.${avisos.map((a) => `\n  ${a}`).join("")}\n`);
    const { ok } = await prompts(
      { type: "confirm", name: "ok", message: "Remover?", initial: false, stdout: process.stderr },
      { onCancel: cancelado },
    );
    if (!ok) cancelado();
  } else {
    for (const a of avisos) out.warn(`  Aviso: ${a}`);
  }

  const removed = await removeChave(api, { _id: key._id });
  out.result({ removed }, () => `\n✓ Chave removida da loja: ${removed.title} (${removed.fingerprint})\n`);
}

/**
 * `deps` existe para os testes: `createApi`.
 */
export async function runKeys(args, globals = {}, { out, interactive = process.stdin.isTTY, deps = {} } = {}) {
  if (globals.help) {
    process.stdout.write(help);
    return;
  }
  const { flags, positional } = parseArgs(args, SPEC);
  const [acao = "list", ...resto] = positional;
  const naoInterativo = Boolean(globals.json || !interactive);
  const dir = path.resolve(globals.dir ?? process.cwd());

  if (!["list", "add", "remove"].includes(acao)) {
    throw new UsageError(`Ação desconhecida: "${acao}". Use unbox keys, unbox keys add ou unbox keys remove. Veja unbox keys --help.`);
  }
  if (acao !== "add" && flags.title !== undefined) throw new UsageError("O --title vale só para unbox keys add.");
  if (acao === "list" && resto.length) throw new UsageError(`Argumento inesperado: "${resto[0]}". Veja unbox keys --help.`);
  if (acao === "add" && resto.length > 1) throw new UsageError(`Argumento inesperado: "${resto[1]}". O add recebe um arquivo só.`);
  if (acao === "remove" && resto.length !== 1) throw new UsageError("Informe a chave a remover: unbox keys remove <fingerprint|id>.");
  if (acao === "remove" && !identificador(resto[0])) {
    throw new UsageError(`"${resto[0]}" não é um fingerprint (SHA256:...) nem um id. Veja as chaves com unbox keys.`);
  }

  const loaded = loadProjectEnv({ dir, envFile: globals["env-file"] ?? ".env.local" });
  const env = requireCredentials(loaded);
  out.progress(`  Credenciais: ${describeOrigins(loaded)}`);

  const api = await (deps.createApi ?? createPartnerApi)({ env, out });
  const shopId = await api.shopId();

  if (acao === "list") return lista(api, shopId, out);
  if (acao === "add") return adiciona(api, shopId, { arquivo: resto[0], title: flags.title, dir, out });
  return remove(api, shopId, { alvo: resto[0], yes: Boolean(globals.yes), naoInterativo, out });
}
