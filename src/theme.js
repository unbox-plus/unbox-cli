import fs from "node:fs";
import path from "node:path";
import { PRESETS } from "./presets.js";

/**
 * Substitui os valores dos tokens `--store-*` (e `--radius`) no bloco "CONFIGURE" de
 * app/globals.css. Só troca o valor depois de `:`, nunca a chave nem o resto do arquivo.
 * Aceita hex e valores rem (radius).
 *
 * A regex é ANCORADA no início da linha (`^\s*`) e proibida de atravessar quebra de linha
 * (`[^;\n]`) por um motivo concreto: sem isso, uma MENÇÃO ao token dentro de um comentário
 * (ex.: "o token --motion: 0 desliga tudo") casava primeiro, e o `[^;]+` engolia tudo até o
 * `;` seguinte — várias linhas adiante, levando junto o fechamento do comentário e o
 * `@import` do Tailwind. O CSS saía quebrado e só o build acusava, com erro que não apontava
 * pra causa. Declaração de token vive sempre sozinha na linha; menção em prosa, não.
 */
export function applyBrandTokens(targetDir, tokens) {
  const cssPath = path.join(targetDir, "app", "globals.css");
  let css = fs.readFileSync(cssPath, "utf8");

  for (const [name, value] of Object.entries(tokens)) {
    const re = new RegExp(`^(\\s*${name}:\\s*)[^;\\n]+;`, "m");
    if (!re.test(css)) {
      throw new Error(`[create-unbox-store] token ${name} não encontrado em app/globals.css: a foundation pode ter mudado.`);
    }
    css = css.replace(re, `$1${value};`);
  }

  fs.writeFileSync(cssPath, css);
}

/**
 * Reescreve o bloco UNBOX-FONTS de app/layout.tsx com o par tipográfico do preset.
 * next/font exige declaração estática top-level — por isso replace de bloco marcado.
 */
export function applyFonts(targetDir, preset) {
  const layoutPath = path.join(targetDir, "app", "layout.tsx");
  let src = fs.readFileSync(layoutPath, "utf8");
  const re = /\/\/ UNBOX-FONTS-BEGIN[\s\S]*?\/\/ UNBOX-FONTS-END/;
  if (!re.test(src)) {
    throw new Error("[create-unbox-store] markers UNBOX-FONTS não encontrados em app/layout.tsx: a foundation pode ter mudado.");
  }
  const { sans, display } = preset.fonts;
  const families = [...new Set(["Geist_Mono", sans.fn, display.fn])].sort();
  const block = [
    "// UNBOX-FONTS-BEGIN (bloco reescrito pelo create-unbox-store conforme o estilo escolhido; não renomear os markers)",
    `import { ${families.join(", ")} } from "next/font/google";`,
    `const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });`,
    `const sans = ${sans.fn}({ variable: "--font-sans", subsets: ["latin"], weight: [${sans.weights.map((w) => `"${w}"`).join(", ")}], display: "swap" });`,
    `const displayFont = ${display.fn}({ variable: "--font-display", subsets: ["latin"], weight: [${display.weights.map((w) => `"${w}"`).join(", ")}], display: "swap" });`,
    "// UNBOX-FONTS-END",
  ].join("\n");
  fs.writeFileSync(layoutPath, src.replace(re, block));
}

/** Escreve a receita da home (components/home/home-recipe.ts) conforme o preset. */
/** Escreve components/chrome/chrome-recipe.ts — qual header e qual rodapé a loja usa.
 *  Mesma mecânica do applyHomeRecipe: reescreve o arquivo inteiro e falha alto se ele sumiu. */
