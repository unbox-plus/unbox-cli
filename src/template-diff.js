// A comparação de três árvores (template da versão-base × template atual × a loja) que `unbox analyze-version`
// lê e `unbox upgrade-template` aplica. Tudo aqui é puro: recebe árvores em memória (`Map<rel, Buffer>`) e devolve
// dados; quem lê disco é `readTree`, quem escreve é o comando.
//
// A loja é uma cópia do template na versão-base mais o que o time escreveu por cima. Não há histórico do template
// na loja, então "migrar" é decidir arquivo a arquivo: copiar o atual, reaplicar a mudança da loja sobre ele, ou
// manter o da loja. A classificação abaixo é essa decisão, mecanizada onde dá e nomeada onde não dá.
import fs from "node:fs";
import path from "node:path";
/** O que não é código da loja (segredo, dependência, saída de ferramenta, insumo) e fica fora da comparação. `.claude/` ENTRA: o template leva agentes, settings e as skills de migração, e a loja precisa recebê-los. */
const EXCLUIR = [
  /^(node_modules|\.next|\.git|\.vercel|\.local|marca|producao|shots|reviews)\//,
  /^\.env$/, /^\.env\.local$/, /^\.env\..*\.local$/, /^\.mcp\.json$/,
  /^(bootstrap\.sh|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|\.DS_Store)$/,
  /^public\/(?!brand\/)/, // public/ é da loja (fotos, vídeos); só public/brand é do template, e é personalizado
];
/** O que o `create` reescreve depois de copiar (tokens, receitas, assets recoloridos, slug, segredo). Nunca se copia por cima. */
const PERSONALIZADO = [
  "app/globals.css", "app/layout.tsx", "app/manifest.ts", "app/opengraph-image.tsx",
  "components/chrome/chrome-recipe.ts", "components/home/home-recipe.ts",
  "lib/editable/config.ts", "lib/editable/tokens.ts", "lib/segredo-da-loja.ts",
];
const PERSONALIZADO_PREFIXO = ["public/brand/"];
/** A foundation do editor: cópia byte a byte; correção entra por versão, nunca à mão. */
const ehFoundation = (rel) => (rel.startsWith("lib/editable/") && !PERSONALIZADO.includes(rel)) || rel === "scripts/check-editable.mjs";
/** O `create` apaga estes com checkout hospedado; a loja sem eles não os quer de volta. */
export const CHECKOUT_PROPRIO = ["app/(loja)/checkout", "components/checkout", "app/api/checkout"];
export const SINAIS_DE_LOJA = ["agents/MANAGER.md", "scripts/check-unbox-brand.mjs"];

const REAPLICAR_MAX = 20;
const REAPLICAR_RAZAO = 0.25;

export const excluido = (rel) => EXCLUIR.some((re) => re.test(rel));
const personalizado = (rel) => PERSONALIZADO.includes(rel) || PERSONALIZADO_PREFIXO.some((p) => rel.startsWith(p));

/** Lê uma árvore do disco. `template: true` renomeia `gitignore` → `.gitignore`, como o create faz. */
export function readTree(raiz, { template = false, semCheckoutProprio = false } = {}) {
  const tree = new Map();
  const anda = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      let rel = path.relative(raiz, abs).split(path.sep).join("/");
      if (template && rel === "gitignore") rel = ".gitignore";
      if (excluido(rel) || (ent.isDirectory() && excluido(rel + "/"))) continue;
      if (semCheckoutProprio && CHECKOUT_PROPRIO.some((c) => rel === c || rel.startsWith(c + "/"))) continue;
      if (ent.isDirectory()) anda(abs);
      else if (ent.isFile()) tree.set(rel, fs.readFileSync(abs));
    }
  };
  anda(raiz);
  return tree;
}

export const ehTexto = (buf) => !buf.subarray(0, 8000).includes(0);
const iguais = (a, b) => a && b && a.equals(b);

