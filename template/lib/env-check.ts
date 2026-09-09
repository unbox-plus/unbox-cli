// Sanidade das variáveis de ambiente — roda uma vez no boot do servidor (importado pelo
// lib/config.ts). Não valida segredo (impossível), valida FORMA: um valor que parece prosa
// ("chave da loja (x-api-key...)") é sinal de que o comentário do .env virou valor no deploy.
// Presença truthy não é validade — foi essa confusão que derrubou a /api/capi de uma loja.
import "server-only";

const CHAVES = [
  "UNBOX_PARTNER_API_KEY", "UNBOX_CAPTCHA_BYPASS", "UNBOX_API_KEY", "UNBOX_USER", "UNBOX_PASS",
  "UNBOX_SHOP_ID", "UNBOX_SHOP_SLUG", "UNBOX_WEBHOOK_SECRET", "SESSION_SECRET", "REVALIDATE_SECRET",
  "UNBOX_HOSTED_CHECKOUT_URL", "META_PIXEL_ID", "META_CAPI_TOKEN", "NEXT_PUBLIC_GA_ID",
  "NEXT_PUBLIC_META_PIXEL_ID", "PREVIEW_PASSWORD", "PIPEDRIVE_API_TOKEN", "PREVIEW_WEBHOOK_URL",
];

/** Parece comentário/prosa: tem `#`, ou tem espaço, ou é uma frase com acento/parênteses. */
function pareceProsa(v: string) {
  return /#/.test(v) || /\s/.test(v.trim()) || /[()áéíóúãõçÁÉÍÓÚÃÕÇ]/.test(v);
}

let avisado = false;
export function checkEnv() {
  if (avisado) return;
  avisado = true;
  const problemas: string[] = [];
  for (const k of CHAVES) {
    const v = process.env[k];
    // NUNCA imprime o valor: a lista inclui senha e tokens, e o próprio .env.example sugere
    // UNBOX_PASS="#minhaSenha$123" — com o `#` ela cairia aqui e iria inteira pro log da Vercel.
    // Só o nome da variável e o motivo.
    if (v && pareceProsa(v)) problemas.push(`${k}: contém ${/#/.test(v) ? "'#'" : /\s/.test(v.trim()) ? "espaço" : "acento/parêntese"} (parece comentário copiado como valor)`);
  }
  const pixel = process.env.META_PIXEL_ID;
  if (pixel && !/^\d{5,}$/.test(pixel)) problemas.push("META_PIXEL_ID: não é numérico");
  const ga = process.env.NEXT_PUBLIC_GA_ID;
  if (ga && !/^G-[A-Z0-9]{6,}$/i.test(ga)) problemas.push("NEXT_PUBLIC_GA_ID: não tem a forma G-XXXXXXX");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (process.env.NODE_ENV === "production" && (!site || /localhost|127\.0\.0\.1/.test(site) || !site.startsWith("https://"))) {
    problemas.push("NEXT_PUBLIC_SITE_URL: ausente ou localhost em PRODUÇÃO — canonical, sitemap, robots, Open Graph, JSON-LD e o link de recuperação de carrinho saem apontando para localhost");
  }
  if (process.env.NODE_ENV === "production" && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.includes("dev-insecure"))) {
    problemas.push("SESSION_SECRET: vazio ou default de desenvolvimento em PRODUÇÃO — a posse dos pedidos (cookie unbox_order_*) fica forjável; gere um valor aleatório longo");
  }
  if (problemas.length) {
    console.warn("\n⚠ [env] valores que parecem COMENTÁRIO copiado como valor (o .env tinha `CHAVE=  # texto`?):");
    for (const p of problemas) console.warn("   • " + p);
    console.warn("   Corrija no painel de variáveis do deploy. Enquanto isso, a integração correspondente vai falhar.\n");
  }
}