export function applyChromeRecipe(targetDir, preset) {
  const recipePath = path.join(targetDir, "components", "chrome", "chrome-recipe.ts");
  if (!fs.existsSync(recipePath)) {
    throw new Error("[create-unbox-store] components/chrome/chrome-recipe.ts não encontrado: a foundation pode ter mudado.");
  }
  const recipe = preset.chromeRecipe ?? { header: "classico", footer: "colunas" };
  const content = `// ═══════════════════════════════════════════════════════════════════════════
// RECEITA DO CHROME: qual header e qual rodapé esta loja usa.
// Escrita pelo create-unbox-store conforme o ESTILO escolhido no setup; editada
// pelo agente de branding no briefing (é AQUI que o chrome muda, não reescreva
// o JSX de uma variante; catálogo em agents/PADROES.md).
// \`npm run typecheck\` acusa header/rodapé inexistente.
// ═══════════════════════════════════════════════════════════════════════════
import type { ChromeRecipe } from "@/components/chrome/registry";

export const chromeRecipe: ChromeRecipe = ${JSON.stringify(recipe, null, 2)};
`;
  fs.writeFileSync(recipePath, content);
}

export function applyHomeRecipe(targetDir, preset) {
  const recipePath = path.join(targetDir, "components", "home", "home-recipe.ts");
  if (!fs.existsSync(recipePath)) {
    throw new Error("[create-unbox-store] components/home/home-recipe.ts não encontrado: a foundation pode ter mudado.");
  }
  const body = JSON.stringify(preset.home, null, 2);
  const content = `// ═══════════════════════════════════════════════════════════════════════════
// RECEITA DA HOME: a ordem, as variantes e as props das seções.
// Escrita pelo create-unbox-store conforme o ESTILO escolhido no setup; editada
// pelo agente de branding no briefing (é AQUI que o layout muda, não reescreva
// o JSX das seções; catálogo de seções/variantes em agents/PADROES.md).
// \`npm run typecheck\` acusa seção/variante inexistente.
// ═══════════════════════════════════════════════════════════════════════════
import type { HomeRecipe } from "@/components/home/sections/registry";

export const homeRecipe: HomeRecipe = ${body};
`;
  fs.writeFileSync(recipePath, content);
}

// Cores DEFAULT usadas nos SVGs de hero placeholder — trocadas pelas da marca no scaffold.
// Sentinelas NEUTRAS (= os valores default da paleta), únicas entre si: o template cru já
// renderiza limpo e o recolorizador segue mapeando hex→token no scaffold.
const HERO_SVG_COLOR_SLOTS = {
  "#18181B": "--store-chrome-bg",
  "#3F3F46": "--store-ink-2",
  "#27272A": "--store-primary",
  "#D97706": "--store-cta",
  "#F1F1F3": "--store-primary-soft",
  "#FCFCFD": "--store-surface",
  "#F4F4F5": "--store-surface-2",
};

/** Recolore um SVG trocando as cores default pelos valores da marca. */
function recolorSvg(svg, palette) {
  for (const [hex, token] of Object.entries(HERO_SVG_COLOR_SLOTS)) {
    const value = palette[token];
    if (value) svg = svg.replaceAll(hex, value);
  }
  return svg;
}

/**
 * Escolhe o par de heros placeholder do preset, recolore com a marca e grava como
 * public/brand/hero-{desktop,mobile}.svg. Remove a pasta heros/ do projeto gerado.
 * Também recolore TODOS os placeholders de mídia em public/brand/ph/ (fotos, posters,
 * avatares usados pelas seções da biblioteca) — a loja nasce com a paleta da marca.
 */
export function applyHeroAssets(targetDir, presetName, tokens, neutrals) {
  const herosDir = path.join(targetDir, "public", "brand", "heros");
  const palette = { ...neutrals, ...tokens };
  for (const kind of ["desktop", "mobile"]) {
    const src = path.join(herosDir, `${presetName}-${kind}.svg`);
    if (!fs.existsSync(src)) {
      throw new Error(`[create-unbox-store] hero placeholder ${presetName}-${kind}.svg não encontrado: a foundation pode ter mudado.`);
    }
    const svg = recolorSvg(fs.readFileSync(src, "utf8"), palette);
    fs.writeFileSync(path.join(targetDir, "public", "brand", `hero-${kind}.svg`), svg);
  }
  fs.rmSync(herosDir, { recursive: true, force: true });

  const phDir = path.join(targetDir, "public", "brand", "ph");
  if (fs.existsSync(phDir)) {
    for (const f of fs.readdirSync(phDir)) {
      if (!f.endsWith(".svg")) continue;
      const p = path.join(phDir, f);
      fs.writeFileSync(p, recolorSvg(fs.readFileSync(p, "utf8"), palette));
    }
  }
}

