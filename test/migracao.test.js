// O parser do MIGRACAO.md: títulos com versão e intervalo, as cinco seções, a seleção base<v≤atual e as variáveis.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMigracao, lerMigracao, fichasEntre, variaveisDasFichas, SECOES } from "../src/migracao.js";
import { migracaoFalsa } from "./helpers/template-fixture.mjs";

test("parse: versão, intervalo, cinco seções; títulos sem versão e blocos de código são ignorados", () => {
  const f = parseMigracao(migracaoFalsa() + "\n## Prosa\n\n```\n## 9.9.9\n### Template\n```\n");
  assert.deepEqual(f.map((x) => [x.versao, x.ate]), [["0.30.0", "0.30.0"], ["0.29.0", "0.29.0"], ["0.26.0", "0.28.0"]]);
  for (const s of SECOES) assert.ok(s in f[0].secoes, s);
  assert.equal(f[0].secoes["Loja já gerada"], "copiar lib/novo.ts");
  assert.equal(f[1].secoes.Ambiente, "- `VAR_ANTIGA`");
});

test("fichasEntre: limite superior do intervalo acima da base, inferior até a atual", () => {
  const f = parseMigracao(migracaoFalsa());
  assert.deepEqual(fichasEntre(f, "0.25.0", "0.30.0").map((x) => x.versao), ["0.30.0", "0.29.0", "0.26.0"]);
  assert.deepEqual(fichasEntre(f, "0.27.0", "0.29.0").map((x) => x.versao), ["0.29.0", "0.26.0"], "0.27.0 está dentro de 0.26.0 a 0.28.0: a ficha vale");
  assert.deepEqual(fichasEntre(f, "0.29.0", "0.30.0").map((x) => x.versao), ["0.30.0"]);
  assert.deepEqual(fichasEntre(f, "0.30.0", "0.30.0"), []);
});

test("variáveis: entram e saem pelas linhas de Ambiente, com vários nomes por sinal", () => {
  const f = parseMigracao("## 1.0.0\n### Template\nx\n### Loja já gerada\nx\n### Ambiente\n+ `A`, `B` (build) · - `C`\n- `D`, `E`\n### Mudanças de comportamento\nnada\n### Armadilhas\nnada\n");
  assert.deepEqual(variaveisDasFichas(f), { entram: ["A", "B"], saem: ["C", "D", "E"] });
  const real = fichasEntre(lerMigracao(), "0.21.3", "0.30.0");
  const v = variaveisDasFichas(real);
  assert.ok(v.entram.includes("UNBOX_PARTNER_API_KEY") && v.entram.includes("NEXT_PUBLIC_ADMIN_ORIGIN"));
  assert.ok(v.saem.includes("UNBOX_CAPTCHA_BYPASS"));
});

test("o MIGRACAO.md do pacote é parseável e tem a ficha de toda versão com marcador a partir de 0.20.0", () => {
  const f = lerMigracao();
  const versoes = f.map((x) => x.versao);
  assert.ok(versoes.includes("0.30.0") && versoes.includes("0.29.0") && versoes.includes("0.25.0") && versoes.includes("0.22.0"));
  for (const x of f) for (const s of SECOES) assert.ok(x.secoes[s], `${x.versao}: ${s} vazio`);
  assert.equal(fichasEntre(f, "0.24.0", "0.29.0").map((x) => x.versao).join(","), "0.29.0,0.26.0,0.25.0");
});
