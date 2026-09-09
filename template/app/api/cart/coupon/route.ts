// Aplicar (POST) e remover (DELETE) cupom de desconto no carrinho.
// ⚠️ doc 04/05: aplicar o cupom ANTES de selecionar o frete (cupom depois do frete → total divergente).
import { withStoreClient } from "@/lib/unbox/store";
import { getCartRef } from "@/lib/session";
import { cartResponse } from "@/lib/cart-response";
import { ok, fail, failFrom } from "@/lib/api";

export const dynamic = "force-dynamic";

// POST /api/cart/coupon { code }
export async function POST(req: Request) {
  try {
    const ref = await getCartRef();
    if (!ref) return fail("Carrinho não encontrado.", 404);
    const { code } = await req.json();
    if (!code) return fail("Informe um cupom.");

    const trimmed = String(code).trim();
    const { events, discountId } = await withStoreClient(async (c) => {
      const r = await c.applyDiscount(ref.cartId, ref.cartToken, trimmed);
      // resolve o id do desconto p/ permitir remoção (o Cart lido não traz os ids aplicados)
      const id = await c.findDiscountIdByCode(trimmed).catch(() => null);
      return { events: r?.cartEvents ?? [], discountId: id };
    });
    const full = await withStoreClient((c) => c.getCart(ref.cartId, ref.cartToken));
    return ok({ cart: await cartResponse(full, events), coupon: { code: trimmed, discountId } });
  } catch (e) {
    return failFrom(e);
  }
}

// DELETE /api/cart/coupon { discountId }
export async function DELETE(req: Request) {
  try {
    const ref = await getCartRef();
    if (!ref) return fail("Carrinho não encontrado.", 404);
    const { discountId } = await req.json();
    if (!discountId) return fail("Cupom inválido.");

    const events = await withStoreClient(async (c) => {
      const r = await c.removeDiscount(ref.cartId, ref.cartToken, discountId);
      return r?.cartEvents ?? [];
    });
    const full = await withStoreClient((c) => c.getCart(ref.cartId, ref.cartToken));
    return ok({ cart: await cartResponse(full, events) });
  } catch (e) {
    return failFrom(e);
  }
}
