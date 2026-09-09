// Presets de ESTILO visual da loja: receita da home + tipografia + neutros + chrome +
// radius + hero. O CLI sugere um (suggestPreset), o usuário confirma no select, e
// applyPreset (theme.js) escreve tudo no projeto gerado. O agente de branding refina
// depois no briefing (agents/PADROES.md documenta o repertório).
//
// Regras dos presets:
//  - "essencial" é o default equilibrado (não mais "paridade com o visual histórico":
//    header sem barra de busca e hero full-bleed, que é o que tira a cara de template).
//  - Fontes: só famílias do Google Fonts com pesos 500-800 (o design usa font-extrabold).
//  - Neutros: hex literais por preset (o CLI escreve nos tokens --store-* de globals.css).

export const PRESETS = {
  essencial: {
    // dials do briefing (1-10) — variância de composição, intensidade de motion,
    // densidade visual. O agente 15 ajusta conforme a marca; ver agents/PADROES.md.
    dials: { variancia: 5, motion: 3, densidade: 6 },
    label: "Essencial",
    tagline: "layout completo e equilibrado, funciona pra qualquer loja",
    fonts: {
      sans: { fn: "Plus_Jakarta_Sans", weights: ["400", "500", "600", "700"] },
      display: { fn: "Poppins", weights: ["500", "600", "700", "800"] },
    },
    neutrals: {
      "--store-ink": "#18181B",
      "--store-ink-2": "#3F3F46",
      "--store-muted": "#71717A",
      "--store-faint": "#A1A1AA",
      "--store-bg": "#FAFAFA",
      "--store-surface": "#FFFFFF",
      "--store-surface-2": "#F4F4F5",
      "--store-line": "#E4E4E7",
      "--store-line-2": "#D4D4D8",
      "--store-sale": "#DC2626",
      "--store-sale-soft": "#FEE9E9",
    },
    chrome: "brand-dark",
    chromeRecipe: { header: "equilibrado", footer: "colunas" },
    radius: "0.875rem",
    axes: {
      "--section-gap": "52px", "--container-max": "1240px",
      "--card-bg": "#ffffff", "--card-border": "1px solid var(--store-line)", "--card-shadow": "none",
    },
    // hero full-bleed: o banner em card arredondado é o maior "cara de template" que existe.
    hero: "imagem-imersiva",
    home: [
      { section: "hero", variant: "imagem-imersiva", props: { imageDesktop: "/brand/hero-desktop.svg", imageMobile: "/brand/hero-mobile.svg", title: "Bem-vindo à nossa loja", subtitle: "Produtos escolhidos com cuidado, do nosso catálogo pra sua casa.", ctaLabel: "Ver destaques" } },
      { section: "trust-bar" },
      { section: "attributes-marquee" },
      { section: "category-pills" },
      { section: "combos-carousel" },
      { section: "savings" },
      { section: "benefits" },
      { section: "media-cards" },
      { section: "reviews", variant: "grid" },
      { section: "ritual" },
      { section: "founder-story" },
      { section: "kits" },
      { section: "spec-table" },
      { section: "video-wall" },
      { section: "trust-strip" },
      { section: "newsletter", variant: "bloco" },
    ],
  },

  promocional: {
    // dials do briefing (1-10) — variância de composição, intensidade de motion,
    // densidade visual. O agente 15 ajusta conforme a marca; ver agents/PADROES.md.
    dials: { variancia: 6, motion: 4, densidade: 9 },
    label: "Promocional",
    tagline: "oferta em primeiro plano: kits, economia e urgência pra subir o ticket",
    fonts: {
      sans: { fn: "Barlow", weights: ["400", "500", "600", "700"] },
      display: { fn: "Barlow_Condensed", weights: ["500", "600", "700", "800"] },
    },
    neutrals: {
      "--store-ink": "#09090B",
      "--store-ink-2": "#27272A",
      "--store-muted": "#71717A",
      "--store-faint": "#A1A1AA",
      "--store-bg": "#FFFFFF",
      "--store-surface": "#FAFAFA",
      "--store-surface-2": "#F4F4F5",
      "--store-line": "#E4E4E7",
      "--store-line-2": "#D4D4D8",
      "--store-sale": "#E11D48",
      "--store-sale-soft": "#FFE4E9",
    },
    chrome: "brand-dark",
    chromeRecipe: { header: "compacto", footer: "conversao" },
    radius: "1.25rem",
    axes: {
      "--section-gap": "44px", "--container-max": "1240px",
      "--card-bg": "#ffffff", "--card-border": "1px solid transparent", "--card-shadow": "0 8px 28px rgba(0,0,0,0.07)",
    },
    hero: "carousel",
    home: [
      { section: "hero", variant: "carousel", props: { banners: [
        { imageDesktop: "/brand/hero-desktop.svg", imageMobile: "/brand/hero-mobile.svg", href: "#comprar" },
        { imageDesktop: "/brand/hero-desktop.svg", imageMobile: "/brand/hero-mobile.svg", href: "#comprar" },
        { imageDesktop: "/brand/hero-desktop.svg", imageMobile: "/brand/hero-mobile.svg" },
      ] } },
      { section: "attributes-marquee" },
      { section: "purchase-hero" },
      { section: "product-showcase", props: { ctaHref: "#comprar" } },
      { section: "savings" },
      { section: "combos-carousel" },
      { section: "benefits" },
      { section: "stats-grid" },
      { section: "reviews-carousel" },
      { section: "media-cards" },
      { section: "comparison" },
      { section: "kits" },
      { section: "ritual", props: { ctaLabel: "Montar meu pedido" } },
      { section: "social-row" },
      { section: "trust-strip" },
      { section: "newsletter", variant: "bloco" },
    ],
  },

  editorial: {
    // dials do briefing (1-10) — variância de composição, intensidade de motion,
    // densidade visual. O agente 15 ajusta conforme a marca; ver agents/PADROES.md.
    dials: { variancia: 7, motion: 5, densidade: 4 },
    label: "Editorial",
    tagline: "clima de clube e assinatura, com respiro e tipografia de revista",
    fonts: {
      sans: { fn: "Inter", weights: ["400", "500", "600", "700"] },
      display: { fn: "Fraunces", weights: ["500", "600", "700", "800"] },
    },
    neutrals: {
      "--store-ink": "#1C1917",
      "--store-ink-2": "#44403C",
      "--store-muted": "#78716C",
      "--store-faint": "#A8A29E",
      "--store-bg": "#FAFAF9",
      "--store-surface": "#FFFFFF",
      "--store-surface-2": "#F5F5F4",
      "--store-line": "#E7E5E4",
      "--store-line-2": "#D6D3D1",
      "--store-sale": "#B91C1C",
      "--store-sale-soft": "#FBE8E8",
    },
    chrome: "ink-dark",
    chromeRecipe: { header: "centralizado", footer: "editorial" },
    radius: "0.5rem",
    axes: {
      "--section-gap": "72px", "--container-max": "1080px",
      "--card-bg": "var(--store-surface)", "--card-border": "1px solid transparent", "--card-shadow": "none",
    },
    hero: "split-editorial",
    home: [
      { section: "hero", variant: "split-editorial", props: { imageDesktop: "/brand/hero-desktop.svg", imageMobile: "/brand/hero-mobile.svg", title: "Feito com calma, entregue todo mês", subtitle: "Curadoria da nossa loja pra sua rotina. Conheça os destaques e, se fizer sentido, assine.", ctaLabel: "Ver destaques" } },
      { section: "attributes-marquee" },
      { section: "benefits" },
      { section: "combos-carousel" },
      { section: "founder-story" },
      { section: "ritual" },
      { section: "media-cards" },
      { section: "reviews", variant: "faixa" },
      { section: "quote-banner" },
      { section: "kits" },
      { section: "spec-table" },
      { section: "social-row" },
      { section: "newsletter", variant: "inline" },
    ],
  },

  boutique: {
    // dials do briefing (1-10) — variância de composição, intensidade de motion,
    // densidade visual. O agente 15 ajusta conforme a marca; ver agents/PADROES.md.
    dials: { variancia: 8, motion: 6, densidade: 2 },
    label: "Boutique",
    tagline: "minimal e premium: poucas seções, muito respiro, detalhes finos",
    fonts: {
      sans: { fn: "DM_Sans", weights: ["400", "500", "600", "700"] },
      display: { fn: "Playfair_Display", weights: ["500", "600", "700", "800"] },
    },
    neutrals: {
      "--store-ink": "#1A1A1F",
      "--store-ink-2": "#3F3F49",
      "--store-muted": "#71717D",
      "--store-faint": "#A5A5B0",
      "--store-bg": "#FBFBFC",
      "--store-surface": "#FFFFFF",
      "--store-surface-2": "#F4F4F6",
      "--store-line": "#E8E8EC",
      "--store-line-2": "#DCDCE2",
      "--store-sale": "#A63D2F",
      "--store-sale-soft": "#F6E7E3",
    },
    chrome: "ink-dark",
    chromeRecipe: { header: "imersivo", footer: "minimal" },
    radius: "0.25rem",
    axes: {
      "--section-gap": "88px", "--container-max": "1000px",
      "--card-bg": "#ffffff", "--card-border": "1px solid var(--store-line-2)", "--card-shadow": "none",
    },
    // hero imersivo: é o par do header "imersivo" (a foto sobe por baixo dele e o header
    // fica transparente). Sem foto boa da marca, troque na receita por "minimal-texto" —
    // o header degrada pra sólido sozinho.
    hero: "imagem-imersiva",
    home: [
      { section: "hero", variant: "imagem-imersiva", props: { title: "Peças escolhidas a dedo", subtitle: "Um catálogo enxuto, pensado pra durar. Conheça os destaques da casa.", ctaLabel: "Ver destaques" } },
      { section: "combos-carousel" },
      { section: "benefits" },
      { section: "media-cards" },
      { section: "quote-banner" },
      { section: "reviews", variant: "faixa" },
      { section: "founder-story" },
      { section: "kits" },
      { section: "spec-table" },
      { section: "newsletter", variant: "inline" },
    ],
  },
};