/** Linhas que diferem entre dois textos, por multiconjunto (bloco movido conta zero; basta para a régua). */
export function linhasDiferentes(a, b) {
  const conta = (buf) => {
    const m = new Map();
    for (const l of buf.toString("utf8").split("\n")) m.set(l, (m.get(l) ?? 0) + 1);
    return m;
  };
  const ma = conta(a), mb = conta(b);
  let n = 0;
  for (const [l, c] of ma) n += Math.max(0, c - (mb.get(l) ?? 0));
  for (const [l, c] of mb) n += Math.max(0, c - (ma.get(l) ?? 0));
  return n;
}

/**
 * Classifica. Devolve `{ grupos, pacote }`: cada grupo é uma lista de `{ arquivo, ... }`.
 *   copiar               template mudou, loja igual à base: zero decisão
 *   reaplicar            os dois mudaram; a da loja é pequena (≤ 20 linhas ou < 1/4 da do template)
 *   reescrita            os dois mudaram; a da loja é a maior: a do template entra na versão da loja
 *   personalizado        o create reescreveu; se o template mudou, o diff base→atual é o que se reaplica à mão
 *   foundation           lib/editable e o gate: copiar byte a byte (ou pendente, se editada à mão: `editada`)
 *   novo_no_template     copiar, salvo `colide` (a loja já tem o caminho com outro conteúdo, ou uma pasta homônima: `lib/unbox.ts` × `lib/unbox/`);
 *                        já igual ao template na loja = intacto
 *   removido_no_template apagar, salvo `loja_alterou` ou `bloqueado` (a pasta tem arquivo da loja: nada da pasta sai)
 *   removido_pela_loja   a loja apagou; `template_mudou` diz se o template ainda conta com ele
 *   so_loja, intacto, novo_na_loja
 */
