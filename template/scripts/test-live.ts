// Teste ao vivo do SDK contra a loja real (produção). Roda só leituras seguras + monta o payload
// de placeOrder (dry-run). NÃO cria pedido/webhook/OTP.
//
//   npm run unbox:test
import "./load-env"; // SEMPRE o primeiro import — parser de env idêntico ao do app
import { UnboxClient } from "../lib/unbox/client";
import { friendlyError, cartEventLabel } from "../lib/unbox/errors";
import { orderStatusLabel } from "../lib/unbox/customer";

const SHOP = process.env.UNBOX_SHOP_ID!;
const SLUG = process.env.UNBOX_SHOP_SLUG ?? "minha-loja";
const client = new UnboxClient({
  apiKey: process.env.UNBOX_API_KEY ?? "",
  shopId: SHOP,
  // API de parceiros: presente = signIn e leituras compativeis roteiam pra ela
  partnerApiKey: process.env.UNBOX_PARTNER_API_KEY,
  partnerGqlUrl: process.env.UNBOX_PARTNER_GRAPHQL_URL,
  captchaBypass: process.env.UNBOX_CAPTCHA_BYPASS,
});

let pass = 0,
  fail = 0;
async function step<T>(name: string, fn: () => Promise<T> | T): Promise<T | undefined> {
  try {
    const r = await fn();
    console.log(`✅ ${name}`);
    pass++;
    return r;
  } catch (e: any) {
    console.log(`❌ ${name}\n   → ${e.message}`);
    fail++;
    return undefined;
  }
}

const ADDR = {
  fullName: "Allan Teste", taxPayerId: "08383142951", postal: "04551-080",
  address1: "Rua São Tomé", address2: "Apto 703", number: "73",
  neighborhood: "Vila Olímpia", city: "São Paulo", region: "SP",
  cityCode: "3550308", phone: "11999990000",
};