export const PRESET_NAMES = Object.keys(PRESETS);

// Heurística de sugestão: soma pontos por palavra-chave (sem acento, lowercase) no
// objetivo/site/instagram. Empate: promocional > editorial > boutique. Zero: essencial.
const KEYWORDS = {
  promocional: ["ticket", "upsell", "kit", "combo", "oferta", "promoc", "desconto", "atacado", "black", "volume", "venda", "conversao", "barato"],
  editorial: ["assinatura", "recorren", "clube", "curadoria", "conteudo", "comunidade", "blog", "receita", "ritual", "mensal"],
  boutique: ["premium", "minimal", "luxo", "sofistic", "estetic", "design", "autoral", "exclusiv", "boutique", "atelie", "artesanal", "fino"],
};

function normalize(s) {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Sugere um preset a partir do que o usuário contou no formulário. Nunca lança. */
export function suggestPreset({ objetivo, site, instagram } = {}) {
  const haystack = [objetivo, site, instagram].map(normalize).join(" ");
  const scores = {};
  for (const [preset, words] of Object.entries(KEYWORDS)) {
    scores[preset] = words.reduce((acc, w) => acc + (haystack.includes(w) ? 1 : 0), 0);
  }
  const order = ["promocional", "editorial", "boutique"]; // desempate
  const best = order.reduce((a, b) => (scores[b] > scores[a] ? b : a), "promocional");
  return scores[best] > 0 ? best : "essencial";
}
