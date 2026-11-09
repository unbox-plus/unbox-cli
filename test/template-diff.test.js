// O classificador de três árvores, puro: cada grupo com o arquivo que leva o nome do caso (helpers/template-fixture).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readTree, classificar, planoDeAplicacao, mergePackageJson, linhasDiferentes, regua, numeros, auditoriaDoEditor } from "../src/template-diff.js";
import { BASE, ATUAL, LOJA, monta } from "./helpers/template-fixture.mjs";

function arvores() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "unbox-diff-"));
  const base = readTree(monta(path.join(raiz, "base"), BASE), { template: true });
  const atual = readTree(monta(path.join(raiz, "atual"), ATUAL), { template: true });
  const lojaDir = monta(path.join(raiz, "loja"), LOJA());
  // o analyze aplica o nome da loja à base antes de comparar (applyStoreName); aqui, puro, a base já vem com ele
  base.set("components/site-header.tsx", Buffer.from(LOJA()["components/site-header.tsx"]));
  base.set("app/layout.tsx", Buffer.from(LOJA()["app/layout.tsx"]));
  atual.set("app/layout.tsx", Buffer.from(LOJA()["app/layout.tsx"]));
  const loja = readTree(lojaDir);
  return { raiz, base, atual, loja, lojaDir };
}
const nomes = (g) => g.map((x) => x.arquivo);

test("cada grupo recebe o arquivo do seu caso", () => {
  const { base, atual, loja } = arvores();
  const { grupos: g } = classificar({ base, atual, loja });
  assert.deepEqual(nomes(g.copiar), ["components/site-header.tsx", "lib/copiar.ts"]);
  assert.deepEqual(nomes(g.reaplicar), ["lib/reaplicar.ts"]);
  assert.deepEqual(nomes(g.reescrita), ["lib/reescrita.ts"]);
  assert.deepEqual(nomes(g.so_loja), ["lib/so-loja.ts"]);
  assert.ok(nomes(g.intacto).includes("lib/intacto.ts"));
  assert.ok(nomes(g.novo_na_loja).includes("lib/unbox/proprio.ts"));
  assert.deepEqual(nomes(g.novo_no_template).sort(), ["lib/novo-importa-ausente.ts", "lib/novo.ts", "lib/unbox.ts"]);
  assert.deepEqual(nomes(g.removido_no_template).sort(), ["lib/removido-importado.ts", "lib/removido.ts", "lib/unbox/x.ts", "lib/unbox/y.ts"]);
});

test("gitignore do template compara com .gitignore da loja; package.json fica fora da classificação", () => {
  const { base, atual, loja } = arvores();
  assert.ok(base.has(".gitignore") && !base.has("gitignore"));
  const { grupos: g } = classificar({ base, atual, loja });
  const todos = Object.values(g).flat().map((x) => x.arquivo);
  assert.ok(todos.includes(".gitignore"));
  assert.ok(!todos.includes("package.json"));
});

test("personalizado pelo create nunca vai para copiar: layout, globals.css e lib/editable/config.ts", () => {
  const { base, atual, loja } = arvores();
  const { grupos: g } = classificar({ base, atual, loja });
  assert.deepEqual(nomes(g.personalizado).sort(), ["app/globals.css", "lib/editable/config.ts"]);
  assert.ok(!nomes(g.copiar).includes("app/globals.css"));
  // personalizado que o template não mudou mas a loja mudou é so_loja (nunca copiar)
  const loja2 = new Map(loja); loja2.set("app/layout.tsx", Buffer.from("export const metadata = { title: \"Outro\" };\n"));
  const { grupos: g2 } = classificar({ base, atual, loja: loja2 });
  assert.ok(nomes(g2.so_loja).includes("app/layout.tsx"));
  assert.ok(!nomes(g2.copiar).includes("app/layout.tsx"));
});

test("foundation do editor: cópia byte a byte quando intacta; editada à mão vira pendente", () => {
  const { base, atual, loja } = arvores();
  const { grupos: g } = classificar({ base, atual, loja });
  assert.deepEqual(g.foundation.map((f) => [f.arquivo, f.editada]), [["lib/editable/document.ts", false], ["scripts/check-editable.mjs", false]]);
  const editada = new Map(loja);
  editada.set("lib/editable/document.ts", Buffer.from("export const doc = 1; // meu ajuste\n"));
  const { grupos: g2 } = classificar({ base, atual, loja: editada });
  assert.equal(g2.foundation.find((f) => f.arquivo === "lib/editable/document.ts").editada, true);
  const plano = planoDeAplicacao({ grupos: g2, loja: editada });
  assert.ok(plano.pendentes.some((p) => p.arquivo === "lib/editable/document.ts" && p.grupo === "foundation"));
  assert.ok(!plano.aplicar.foundation.some((f) => f.arquivo === "lib/editable/document.ts"));
});