export function classificar({ base, atual, loja }) {
  const g = Object.fromEntries(["copiar", "reaplicar", "reescrita", "personalizado", "foundation", "novo_no_template",
    "removido_no_template", "removido_pela_loja", "so_loja", "intacto", "novo_na_loja"].map((k) => [k, []]));
  const dirsDaLoja = new Set([...loja.keys()].map((r) => r.split("/").slice(0, -1).join("/")).filter(Boolean));
  const todos = new Set([...base.keys(), ...atual.keys()]);
  for (const rel of [...todos].sort()) {
    if (rel === "package.json") continue; // merge por chave, fora da classificação
    const b = base.get(rel), a = atual.get(rel), l = loja.get(rel);
    if (b && !a) {
      if (l) g.removido_no_template.push({ arquivo: rel, loja_alterou: !iguais(b, l), linhas: ehTexto(b) && ehTexto(l) ? linhasDiferentes(b, l) : (iguais(b, l) ? 0 : 1) });
      continue;
    }
    if (a && !b) {
      // a loja já trouxe o arquivo novo à mão, igual ao template: nada a fazer (não é colisão)
      if (l && iguais(a, l)) { g.intacto.push({ arquivo: rel }); continue; }
      const semExt = rel.replace(/\.[^./]+$/, "");
      const colide = Boolean(l) || dirsDaLoja.has(semExt);
      g.novo_no_template.push({ arquivo: rel, colide, motivo: l ? "a loja já tem um arquivo com este caminho" : colide ? `a loja tem a pasta ${semExt}/, e o import ficaria ambíguo` : undefined });
      continue;
    }
    const tplMudou = !iguais(b, a);
    if (!l) {
      g.removido_pela_loja.push({ arquivo: rel, template_mudou: tplMudou });
      continue;
    }
    const lojaMudou = !iguais(b, l);
    if (ehFoundation(rel)) {
      if (tplMudou || lojaMudou) g.foundation.push({ arquivo: rel, editada: lojaMudou, template_mudou: tplMudou });
      else g.intacto.push({ arquivo: rel });
      continue;
    }
    if (personalizado(rel)) {
      if (tplMudou) g.personalizado.push({ arquivo: rel, template: ehTexto(b) && ehTexto(a) ? linhasDiferentes(b, a) : 1 });
      else (lojaMudou ? g.so_loja : g.intacto).push({ arquivo: rel });
      continue;
    }
    if (tplMudou && !lojaMudou) g.copiar.push({ arquivo: rel });
    else if (tplMudou && lojaMudou) {
      const texto = ehTexto(b) && ehTexto(a) && ehTexto(l);
      const dl = texto ? linhasDiferentes(b, l) : Infinity, dt = texto ? linhasDiferentes(b, a) : 1;
      const item = { arquivo: rel, loja: dl, template: dt };
      (dl <= REAPLICAR_MAX || dl < REAPLICAR_RAZAO * dt ? g.reaplicar : g.reescrita).push(item);
    } else if (lojaMudou) g.so_loja.push({ arquivo: rel });
    else g.intacto.push({ arquivo: rel });
  }
  for (const rel of [...loja.keys()].sort()) if (!todos.has(rel) && rel !== "package.json") g.novo_na_loja.push({ arquivo: rel });

  // Regra de diretório: uma pasta que o template apagou INTEIRA (lib/unbox/ no SDK) e em que a loja alterou ou
  // acrescentou arquivo fica inteira, até alguém decidir; pasta que o template ainda tem (lib/) não entra na regra.
  const dirsDoAtual = new Set([...atual.keys()].map((r) => path.posix.dirname(r)));
  const apagadas = new Set(g.removido_no_template.map((r) => path.posix.dirname(r.arquivo)).filter((d) => d !== "." && ![...dirsDoAtual].some((x) => x === d || x.startsWith(d + "/"))));
  const pastasVivas = new Set();
  for (const r of g.removido_no_template) if (r.loja_alterou && apagadas.has(path.posix.dirname(r.arquivo))) pastasVivas.add(path.posix.dirname(r.arquivo));
  for (const n of g.novo_na_loja) { const d = path.posix.dirname(n.arquivo); if (apagadas.has(d)) pastasVivas.add(d); }
  for (const r of g.removido_no_template) {
    const dir = path.posix.dirname(r.arquivo);
    const viva = [...pastasVivas].some((p) => dir === p || dir.startsWith(p + "/"));
    if (viva && !r.loja_alterou && dir !== ".") r.bloqueado = true;
  }
  for (const n of g.novo_no_template) {
    const semExt = n.arquivo.replace(/\.[^./]+$/, "");
    if (!n.colide && pastasVivas.has(semExt)) { n.colide = true; n.motivo = `a loja mantém a pasta ${semExt}/ com lógica própria`; }
  }
  g._pastasVivas = [...pastasVivas];
  return { grupos: g, pacote: mergePackageJson(base.get("package.json"), atual.get("package.json"), loja.get("package.json")) };
}

/**
 * package.json por chave, nunca por cópia: chave nova do template entra; chave existente só muda se o valor da
 * loja for igual ao da base (a loja não mexeu); chave só da loja fica; `name` e `unbox.*` são da loja.
 */
export class PackageJsonInvalido extends Error {
  constructor(qual) { super(`${qual} não é JSON válido`); this.code = "PACKAGE_JSON_INVALIDO"; }
}
export function mergePackageJson(baseBuf, atualBuf, lojaBuf) {
  const parse = (b, qual) => { if (!b) return {}; try { return JSON.parse(b.toString("utf8")); } catch { throw new PackageJsonInvalido(qual); } };
  const base = parse(baseBuf, "o package.json do template da base"), atual = parse(atualBuf, "o package.json do template atual"), loja = parse(lojaBuf, "o package.json da loja");
  const novo = JSON.parse(JSON.stringify(loja));
  const rel = { adicionadas: [], atualizadas: [], divergentes: [], removidas_no_template: [] };
  for (const sec of ["scripts", "dependencies", "devDependencies", "engines", "overrides"]) {
    const b = base[sec] ?? {}, a = atual[sec] ?? {}, l = loja[sec] ?? {};
    if (!atual[sec] && !loja[sec]) continue;
    novo[sec] = { ...l };
    for (const [k, v] of Object.entries(a)) {
      if (!(k in l)) { if (!(k in b)) { novo[sec][k] = v; rel.adicionadas.push(`${sec}.${k}`); } else rel.removidas_no_template.push(`${sec}.${k} (a loja apagou; o template ainda tem)`); }
      else if (l[k] === v) continue;
      else if (l[k] === b[k]) { novo[sec][k] = v; rel.atualizadas.push(`${sec}.${k}: ${l[k]} → ${v}`); }
      else rel.divergentes.push(`${sec}.${k}: loja ${l[k]}, template ${v}`);
    }
    for (const k of Object.keys(b)) if (!(k in a) && k in l) rel.removidas_no_template.push(`${sec}.${k} (o template tirou; a loja ainda tem)`);
  }
  for (const campo of ["type", "private"]) if (campo in atual && !(campo in loja)) { novo[campo] = atual[campo]; rel.adicionadas.push(campo); }
  return { pkg: novo, relatorio: rel, mudou: JSON.stringify(novo) !== JSON.stringify(loja) };
}

