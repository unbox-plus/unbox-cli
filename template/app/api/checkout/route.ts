// placeOrder — PRODUÇÃO REAL e NÃO-idempotente (doc 11). Proteções:
//  - rate-limit por IP
//  - lock por cartId (recusa chamadas concorrentes do mesmo carrinho)
//  - RELÊ o carrinho imediatamente antes (estado final: itens sem brindes + total do servidor)
//  - exige frete já selecionado
//  - em erro: NÃO retenta cegamente (poderia gerar cobrança dupla)
//  - sucesso: grava token de posse (cookie) e INVALIDA o carrinho
import { withStoreClient } from "@/lib/unbox/store";
import { getCartRef, setOrderToken, clearCartRef, getRecurFreq } from "@/lib/session";
import { acquireCheckoutLock, releaseCheckoutLock } from "@/lib/checkout-lock";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";
import { dispatchCrm } from "@/lib/crm";
import { placeOrderSchema } from "@/lib/schemas";
import { ok, fail, failFrom } from "@/lib/api";
import { isUnboxTimeout } from "@/lib/unbox/client";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`checkout:${ip}`, LIMITS.checkout.limit, LIMITS.checkout.windowMs);
  if (!rl.ok) return fail("Muitas tentativas. Aguarde um instante.", 429);

  const ref = await getCartRef();
  if (!ref) return fail("Carrinho não encontrado.", 404);

  const body = await req.json().catch(() => null);
  const parsed = placeOrderSchema.safeParse(body);
  if (!parsed.success) return fail("Dados de pagamento inválidos.", 422, { issues: parsed.error.flatten() });

  if (!acquireCheckoutLock(ref.cartId)) {
    return fail("Já existe um pedido em andamento para este carrinho.", 409);
  }

  try {
    const { email, address, payment, recurringItemsFrequencyId, device } = parsed.data;

    // RELEITURA do carrinho — estado final real (doc 11): evita FULFILLMENT_GROUP_AND_CART_ITEMS_DO_NOT_MATCH_ERROR
    const cart = await withStoreClient((c) => c.getCart(ref.cartId, ref.cartToken));
    if (!cart) return fail("Carrinho expirado. Recomece a compra.", 410);

    const selected = (cart.checkout?.fulfillmentGroups ?? []).find((g: any) => g.selectedFulfillmentOption);
    const fulfillmentMethodId = selected?.selectedFulfillmentOption?.fulfillmentMethod?._id;
    if (!fulfillmentMethodId) return fail("Selecione uma opção de frete antes de pagar.", 422);

    const total = cart.checkout?.summary?.total?.amount;
    if (typeof total !== "number") return fail("Não foi possível calcular o total.", 422);

    // Assinatura: o carrinho tem item(ns) isRecurring? A frequência veio em cookie (preferência) ou no body.
    const hasRecurring = (cart.items?.edges ?? []).some((e: any) => e.node?.isRecurring === true);
    const freqId = (await getRecurFreq()) ?? recurringItemsFrequencyId ?? undefined;
    if (hasRecurring) {
      if (payment.type !== "card") return fail("Assinaturas exigem pagamento com cartão de crédito.", 422);
      if (!freqId) return fail("Selecione a frequência da assinatura.", 422);
    }

    const order = await withStoreClient((c) => {
      const items = c.buildOrderItems(cart); // TODOS os itens, com flags isRecurring/isDiscountedBonusItem (casar c/ o carrinho — senão 502)
      return c.placeOrder({
        cartId: ref.cartId,
        email,
        address: address as any,
        fulfillmentMethodId,
        total,
        items,
        payment: payment.type === "pix" ? { type: "pix" } : { type: "card", card: payment.card as any },
        recurrence: hasRecurring && freqId ? { recurringItemsFrequencyId: freqId } : undefined,
        // antifraude: device coletado no browser; sem ele o client envia { type: "API" }.
        device,
      });
    });

    const placed = order.orders?.[0];
    if (!placed) return fail("Não foi possível concluir o pedido.", 502);

    // posse do pedido (guest) + invalida o carrinho (não reutilizar o cartId)
    if (placed.referenceId && order.token) await setOrderToken(placed.referenceId, order.token);
    await clearCartRef();

    // CRM (efeito real se CRM_WEBHOOK_URL estiver configurada)
    // cartId incluso pro CRM conseguir CANCELAR o fluxo de abandono armado no checkout_started.
    dispatchCrm({ type: "order_created", email, cartId: ref.cartId, orderId: placed._id, referenceId: placed.referenceId }).catch(() => {});

    const pix = placed.payments?.find((p: any) => p?.data?.qrCode)?.data ?? null;
    return ok({
      referenceId: placed.referenceId,
      status: placed.status,
      paymentType: payment.type,
      total: placed.summary?.total?.displayAmount,
      pix: pix ? { qrCode: pix.qrCode } : null,
      recurringOrderId: placed.recurringOrderId ?? null,
    });
  } catch (e) {
    // ⚠️ NÃO retentar: em timeout/erro o pedido pode ter sido criado. Orientar o cliente a entrar
    // e checar "meus pedidos" (/conta/pedidos) antes de tentar de novo (evita cobrança dupla).
    if (isUnboxTimeout(e)) {
      // Estado DESCONHECIDO: sem resposta dentro do prazo, o pedido pode ter sido criado e cobrado. O
      // código PLACE_ORDER_TIMEOUT diz ao checkout-client pra NÃO reabrir o botão de pagar.
      console.error(JSON.stringify({ tag: "[api-erro]", status: 504, erro: "PLACE_ORDER_TIMEOUT", rota: "checkout", cartId: ref.cartId, quando: new Date().toISOString() }));
      return fail(
        "O pagamento demorou mais que o esperado e não sabemos se foi concluído. Não pague de novo: confira em Meus pedidos ou no seu e-mail antes de tentar outra vez.",
        504,
        { code: "PLACE_ORDER_TIMEOUT" },
      );
    }
    return failFrom(e, 502, { rota: "checkout", cartId: ref.cartId });
  } finally {
    releaseCheckoutLock(ref.cartId);
  }
}
