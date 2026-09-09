// ═══════════════════════════════════════════════════════════════════════════
// MEDIDOR DE COMPOSIÇÃO DA RECEITA — npm run unbox:receita
//
// Converte "gosto" em número: conta seções, famílias de layout, repetição
// consecutiva da mesma família (o "zigzag" que faz a home parecer um sanfona)
// e a diversidade geral. Ideia vinda da taste-skill; os limites são NOSSOS.
//
// ⚠️ Hoje ele só MEDE e reporta (sempre exit 0). Vira gate no prebuild depois
// que os limites estiverem calibrados contra os 4 estilos — um check que
// reprova a própria foundation no dia 1 não serviria pra nada.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Família = o ESQUELETO visual da seção. Duas seções da mesma família em
// sequência repetem a mesma silhueta, mesmo com conteúdo diferente.
const FAMILIA = {
  hero: "hero",
  "purchase-hero": "hero",
  "trust-bar": "faixa", "trust-strip": "faixa", "attributes-marquee": "faixa",
  "category-pills": "chips",
  "combos-carousel": "carrossel", "reviews-carousel": "carrossel",
  "media-cards": "carrossel", "product-showcase": "grade",
  kits: "grade", reviews: "grade", benefits: "grade", "stats-grid": "grade",
  "social-row": "grade", "video-wall": "grade",
  savings: "comparativo", comparison: "comparativo", "spec-table": "tabela",
  "founder-story": "split", ritual: "split", "quote-banner": "split",
  newsletter: "captura",
};

const arquivos = [
  ["home", "components/home/home-recipe.ts"],
  ["oferta", "components/landing/landing-recipe.ts"],
];

let algumAviso = false;

for (const [nome, rel] of arquivos) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, "utf8");
  const secoes = [...src.matchAll(/section:\s*"([^"]+)"/g)].map((m) => m[1]);
  if (!secoes.length) continue;

  const familias = secoes.map((s) => FAMILIA[s] ?? "?");
  const distintas = new Set(familias);

  // maior sequência da MESMA família
  let maiorSeq = 1, seqAtual = 1;
  for (let i = 1; i < familias.length; i++) {
    seqAtual = familias[i] === familias[i - 1] ? seqAtual + 1 : 1;
    if (seqAtual > maiorSeq) maiorSeq = seqAtual;
  }

  console.log(`\n── receita "${nome}" — ${secoes.length} seções, ${distintas.size} famílias`);
  console.log(`   famílias: ${[...distintas].join(", ")}`);
  console.log(`   maior sequência da mesma família: ${maiorSeq}`);

  if (maiorSeq >= 3) {
    algumAviso = true;
    console.log(`   ⚠ ${maiorSeq} seções seguidas com a mesma silhueta — intercale outra família.`);
  }
  if (secoes.length >= 14 && distintas.size <= 5) {
    algumAviso = true;
    console.log(`   ⚠ home longa (${secoes.length}) com pouca variedade (${distintas.size} famílias) — corte ou diversifique.`);
  }
  const desconhecidas = secoes.filter((s) => !FAMILIA[s]);
  if (desconhecidas.length) {
    console.log(`   ℹ seções sem família mapeada (adicione em scripts/check-recipe.mjs): ${[...new Set(desconhecidas)].join(", ")}`);
  }
}

console.log(algumAviso ? "\nMedição concluída — há avisos acima.\n" : "\nMedição concluída — composição equilibrada.\n");
