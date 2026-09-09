// Ações de assinatura (recurring order) — só variantes customer* (token do cliente).
// id = recurringOrderId. action: pause | skip | cancel | items | card | address
import { requireCustomerClient } from "@/lib/customer-session";
import { cardSchema, addressSchema } from "@/lib/schemas";
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
        if (!Array.isArray(body.items)) return fail("Itens inválidos.");
        return ok({ subscription: await me.updateItems(id, body.items) });
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
