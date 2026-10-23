// Saída dos comandos: texto para gente, JSON para agentes e scripts.
//
// O contrato do --json é UM objeto em stdout, sempre, inclusive em erro de uso:
//   { "ok": true,  "data": {...} }
//   { "ok": false, "error": { "code": "...", "message": "..." } }
// Progresso e avisos vão para stderr nesse modo. Quem lê com `JSON.parse(stdout)` não pode
// encontrar uma linha de log antes do objeto.
//
// Nenhuma credencial sai por aqui. O SDK monta a mensagem do signIn com o texto que o servidor
// devolve, e não há garantia de que ele não ecoe o que recebeu: todo texto passa pelo filtro.

const MIN_SEGREDO = 6; // valor curto demais trocaria pedaços comuns da mensagem por ***

export function redact(text, secrets) {
  let out = String(text ?? "");
  for (const s of secrets) {
    if (!s || s.length < MIN_SEGREDO) continue;
    // A forma literal e a forma escapada em JSON (aspas, barra invertida).
    for (const forma of new Set([s, JSON.stringify(s).slice(1, -1)])) {
      out = out.split(forma).join("***");
    }
  }
  return out;
}

export function createOutput({ json = false, stdout = process.stdout, stderr = process.stderr } = {}) {
  const secrets = new Set();
  const limpo = (t) => redact(t, secrets);

  return {
    json,
    /** Registra valores que nunca podem aparecer na saída (senha, api key, token). */
    addSecrets(...values) {
      for (const v of values) if (typeof v === "string" && v) secrets.add(v);
    },
    redact: limpo,
    /** Andamento da operação. No --json vai para stderr. */
    progress(msg) {
      (json ? stderr : stdout).write(limpo(msg) + "\n");
    },
    /** Aviso: sempre em stderr. */
    warn(msg) {
      stderr.write(limpo(msg) + "\n");
    },
    /** Resultado final. `texto(data)` monta a versão para gente. */
    result(data, texto) {
      if (json) stdout.write(limpo(JSON.stringify({ ok: true, data })) + "\n");
      else if (texto) stdout.write(limpo(texto(data)) + "\n");
    },
    /** Falha final. A stack só com UNBOX_DEBUG=1, e filtrada como o resto. */
    fail(err) {
      const code = err?.code && typeof err.code === "string" ? err.code : "ERRO";
      const message = limpo(err?.message ?? String(err));
      if (json) stdout.write(limpo(JSON.stringify({ ok: false, error: { code, message } })) + "\n");
      else stderr.write(`\n✗ ${message}\n`);
      if (process.env.UNBOX_DEBUG === "1" && err?.stack) stderr.write(limpo(err.stack) + "\n");
    },
  };
}
