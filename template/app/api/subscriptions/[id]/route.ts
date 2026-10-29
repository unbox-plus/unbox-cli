// Ações de assinatura (recurring order) — só variantes customer* (token do cliente).
// id = recurringOrderId. action: pause | skip | cancel | items | card | address
import { requireCustomerClient } from "@/lib/customer-session";
import { cardSchema, addressSchema, subscriptionItemsSchema } from "@/lib/schemas";
import { getShopData } from "@/lib/queries";
import { checkItemsChange } from "@/lib/subscription-items";
import { ok, fail, failFrom } from "@/lib/api";

export const dynamic = "force-dynamic";

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
      case "items": {
        const parsed = subscriptionItemsSchema.safeParse(body.items);
        if (!parsed.success) return fail("Itens inválidos.", 422);
        // a rota recebe o _id; o SDK só lê por referenceId.
        // ponytail: lista as 50 primeiras assinaturas do cliente; paginar se alguém tiver mais.
        const lista = await me.subscriptions({ first: 50 });
        const ref = lista.nodes.find((n: any) => n._id === id)?.referenceId;
        const [sub, shop] = await Promise.all([ref ? me.subscription(ref) : null, getShopData()]);
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
