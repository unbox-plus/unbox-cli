// `unbox env`: grava as variáveis do .env.local no projeto de hospedagem da loja, para os builds de
// preview e de produção terem as credenciais. O .env.local não vai no push (está no .gitignore).
//
// Os valores são somente escrita: a API nunca os devolve, e a CLI nunca os imprime. Toda saída,
// inclusive erro e --json, leva só nomes. Por isso os erros da API não são repassados com a
// mensagem original: a validação do servidor poderia ecoar o que recebeu.
import path from "node:path";
import { parseArgs } from "../args.js";
import { CliError, UsageError } from "../errors.js";
import { loadProjectEnv, requireCredentials, describeOrigins } from "../env.js";
import { createPartnerApi } from "../partner-api.js";
import { NOT_READY, backendCode } from "../storefront.js";
import {
  credenciaisSoNoTerminal,
  isReserved,
  joiIndex,
  lotes,
  mensagemPulada,
  planSet,
  validaUnset,
} from "../environment.js";

export const help = `
  unbox env: envia as variáveis do .env.local para a hospedagem da loja

  Uso:
    unbox env                        envia as variáveis do .env.local
    unbox env --list                 mostra o que está na hospedagem e o que ainda não foi enviado
    unbox env --unset CHAVE [...]    remove variáveis da hospedagem
    [--dir <pasta>] [--env-file <arquivo>] [--json]

  Envia as chaves do arquivo com o valor que o next dev vê (uma variável do terminal com o mesmo
  nome vence a do arquivo, e o comando avisa). Repetir é seguro: o valor é substituído.

  Não vão:
    - as vazias;
    - NEXT_PUBLIC_SITE_URL, gerenciada pela Unbox (vai receber o endereço de produção da loja);
    - os nomes reservados: TZ e os que começam com VERCEL_, NEXT_PUBLIC_VERCEL_, NOW_, AWS_ e LAMBDA_.

  Só builds novos usam as variáveis: depois de mudar, rode unbox deploy (e depois unbox publish).

  --list compara só os NOMES: a hospedagem nunca devolve valores, então um valor alterado no
  arquivo não aparece como pendente. --unset recebe as chaves depois da flag (--unset A B).
  Uma chave removida que continue no arquivo volta no próximo unbox env.

  Os valores nunca são impressos, nem com --json.
`;

const SPEC = {
  list: { type: "boolean" },
  unset: { type: "boolean" },
};

const LISTAR = "query { customStorefrontEnvironment { keys } }";
const GRAVAR = "mutation ($input: SetCustomStorefrontEnvironmentInput!) { setCustomStorefrontEnvironment(input: $input) { keys } }";

const KEY_RESERVED = "CUSTOM_STOREFRONT_ENVIRONMENT_KEY_RESERVED_ERROR";
const HOSTING = /^CUSTOM_STOREFRONT_HOSTING_[A-Z]+_ENVIRONMENT_ERROR$/;

/** Códigos que o partner-api.js já traduziu com um texto próprio, sem nada do que foi enviado. */
const JA_TRADUZIDOS = new Set(["MISSING_PERMISSION", "TIMEOUT", "NETWORK", "SIGN_IN_FAILED", "API_KEY_RECUSADA"]);

const PROXIMO_PASSO = "Só builds novos usam as variáveis: rode unbox deploy (e depois unbox publish).";

/**
 * O erro da API como `CliError` com texto da CLI. `lote` é o que foi enviado (para dar nome ao
 * índice que a validação recusou); `feitas` (os nomes já gravados ou removidos), `total` e `verbo`
 * dizem quanto da operação já valeu. `feitas` vai no erro, só com nomes, para quem chamou.
 */
export function traduzErro(e, { lote = [], feitas = [], total = 0, verbo = "gravadas" } = {}) {
  const codigo = backendCode(e);
  const idx = joiIndex(e);
  let erro;
  if (codigo === NOT_READY) {
    erro = new CliError("A loja ainda não está provisionada (ou o provisionamento não terminou): rode unbox provision.", NOT_READY);
  } else if (codigo === KEY_RESERVED) {
    erro = new CliError(
      "A Unbox recusou um nome reservado que esta versão da CLI não conhece; nada deste lote foi alterado. Atualize a CLI ou fale com a Unbox.",
      KEY_RESERVED,
    );
  } else if (codigo && HOSTING.test(codigo)) {
    // A listagem não altera nada; gravar e remover podem ter valido para parte do lote.
    const parcial = codigo.includes("_LIST_") ? "" : " O lote pode ter ficado parcial; rodar de novo completa.";
    erro = new CliError(`A hospedagem não concluiu a operação (${codigo}).${parcial} Rodar de novo é seguro.`, codigo);
  } else if (idx) {
    const item = lote[idx.i];
    const nome = typeof item === "string" ? item : item?.key;
    erro = new CliError(nome ? `A Unbox recusou a variável ${nome}.` : "A Unbox recusou uma das variáveis do lote.", "ENV_INVALIDA");
  } else if (e instanceof CliError && JA_TRADUZIDOS.has(e.code)) {
    erro = e;
  } else if (/^HTTP_5\d\d$/.test(e?.code ?? "")) {
    erro = new CliError(`A Unbox não conseguiu responder (${e.code}). Rodar de novo é seguro.`, e.code);
  } else {
    erro = new CliError("A Unbox recusou a operação nas variáveis.", codigo ?? "ENV_RECUSADO");
  }
  if (feitas.length) erro.message += ` ${feitas.length} de ${total} variáveis já foram ${verbo}.`;
  // Um erro já traduzido pelo partner-api.js é reaproveitado: `feitas` não pode ficar de um uso no outro.
  return Object.assign(erro === e ? new CliError(erro.message, erro.code) : erro, { feitas: [...feitas] });
}

