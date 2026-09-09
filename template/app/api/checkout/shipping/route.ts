// Frete: POST cota TODOS os grupos (doc 11 — N grupos, não 1); PUT seleciona o método por grupo.
import { withStoreClient } from "@/lib/unbox/store";
import { getCartRef } from "@/lib/session";
import { cartResponse } from "@/lib/cart-response";
import { ok, fail, failFrom } from "@/lib/api";

export const dynamic = "force-dynamic";

// POST /api/checkout/shipping → { groups: [{ groupId, options:[{methodId,name,displayName,price,days}] }] }
export async function POST() {
  try {
    const ref = await getCartRef();
    if (!ref) return fail("Carrinho não encontrado.", 404);

    const groups = await withStoreClient(async (c) => {
      const ids = await c.getFulfillmentGroupIds(ref.cartId, ref.cartToken);
      const out = [];
      for (const groupId of ids) {
        const opts = await c.quoteShipping(ref.cartId, ref.cartToken, groupId); // obrigatório (senão options vem vazio)
        out.push({
          groupId,
          options: opts.map((o) => ({
            methodId: o.fulfillmentMethod._id,
            name: o.fulfillmentMethod.name,
            displayName: o.fulfillmentMethod.displayName ?? o.fulfillmentMethod.name,
            price: o.price?.displayAmount,
            discountPrice: o.discountPrice?.displayAmount,
            days: o.fulfillmentMethod.daysToDeliver,
          })),
        });
      }
      return out;
    });

    if (!groups.length || groups.every((g) => g.options.length === 0)) {
      return fail("Não há opções de entrega para este CEP.", 422);
    }
    return ok({ groups });
  } catch (e) {
    return failFrom(e);
  }
}

// PUT /api/checkout/shipping { selections: [{ groupId, methodId }] } → seleciona e devolve o carrinho final
export async function PUT(req: Request) {
  try {
    const ref = await getCartRef();
    if (!ref) return fail("Carrinho não encontrado.", 404);
    const { selections } = await req.json();
    if (!Array.isArray(selections) || !selections.length) return fail("Selecione o frete.");

    const finalCart = await withStoreClient(async (c) => {
      let last: any = null;
      for (const s of selections) {
        last = await c.selectShipping(ref.cartId, ref.cartToken, s.groupId, s.methodId);
      }
      return last;
    });
    // relê o estado completo (descontos + total final)
    const full = await withStoreClient((c) => c.getCart(ref.cartId, ref.cartToken));
    return ok({ cart: await cartResponse(full ?? finalCart) });
  } catch (e) {
    return failFrom(e);
  }
}
