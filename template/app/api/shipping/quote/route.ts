// "Calcule o frete" na PDP (fora do checkout): cota o frete de 1 produto para um CEP.
import { withStoreClient } from "@/lib/unbox/store";
import { ok, fail, failFrom } from "@/lib/api";

export const dynamic = "force-dynamic";

// POST /api/shipping/quote { productId, variantId, price, postal }
export async function POST(req: Request) {
  try {
    const { productId, variantId, price, postal } = await req.json();
    const cep = (postal ?? "").replace(/\D/g, "");
    if (!productId || !variantId) return fail("Produto inválido.");
    if (cep.length !== 8) return fail("CEP inválido.", 422);

    const opts = await withStoreClient((c) =>
      c.quoteShippingForProduct({ productId, productVariantId: variantId, price: price ?? 0.01, quantity: 1 }, cep),
    );
    if (!opts.length) return fail("Não há opções de entrega para este CEP.", 422);
    return ok({
      options: opts.map((o) => ({
        displayName: o.fulfillmentMethod.displayName ?? o.fulfillmentMethod.name,
        price: o.price?.displayAmount,
        days: o.fulfillmentMethod.daysToDeliver,
      })),
    });
  } catch (e) {
    return failFrom(e);
  }
}
