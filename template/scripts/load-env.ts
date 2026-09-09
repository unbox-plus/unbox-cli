// Carrega .env.local/.env com o MESMO parser do Next (@next/env).
//
// Por que não `tsx --env-file=.env.local`? O parser do Node e o do Next divergem no
// escaping de valores com `#`, `$` e aspas — a mesma senha funcionava no `next dev` e
// falhava no `npm run unbox:test` (ou vice-versa). Importando este módulo PRIMEIRO em
// todo script, o valor que o script enxerga é idêntico ao que o app enxerga.
//
// Regra prática pro .env.local: valores com caracteres especiais (#, $, &, *, espaço)
// sempre entre aspas duplas — ex.: UNBOX_PASS="#minhaSenha$123".
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(path.join(import.meta.dirname, ".."));
