// Configuração central — lê variáveis de ambiente (server-only) e expõe os identificadores
// públicos da loja. NUNCA exporte segredos para o cliente daqui.
import "server-only";
import { SEGREDO_DA_LOJA } from "./segredo-da-loja";
import crypto from "node:crypto";
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
  // SEM DEFAULT DE FÁBRICA. Este arquivo viaja num pacote npm PÚBLICO, e até a v0.21.2 havia
  // aqui uma string fixa de fallback: ela era o segredo de toda loja que não definiu a variável,
  // e quem lesse o pacote assinava o cookie de posse de pedido de qualquer uma delas. O valor
  // antigo não fica escrito nem em comentário, porque comentário viaja no pacote igual a código.
  // Em PRODUÇÃO fica VAZIO de propósito, e quem usa o segredo recusa a operação (lib/session.ts);
  // não dá para sortear um aqui, porque cada instância serverless sortearia o seu e a assinatura
  // não fecharia entre elas. Em DESENVOLVIMENTO vale um valor sorteado no boot: o dev não
  // configura nada e os cookies valem enquanto o servidor estiver de pé.
  sessionSecret:
    process.env.SESSION_SECRET ||
    SEGREDO_DA_LOJA ||
    (process.env.NODE_ENV === "production" ? "" : crypto.randomBytes(32).toString("hex")),
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
