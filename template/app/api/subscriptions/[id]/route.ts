// Ações de assinatura (recurring order) — só variantes customer* (token do cliente).
// id = recurringOrderId. action: pause | skip | cancel | get | items | card | address
import { requireCustomerClient } from "@/lib/customer-session";
import { cardSchema, addressSchema, subscriptionItemsSchema } from "@/lib/schemas";
import { getShopData } from "@/lib/queries";
import { checkItemsChange, comProdutoDoKit } from "@/lib/subscription-items";
import { ok, fail, failFrom } from "@/lib/api";

export const dynamic = "force-dynamic";

// a rota recebe o _id; o SDK só lê por referenceId.
// ponytail: lista as 50 primeiras assinaturas do cliente; paginar se alguém tiver mais.
async function loadSubscription(me: Awaited<ReturnType<typeof requireCustomerClient>>, id: string) {
  const lista = await me.subscriptions({ first: 50 });
  const ref = lista.nodes.find((n: any) => n._id === id)?.referenceId;
  const sub = ref ? await me.subscription(ref) : null;
  return sub && { ...sub, items: (sub.items ?? []).map(comProdutoDoKit) };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireCustomerClient();
    const { id } = await params;
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case "pause":
        return ok({ subscription: await me.pause(id) });
      case "skip":
        return ok({ subscription: await me.skipNextCycle(id) });
      case "cancel":
        return ok({ subscription: await me.cancel(id) });
      case "get": {
        // a página confere o estado atual antes de enviar a edição: o backend não protege contra conflito
        const sub = await loadSubscription(me, id);
        if (!sub) return fail("Assinatura não encontrada.", 404);
        return ok({
          status: sub.status?.value,
          items: (sub.items ?? []).map((it: any) => ({ productId: it.productId, variantId: it.variantId, quantity: it.quantity, productKitId: it.productKitId })),
        });
      }
      case "items": {
        const parsed = subscriptionItemsSchema.safeParse(body.items);
        if (!parsed.success) return fail("Itens inválidos.", 422);
        const [sub, shop] = await Promise.all([loadSubscription(me, id), getShopData()]);
        if (!sub) return fail("Assinatura não encontrada.", 404);
        if (sub.status?.value !== "ACTIVE") return fail("Só é possível editar os itens de uma assinatura ativa.", 409);
        const recusa = checkItemsChange(sub.items ?? [], parsed.data, shop?.recurringOrdersPolicy?.customerActions ?? {});
        if (recusa) return fail(recusa, 403);
        return ok({ subscription: await me.updateItems(id, parsed.data as any) });
      }
      case "card": {
        const parsed = cardSchema.safeParse(body.card);
        if (!parsed.success) return fail("Dados do cartão inválidos.", 422);
        const c = parsed.data;
        return ok({
          subscription: await me.updateCard(id, {
            holderName: c.cardHolder,
            cardNumber: c.cardNumber,
            expirationMonth: c.expirationMonth,
            expirationYear: c.expirationYear,
            securityCode: c.securityCode,
          }),
        });
      }
      case "address": {
        const parsed = addressSchema.safeParse(body.address);
        if (!parsed.success) return fail("Endereço inválido.", 422);
        return ok({ subscription: await me.updateAddress(id, parsed.data as any) });
      }
      default:
        return fail("Ação desconhecida.", 400);
    }
  } catch (e) {
    return failFrom(e);
  }
}
