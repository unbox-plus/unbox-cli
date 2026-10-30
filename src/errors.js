// Os dois erros que o despachante (src/main.js) sabe converter em código de saída.
// Qualquer outro erro é inesperado: sai com 1 e mensagem curta.

/** Uso incorreto: flag desconhecida, valor ausente, comando que não existe. Sai com 2 (1 no create). */
export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
    this.code = "USAGE";
  }
}

/** Falha da operação, com um código estável para quem lê o --json. Sai com 1. */
export class CliError extends Error {
  constructor(message, code = "ERRO") {
    super(message);
    this.name = "CliError";
    this.code = code;
  }
}
