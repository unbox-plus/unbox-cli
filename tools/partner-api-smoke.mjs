#!/usr/bin/env node
// Smoke test da conexão com a Partners API, contra um ambiente real (stage ou produção).
//
//   node tools/partner-api-smoke.mjs --dir <pasta da loja> [--env-file .env.local] [--json] [--query "<graphql>"]
//
// Lê as credenciais como os comandos da CLI leem (src/env.js), faz o signIn, mostra de onde veio
// cada credencial e o shopId do token, e roda uma consulta leve: por padrão a `customStorefront`,
// que só lê (exige a permissão read:custom:storefront e responde null se a loja nunca foi
// provisionada). É o que confere, ponta a ponta, os dois cabeçalhos, o token puro e as mensagens
// de erro: senha errada, conta sem permissão, arquivo sem credencial.
//
// Fica fora do pacote publicado: o `files` do package.json leva só bin, src e template.
import path from "node:path";
import { extractGlobals, parseArgs } from "../src/args.js";
import { createOutput } from "../src/output.js";
import { loadProjectEnv, requireCredentials, describeOrigins, connectionOrigins } from "../src/env.js";
import { createPartnerApi } from "../src/partner-api.js";

const QUERY_PADRAO = "query { customStorefront { status repositorySshUrl lastErrorCode } }";

const { globals, rest } = extractGlobals(process.argv.slice(2));
const out = createOutput({ json: Boolean(globals.json) });
try {
  const { flags } = parseArgs(rest, { query: { type: "string" } });
  const dir = path.resolve(globals.dir ?? process.cwd());
  const loaded = loadProjectEnv({ dir, envFile: globals["env-file"] ?? ".env.local" });
  const env = requireCredentials(loaded);
  out.progress(`Credenciais: ${describeOrigins(loaded)}`);

  const api = await createPartnerApi({ env, out });
  out.progress(`Endpoint: ${api.endpoint}`);
  const shopId = await api.shopId();
  out.progress(`signIn ok, shopId do token: ${shopId || "(sem claim)"}`);

  const data = await api.request(flags.query ?? QUERY_PADRAO);
  out.result(
    { endpoint: api.endpoint, shopId, credenciais: connectionOrigins(loaded), data },
    (d) => JSON.stringify(d.data, null, 2),
  );
} catch (err) {
  out.fail(err);
  process.exitCode = err?.code === "USAGE" ? 2 : 1;
}
