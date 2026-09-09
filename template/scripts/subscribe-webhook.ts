// ⚠️ EFEITO REAL: cria uma assinatura de webhook na loja de produção.
// Use sob demanda. Imprime o `secret` — cole em UNBOX_WEBHOOK_SECRET no .env.local.
//
//   npm run unbox:webhook:subscribe -- https://SEU-DOMINIO/api/webhooks/unbox
//   (em dev, exponha localhost com um túnel, ex.: ngrok/cloudflared)
import "./load-env"; // SEMPRE o primeiro import — parser de env idêntico ao do app
import { UnboxClient } from "../lib/unbox/client";

const endpoint = process.argv[2] || process.env.WEBHOOK_ENDPOINT;
if (!endpoint) {
  console.error("Uso: npm run unbox:webhook:subscribe -- <https://seu-dominio/api/webhooks/unbox>");
  process.exit(1);
}

(async () => {
  const client = new UnboxClient({
    apiKey: process.env.UNBOX_API_KEY ?? "",
    shopId: process.env.UNBOX_SHOP_ID!,
    // API de parceiros: presente = signIn e leituras compativeis roteiam pra ela
    partnerApiKey: process.env.UNBOX_PARTNER_API_KEY,
    partnerGqlUrl: process.env.UNBOX_PARTNER_GRAPHQL_URL,
    captchaBypass: process.env.UNBOX_CAPTCHA_BYPASS,
  });
  await client.signIn(process.env.UNBOX_USER!, process.env.UNBOX_PASS!);

  for (const eventType of ["ORDER_STATUS_UPDATE", "ORDER_CREATED"]) {
    try {
      const sub = await client.subscribeWebhook(eventType, endpoint);
      console.log(`✅ ${eventType} → ${endpoint}`);
      console.log(`   secret: ${sub.secret}`);
    } catch (e: any) {
      console.error(`❌ ${eventType}: ${e.message}`);
    }
  }
  console.log("\nCole o secret em UNBOX_WEBHOOK_SECRET no .env.local.");
})();
