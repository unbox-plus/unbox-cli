// `unbox analyze-version`: de que versão do template a loja partiu, o que mudou até a atual, o que a loja
// mudou por cima, o que o editor ainda não alcança, e se compensa refatorar ou refazer.
//
// Só lê a loja. Sem credenciais. Na rede, no máximo o `npm pack` do template da versão-base (em cache depois)
// e a consulta da latest do npm (2 s, falha em silêncio). O `upgrade-template` parte desta mesma análise.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "../args.js";
import { CliError, UsageError } from "../errors.js";
import { TEMPLATE_DIR, packageVersion } from "../paths.js";
import { applyStoreName } from "../theme.js";
import { baseVersion, latestPublished, loadMarkers } from "../template-version.js";
import { fetchTemplate } from "../template-fetch.js";
import { readTree, classificar, auditoriaDoEditor, numeros, regua, compareVersions, planoDeAplicacao, CHECKOUT_PROPRIO, SINAIS_DE_LOJA, PackageJsonInvalido } from "../template-diff.js";
import { lerMigracao, fichasEntre, variaveisDasFichas, SECOES } from "../migracao.js";

export const help = `
  unbox analyze-version: a versão do template desta loja, o que mudou desde então e o que fazer

  Uso:
    unbox analyze-version [--dir <pasta>] [--base <versão>] [--base-template <pasta>] [--no-network] [--json]

  Só lê. Sem credenciais. Mostra:
    1. a versão-base (o carimbo unbox.templateVersion do package.json; antes dele, por marcadores);
    2. cada arquivo do template classificado: copiar direto, reaplicar, reescrita, personalizado, novo,
       removido (é o que o unbox upgrade-template aplica ou deixa para você);
    3. o editor: rotas sem declaração, colisões, componentes sem primitivo;
    4. mudanças de comportamento que são decisão sua (catálogo em JSON, páginas em código);
    5. a régua: refatorar com o upgrade-template, ou refazer com unbox create;
    6. as fichas do MIGRACAO.md entre a base e a versão atual.

  --base <versão>          a versão-base, quando o carimbo ou o marcador engana (loja sincronizada à mão;
                           o primeiro commit "scaffold: create-unbox-store ..." diz a verdadeira)
  --base-template <pasta>  o template da base já extraído (versão não publicada, ou sem rede)
  --no-network             não consulta o npm (precisa do cache ou de --base-template)
  --json                   { base, atual, latest, grupos, pacote, editor, numeros, regua, fichas, ambiente, proximos }
`;

const SPEC = {
  base: { type: "string" },
  "base-template": { type: "string" },
  network: { type: "boolean", negatable: true },
};

/** A pasta é uma loja gerada pela CLI? (os dois arquivos que toda loja tem) */
export function exigeLoja(dir) {
  if (!fs.existsSync(path.join(dir, "package.json"))) throw new CliError(`Não achei package.json em ${dir}. Rode na pasta da loja (ou passe --dir).`, "SEM_PACKAGE_JSON");
  try { JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")); } catch (e) {
    throw new CliError(`O package.json da loja não é JSON válido (${e.message}). Corrija antes: o upgrade o reescreveria por cima.`, "PACKAGE_JSON_INVALIDO");
  }
  if (!SINAIS_DE_LOJA.every((s) => fs.existsSync(path.join(dir, s)))) {
    throw new CliError(`${dir} não parece uma loja gerada pela CLI (faltam ${SINAIS_DE_LOJA.join(" e ")}).`, "SEM_LOJA");
  }
}

/**
 * O nome que o create aplicou a esta loja (`applyStoreName`): o literal que ficou no lugar de "Minha Loja". Lido da
 * própria loja (em `app/api/unbox/paginas/route.ts`, depois `lib/seo-das-rotas.ts`), porque o create usa o nome
 * digitado no wizard, que nem sempre é o `nome` do briefing (a popai-snack tem "popai-snack" no código e
 * "Popai Snack" no briefing). O briefing é o último recurso.
 */