/**
 * Grava um lote. Uma chave reservada que a CLI não conhecia recusa o lote inteiro sem dizer qual:
 * divide ao meio até isolar, e grava o resto (regravar é seguro, a gravação substitui o valor).
 */
async function gravaLote(api, lote, ctx) {
  try {
    const r = await api.request(GRAVAR, { input: { set: lote } });
    ctx.sent.push(...lote.map((x) => x.key));
    return { novas: [], keys: r.setCustomStorefrontEnvironment?.keys ?? null };
  } catch (e) {
    if (backendCode(e) !== KEY_RESERVED) throw traduzErro(e, { lote, feitas: ctx.sent, total: ctx.total });
    if (lote.length === 1) return { novas: [lote[0].key], keys: null };
    const meio = Math.ceil(lote.length / 2);
    const a = await gravaLote(api, lote.slice(0, meio), ctx);
    const b = await gravaLote(api, lote.slice(meio), ctx);
    return { novas: [...a.novas, ...b.novas], keys: b.keys ?? a.keys };
  }
}

/**
 * Envia as variáveis do arquivo. Usado pelo `unbox env` e pelo fim do `unbox provision`, com a
 * conexão que já existe. Devolve só nomes: `{ sent, skipped, fromTerminal, keys }`, em que `keys`
 * é a lista completa da hospedagem depois do envio (`null` se nada foi enviado). Se falhar no
 * meio, o erro leva em `feitas` os nomes que já foram gravados.
 */
export async function syncEnvironment({ api, loaded, out }) {
  const { set, skipped, fromTerminal } = planSet(loaded);
  for (const item of skipped) out.warn(`  ${item.reason === "gerenciada" ? "" : "Aviso: "}${mensagemPulada(item)}`);
  if (fromTerminal.length) {
    out.warn(`  Aviso: valor do ambiente do terminal, que vence o do ${loaded.envFile}: ${fromTerminal.join(", ")}.`);
  }
  for (const k of credenciaisSoNoTerminal(loaded)) {
    out.warn(`  Aviso: ${k} está só no ambiente do terminal, não no ${loaded.envFile}: não vai para a hospedagem, e o build da loja vai falhar no login. Coloque no ${loaded.envFile} e rode unbox env de novo.`);
  }
  if (!set.length) return { sent: [], skipped, fromTerminal, keys: null };

  const ctx = { sent: [], total: set.length };
  let keys = null;
  for (const parte of lotes(set)) {
    const r = await gravaLote(api, parte, ctx);
    keys = r.keys ?? keys;
    for (const key of r.novas) {
      const item = { key, reason: "reservada_nova" };
      skipped.push(item);
      out.warn(`  Aviso: ${mensagemPulada(item)}`);
    }
  }
  const { sent } = ctx;
  return { sent, skipped, fromTerminal: fromTerminal.filter((k) => sent.includes(k)), keys };
}

async function listar(api) {
  try {
    return (await api.request(LISTAR)).customStorefrontEnvironment?.keys ?? [];
  } catch (e) {
    throw traduzErro(e);
  }
}

const lista = (nomes) => (nomes.length ? nomes.join(", ") : "nenhuma");

function textoEnvio(d) {
  if (!d.sent.length) {
    return `\n  Nada a enviar: nenhuma variável do arquivo pode ir para a hospedagem${d.skipped.length ? " (veja os avisos acima)" : ""}.\n`;
  }
  const linhas = ["", "✓ Variáveis enviadas para a hospedagem", ""];
  linhas.push(`  Enviadas (${d.sent.length}): ${d.sent.join(", ")}`);
  if (d.skipped.length) linhas.push(`  Não enviadas (${d.skipped.length}): ${d.skipped.map((s) => s.key).join(", ")} (motivos nos avisos acima)`);
  linhas.push("", `  ${PROXIMO_PASSO}`, "");
  return linhas.join("\n");
}

