// Configuração central — lê variáveis de ambiente (server-only) e expõe os identificadores
// públicos da loja. NUNCA exporte segredos para o cliente daqui.
import "server-only";
import { SEGREDO_DA_LOJA } from "./segredo-da-loja";
import crypto from "node:crypto";
import { checkEnv } from "./env-check";

// UNBOX_PARTNER_API_KEY/USER/PASS são lidos sem lançar erro aqui — esse módulo é importado
// pelo layout raiz (toda página), então validar no import quebraria o app inteiro
// sem credenciais. A validação acontece em lib/unbox/store.ts, só quando uma página
// de fato tenta buscar dados da API (permite "modo mockup" sem credenciais).
export const serverEnv = {
  user: process.env.UNBOX_USER ?? "",
  pass: process.env.UNBOX_PASS ?? "",
  shopId: process.env.UNBOX_SHOP_ID ?? "",
  shopSlug: process.env.UNBOX_SHOP_SLUG ?? "",
  // API pública de PARCEIROS (partners.unbox.com.br): uma api key única por parceiro,
  // independente do nº de lojas, e é por ela que TODA chamada à Unbox passa. QUAL loja é o
  // UNBOX_USER/UNBOX_PASS que diz, no signIn. Ver lib/unbox/client.ts.
  partnerApiKey: process.env.UNBOX_PARTNER_API_KEY ?? "",
  partnerGqlUrl: process.env.UNBOX_PARTNER_GRAPHQL_URL ?? "https://partners.unbox.com.br/graphql",
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

// A key é do PARCEIRO e vale para todas as lojas dele; o user/senha é que diz QUAL loja.
// As três juntas habilitam o modo real (faltando qualquer uma → modo mockup).
export const hasUnboxCredentials = Boolean(
  serverEnv.partnerApiKey && serverEnv.user && serverEnv.pass,
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