export function nomeDaLoja(dir) {
  const le = (rel) => { try { return fs.readFileSync(path.join(dir, rel), "utf8"); } catch { return ""; } };
  let m = le("app/api/unbox/paginas/route.ts").match(/NEXT_PUBLIC_SITE_NAME\s*(?:\|\||\?\?)\s*"((?:[^"\\]|\\.)*)"/);
  if (m) return m[1].replace(/\\(["\\])/g, "$1");
  m = le("lib/seo-das-rotas.ts").match(/NOME_NO_TITULO\s*=\s*"((?:[^"\\]|\\.)*)"/);
  if (m) return m[1].replace(/\\(["\\])/g, "$1");
  try { return JSON.parse(le("marca/briefing.json")).nome ?? null; } catch { return null; }
}

/**
 * Uma cópia do template com a MESMA personalização de nome que o create fez na loja, numa pasta temporária.
 * Vale para a base e para o atual: sem isso, cada "Minha Loja" trocado pelo create apareceria como conflito.
 */
function comNomeDaLoja(origem, nome, lojaDir) {
  if (!fs.existsSync(path.join(origem, "package.json"))) throw new CliError(`${origem} não tem um template da CLI (falta package.json).`, "TEMPLATE_INDISPONIVEL");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "unbox-tpl-"));
  fs.cpSync(origem, tmp, { recursive: true });
  if (nome) applyStoreName(tmp, nome);
  if (lojaDir) alinharComALoja(origem, tmp, lojaDir);
  return tmp;
}

// Os marcadores que o create troca (`applyStoreName`): o nome de exibição, o slug da porta de prévia e o do editor.
const MARCADORES = [
  { texto: "Minha Loja", grupo: "(.+?)" },
  { texto: '"minhaloja"', grupo: '"([^"\\n]*)"' },
  { texto: "__STORE_SLUG__", grupo: "([A-Za-z0-9_-]+)" },
];
const escapaRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Um nome só não descreve a loja: o create aplicou o nome do wizard, e o time depois trocou o literal à mão em
 * alguns arquivos e não em outros (a thryn-nutrition tem "thryn-nutrition" na rota do editor e "THRYN Nutrition" no
 * SEO e na PDP; o slug da porta, "thryn-nutrition", nem é o que a derivação de `applyStoreName` daria). Aplicar um
 * valor em todos fazia o template "atual" trazer de volta o literal errado nos arquivos que a análise manda copiar.
 * Então, linha a linha, onde `applyStoreName` trocou um marcador e a loja tem a MESMA linha com outro valor no
 * lugar dele, vale o valor da loja. Linha que a loja não tem (o template mudou ali) fica com o nome aplicado.
 */
function alinharComALoja(origem, tmp, lojaDir) {
  const texto = /\.(?:[cm]?[jt]sx?|json|md|css|txt)$/;
  const anda = (rel) => {
    for (const e of fs.readdirSync(path.join(tmp, rel), { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) anda(r);
      else if (texto.test(e.name)) alinhaArquivo(r);
    }
  };
  const alinhaArquivo = (rel) => {
    let cru, aplicado, daLoja;
    try { cru = fs.readFileSync(path.join(origem, rel), "utf8"); aplicado = fs.readFileSync(path.join(tmp, rel), "utf8"); } catch { return; }
    if (cru === aplicado) return;
    try { daLoja = fs.readFileSync(path.join(lojaDir, rel === "gitignore" ? ".gitignore" : rel), "utf8"); } catch { return; }
    const linhasCru = cru.split("\n"), linhasApl = aplicado.split("\n");
    if (linhasCru.length !== linhasApl.length) return;
    const linhasLoja = daLoja.split("\n");
    let mudou = false;
    for (let i = 0; i < linhasCru.length; i++) {
      if (linhasCru[i] === linhasApl[i]) continue;
      const presentes = MARCADORES.filter((m) => linhasCru[i].includes(m.texto));
      if (!presentes.length) continue;
      // a linha crua vira um padrão: o resto literal, cada marcador como captura (na ordem em que aparecem)
      const alvo = new RegExp(presentes.map((m) => escapaRegex(m.texto)).join("|"), "g");
      const pedacos = linhasCru[i].split(alvo);
      const achados = linhasCru[i].match(alvo).map((t) => presentes.find((m) => m.texto === t));
      const re = new RegExp(`^${pedacos.map(escapaRegex).reduce((acc, p, j) => acc + achados[j - 1].grupo + p)}$`);
      const casada = linhasLoja.map((l) => l.match(re)).find(Boolean);
      if (!casada) continue;
      let k = 0;
      linhasApl[i] = linhasCru[i].replace(alvo, (t) => {
        const valor = casada[++k];
        return t.startsWith('"') ? `"${valor}"` : valor;
      });
      mudou = true;
    }
    if (mudou) fs.writeFileSync(path.join(tmp, rel), linhasApl.join("\n"));
  };
  anda("");
}

/**
 * A análise inteira, compartilhada com o upgrade-template. `flags` já parseadas; `deps` para os testes:
 * `fetchTemplate`, `latest`, `cliVersion`, `templateDir`, `pack`.
 */
export async function analisar(dir, flags, { out, deps = {}, manterTemplate = false } = {}) {
  exigeLoja(dir);
  const tabela = loadMarkers();
  const base = baseVersion(dir, { base: flags.base, tabela });
  const atual = (deps.cliVersion ?? packageVersion)();
  const semRede = flags.network === false;
  const latest = semRede ? null : await (deps.latest ?? latestPublished)();
  if (compareVersions(base.versao, atual) > 0) {
    throw new CliError(`A loja partiu do template ${base.versao}, mais novo que esta CLI (${atual}). Rode com a última: npx --package=@unbox-plus/cli@latest unbox analyze-version`, "CLI_DESATUALIZADA");
  }
  const nome = nomeDaLoja(dir);
  const semCheckoutProprio = CHECKOUT_PROPRIO.every((c) => !fs.existsSync(path.join(dir, c)));

  const temporarias = [];
  try {
    const atualDir = comNomeDaLoja(deps.templateDir ?? TEMPLATE_DIR, nome, dir);
    temporarias.push(atualDir);
    const tplAtual = readTree(atualDir, { template: true, semCheckoutProprio });
    const loja = readTree(dir, { semCheckoutProprio });
    let baseDir = null, grupos, pacote, comparado = true;
    if (compareVersions(base.versao, atual) === 0) {
      ({ grupos, pacote } = classificar({ base: tplAtual, atual: tplAtual, loja }));
    } else if (flags["base-template"] || base.publicada || deps.fetchTemplate) {
      const origem = flags["base-template"] ? path.resolve(flags["base-template"]) : (deps.fetchTemplate ?? fetchTemplate)(base.versao, { publicada: base.publicada, semRede, out, deps });
      baseDir = comNomeDaLoja(origem, nome, dir);
      temporarias.push(baseDir);
      const tplBase = readTree(baseDir, { template: true, semCheckoutProprio });
      ({ grupos, pacote } = classificar({ base: tplBase, atual: tplAtual, loja }));
    } else {
      // Versão sem pacote no npm (< 0.21.3): a régua manda refazer; sem template da base não há classificação.
      comparado = false;
      ({ grupos, pacote } = classificar({ base: tplAtual, atual: tplAtual, loja }));
      for (const k of Object.keys(grupos)) grupos[k] = [];
    }
    const editor = auditoriaDoEditor({ base: baseDir ? readTree(baseDir, { template: true }) : tplAtual, atual: tplAtual, loja, grupos, raizDaLoja: dir });
    const n = numeros({ grupos, auditoria: editor, atual: tplAtual, versaoBase: base.versao });
    const r = regua(n, { comparado });
    const fichas = fichasEntre(lerMigracao(deps.migracao), base.versao, atual).map((f) => ({ versao: f.versao, ate: f.ate, titulo: f.titulo, ...f.secoes }));
    const ambiente = variaveisDasFichas(fichasEntre(lerMigracao(deps.migracao), base.versao, atual));
    const plano = planoDeAplicacao({ grupos, loja });
    const proximos = proximosPassos({ base, atual, latest, regua: r, comparado, plano });
    const { _pastasVivas, ...gruposPublicos } = grupos;
    const resultado = { dir, base, atual, latest, comparado, nome, grupos: gruposPublicos, pacote: pacote.relatorio, editor, numeros: n, regua: r, fichas, ambiente, plano, proximos, _loja: loja, _pacote: pacote };
    // O upgrade copia do template COM o nome da loja (não do cru): ele fica com a pasta e a apaga no fim.
    if (manterTemplate) { resultado._atualDir = atualDir; temporarias.splice(temporarias.indexOf(atualDir), 1); }
    return resultado;
  } catch (e) {
    if (e instanceof PackageJsonInvalido) throw new CliError(`${e.message}. Corrija antes de seguir.`, "PACKAGE_JSON_INVALIDO");
    throw e;
  } finally {
    for (const t of temporarias) fs.rmSync(t, { recursive: true, force: true });
  }
}

function proximosPassos({ base, atual, latest, regua, comparado, plano }) {
  const p = [];
  if (latest && compareVersions(latest, atual) > 0) p.push(`Há uma CLI mais nova no npm (${latest}); rode com npx --package=@unbox-plus/cli@latest para comparar com o template mais recente.`);
  if (compareVersions(base.versao, atual) === 0) { p.push(`A loja já está no template ${atual}. Nada a migrar.`); return p; }
  if (regua.recomendacao === "indeterminada") { p.push(`Sem o template da ${base.versao} não há o que classificar: ${regua.motivo}.`); return p; }
  if (regua.recomendacao === "refazer") {
    p.push(`Refazer: unbox create numa pasta nova e portar public/brand, fontes, tokens de cor, marca/, redirects e as seções próprias (com primitivos). A régua está em MIGRACAO.md.`);
    if (comparado) p.push("Se preferir refatorar mesmo assim: unbox upgrade-template --force (a parte mecânica) e o relatório de pendentes.");
    return p;
  }
  p.push(`Refatorar: unbox upgrade-template aplica ${plano.aplicar.copiar.length + plano.aplicar.novos.length + plano.aplicar.foundation.length} cópias e ${plano.aplicar.remover.length} remoções, e deixa ${plano.pendentes.length} arquivo(s) para você, com a cópia do template ao lado.`);
  p.push("Depois: npm install, npx tsc --noEmit, npm run build, as variáveis de ambiente das fichas, e npm run unbox:editavel.");
  return p;
}

// ------------------------------------------------------------------------------------- texto

const lista = (itens, fmt) => itens.map((i) => `      - ${fmt(i)}`);

export function texto(d) {
  const g = d.grupos, l = [""];
  l.push(`  Versão-base: ${d.base.versao} (${d.base.fonte})${d.base.lacunas.length ? `; lacunas: ${d.base.lacunas.join(", ")}` : ""}   Template atual: ${d.atual}${d.latest && compareVersions(d.latest, d.atual) > 0 ? `   (npm já tem ${d.latest})` : ""}`);
  if (!d.comparado) {
    l.push(`  A ${d.base.versao} não tem pacote no npm: sem o template da base, não há classificação por arquivo (passe --base-template).`);
  } else if (compareVersions(d.base.versao, d.atual) !== 0) {
    l.push("", "  Arquivos (template@base × template@atual × loja)");
    l.push(`    Copiar direto (template mudou, loja não tocou): ${g.copiar.length}`);
    l.push(`    Novos no template: ${g.novo_no_template.length}${g.novo_no_template.some((x) => x.colide) ? `, ${g.novo_no_template.filter((x) => x.colide).length} em colisão` : ""}`);
    l.push(...lista(g.novo_no_template.filter((x) => x.colide), (x) => `${x.arquivo}: ${x.motivo}`));
    l.push(`    Foundation do editor (cópia byte a byte): ${g.foundation.length}${g.foundation.some((f) => f.editada) ? `, ${g.foundation.filter((f) => f.editada).length} EDITADA À MÃO` : ""}`);
    l.push(...lista(g.foundation.filter((f) => f.editada), (f) => `${f.arquivo}: difere do template da base`));
    l.push(`    Removidos no template: ${g.removido_no_template.length}`);
    l.push(...lista(g.removido_no_template.filter((x) => x.loja_alterou || x.bloqueado), (x) => `${x.arquivo}: ${x.loja_alterou ? `a loja alterou (${x.linhas} linhas): recrie a lógica antes de apagar` : "fica (a pasta tem arquivo da loja)"}`));
    l.push(`    Reaplicar (os dois mudaram; a da loja é pequena): ${g.reaplicar.length}`);
    l.push(...lista(g.reaplicar, (x) => `${x.arquivo}  loja ${x.loja} linhas, template ${x.template}`));
    l.push(`    Reescrita (os dois mudaram; a da loja é a maior): ${g.reescrita.length}`);
    l.push(...lista(g.reescrita, (x) => `${x.arquivo}  loja ${x.loja} linhas, template ${x.template}`));
    l.push(`    Personalizados pelo create com mudança no template: ${g.personalizado.length}`);
    l.push(...lista(g.personalizado, (x) => `${x.arquivo}  template ${x.template} linhas (o diff base→atual é o que se reaplica)`));
    l.push(`    Removidos pela loja que o template ainda mudou: ${g.removido_pela_loja.filter((x) => x.template_mudou).length}`);
    l.push(...lista(g.removido_pela_loja.filter((x) => x.template_mudou), (x) => x.arquivo));
    l.push(`    Só a loja mudou: ${g.so_loja.length}   Novos na loja: ${g.novo_na_loja.length}   Intactos: ${g.intacto.length}`);
    const pk = d.pacote;
    if (pk.adicionadas.length || pk.atualizadas.length || pk.divergentes.length || pk.removidas_no_template.length) {
      l.push("    package.json (merge por chave):");
      l.push(...lista([...pk.adicionadas.map((x) => `entra ${x}`), ...pk.atualizadas.map((x) => `sobe ${x}`), ...pk.divergentes.map((x) => `diverge ${x} (fica o da loja)`), ...pk.removidas_no_template.map((x) => x)], (x) => x));
    }
  }
  const e = d.editor;
  l.push("", "  Editor (na ordem em que o gate unbox:editavel para)");
  l.push(`    lib/rotas-editaveis.ts: ${e.rotas_editaveis}`);
  l.push(`    Rotas do código sem declaração: ${e.rotas_sem_declaracao.length ? e.rotas_sem_declaracao.join(", ") : "nenhuma"}`);
  l.push(`    Coleções do lojista em colisão com o código: ${e.colecoes_em_colisao.length ? e.colecoes_em_colisao.join(", ") : "nenhuma"}`);
  l.push(`    Vitrine do editor ignorada na home: ${e.vitrine_ignorada ? "SIM (sem catalogoDasVitrines)" : "não"}`);
  l.push(`    Foundation editada à mão: ${e.foundation_editada_a_mao.length ? e.foundation_editada_a_mao.join(", ") : "nenhuma"}`);
  l.push(`    Componentes de conteúdo próprios: ${e.componentes_proprios.length}; sem nenhum primitivo: ${e.sem_primitivo.length}`);
  l.push(...lista(e.componentes_proprios.filter((c) => c.primitivos === 0), (c) => `${c.arquivo} (${c.linhas} linhas, ${c.origem})${c.html_cru ? `  [HTML cru sem sanitize ×${c.html_cru}, ${c.html_de_json ? "JSON do repositório" : "conferir a origem"}]` : ""}`));
  l.push(`    Integração (lib/unbox*) fora do template da base: ${e.integracao_alterada.length ? e.integracao_alterada.map((i) => `${i.arquivo} (${i.estado})`).join("; ") : "nenhuma"}`);
  l.push("", "  Mudanças de comportamento (decisão do dono da loja: migrar e perder o hard-coded, ou manter)");
  if (!e.catalogo_duplicado_no_repo.length && !e.rotas_proprias.length) l.push("    nenhuma detectada");
  for (const j of e.catalogo_duplicado_no_repo) l.push(`    Catálogo duplicado em ${j.arquivo} (${Math.round(j.bytes / 1024)} KB: ${j.chaves_de_catalogo.join(", ")}), lido por ${j.importado_por.length} arquivo(s) e, por tabela, mais ${j.e_por_tabela.length}. Migrar = dado de produto volta à API (o que a API não tem vira prosa em primitivo ou some); manter = o painel não é a fonte.`);
  for (const r of e.rotas_proprias) l.push(`    ${r.rota.padEnd(26)} ${r.tipo}${r.candidata_a_pagina_do_lojista ? "  → candidata a página do lojista (migrar = vira página do editor; manter = container + primitivos)" : ""}`);
  l.push("", `  Régua: ${d.regua.recomendacao.toUpperCase()}${d.regua.corte_duro ? ` (corte duro: base ${d.base.versao} < 0.22.0)` : d.regua.recomendacao === "indeterminada" ? ` (${d.regua.motivo})` : ` (${d.regua.sinais_ativos} de 5 sinais; refazer a partir de 3)`}`);
  for (const s of d.regua.sinais) l.push(`    ${s.ativo ? "✗" : "·"} ${s.nome}: ${s.valor}`);
  if (d.fichas.length) {
    l.push("", `  O que mudou (MIGRACAO.md, ${d.fichas.length} ficha(s))`);
    for (const f of d.fichas) {
      l.push(`    ${f.titulo}`);
      for (const s of SECOES) if (f[s] && !/^(nada|nenhuma conhecida)/i.test(f[s])) l.push(`      ${s}:`, ...f[s].split("\n").map((x) => `        ${x}`));
    }
    if (d.ambiente.entram.length || d.ambiente.saem.length) l.push(`    Ambiente: entram ${d.ambiente.entram.join(", ") || "nada"}; saem ${d.ambiente.saem.join(", ") || "nada"}`);
  }
  l.push("", "  Próximos passos");
  for (const p of d.proximos) l.push(`    ${p}`);
  return l.join("\n") + "\n";
}

export async function runAnalyzeVersion(args, globals = {}, { out, deps = {} } = {}) {
  if (globals.help) { process.stdout.write(help); return; }
  const { flags, positional } = parseArgs(args, SPEC);
  if (positional.length) throw new UsageError(`Argumento inesperado: "${positional[0]}". A pasta vai em --dir. Veja unbox analyze-version --help.`);
  const dir = path.resolve(globals.dir ?? process.cwd());
  const d = await analisar(dir, flags, { out, deps });
  const { _loja, _pacote, _atualDir, plano, ...publico } = d;
  out.result({ ...publico, plano: { aplicar: Object.fromEntries(Object.entries(plano.aplicar).map(([k, v]) => [k, v.map((x) => x.arquivo)])), pendentes: plano.pendentes.map(({ arquivo, grupo, motivo }) => ({ arquivo, grupo, motivo })) } }, () => texto(d));
}
