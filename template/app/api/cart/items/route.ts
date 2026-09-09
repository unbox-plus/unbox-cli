// Alterar quantidade (PATCH) e remover itens (DELETE) do carrinho.
import { withStoreClient } from "@/lib/unbox/store";
import { getCartRef } from "@/lib/session";
import { cartResponse } from "@/lib/cart-response";
import { ok, fail, failFrom } from "@/lib/api";

export const dynamic = "force-dynamic";

// PATCH /api/cart/items { cartItemId, quantity }
export async function PATCH(req: Request) {
  try {
    const ref = await getCartRef();
    if (!ref) return fail("Carrinho não encontrado.", 404);
    const { cartItemId, quantity } = await req.json();
    if (!cartItemId || typeof quantity !== "number") return fail("Parâmetros inválidos.");

    const events = await withStoreClient(async (c) => {
      const r = await c.updateItemQuantity(ref.cartId, ref.cartToken, cartItemId, quantity);
      return r?.cartEvents ?? [];
    });
    const full = await withStoreClient((c) => c.getCart(ref.cartId, ref.cartToken));
    return ok({ cart: await cartResponse(full, events) });
  } catch (e) {
    return failFrom(e);
  }
}

// DELETE /api/cart/items { cartItemIds: string[] }
export async function DELETE(req: Request) {
  try {
    const ref = await getCartRef();
    if (!ref) return fail("Carrinho não encontrado.", 404);
    const { cartItemIds } = await req.json();
    if (!Array.isArray(cartItemIds) || !cartItemIds.length) return fail("Nenhum item informado.");

    const events = await withStoreClient(async (c) => {
      const r = await c.removeCartItems(ref.cartId, ref.cartToken, cartItemIds);
      return r?.cartEvents ?? [];
    });
    const full = await withStoreClient((c) => c.getCart(ref.cartId, ref.cartToken));
    return ok({ cart: await cartResponse(full, events) });
  } catch (e) {
    return failFrom(e);
  }
}
