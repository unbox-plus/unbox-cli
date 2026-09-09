// ⚠️ EFEITO REAL: cria um pedido PENDING via Pix na loja de produção (gera QR; NÃO cobra até o pagamento).
// Exige o argumento --confirm para evitar execução acidental.
//
//   npm run unbox:order:pix -- --confirm
import "./load-env"; // SEMPRE o primeiro import — parser de env idêntico ao do app
import { UnboxClient } from "../lib/unbox/client";

if (!process.argv.includes("--confirm")) {
  console.error("Recusado. Isto cria um pedido REAL (Pix PENDING). Rode com: npm run unbox:order:pix -- --confirm");
  process.exit(1);
}

const ADDR = {
  fullName: "Cliente Teste", taxPayerId: "08383142951", postal: "04551-080",
  address1: "Rua São Tomé", number: "73", neighborhood: "Vila Olímpia",
  city: "São Paulo", region: "SP", phone: "11999990000",
};

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

  const cat = await client.getCatalog({ first: 20 });
  const picked = (cat.nodes as any[]).map((n) => n.product).find((p) => !p.isSoldOut && p.variants?.[0]?.pricing?.[0]?.price);
  if (!picked) throw new Error("nenhum produto vendável encontrado");
  const v = picked.variants[0];
  console.log(`Produto: ${picked.title} @ ${v.pricing[0].displayPrice}`);

  const cart = await client.createCart([{ productId: picked.productId, productVariantId: v._id, price: v.pricing[0].price, quantity: 1 }]);
  const fgId = await client.setShippingAddress(cart.cartId, cart.cartToken, ADDR as any);
  const opts = await client.quoteShipping(cart.cartId, cart.cartToken, fgId);
  const finalCart = await client.selectShipping(cart.cartId, cart.cartToken, fgId, opts[0].fulfillmentMethod._id);

  const order = await client.placeOrder({
    cartId: cart.cartId,
    email: process.env.UNBOX_TEST_EMAIL ?? "teste@example.com",
    address: ADDR as any,
    fulfillmentMethodId: opts[0].fulfillmentMethod._id,
    total: finalCart.checkout.summary.total.amount,
    items: client.buildOrderItems(finalCart),
    payment: { type: "pix" },
    // antifraude: pedido originado no servidor (sem navegador) → device API no ROOT.
    // Se a Unbox aceitar (pedido criado), o root placement do device está confirmado.
    device: { type: "API" },
  });

  const o = order.orders[0];
  console.log(`✅ Pedido criado: #${o.referenceId} (status ${o.status})`);
  const qr = o.payments?.find((p: any) => p?.data?.qrCode)?.data?.qrCode;
  console.log(qr ? `QR Pix (copia-e-cola):\n${qr}` : "sem QR retornado");
})().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