function textoLista(d, envFile) {
  const linhas = [""];
  linhas.push(`  Na hospedagem (${d.keys.length}): ${lista(d.keys)}`);
  linhas.push(`  Do ${envFile}, ainda não enviadas (${d.notSent.length}): ${lista(d.notSent)}`);
  if (d.skipped.length) linhas.push(`  Do ${envFile}, que o unbox env não envia: ${d.skipped.map((s) => `${s.key} (${s.reason})`).join(", ")}`);
  if (d.remoteOnly.length) linhas.push(`  Só na hospedagem (${d.remoteOnly.length}): ${d.remoteOnly.join(", ")}  (remova com unbox env --unset)`);
  linhas.push("", "  A comparação é só pelo nome: um valor alterado no arquivo não aparece aqui. Para enviar de novo: unbox env", "");
  return linhas.join("\n");
}

function textoRemocao(d) {
  const linhas = [""];
  linhas.push(d.removed.length ? `✓ Removidas da hospedagem: ${d.removed.join(", ")}` : "  Nada removido.");
  if (d.notFound.length) linhas.push(`  Não estavam na hospedagem: ${d.notFound.join(", ")}`);
  if (d.removed.length) linhas.push("", `  ${PROXIMO_PASSO}`);
  linhas.push("");
  return linhas.join("\n");
}

async function remove(api, keys, loaded, out) {
  const existentes = new Set(await listar(api));
  const removed = keys.filter((k) => existentes.has(k));
  const notFound = keys.filter((k) => !existentes.has(k));
  let restantes = [...existentes].filter((k) => !removed.includes(k));
  const feitas = [];
  for (const parte of lotes(removed)) {
    try {
      const r = await api.request(GRAVAR, { input: { unset: parte } });
      restantes = r.setCustomStorefrontEnvironment?.keys ?? restantes;
      feitas.push(...parte);
    } catch (e) {
      throw traduzErro(e, { lote: parte, feitas, total: removed.length, verbo: "removidas" });
    }
  }
  const noArquivo = removed.filter((k) => (loaded.fileKeys ?? []).includes(k));
  if (noArquivo.length) {
    out.warn(`  Aviso: ${noArquivo.join(", ")} continua no ${loaded.envFile} e volta no próximo unbox env. Tire do arquivo se não quiser mais.`);
  }
  return { removed, notFound, keys: restantes };
}

/**
 * `deps` existe para os testes: `createApi`.
 */
export async function runEnv(args, globals = {}, { out, deps = {} } = {}) {
  if (globals.help) {
    process.stdout.write(help);
    return;
  }
  const { flags, positional } = parseArgs(args, SPEC);
  if (flags.list && flags.unset) throw new UsageError("Use --list ou --unset, não os dois. Veja unbox env --help.");
  if (positional.length && !flags.unset) {
    throw new UsageError(`Argumento inesperado: "${positional[0]}". Para remover, use --unset ${positional[0]}. Veja unbox env --help.`);
  }
  const unset = flags.unset ? validaUnset(positional) : null;

  const dir = path.resolve(globals.dir ?? process.cwd());
  const loaded = loadProjectEnv({ dir, envFile: globals["env-file"] ?? ".env.local" });
  if (!unset && !loaded.exists) {
    throw new CliError(
      `Arquivo ${loaded.envFile} não encontrado em ${dir}: é dele que o unbox env lê as variáveis. Aponte outro com --env-file <arquivo>.`,
      "ENV_FILE_AUSENTE",
    );
  }
  const env = requireCredentials(loaded);
  out.progress(`  Credenciais: ${describeOrigins(loaded)}`);

  const api = await (deps.createApi ?? createPartnerApi)({ env, out });
  await api.shopId();

  if (unset) {
    const data = await remove(api, unset, loaded, out);
    out.result(data, textoRemocao);
    return;
  }

  if (flags.list) {
    const keys = await listar(api);
    const { set, skipped } = planSet(loaded);
    const naHospedagem = new Set(keys);
    const doArquivo = new Set(loaded.fileKeys);
    const data = {
      keys,
      notSent: set.map((x) => x.key).filter((k) => !naHospedagem.has(k)),
      skipped,
      // Gerenciadas e reservadas não entram: o --unset as recusa.
      remoteOnly: keys.filter((k) => !doArquivo.has(k) && !isReserved(k)),
    };
    out.result(data, (d) => textoLista(d, loaded.envFile));
    return;
  }

  out.progress("  Enviando as variáveis para a hospedagem");
  const data = await syncEnvironment({ api, loaded, out });
  out.result(data, textoEnvio);
}
