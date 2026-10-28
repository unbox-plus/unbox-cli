// Parser de argumentos, sem dependência. Cada comando declara as flags que aceita numa `spec`:
//
//   { estilo: { type: "string" }, install: { type: "boolean" }, yes: { type: "boolean", short: "y" } }
//
// Aceita `--flag valor`, `--flag=valor`, `-y` e `--no-<flag>` para booleanas que declaram
// `negatable: true`. Flag desconhecida é ERRO, não silêncio: "--estylo boutique" ignorado geraria
// uma loja com o estilo errado sem ninguém perceber.
import { UsageError } from "./errors.js";

export const GLOBAL_SPEC = {
  help: { type: "boolean", short: "h" },
  json: { type: "boolean" },
  yes: { type: "boolean", short: "y" },
  dir: { type: "string" },
  "env-file": { type: "string" },
};

function lookup(spec, arg) {
  if (arg.startsWith("--")) {
    const [nome, ...resto] = arg.slice(2).split("=");
    const valor = resto.length ? resto.join("=") : undefined;
    if (spec[nome]) return { nome, def: spec[nome], valor, negado: false };
    if (nome.startsWith("no-") && spec[nome.slice(3)]?.negatable) {
      return { nome: nome.slice(3), def: spec[nome.slice(3)], valor, negado: true };
    }
    return null;
  }
  if (/^-[A-Za-z]$/.test(arg)) {
    const entrada = Object.entries(spec).find(([, d]) => d.short === arg.slice(1));
    return entrada ? { nome: entrada[0], def: entrada[1], valor: undefined, negado: false } : null;
  }
  return null;
}

/** Lê `argv` contra `spec`. Devolve `{ flags, positional }`; lança UsageError no que não reconhecer. */
export function parseArgs(argv, spec) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("-") || arg === "-") {
      positional.push(arg);
      continue;
    }
    const achado = lookup(spec, arg);
    if (!achado) throw new UsageError(`Flag desconhecida: "${arg}". Veja as opções com --help.`);
    const { nome, def, valor, negado } = achado;
    if (def.type === "boolean") {
      if (valor !== undefined) throw new UsageError(`A flag --${nome} não recebe valor.`);
      flags[nome] = !negado;
    } else {
      const v = valor ?? argv[++i];
      if (v === undefined || v === "" || (valor === undefined && v.startsWith("--"))) {
        throw new UsageError(`A flag --${nome} precisa de um valor.`);
      }
      flags[nome] = v;
    }
  }
  return { flags, positional };
}

/**
 * Separa as flags GLOBAIS do resto, em qualquer posição: `unbox -y create x` e
 * `unbox create x --yes` chegam iguais ao comando. O que não é global segue intacto, na mesma
 * ordem, para o parser do comando.
 */
export function extractGlobals(argv) {
  const globals = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const achado = arg.startsWith("-") ? lookup(GLOBAL_SPEC, arg) : null;
    if (!achado) {
      rest.push(arg);
      continue;
    }
    const { nome, def, valor } = achado;
    if (def.type === "boolean") {
      if (valor !== undefined) throw new UsageError(`A flag --${nome} não recebe valor.`);
      globals[nome] = true;
    } else {
      const v = valor ?? argv[++i];
      if (v === undefined || v === "" || (valor === undefined && v.startsWith("--"))) {
        throw new UsageError(`A flag --${nome} precisa de um valor.`);
      }
      globals[nome] = v;
    }
  }
  return { globals, rest };
}
