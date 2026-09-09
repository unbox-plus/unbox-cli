// Configuração central — lê variáveis de ambiente (server-only) e expõe os identificadores
// públicos da loja. NUNCA exporte segredos para o cliente daqui.
import "server-only";
import { checkEnv } from "./env-check";

// UNBOX_API_KEY/USER/PASS são lidos sem lançar erro aqui — esse módulo é importado
// pelo layout raiz (toda página), então validar no import quebraria o app inteiro
// sem credenciais. A validação acontece em lib/unbox/store.ts, só quando uma página
// de fato tenta buscar dados da API (permite "modo mockup" sem credenciais).
export const serverEnv = {
  apiKey: process.env.UNBOX_API_KEY ?? "",
  user: process.env.UNBOX_USER ?? "",
  pass: process.env.UNBOX_PASS ?? "",
  shopId: process.env.UNBOX_SHOP_ID ?? "",
  shopSlug: process.env.UNBOX_SHOP_SLUG ?? "",
  authUrl: process.env.UNBOX_AUTH_URL ?? "https://api.unbox.com.br",
  gqlUrl: process.env.UNBOX_GRAPHQL_URL ?? "https://core.unbox.com.br/graphql",
  // API pública de PARCEIROS (nova): uma api key única por parceiro, independente do nº de
  // lojas. Setar UNBOX_PARTNER_API_KEY liga o roteamento: signIn + leituras com paridade
  // passam por partners.unbox.com.br; o restante (carrinho/checkout/cliente) segue no core
  // até a Unbox liberar as escritas na API de parceiros. Ver lib/unbox/client.ts.
  partnerApiKey: process.env.UNBOX_PARTNER_API_KEY ?? "",
  partnerGqlUrl: process.env.UNBOX_PARTNER_GRAPHQL_URL ?? "https://partners.unbox.com.br/graphql",
  captchaBypass: process.env.UNBOX_CAPTCHA_BYPASS ?? "",
  webhookSecret: process.env.UNBOX_WEBHOOK_SECRET ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "dev-insecure-session-secret-change-me",
  crmWebhookUrl: process.env.CRM_WEBHOOK_URL ?? "",
  revalidateSecret: process.env.REVALIDATE_SECRET ?? "",
};

// No modelo antigo a loja tem api key própria; no novo, a key é do PARCEIRO. Qualquer uma
// das duas + user/pass da loja habilita o modo real (sem nenhuma → modo mockup).
export const hasUnboxCredentials = Boolean(
  (serverEnv.apiKey || serverEnv.partnerApiKey) && serverEnv.user && serverEnv.pass,
);

/** Decodifica os claims do JWT (sem validar — só para extrair shopId/shopSlug). */
export function decodeJwtClaims(jwt: string): Record<string, any> {
  try {
    const payload = jwt.split(".")[1];
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export const SHOP_ID_CLAIM = "arn:unbox:shopId";
export const SHOP_SLUG_CLAIM = "arn:unbox:shopSlug";

checkEnv();
