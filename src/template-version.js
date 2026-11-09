// A versão do template que gerou a loja, contra a versão atual da CLI.
//
// Da 0.30.0 em diante o `unbox create` carimba `unbox.templateVersion` no `package.json` da loja; antes
// disso não há carimbo, e a versão só sai por marcadores (src/version-markers.json, lido pela skill
// migrar-loja-analisar). A loja não recebe atualização sozinha, então "atrás" não é um aviso de pacote
// desatualizado: é um aviso de que existe uma migração a fazer, descrita em MIGRACAO.md.
//
// A versão atual vem do registry do npm (a `latest` publicada), com teto de 2 s e falha silenciosa: um
// `status` sem rede continua saindo, comparando com a versão da CLI que está rodando, que é pelo menos
// um piso. `UNBOX_NO_UPDATE_CHECK=1` desliga a consulta (CI, máquina sem saída para a internet).
import fs from "node:fs";
import path from "node:path";
import { PACKAGE_ROOT, packageVersion } from "./paths.js";
import { CliError } from "./errors.js";

export const PACOTE = "@unbox-plus/cli";
export const MIGRACAO_URL = "https://github.com/unbox-plus/unbox-cli/blob/main/MIGRACAO.md";
const REGISTRY = "https://registry.npmjs.org";

/** A tabela de marcadores (src/version-markers.json): como reconhecer a versão de uma loja anterior ao carimbo. */
export function loadMarkers() {
  return JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "src", "version-markers.json"), "utf8"));
}

/** Uma checagem da tabela contra a pasta da loja. */
function confere(dir, [tipo, rel, regex]) {
  const alvo = path.join(dir, rel);
  if (tipo === "file") return fs.existsSync(alvo) && fs.statSync(alvo).isFile();
  if (tipo === "dir") return fs.existsSync(alvo) && fs.statSync(alvo).isDirectory();
  if (!fs.existsSync(alvo)) return false;
  const hit = new RegExp(regex).test(fs.readFileSync(alvo, "utf8"));
  return tipo === "grep" ? hit : !hit;
}

/**
 * A versão-base da loja: `{ versao, fonte: "carimbo"|"marcadores"|"--base", lacunas, publicada }`.
 * Carimbo primeiro; sem ele, a mais alta cujos marcadores estão todos presentes. Sem nenhum: `VERSAO_DESCONHECIDA`.
 * `publicada` diz se há pacote no npm para baixar o template dela.
 */
export function baseVersion(dir, { base, tabela = loadMarkers() } = {}) {
  const publicada = (v) => tabela.marcadores.find((m) => m.versao === v)?.npm ?? compareVersions(v, tabela.carimbo.desde) >= 0;
  if (base) {
    if (!/^\d+\.\d+\.\d+$/.test(base)) throw new CliError(`--base precisa de uma versão no formato X.Y.Z (recebi "${base}").`, "USAGE");
    return { versao: base, fonte: "--base", lacunas: [], publicada: publicada(base) };
  }
  const carimbo = templateVersionOf(dir);
  if (carimbo) return { versao: carimbo, fonte: "carimbo", lacunas: [], publicada: publicada(carimbo) };
  const hits = tabela.marcadores.map((m) => m.checagens.every((c) => confere(dir, c)));
  const idx = hits.lastIndexOf(true);
  if (idx === -1) {
    throw new CliError("Não reconheci a versão do template desta loja: sem carimbo unbox.templateVersion no package.json e sem nenhum marcador de versão. Se é uma loja da CLI, passe --base <versão> (o primeiro commit, \"scaffold: create-unbox-store ...\", diz qual).", "VERSAO_DESCONHECIDA");
  }
  const v = tabela.marcadores[idx].versao;
  return { versao: v, fonte: "marcadores", lacunas: tabela.marcadores.slice(0, idx).filter((m, i) => !hits[i]).map((m) => m.versao), publicada: tabela.marcadores[idx].npm };
}

/** `unbox.templateVersion` do package.json em `dir`; null sem carimbo; undefined sem package.json legível. */
export function templateVersionOf(dir) {
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  } catch {
    return undefined;
  }
  const v = pkg?.unbox?.templateVersion;
  return typeof v === "string" && /^\d+\.\d+\.\d+/.test(v) ? v : null;
}

/** A `latest` publicada no npm, ou null (sem rede, registry fora, resposta estranha, ou desligado). */
export async function latestPublished({ fetchImpl = globalThis.fetch, timeoutMs = 2000, registry = process.env.UNBOX_NPM_REGISTRY ?? REGISTRY } = {}) {
  if (process.env.UNBOX_NO_UPDATE_CHECK === "1" || typeof fetchImpl !== "function") return null;
  try {
    const r = await fetchImpl(`${registry}/${PACOTE}/latest`, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json" } });
    if (!r.ok) return null;
    const v = (await r.json())?.version;
    return typeof v === "string" && /^\d+\.\d+\.\d+/.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** negativo se a < b, 0 se iguais, positivo se a > b (só os três números; pré-release ignorado). */
export function compareVersions(a, b) {
  const x = a.split(".").map((n) => parseInt(n, 10) || 0);
  const y = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

/**
 * A seção `template` do status: `{ versao, atual, fonte, atualizada }`.
 *   versao     o carimbo da loja; null = loja anterior ao carimbo
 *   atual      a versão de referência; fonte "npm" (a latest publicada) ou "cli" (a que está rodando)
 *   atualizada true quando versao >= atual; null quando não há carimbo
 * `null` quando `dir` não tem package.json (não é um projeto).
 */
export async function templateStatus(dir, { latest = latestPublished, cliVersion = packageVersion } = {}) {
  const versao = templateVersionOf(dir);
  if (versao === undefined) return null;
  const publicada = await latest();
  const atual = publicada ?? cliVersion();
  return {
    versao,
    atual,
    fonte: publicada ? "npm" : "cli",
    atualizada: versao ? compareVersions(versao, atual) >= 0 : null,
  };
}

/** As linhas do bloco "Template" do texto do status. */
export function linhasDoTemplate(t) {
  if (!t) return [];
  const l = ["  Template"];
  const ref = t.fonte === "npm" ? `CLI publicada ${t.atual}` : `CLI em uso ${t.atual} (não consegui consultar o npm)`;
  if (!t.versao) {
    l.push("    Versão:  anterior a 0.30.0 (sem carimbo no package.json)");
    l.push("             unbox analyze-version descobre a versão e diz o que mudou; unbox upgrade-template aplica a parte mecânica");
    return l;
  }
  if (t.atualizada) {
    l.push(`    Versão:  ${t.versao}, em dia com a ${ref}`);
    return l;
  }
  l.push(`    Versão:  ${t.versao}, atrás da ${ref}`);
  l.push("             a loja não atualiza sozinha: unbox analyze-version mostra o que mudou, unbox upgrade-template aplica a parte mecânica");
  l.push(`             (as fichas por versão: ${MIGRACAO_URL})`);
  return l;
}
