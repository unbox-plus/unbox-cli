// Matemática de cor mínima pra derivar a paleta da loja a partir de 2-3 cores escolhidas pelo
// usuário (primária + CTA, opcionalmente chrome). Sem dependências externas.

const HEX_RE = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export function normalizeHex(input) {
  const m = HEX_RE.exec(input.trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return `#${hex.toUpperCase()}`;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** Mistura `hex` com `target` (preto/branco) por `amount` (0-1). amount=0.2 → 20% em direção ao target. */
function mix(hex, target, amount) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
}

export const darken = (hex, amount = 0.15) => mix(hex, "#000000", amount);
export const lighten = (hex, amount = 0.15) => mix(hex, "#ffffff", amount);

/** Luminância relativa (WCAG simplificado) — decide se o texto sobre `hex` deve ser claro ou escuro. */
function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Texto de contraste (preto ou branco) pra ficar legível sobre `bgHex`. */
export function contrastText(bgHex) {
  return relativeLuminance(bgHex) > 0.45 ? "#1A1B18" : "#FFFFFF";
}

/**
 * Deriva os tokens de marca a partir de `primary` + `cta` (e opcionalmente `chromeBg`),
 * mais o MODO de chrome do preset:
 *  - "brand-dark" (default): chrome = primária escurecida (comportamento histórico)
 *  - "ink-dark":            chrome = tinta do estilo escurecida (neutro, não "cor da marca")
 *  - "light":               chrome claro (superfície do estilo, texto na tinta)
 * Mesmo conjunto de variáveis do bloco "CONFIGURE" em app/globals.css.
 */
export function deriveBrandTokens({ primary, cta, chromeBg }, preset) {
  const mode = preset?.chrome ?? "brand-dark";
  const neutrals = preset?.neutrals ?? {};
  const ink = neutrals["--store-ink"] ?? "#20211E";

  let resolvedChromeBg, chromeText, chromeMuted;
  if (chromeBg) {
    resolvedChromeBg = chromeBg;
    chromeText = contrastText(resolvedChromeBg);
    chromeMuted = mix(resolvedChromeBg, chromeText, 0.55);
  } else if (mode === "light") {
    resolvedChromeBg = neutrals["--store-surface"] ?? "#FAF8F3";
    chromeText = ink;
    chromeMuted = neutrals["--store-muted"] ?? "#85816F";
  } else if (mode === "ink-dark") {
    resolvedChromeBg = darken(ink, 0.35);
    chromeText = contrastText(resolvedChromeBg);
    chromeMuted = mix(resolvedChromeBg, "#FFFFFF", 0.55);
  } else {
    resolvedChromeBg = darken(primary, 0.55);
    chromeText = contrastText(resolvedChromeBg);
    chromeMuted = mix(resolvedChromeBg, "#FFFFFF", 0.55);
  }

  return {
    "--store-primary": primary,
    "--store-primary-dark": darken(primary, 0.15),
    "--store-primary-soft": lighten(primary, 0.88),
    "--store-cta": cta,
    "--store-cta-fg": contrastText(cta),
    "--store-cta-dark": darken(cta, 0.15),
    "--store-cta-soft": lighten(cta, 0.8),
    "--store-chrome-bg": resolvedChromeBg,
    "--store-chrome-text": chromeText,
    "--store-chrome-muted": chromeMuted,
    // divisores DENTRO do chrome (rodapé). Derivado do texto pra funcionar também em
    // chrome claro — um branco fixo a 10% sumiria por completo lá.
    "--store-chrome-line": mix(resolvedChromeBg, chromeText, 0.14),
  };
}