(async () => {
  console.log(client.usesPartnerApi
    ? `ℹ️  API de PARCEIROS ativa (${client.partnerGqlUrl}) — signIn + leituras compatíveis roteiam por ela`
    : "ℹ️  Modo core puro (sem UNBOX_PARTNER_API_KEY) — todas as chamadas via core/REST");
  await step("1. signIn (loja)", async () => {
    const token = await client.signIn(process.env.UNBOX_USER!, process.env.UNBOX_PASS!);
    // Setup só-parceiro: UNBOX_SHOP_ID pode vir vazio — extrai do JWT (mesmos claims
    // arn:unbox:shopId que o app usa em lib/unbox/store.ts). Necessário pros passos core.
    if (!client.shopId) {
      try {
        const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const claims = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
        client.shopId = claims["arn:unbox:shopId"] ?? "";
        if (client.shopId) console.log(`   shopId (do JWT): ${client.shopId}`);
      } catch { /* segue sem shopId — passos core vão acusar */ }
    }
    return token;
  });

  const cat = await step("2. getCatalog", async () => {
    const c = await client.getCatalog({ first: 10 });
    console.log(`   totalCount=${c.totalCount}`);
    return c;
  });

  let picked: any;
  if (cat) {
    picked = (cat.nodes as any[])
      .map((n) => n.product)
      .find((p) => !p.isSoldOut && p.variants?.[0]?.pricing?.[0]?.price);
    if (picked) console.log(`   produto: "${picked.title}" @ ${picked.variants[0].pricing[0].displayPrice}`);
  }

  await step("3. getProductBySlug", async () => {
    if (!picked) throw new Error("sem produto");
    const p = await client.getProductBySlug(picked.slug);
    if (!p?.product?._id) throw new Error("produto não encontrado");
    return p;
  });

  await step("4. getTags", async () => {
    const t = await client.getTags(); // sem filtro isTopLevel — mesmo path que o app usa
    console.log(`   ${t.length} categorias`);
    return t;
  });

  await step("5. getShop (promoções + assinatura)", async () => {
    const s = await client.getShop(SLUG);
    console.log(`   shopSales: ${(s.shopSales ?? []).map((x: any) => x.label).join(", ")}`);
    console.log(`   freqs: ${(s.recurringOrdersPolicy?.allowedFrequencies ?? []).map((f: any) => f.title).join(", ")}`);
    return s;
  });

  await step("6. getPaymentMethods", async () => {
    const m = await client.getPaymentMethods();
    console.log(`   ${m.map((x: any) => x.name).join(", ")}`);
    return m;
  });

  await step("7. listDiscountCodes", async () => {
    const d = await client.listDiscountCodes(3);
    console.log(`   totalCount=${d.totalCount}`);
    return d;
  });

  const v = picked?.variants?.[0];
  const cart = await step("8. createCart", async () => {
    if (!picked) throw new Error("sem produto");
    const r = await client.createCart([{ productId: picked.productId, productVariantId: v._id, price: v.pricing[0].price, quantity: 1 }]);
    console.log(`   cartId=${r.cartId} subtotal=${r.cart.checkout.summary.total.displayAmount}`);
    return r;
  });

  await step("8b. addCartItems / getCart / update / remove", async () => {
    if (!cart || !picked) throw new Error("sem carrinho");
    await client.addCartItems(cart.cartId, cart.cartToken, [{ productId: picked.productId, productVariantId: v._id, price: v.pricing[0].price, quantity: 1 }]);
    const reloaded = await client.getCart(cart.cartId, cart.cartToken);
    const itemId = reloaded.items.edges[0].node._id;
    await client.updateItemQuantity(cart.cartId, cart.cartToken, itemId, 3);
    await client.removeCartItems(cart.cartId, cart.cartToken, [itemId]);
    console.log(`   getCart itens=${reloaded.items.totalCount}; add/update/remove OK`);
    return true;
  });

  let fgId: string | undefined;
  await step("9. setShippingAddress", async () => {
    if (!cart) throw new Error("sem carrinho");
    fgId = await client.setShippingAddress(cart.cartId, cart.cartToken, ADDR as any);
    console.log(`   fulfillmentGroupId=${fgId}`);
    return fgId;
  });

  let fmId: string | undefined;
  await step("10. quoteShipping", async () => {
    if (!cart || !fgId) throw new Error("pré-requisito faltando");
    const opts = await client.quoteShipping(cart.cartId, cart.cartToken, fgId);
    fmId = opts[0]?.fulfillmentMethod._id;
    console.log(`   ${opts.length} opção(ões); 1ª: ${opts[0]?.fulfillmentMethod.displayName} ${opts[0]?.price?.displayAmount}`);
    if (!fmId) throw new Error("sem opções de frete");
    return opts;
  });

  let finalCart: any;
  await step("11. selectShipping", async () => {
    if (!cart || !fgId || !fmId) throw new Error("pré-requisito faltando");
    finalCart = await client.selectShipping(cart.cartId, cart.cartToken, fgId, fmId);
    console.log(`   total c/ frete=${finalCart.checkout.summary.total.displayAmount}`);
    return finalCart;
  });

  await step("12. buildOrderItems + payload placeOrder (DRY-RUN)", async () => {
    if (!finalCart || !cart || !fmId) throw new Error("pré-requisito faltando");
    const items = client.buildOrderItems(finalCart);
    const total = finalCart.checkout.summary.total.amount;
    console.log(`   payload OK: ${items.length} item(ns), total=R$${total} (placeOrder NÃO chamado)`);
    return true;
  });

  await step("13. customerAccountExists", async () => {
    const r = await client.customerAccountExists(process.env.UNBOX_TEST_EMAIL ?? "cliente@example.com");
    console.log(`   existe? ${r}`);
    return r;
  });

  await step("14. getAddressByPostalCode", async () => {
    const a = await client.getAddressByPostalCode("04551-080");
    console.log(`   ${a.address1}, ${a.neighborhood} - ${a.city}/${a.region}`);
    return a;
  });

  await step("16. errors/labels", async () => {
    const checks: Array<[string, string]> = [
      [friendlyError({ message: "INSUFFICIENT_FUNDS_ERROR" }), "Pagamento recusado: saldo/limite insuficiente."],
      [cartEventLabel("SALE_FREE_ITEM_ADDED"), "🎁 Você ganhou um brinde!"],
      [orderStatusLabel("PENDING"), "Aguardando pagamento"],
    ];
    for (const [got, exp] of checks) if (got !== exp) throw new Error(`esperava "${exp}", veio "${got}"`);
    console.log(`   ${checks.length} mapeamentos OK`);
    return true;
  });

  console.log(`\n──────────── ${pass} passaram, ${fail} falharam ────────────`);
  process.exit(fail ? 1 : 0);
})();
