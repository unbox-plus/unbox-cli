// Raio-X da loja real: imprime promoções (shopSales), cupons, política de assinatura,
// formas de pagamento e catálogo, direto do backend Unbox. Use ANTES de preencher
// lib/store-config.ts — a regra de ouro da loja é só prometer o que aparece aqui.
//
//   npm run unbox:dump
import "./load-env"; // SEMPRE o primeiro import — parser de env idêntico ao do app
import { UnboxClient } from "../lib/unbox/client";

const client = new UnboxClient({
  apiKey: process.env.UNBOX_API_KEY ?? "",
  shopId: process.env.UNBOX_SHOP_ID ?? "",
  partnerApiKey: process.env.UNBOX_PARTNER_API_KEY,
  partnerGqlUrl: process.env.UNBOX_PARTNER_GRAPHQL_URL,
  captchaBypass: process.env.UNBOX_CAPTCHA_BYPASS,
});

const brl = (n: number) => `R$${n.toFixed(2).replace(".", ",")}`;
const h = (title: string) => console.log(`\n═══ ${title} ═══`);

async function main() {
  await client.signIn(process.env.UNBOX_USER!, process.env.UNBOX_PASS!);
  const shop = await client.getShop(process.env.UNBOX_SHOP_SLUG ?? "");

  h("LOJA");
  console.log(`${shop.name} (slug: ${shop.slug}, id: ${shop._id})`);
  console.log(`Pagamentos: cartão ${shop.acceptsCreditCard ? "sim" : "não"} · boleto ${shop.acceptsBoleto ? "sim" : "não"}`);

  h("PROMOÇÕES AUTOMÁTICAS (shopSales)");
  const sales: any[] = shop.shopSales ?? [];
  if (!sales.length) console.log("Nenhuma. NÃO exiba desconto, brinde ou régua de frete na loja.");
  for (const s of sales) {
    console.log(`• ${s.label ?? s.code ?? s._id} [${s.calculation?.__typename ?? "?"}] ${s.enabled ? "ATIVA" : "desativada"}`);
    for (const t of s.calculation?.tiers ?? []) {
      console.log(`    a partir de ${brl(t.cartSubtotalGTE)} → brinde: ${t.catalogProductVariant?.title ?? t.catalogProductVariant?._id}`);
    }
  }
  const tierSale = sales.find((s) => s.enabled && s.calculation?.__typename === "CalculationFreeItemByTier");
  if (tierSale?.calculation?.tiers?.length) {
    console.log(`  → GIFT_TIERS sugerido p/ lib/store-config.ts:`);
    console.log(`    ${JSON.stringify(tierSale.calculation.tiers.map((t: any) => ({ name: t.catalogProductVariant?.title ?? "Brinde", threshold: t.cartSubtotalGTE })))}`);
  }
  if (sales.some((s) => s.enabled && s.calculation?.__typename === "CalculationDiscountByPaymentMethod")) {
    console.log(`  → Existe desconto por forma de pagamento: confirme o percentual no painel e preencha PIX_DISCOUNT_PCT.`);
  } else {
    console.log(`  → Sem CalculationDiscountByPaymentMethod: mantenha PIX_DISCOUNT_PCT = 0.`);
  }

  h("CUPONS (discountCodes)");
  try {
    const codes = await client.listDiscountCodes(50);
    if (!codes.nodes?.length) console.log("Nenhum cupom cadastrado.");
    for (const c of codes.nodes ?? []) {
      console.log(`• ${c.code ?? c.label} [${c.calculation?.__typename ?? "?"}] ${c.enabled ? "ativo" : "inativo"}`);
    }
  } catch (e: any) {
    console.log(`(indisponível: ${e.message})`);
  }

  h("ASSINATURA (recurringOrdersPolicy)");
  const pol = shop.recurringOrdersPolicy;
  if (!pol?.enabled) {
    console.log("Desabilitada. NÃO exiba oferta de assinatura.");
  } else {
    const pp = pol.pricingPolicy;
    console.log(`Habilitada. Desconto de assinante: ${pp ? `${pp.value}${pp.type === "PERCENTAGE_OFF" ? "%" : ""} (${pp.type})` : "nenhum"}`);
    for (const f of pol.allowedFrequencies ?? []) console.log(`  • ${f.title} (${f._id})`);
  }

  h("FORMAS DE PAGAMENTO");
  try {
    // Consulta direto no core com o _id que acabamos de buscar (o shopId do .env é opcional).
    const d = await client.gql<{ availablePaymentMethods: any[] }>(
      `query($s:ID!){availablePaymentMethods(shopId:$s){name displayName isEnabled}}`, { s: shop._id },
    );
    for (const m of d.availablePaymentMethods) console.log(`• ${m.displayName ?? m.name} ${m.isEnabled ? "" : "(desabilitada)"}`);
  } catch (e: any) {
    console.log(`(indisponível: ${e.message})`);
  }

  h("CATÁLOGO (até 50 itens)");
  const cat = await client.getCatalog({ first: 50 });
  console.log(`Total na loja: ${cat.totalCount}`);
  for (const n of cat.nodes ?? []) {
    const p: any = (n as any).product ?? n;
    if (!p?.title) continue;
    const flags = [p.isVisible === false && "OCULTO", p.isSoldOut && "ESGOTADO"].filter(Boolean).join(" ");
    const price = p.pricing?.[0]?.displayPrice ?? p.variants?.[0]?.pricing?.[0]?.displayPrice ?? "sem preço";
    console.log(`• ${p.title} — ${price} · ${p.variants?.length ?? 0} variação(ões) ${flags}`.trim());
  }

  console.log(`\nRegra de ouro: lib/store-config.ts só recebe o que apareceu acima.`);
  console.log(`O que não está aqui não existe no backend e não pode ser prometido na loja.`);
}

main().catch((e) => { console.error(`Falha no dump: ${e.message}`); process.exit(1); });