/** Aplica o preset inteiro: tokens (cores+neutros+radius), fontes, receita e heros. */
export function applyPreset(targetDir, presetName, brandTokens) {
  const preset = PRESETS[presetName];
  if (!preset) throw new Error(`[create-unbox-store] estilo desconhecido: ${presetName}`);
  // --motion vem do dial: 0 desliga as animações, 1 é o padrão, acima disso amplifica.
  const motion = preset.dials?.motion != null ? (preset.dials.motion / 5).toFixed(2) : "1";
  applyBrandTokens(targetDir, {
    ...brandTokens, ...preset.neutrals, ...(preset.axes ?? {}),
    "--radius": preset.radius, "--motion": motion,
  });
  applyFonts(targetDir, preset);
  applyHomeRecipe(targetDir, preset);
  applyChromeRecipe(targetDir, preset);
  applyHeroAssets(targetDir, presetName, brandTokens, preset.neutrals);
  // manifest.ts e opengraph-image.tsx: os DOIS lugares onde a cor precisa ser hex literal, porque
  // nem o manifest do PWA nem o satori (ImageResponse) leem variavel de CSS. Sem reescrever aqui,
  // a loja aplica a paleta da marca em tudo e mesmo assim instala no celular e compartilha no
  // WhatsApp com a cor default da foundation.
  const tokens = { ...preset.neutrals, ...brandTokens };
  const chromeBg = tokens["--store-chrome-bg"];
  const manifestPath = path.join(targetDir, "app", "manifest.ts");
  if (chromeBg && fs.existsSync(manifestPath)) {
    const content = fs.readFileSync(manifestPath, "utf8");
    fs.writeFileSync(manifestPath, content.replace(/theme_color:\s*"[^"]*"/, `theme_color: "${chromeBg}"`));
  }
  const ogPath = path.join(targetDir, "app", "opengraph-image.tsx");
  const ogBg = tokens["--store-primary"];
  const ogFg = tokens["--store-chrome-text"] || "#FFFFFF";
  if (ogBg && fs.existsSync(ogPath)) {
    let og = fs.readFileSync(ogPath, "utf8");
    og = og.replace(/const PRIMARY = "[^"]*";/, `const PRIMARY = "${ogBg}";`);
    og = og.replace(/const PRIMARY_FG = "[^"]*";/, `const PRIMARY_FG = "${ogFg}";`);
    fs.writeFileSync(ogPath, og);
  }
  if (preset.chrome === "light") {
    fs.copyFileSync(
      path.join(targetDir, "public", "brand", "logo.svg"),
      path.join(targetDir, "public", "brand", "logo-chrome.svg"),
    );
    // Selo "Powered by Unbox": em rodapé CLARO a variante ativa é a com fundo preto
    // (regra da Unbox). O default do template (transparente neon) serve os chromes escuros.
    fs.copyFileSync(
      path.join(targetDir, "public", "unbox", "powered-by-fundo-preto.png"),
      path.join(targetDir, "public", "unbox", "powered-by.png"),
    );
  }
}

/** Troca o fallback "Minha Loja" pelo nome de exibição escolhido (header, footer e metadata). */
export function applyStoreName(targetDir, displayName) {
  if (!displayName) return;
  // Literal de string TS: escapa barra e aspas. E TODA substituição usa função (não string)
  // — com string, um nome com `$&` ou `$'` vira padrão de replace e corrompe o TSX.
  const safe = displayName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const lit = () => `?? "${safe}"`;
  const nome = () => safe;
  const files = [
    path.join(targetDir, "components", "site-header.tsx"),
    path.join(targetDir, "components", "site-footer.tsx"),
  ];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const content = fs.readFileSync(f, "utf8");
    fs.writeFileSync(f, content.replaceAll('?? "Minha Loja"', lit));
  }
  // metadata do app/layout.tsx (título da aba, template e OpenGraph siteName) e da PDP,
  // que repete siteName no seu próprio openGraph — o App Router substitui o objeto
  // openGraph inteiro do layout pai, não faz merge, então o campo precisa existir lá também.
  // (e app/api/unbox/paginas/route.ts: é o `nome` que a loja declara ao editor em `loja: { slug, nome }`)
  //
  // lib/paginas-seo.ts e app/llms.txt/route.ts pelo MESMO motivo, e eles ficaram de fora até a
  // revisão de 10/09: os dois têm `process.env.NEXT_PUBLIC_SITE_NAME || "Minha Loja"`, e o `.env.local`
  // que este CLI escreve não vai para o deploy (o .gitignore da loja ignora `.env*`). Sem a variável no
  // ambiente da Vercel, a MESMA página dizia dois nomes: o `<title>` trazia o da loja (vem do template
  // do layout, reescrito aqui) e o `og:site_name` do artigo trazia o placeholder. Reescrever o literal
  // não tira nada de ninguém: o ambiente continua vencendo quando existe.
  for (const rel of [["app", "layout.tsx"], ["app", "(loja)", "produto", "[productSlug]", "page.tsx"], ["app", "(loja)", "page.tsx"], ["app", "opengraph-image.tsx"], ["app", "api", "unbox", "paginas", "route.ts"], ["lib", "paginas-seo.ts"], ["app", "llms.txt", "route.ts"]]) {
    const p = path.join(targetDir, ...rel);
    if (!fs.existsSync(p)) continue;
    fs.writeFileSync(p, fs.readFileSync(p, "utf8").replaceAll("Minha Loja", nome));
  }
  // app/manifest.ts (nome do PWA na tela inicial — some com o "Minha Loja"/"Loja" placeholder)
  const manifestPath = path.join(targetDir, "app", "manifest.ts");
  if (fs.existsSync(manifestPath)) {
    const content = fs.readFileSync(manifestPath, "utf8");
    fs.writeFileSync(manifestPath, content.replaceAll('?? "Minha Loja"', lit).replaceAll('?? "Loja"', lit));
  }
  // Porta de preview: o slug vira nome do cookie e título do negócio no Pipedrive
  // ("<slug> - Nome do Lead"). Sem acento/espaço pra viver em nome de cookie.
  const slug = displayName
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 30) || "loja";
  for (const rel of [["middleware.ts"], ["app", "api", "acesso", "route.ts"]]) {
    const p = path.join(targetDir, ...rel);
    if (!fs.existsSync(p)) continue;
    const content = fs.readFileSync(p, "utf8");
    fs.writeFileSync(p, content.replaceAll('"minhaloja"', `"${slug}"`));
  }
  // Editor da Unbox: o MESMO slug vira o STORE_SLUG de lib/editable/config.ts (a foundation traz o
  // marcador __STORE_SLUG__; é por ele que a loja pede o conteúdo publicado ao editor). Tem de ser
  // IGUAL ao `slug` da entrada da loja no shops.json do editor, que segue esta mesma derivação
  // (minúsculas, sem acento, só letras e números). Marcador ausente é erro, não silêncio: uma loja
  // com "__STORE_SLUG__" no ar pede o publicado de uma loja que não existe e nunca muda.
  const configEditavel = path.join(targetDir, "lib", "editable", "config.ts");
  if (fs.existsSync(configEditavel)) {
    const content = fs.readFileSync(configEditavel, "utf8");
    if (!content.includes("__STORE_SLUG__")) {
      throw new Error("[create-unbox-store] marcador __STORE_SLUG__ não encontrado em lib/editable/config.ts: a foundation do editor pode ter mudado.");
    }
    fs.writeFileSync(configEditavel, content.replaceAll("__STORE_SLUG__", () => slug));
  }
}
