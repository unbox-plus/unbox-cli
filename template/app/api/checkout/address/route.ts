// Define o endereço de entrega no carrinho → devolve os ids dos fulfillmentGroups.
import { withStoreClient } from "@/lib/unbox/store";
import { getCartRef } from "@/lib/session";
import { ok, fail, failFrom } from "@/lib/api";
import { addressSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

// POST /api/checkout/address { address }
export async function POST(req: Request) {
  try {
    const ref = await getCartRef();
    if (!ref) return fail("Carrinho não encontrado.", 404);
    const body = await req.json();
    const parsed = addressSchema.safeParse(body.address);
    if (!parsed.success) return fail("Endereço inválido. Confira os campos.", 422, { issues: parsed.error.flatten() });

    await withStoreClient((c) => c.setShippingAddress(ref.cartId, ref.cartToken, parsed.data as any));
    const groupIds = await withStoreClient((c) => c.getFulfillmentGroupIds(ref.cartId, ref.cartToken));
    return ok({ fulfillmentGroupIds: groupIds });
  } catch (e) {
    return failFrom(e);
  }
}