test("regra de diretório: pasta removida no template com arquivo da loja fica inteira, e o homônimo novo colide", () => {
  const { base, atual, loja } = arvores();
  const { grupos: g } = classificar({ base, atual, loja });
  const x = g.removido_no_template.find((r) => r.arquivo === "lib/unbox/x.ts");
  const y = g.removido_no_template.find((r) => r.arquivo === "lib/unbox/y.ts");
  assert.equal(x.loja_alterou, true);
  assert.equal(y.loja_alterou, false);
  assert.equal(y.bloqueado, true, "y.ts intacto, mas a pasta tem x.ts alterado e proprio.ts: fica");
  const unbox = g.novo_no_template.find((n) => n.arquivo === "lib/unbox.ts");
  assert.equal(unbox.colide, true);
  assert.match(unbox.motivo, /lib\/unbox\//);
  const plano = planoDeAplicacao({ grupos: g, loja });
  assert.ok(!plano.aplicar.remover.some((r) => r.arquivo.startsWith("lib/unbox/")));
  assert.ok(!plano.aplicar.novos.some((n) => n.arquivo === "lib/unbox.ts"));
});

test("remoção segura só do que ninguém importa; o importado vira pendente com quem o importa", () => {
  const { base, atual, loja } = arvores();
  const { grupos: g } = classificar({ base, atual, loja });
  const plano = planoDeAplicacao({ grupos: g, loja });
  assert.deepEqual(nomes(plano.aplicar.remover), ["lib/removido.ts"]);
  const p = plano.pendentes.find((x) => x.arquivo === "lib/removido-importado.ts");
  assert.match(p.motivo, /ainda importado por lib\/importa-removido\.ts/);
});

test("novo no template cujo import não resolve na loja é detectado por naoResolve", () => {
  const { base, atual, loja } = arvores();
  const { grupos: g } = classificar({ base, atual, loja });
  const plano = planoDeAplicacao({ grupos: g, loja });
  assert.deepEqual(plano.naoResolve("lib/novo-importa-ausente.ts", atual.get("lib/novo-importa-ausente.ts")), ["@/lib/nao-existe"]);
  assert.deepEqual(plano.naoResolve("lib/novo.ts", atual.get("lib/novo.ts")), []);
});

test("reaplicar × reescrita: até 20 linhas, ou menos de 1/4 da mudança do template, é reaplicar", () => {
  const b = Buffer.from(Array.from({ length: 100 }, (_, i) => `l${i}`).join("\n"));
  const tplGrande = Buffer.from(Array.from({ length: 100 }, (_, i) => `t${i}`).join("\n"));
  const loja23 = Buffer.from(Array.from({ length: 100 }, (_, i) => (i < 23 ? `m${i}` : `l${i}`)).join("\n"));
  assert.equal(linhasDiferentes(b, loja23), 46);
  const base = new Map([["f.ts", b]]), atual = new Map([["f.ts", tplGrande]]), loja = new Map([["f.ts", loja23]]);
  const { grupos: g } = classificar({ base, atual, loja });
  assert.equal(g.reaplicar.length, 1, "23 linhas da loja contra 100 do template: reaplicar (< 1/4)");
  const tplPequeno = Buffer.from(b.toString().replace("l0", "t0"));
  const { grupos: g2 } = classificar({ base, atual: new Map([["f.ts", tplPequeno]]), loja });
  assert.equal(g2.reescrita.length, 1, "23 linhas da loja contra 1 do template: reescrita");
});

test("package.json por chave: nova entra, igual à base sobe, alterada pela loja fica, name e unbox são da loja", () => {
  const { base, atual, loja } = arvores();
  const { pkg, relatorio, mudou } = mergePackageJson(base.get("package.json"), atual.get("package.json"), loja.get("package.json"));
  assert.equal(mudou, true);
  assert.equal(pkg.name, "loja-teste");
  assert.deepEqual(pkg.unbox, { templateVersion: "0.29.0" });
  assert.equal(pkg.dependencies["@unbox-plus/sdk"], "^0.4.1");
  assert.equal(pkg.dependencies.next, "15.5.30", "a loja tinha o valor da base: sobe");
  assert.equal(pkg.dependencies.zod, "^4", "só da loja: fica");
  assert.equal(pkg.scripts["test:meu"], "node t");
  assert.equal(pkg.scripts["unbox:novo"], "node x");
  assert.ok(relatorio.adicionadas.includes("dependencies.@unbox-plus/sdk"));
  assert.ok(relatorio.atualizadas.some((x) => x.startsWith("dependencies.next")));
  const divergente = Buffer.from(JSON.stringify({ name: "loja", dependencies: { next: "14.0.0" } }));
  const r2 = mergePackageJson(base.get("package.json"), atual.get("package.json"), divergente);
  assert.equal(r2.pkg.dependencies.next, "14.0.0");
  assert.ok(r2.relatorio.divergentes.some((x) => x.startsWith("dependencies.next")));
});

test("auditoria do editor: rota sem declaração, coleção em colisão, catálogo em JSON e rota própria de prosa", () => {
  const { base, atual, loja, lojaDir } = arvores();
  const { grupos } = classificar({ base, atual, loja });
  const a = auditoriaDoEditor({ base, atual, loja, grupos, raizDaLoja: lojaDir });
  assert.deepEqual(a.rotas_sem_declaracao, ["/blog", "/sobre"]);
  assert.deepEqual(a.colecoes_em_colisao, ["blog"]);
  assert.equal(a.vitrine_ignorada, false);
  assert.equal(a.catalogo_duplicado_no_repo.length, 1);
  assert.equal(a.catalogo_duplicado_no_repo[0].arquivo, "lib/brand/catalogo.json");
  assert.ok(a.catalogo_duplicado_no_repo[0].importado_por.includes("lib/brand/catalogo.ts"));
  assert.ok([...a.catalogo_duplicado_no_repo[0].importado_por, ...a.catalogo_duplicado_no_repo[0].e_por_tabela].includes("components/brand/card.tsx"));
  const sobre = a.rotas_proprias.find((r) => r.rota === "/sobre");
  assert.equal(sobre.candidata_a_pagina_do_lojista, true);
  assert.equal(sobre.le_json, true);
  assert.ok(a.sem_primitivo.includes("components/brand/card.tsx"));
  assert.ok(!a.sem_primitivo.includes("app/(loja)/termos/page.tsx"), "SO_CHROME fica fora");
});

test("régua: corte duro abaixo de 0.22.0; de 0.22.0 em diante, três sinais mandam refazer", () => {
  const limpa = { versao_base: "0.24.0", reescrita: 2, fracao_em_conflito: 0.1, foundation_editada_a_mao: 0, integracao_com_logica_propria: 0, sem_primitivo: 5, rotas_sem_declaracao: 1 };
  assert.equal(regua(limpa).recomendacao, "refatorar");
  assert.equal(regua({ ...limpa, versao_base: "0.21.10" }).recomendacao, "refazer");
  assert.equal(regua({ ...limpa, versao_base: "0.21.10" }).corte_duro, true);
  const dois = { ...limpa, integracao_com_logica_propria: 2, sem_primitivo: 33, rotas_sem_declaracao: 13 };
  assert.equal(regua(dois).recomendacao, "refatorar");
  assert.equal(regua(dois).sinais_ativos, 2);
  assert.equal(regua({ ...dois, reescrita: 10 }).recomendacao, "refazer");
  assert.equal(regua({ ...dois, versao_base: "0.25.0", reescrita: 10 }).sinais_ativos, 2, "integração própria só conta abaixo do SDK");
});

test("números: fracao_em_conflito mede a loja, fracao_do_template_mudada mede o salto", () => {
  const { base, atual, loja, lojaDir } = arvores();
  const { grupos } = classificar({ base, atual, loja });
  const a = auditoriaDoEditor({ base, atual, loja, grupos, raizDaLoja: lojaDir });
  const n = numeros({ grupos, auditoria: a, atual, versaoBase: "0.29.0" });
  assert.equal(n.copiar, 2);
  assert.equal(n.reaplicar, 1);
  assert.equal(n.reescrita, 1);
  assert.ok(n.fracao_em_conflito > 0 && n.fracao_em_conflito < 1);
  assert.ok(n.fracao_do_template_mudada > 0);
});

test("template igual à base: nada muda, tudo intacto ou da loja", () => {
  const { base, loja } = arvores();
  const { grupos: g } = classificar({ base, atual: base, loja });
  for (const k of ["copiar", "reaplicar", "reescrita", "personalizado", "foundation", "novo_no_template", "removido_no_template"]) assert.equal(g[k].length, 0, k);
});
