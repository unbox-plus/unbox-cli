// Recuperação de carrinho abandonado (doc 10/11): fica com o storefront. Em produção, um
// cron varre os carrinhos persistidos (itens + e-mail, sem pedido há N min) e dispara o CRM.
//
// Aqui é uma DEMONSTRAÇÃO executável: como não há DB neste projeto self-contained, recebe um
// cartId+token (de um carrinho real, com e-mail capturado) e dispara o evento de CRM se houver
// itens e e-mail. Em produção, troque a fonte por uma consulta ao seu DB de ponteiros de carrinho.
//
//   npm run unbox:abandoned -- <cartId> <cartToken>
//
// Não importa dispatchCrm de lib/crm.ts (só o TYPE, apagado em tempo de compilação): lib/crm.ts
// tem `import "server-only"`, um pacote que só existe dentro do bundler do Next — via tsx/Node
// puro ele SEMPRE lança "Cannot find module 'server-only'" e o script nunca chega a executar.
// Reimplementa o mesmo dispatch aqui lendo process.env direto, igual aos outros scripts.
import "./load-env"; // SEMPRE o primeiro import — parser de env idêntico ao do app
import { UnboxClient } from "../lib/unbox/client";
import { buildRecoveryUrl } from "../lib/cart-recovery";
import type { CrmEvent } from "../lib/crm";

async function dispatchCrm(event: CrmEvent): Promise<{ ok: boolean; skipped?: boolean }> {
  const crmWebhookUrl = process.env.CRM_WEBHOOK_URL ?? "";
  if (!crmWebhookUrl) {
    console.info("[crm] CRM_WEBHOOK_URL não configurada — evento ignorado:", event.type);
    return { ok: true, skipped: true };
  }
  try {
    const res = await fetch(crmWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "unbox-storefront", ...event, at: new Date().toISOString() }),
    });
    return { ok: res.ok };
  } catch (e) {
    console.error("[crm] falha ao despachar evento", e);
    return { ok: false };
  }
}

const [cartId, cartToken] = process.argv.slice(2);
if (!cartId || !cartToken) {
  console.error("Uso: npm run unbox:abandoned -- <cartId> <cartToken>");
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

  const cart = await client.getCart(cartId, cartToken);
  if (!cart) {
    console.log("Carrinho não encontrado/expirado — nada a recuperar.");
    return;
  }
  const itemCount = cart.items?.totalCount ?? cart.items?.edges?.length ?? 0;
  if (itemCount === 0 || !cart.email) {
    console.log(`Sem itens (${itemCount}) ou sem e-mail capturado — não dispara recuperação.`);
    return;
  }

  // Formato único do link (id+token+freq+step=1), o mesmo que o /api/checkout/email manda
  // no evento checkout_started — ver lib/cart-recovery.ts.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const recoveryUrl = buildRecoveryUrl(siteUrl, cartId, cartToken, cart.recurringItemsFrequencyId);

  const r = await dispatchCrm({
    type: "abandoned_cart",
    email: cart.email,
    cartId,
    recoveryUrl,
    payload: { itemCount, total: cart.checkout?.summary?.total?.displayAmount },
  });
  console.log(r.skipped ? "CRM não configurado (CRM_WEBHOOK_URL vazio) — evento ignorado." : `Evento de recuperação enviado ao CRM (ok=${r.ok}).`);
})().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
