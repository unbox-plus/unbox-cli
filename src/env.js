// O .env do projeto: quem escreve (o create, no scaffold) e quem lê (os comandos que falam com a
// Unbox) moram no mesmo módulo, porque a regra que importa é a ida e volta: o valor que o create
// grava tem de voltar idêntico na leitura, e idêntico ao que o `next dev` da loja enxerga.
//
// A leitura usa o `processEnv` do `@next/env`, o mesmo parser do Next do template (dotenv com
// expansão de `$VAR`). Reimplementar essa gramática já custou uma vez: a senha com `$` funcionava
// num lado e falhava no outro, e o signIn recusava sem pista nenhuma.
import fs from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import { CliError } from "./errors.js";

/** As três que habilitam a conversa com a Unbox. Faltando qualquer uma, nenhum comando de API roda. */
export const CREDENTIAL_KEYS = ["UNBOX_PARTNER_API_KEY", "UNBOX_USER", "UNBOX_PASS"];

/** Valor seguro pra linha KEY=... do .env.local. O Next lê o arquivo com dotenv + dotenv-expand:
 *  sem aspas, `#` vira comentário (senha truncada), `$X` é expandido (some) e espaço quebra.
 *  Caso real: senha com `$` chegava cortada e o signIn falhava sem pista.
 *  Medido com o @next/env real (9 valores adversos): aspas simples NÃO protegem `$1` (o expand
 *  roda mesmo assim) e aspas duplas não desfazem `\"`. O único formato que devolve todos os
 *  valores intactos é CRASE com `$` escapado como `\$`. Só caracteres simples saem crus. */
export function envValue(v) {
  const s = String(v ?? "").replace(/\r?\n/g, "");
  if (s === "" || /^[A-Za-z0-9_.\/:@+=,-]*$/.test(s)) return s;
  const esc = s.replace(/\$/g, "\\$");
  if (!s.includes("`")) return "`" + esc + "`";
  // Valor com crase: aspas duplas (a única perda possível é uma aspa dupla interna, sem escape em dotenv).
  return `"${esc.replace(/"/g, "")}"`;
}

const logMudo = { info() {}, error() {} };

/**
 * Lê o conteúdo de UM arquivo com o parser do Next e devolve o que ele declara, já expandido.
 *
 * O `processEnv` escreve em `process.env` (é assim que o Next carrega o ambiente). Aqui ele é só o
 * parser: o `process.env` volta exatamente como estava, para o comando decidir a precedência e
 * saber de onde veio cada valor.
 */
export function parseEnvContents(contents, { file = ".env.local", dir = process.cwd() } = {}) {
  const antes = { ...process.env };
  const arquivos = [{ path: file, contents, env: {} }];
  try {
    nextEnv.processEnv(arquivos, dir, logMudo, true);
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in antes)) delete process.env[k];
    Object.assign(process.env, antes);
  }
  return { ...arquivos[0].env };
}

/**
 * O ambiente do projeto: o arquivo pedido (padrão `.env.local`) com as variáveis do processo POR
 * CIMA, como no Next. `origem` diz, para cada chave do arquivo e cada `UNBOX_*`, se o valor veio
 * do arquivo ou do terminal: uma variável esquecida no shell, de outra loja, vence o arquivo sem
 * ninguém ver, e é isso que leva a operação para a loja errada.
 */
export function loadProjectEnv({ dir = process.cwd(), envFile = ".env.local", processEnvironment = process.env } = {}) {
  const file = path.resolve(dir, envFile);
  const exists = fs.existsSync(file) && fs.statSync(file).isFile();
  const parsed = exists ? parseEnvContents(fs.readFileSync(file, "utf8"), { file: envFile, dir }) : {};

  const env = { ...parsed };
  const origem = {};
  for (const k of Object.keys(parsed)) origem[k] = "arquivo";
  for (const [k, v] of Object.entries(processEnvironment)) {
    if (v === undefined) continue;
    env[k] = v;
    if (k in parsed || k.startsWith("UNBOX_")) origem[k] = "ambiente";
  }
  return { env, origem, file, envFile, dir, exists };
}

/** Credenciais presentes ou erro com instrução. Roda ANTES do SDK, que diria "modo mockup". */
export function requireCredentials(loaded) {
  const { env, file, envFile, dir, exists } = loaded;
  const faltam = CREDENTIAL_KEYS.filter((k) => !env[k]);
  if (!faltam.length) return env;

  const linhas = [];
  if (!exists) linhas.push(`Arquivo ${envFile} não encontrado em ${dir}.`);
  else {
    const rel = path.relative(process.cwd(), file);
    linhas.push(`Faltam credenciais da Unbox em ${rel && !rel.startsWith("..") ? rel : file}: ${faltam.join(", ")}.`);
  }
  linhas.push("  Preencha a partir do .env.example do projeto, ou aponte outro arquivo com --env-file <arquivo>.");

  // O Next também lê `.env`: quem guardou as chaves lá vê a loja funcionar e a CLI recusar.
  if (path.basename(envFile) !== ".env") {
    const alternativo = path.join(dir, ".env");
    if (fs.existsSync(alternativo)) {
      const outro = parseEnvContents(fs.readFileSync(alternativo, "utf8"), { file: ".env", dir });
      if (CREDENTIAL_KEYS.every((k) => outro[k])) {
        linhas.push("  As credenciais estão no .env deste projeto: rode de novo com --env-file .env");
      }
    }
  }
  throw new CliError(linhas.join("\n"), "CREDENCIAIS_AUSENTES");
}

/** As variáveis que decidem COM QUEM a CLI fala. É o que se mostra de `origem` (o resto dela, como
 *  um UNBOX_MCP_TOKEN do terminal, não muda nada aqui e só faria ruído). */
export const CONNECTION_KEYS = [...CREDENTIAL_KEYS, "UNBOX_PARTNER_GRAPHQL_URL", "UNBOX_SHOP_ID"];

/** `{ UNBOX_USER: "arquivo" | "ambiente", ... }`, só das variáveis de conexão presentes. */
export function connectionOrigins(loaded) {
  return Object.fromEntries(CONNECTION_KEYS.filter((k) => loaded.origem[k]).map((k) => [k, loaded.origem[k]]));
}

/** "UNBOX_USER do .env.local, UNBOX_PASS do ambiente do terminal", para o stderr. */
export function describeOrigins(loaded, keys = CREDENTIAL_KEYS) {
  return keys
    .filter((k) => loaded.origem[k])
    .map((k) => `${k} ${loaded.origem[k] === "ambiente" ? "do ambiente do terminal" : `do ${loaded.envFile}`}`)
    .join(", ");
}