/**
 * O que o upgrade aplica, já com a conferência de imports (I4 da revisão): um arquivo copiado cujo import `@/x`
 * ou relativo não resolve na árvore resultante vai para pendentes, com o motivo.
 */
export function planoDeAplicacao({ grupos, loja }) {
  const aplicar = { copiar: [], novos: [], remover: [], foundation: [] };
  const pendentes = [];
  const pend = (item, grupo, motivo) => pendentes.push({ ...item, grupo, motivo });
  for (const c of grupos.copiar) aplicar.copiar.push(c);
  for (const f of grupos.foundation) (f.editada ? pend(f, "foundation", "lib/editable editada à mão: o template atual vai ao lado, compare antes de copiar") : aplicar.foundation.push(f));
  for (const n of grupos.novo_no_template) (n.colide ? pend(n, "novo_no_template", n.motivo) : aplicar.novos.push(n));
  // Quem, na loja, importa cada arquivo (para não apagar o que outro arquivo da loja ainda importa).
  const importadores = (rel) => {
    const semExt = rel.replace(/\.[^./]+$/, "").replace(/\/index$/, "");
    const quem = [];
    for (const [f, buf] of loja) {
      if (f === rel || !/\.(tsx?|jsx?|mjs|cjs)$/.test(f) || !ehTexto(buf)) continue;
      const src = buf.toString("utf8");
      for (const m of src.matchAll(/(?:from|import|require)\s*\(?\s*["']([^"']+)["']/g)) {
        const alvo = m[1].startsWith("@/") ? m[1].slice(2) : m[1].startsWith(".") ? path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])) : null;
        if (alvo && alvo.replace(/\.[^./]+$/, "") === semExt) { quem.push(f); break; }
      }
    }
    return quem;
  };
  const removidos = new Set(grupos.removido_no_template.filter((r) => !r.loja_alterou && !r.bloqueado).map((r) => r.arquivo));
  for (const r of grupos.removido_no_template) {
    if (r.loja_alterou) { pend(r, "removido_no_template", "a loja alterou um arquivo que o template apagou: recrie a lógica em outro lugar antes de apagar"); continue; }
    if (r.bloqueado) { pend(r, "removido_no_template", "a pasta tem arquivo da loja; nada dela é apagado até você decidir"); continue; }
    const quem = importadores(r.arquivo).filter((f) => !removidos.has(f) && !grupos.copiar.some((c) => c.arquivo === f));
    if (quem.length) pend({ ...r, importado_por: quem }, "removido_no_template", `ainda importado por ${quem.slice(0, 3).join(", ")}${quem.length > 3 ? "…" : ""}: reaponte antes de apagar`);
    else aplicar.remover.push(r);
  }
  for (const r of grupos.reaplicar) pend(r, "reaplicar", `copie o atual e reaplique a mudança da loja (${r.loja} linhas)`);
  for (const r of grupos.reescrita) pend(r, "reescrita", `a loja reescreveu (${r.loja} linhas); a mudança do template (${r.template} linhas) entra na versão da loja`);
  for (const p of grupos.personalizado) pend(p, "personalizado", `o create personalizou este arquivo; o diff base→atual do template (${p.template} linhas) é o que se reaplica`);

  // Imports: a árvore depois do upgrade. Um import que cai num novo que colide (`@/lib/unbox` com `lib/unbox/`
  // ainda na loja) ou numa pasta que ficou inteira é tratado como NÃO resolvido: o alvo que existe é o antigo.
  const arvore = new Set(loja.keys());
  for (const r of aplicar.remover) arvore.delete(r.arquivo);
  for (const x of [...aplicar.copiar, ...aplicar.novos, ...aplicar.foundation]) arvore.add(x.arquivo);
  const colididos = new Set(grupos.novo_no_template.filter((n) => n.colide).map((n) => n.arquivo.replace(/\.[^./]+$/, "")));
  const pastasVivas = grupos._pastasVivas ?? [];
  const resolve = (de, alvo) => {
    let p;
    if (alvo.startsWith("@/")) p = alvo.slice(2);
    else if (alvo.startsWith(".")) p = path.posix.normalize(path.posix.join(path.posix.dirname(de), alvo));
    else return true; // pacote
    p = p.replace(/\.(ts|tsx|js|mjs|cjs)$/, "");
    if (colididos.has(p) || pastasVivas.some((d) => p === d || p.startsWith(d + "/"))) return false;
    const cands = [p, ...["ts", "tsx", "js", "mjs", "cjs", "json", "css"].map((e) => `${p}.${e}`), ...["ts", "tsx", "js"].map((e) => `${p}/index.${e}`)];
    return cands.some((c) => arvore.has(c));
  };
  const ehCodigo = (rel) => /\.(tsx?|jsx?|mjs|cjs)$/.test(rel);
  const naoResolve = (rel, buf) => {
    if (!ehCodigo(rel) || !ehTexto(buf)) return [];
    const src = buf.toString("utf8");
    const imports = [...src.matchAll(/(?:from|import|require)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
    return [...new Set(imports.filter((i) => !resolve(rel, i)))];
  };
  return { aplicar, pendentes, naoResolve };
}

// ------------------------------------------------------------------------------ editor e comportamento

const PRIMITIVOS = /\bEditable\.(Text|RichText|Image|Img|Icon|Link|Slot|Section|Sections|Html|Video|Vitrine)\b|<Editable(Text|RichText|Image|Img|Icon|Link|Slot|Section|Sections|Html|Video|Vitrine|Fatia|Publico)\b|\buseEditable\(/g;
const FIACAO = new Set(["components/moldura-da-loja.tsx", "components/home/pagina-inicial.tsx"]);
const txt = (tree, rel) => (tree.get(rel) ? tree.get(rel).toString("utf8") : null);

function rotasDoCodigo(tree) {
  const r = new Set();
  for (const rel of tree.keys()) {
    const m = rel.match(/^app\/\(loja\)\/(.+\/)?page\.tsx$/);
    if (m) r.add("/" + (m[1] ?? "").replace(/\/$/, ""));
  }
  return [...r].sort();
}

/** primeiro segmento de URL que o código ocupa: app/ inteira (fora grupos, dinâmicas, privadas), metadados da raiz, e public/ (lido do disco, porque public/ fica fora da árvore). */
function segmentosReservados(tree, raizDaLoja) {
  const segs = new Set();
  for (const rel of tree.keys()) {
    const m = rel.match(/^app\/(?:\([^)]+\)\/)?([^/]+)/);
    if (!m) continue;
    const s = m[1];
    if (/^[\[_@(%]/.test(s)) continue;
    if (rel.split("/").length === 2) { if (!/^(layout|page|error|not-found|globals|loading|template)\b/.test(s)) segs.add(s.split(".")[0]); }
    else segs.add(s);
  }
  const pub = path.join(raizDaLoja, "public");
  if (fs.existsSync(pub)) for (const e of fs.readdirSync(pub)) segs.add(e.split(".")[0]);
  return segs;
}

export function auditoriaDoEditor({ base, atual, loja, grupos, raizDaLoja }) {
  const a = {};
  const tabela = txt(loja, "lib/rotas-editaveis.ts");
  a.rotas_editaveis = tabela === null ? "ausente" : (iguais(loja.get("lib/rotas-editaveis.ts"), atual.get("lib/rotas-editaveis.ts")) ? "igual ao template atual" : "alterado pela loja");
  const t = tabela ?? "";
  let m = t.match(/SO_CHROME[^=]*=\s*\[([^\]]*)\]/);
  const soChrome = new Set(m ? [...m[1].matchAll(/"(\/[^"]+)"/g)].map((x) => x[1]) : []);
  m = t.match(/CONTAINERS_POR_ROTA[^=]*=\s*\{([\s\S]*?)\n\};/);
  const declaradas = new Set(m ? [...m[1].matchAll(/^\s*"(\/[^"]*)"\s*:/gm)].map((x) => x[1]) : []);
  if (m) for (const x of m[1].matchAll(/"(\/[^"]+)":\s*\[\s*\]/g)) soChrome.add(x[1]);
  const robots = txt(loja, "app/robots.ts") ?? "";
  m = robots.match(/DISALLOW\s*=\s*\[([^\]]*)\]/);
  const bloqueadas = new Set(m ? [...m[1].matchAll(/"(\/[^"]+)"/g)].map((x) => x[1]) : []);
  const segmento = (r) => (r === "/" ? "/" : "/" + r.split("/")[1]);
  const foraDoEditor = (r) => bloqueadas.has(segmento(r)) || soChrome.has(r) || /^\/(_|%5F)/.test(segmento(r));

  const novos = new Set(grupos.novo_na_loja.map((x) => x.arquivo));
  const proprios = [...grupos.novo_na_loja, ...grupos.reescrita, ...grupos.so_loja].map((x) => x.arquivo);
  const comp = [];
  for (const rel of [...new Set(proprios)].sort()) {
    if (!rel.endsWith(".tsx") || !/^(components\/|app\/\(loja\)\/)/.test(rel) || FIACAO.has(rel) || /^components\/(account|checkout|cart)\//.test(rel)) continue;
    if (rel.startsWith("app/(loja)/")) {
      const rota = "/" + rel.replace(/^app\/\(loja\)\/(.*\/)?page\.tsx$/, "$1").replace(/\/$/, "");
      if (foraDoEditor(rota)) continue;
    }
    const s = txt(loja, rel) ?? "";
    if (!/<[A-Za-z]/.test(s)) continue; // page.tsx que só reexporta
    const cru = s.split("\n").filter((l) => l.includes("dangerouslySetInnerHTML") && !/sanitize|ldJson/.test(l)).length;
    comp.push({ arquivo: rel, origem: novos.has(rel) ? "nova" : "do template, alterada", primitivos: (s.match(PRIMITIVOS) ?? []).length, linhas: s.split("\n").length,
      html_cru: cru, html_de_json: cru > 0 && /from "@\/lib\/brand|\.json"/.test(s) });
  }
  a.componentes_proprios = comp;
  a.sem_primitivo = comp.filter((c) => c.primitivos === 0).map((c) => c.arquivo);
  a.html_cru_sem_sanitize = comp.filter((c) => c.html_cru).map((c) => ({ arquivo: c.arquivo, ocorrencias: c.html_cru, origem_provavel: c.html_de_json ? "JSON do repositório" : "conferir (API?)" }));
  const rotas = rotasDoCodigo(loja);
  a.rotas_do_codigo = rotas;
  a.rotas_sem_declaracao = rotas.filter((r) => !foraDoEditor(r) && !declaradas.has(r));
  const decl = txt(loja, "lib/paginas-do-lojista.ts") ?? "";
  const reservados = segmentosReservados(loja, raizDaLoja);
  a.colecoes_em_colisao = [...decl.matchAll(/handle:\s*"([^"]+)"/g)].map((x) => x[1]).filter((h) => reservados.has(h));
  const pi = txt(loja, "components/home/pagina-inicial.tsx");
  a.vitrine_ignorada = Boolean(pi) && !pi.includes("catalogoDasVitrines(");
  a.foundation_editada_a_mao = grupos.foundation.filter((f) => f.editada).map((f) => f.arquivo);
  a.integracao_alterada = [];
  for (const rel of [...loja.keys()].sort()) {
    if (!/^lib\/unbox(\/.*)?\.ts$/.test(rel)) continue;
    if (!base.has(rel)) a.integracao_alterada.push({ arquivo: rel, estado: "novo na loja", linhas: (txt(loja, rel) ?? "").split("\n").length });
    else if (!iguais(base.get(rel), loja.get(rel))) a.integracao_alterada.push({ arquivo: rel, estado: "alterado", linhas: linhasDiferentes(base.get(rel), loja.get(rel)) });
  }
  a.usa_sdk = /"@unbox-plus\/sdk"/.test(txt(loja, "package.json") ?? "");
  a.imports_lib_unbox_antigo = [...loja.keys()].filter((rel) => !rel.startsWith("lib/unbox/") && ehTexto(loja.get(rel)) && /@\/lib\/unbox\/|from "\.\.\/unbox\/|from "\.\/unbox\//.test(txt(loja, rel))).sort();

  // Mudanças de comportamento: catálogo duplicado em JSON e rotas próprias de prosa.
  const CHAVES = /"(descriptionHtml|variants|price|sku|productId|compareAt|imageUrls|ingredients)"/g;
  a.catalogo_duplicado_no_repo = [];
  for (const rel of [...loja.keys()].sort()) {
    if (!rel.endsWith(".json") || base.has(rel) || ["package.json", "tsconfig.json", "components.json"].includes(rel)) continue;
    const s = txt(loja, rel);
    const chaves = [...new Set([...s.matchAll(CHAVES)].map((x) => x[1]))].sort();
    if (chaves.length < 3) continue;
    const importa = (alvo) => [...loja.keys()].filter((f) => f !== alvo && ehTexto(loja.get(f)) && (txt(loja, f).includes(`${alvo.split("/").pop()}"`) || txt(loja, f).includes(`${"@/" + alvo.replace(/\.(tsx?|json)$/, "")}"`))).sort();
    const diretos = importa(rel);
    const via = [...new Set(diretos.filter((f) => f.startsWith("lib/")).flatMap((f) => importa(f)))].filter((f) => !diretos.includes(f)).sort();
    a.catalogo_duplicado_no_repo.push({ arquivo: rel, bytes: loja.get(rel).length, chaves_de_catalogo: chaves, importado_por: diretos, e_por_tabela: via });
  }
  const rotasBase = new Set(rotasDoCodigo(base));
  a.rotas_proprias = [];
  for (const r of rotas) {
    if (rotasBase.has(r) || foraDoEditor(r)) continue;
    const page = "app/(loja)" + (r === "/" ? "" : r) + "/page.tsx";
    const s = txt(loja, page) ?? "";
    const comps = [...s.matchAll(/from "@\/components\/([^"]+)"/g)].map((x) => x[1]);
    const fontes = s + comps.map((c) => txt(loja, `components/${c}.tsx`) ?? txt(loja, `components/${c}/index.tsx`) ?? "").join("");
    const leApi = /@\/lib\/(queries|unbox|vitrine|catalog-map)|@unbox-plus\/sdk/.test(fontes);
    const leJson = /\.json"/.test(fontes);
    const dinamica = r.includes("[");
    const blog = ["blog", "artigos", "noticias", "news"].includes(r.split("/")[1]);
    let tipo, candidata;
    if (blog) [tipo, candidata] = ["blog em código (lista + artigo viram coleção do lojista)", true];
    else if (dinamica) [tipo, candidata] = ["rota dinâmica própria (fica em código)", false];
    else if (leApi) [tipo, candidata] = ["prosa + vitrine do catálogo (a vitrine vira seção vitrine-de-produtos)", true];
    else [tipo, candidata] = ["só prosa/JSON", true];
    a.rotas_proprias.push({ rota: r, tipo, le_api: leApi, le_json: leJson, dinamica, candidata_a_pagina_do_lojista: candidata });
  }
  return a;
}

// ------------------------------------------------------------------------------ a régua

export function compareVersions(a, b) {
  const x = a.split(".").map((n) => parseInt(n, 10) || 0), y = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

export function numeros({ grupos, auditoria, atual, versaoBase }) {
  const g = grupos;
  const mudados = g.copiar.length + g.reaplicar.length + g.reescrita.length + g.novo_no_template.length + g.removido_no_template.length
    + g.removido_pela_loja.filter((x) => x.template_mudou).length + g.personalizado.length + g.foundation.filter((f) => f.template_mudou).length;
  const conflito = g.reaplicar.length + g.reescrita.length + g.removido_no_template.filter((x) => x.loja_alterou).length;
  const total = [...atual.keys()].length;
  return {
    versao_base: versaoBase,
    arquivos_template_atual: total,
    mudados_no_template_desde_a_base: mudados,
    copiar: g.copiar.length, reaplicar: g.reaplicar.length, reescrita: g.reescrita.length, personalizado: g.personalizado.length,
    so_loja: g.so_loja.length, novo_na_loja: g.novo_na_loja.length,
    fracao_em_conflito: mudados ? Math.round((conflito / mudados) * 100) / 100 : 0,
    fracao_do_template_mudada: total ? Math.round((mudados / total) * 100) / 100 : 0,
    componentes_proprios: auditoria.componentes_proprios.length,
    sem_primitivo: auditoria.sem_primitivo.length,
    rotas_sem_declaracao: auditoria.rotas_sem_declaracao.length,
    foundation_editada_a_mao: auditoria.foundation_editada_a_mao.length,
    integracao_com_logica_propria: auditoria.integracao_alterada.filter((i) => i.linhas > REAPLICAR_MAX).length,
  };
}

export const CORTE_DURO = "0.22.0";
export const SDK_DESDE = "0.25.0";

/** `{ recomendacao: "refatorar"|"refazer", corte_duro, sinais: [{ nome, valor, ativo }] }` (a régua de MIGRACAO.md). */
export function regua(n, { comparado = true } = {}) {
  const corteDuro = compareVersions(n.versao_base, CORTE_DURO) < 0;
  if (!comparado && !corteDuro) {
    return { recomendacao: "indeterminada", corte_duro: false, sinais_ativos: 0, sinais: [], motivo: "sem o template da versão-base não há classificação; passe --base-template <pasta> (git archive <tag> template no repo da CLI)" };
  }
  const sinais = [
    { nome: "reescrita ≥ 10", valor: n.reescrita, ativo: n.reescrita >= 10 },
    { nome: "fracao_em_conflito ≥ 0,4", valor: n.fracao_em_conflito, ativo: n.fracao_em_conflito >= 0.4 },
    { nome: "foundation_editada_a_mao > 0", valor: n.foundation_editada_a_mao, ativo: n.foundation_editada_a_mao > 0 },
    { nome: "integracao_com_logica_propria ≥ 1 com base < 0.25.0", valor: n.integracao_com_logica_propria, ativo: n.integracao_com_logica_propria >= 1 && compareVersions(n.versao_base, SDK_DESDE) < 0 },
    { nome: "sem_primitivo ≥ 30 e rotas_sem_declaracao ≥ 8", valor: `${n.sem_primitivo}/${n.rotas_sem_declaracao}`, ativo: n.sem_primitivo >= 30 && n.rotas_sem_declaracao >= 8 },
  ];
  const ativos = sinais.filter((s) => s.ativo).length;
  return { recomendacao: corteDuro || ativos >= 3 ? "refazer" : "refatorar", corte_duro: corteDuro, sinais_ativos: ativos, sinais };
}
