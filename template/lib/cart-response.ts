// Monta a resposta de carrinho para o BFF: normaliza + anexa a FREQUÊNCIA de assinatura
// (a frequência não vive no carrinho da Unbox — está no cookie; o título vem da política da loja).
import "server-only";
import { normalizeCart, type UiCart } from "./cart-normalize";
import { getRecurFreq } from "./session";
import { getShopData, getCatalog } from "./queries";

// Brindes/bônus liberados automaticamente pela Unbox (ex.: item grátis ao atingir um valor no
// carrinho) não vêm com `thumbnail` na linha do carrinho, mesmo o produto tendo foto real
// cadastrada — completa buscando no catálogo por productId (já cacheado por getCatalog).
async function fillMissingThumbnails(cart: UiCart): Promise<void> {
  const missing = cart.items.filter((i) => !i.thumbnail);
  if (!missing.length) return;
  try {
    const catalog = await getCatalog({ first: 100 });
    const imageByProductId = new Map<string, string>();
    for (const n of catalog.nodes ?? []) {
      const p = n.product ?? n;
      if (p?.productId && p?.imageUrls?.[0]) imageByProductId.set(p.productId, p.imageUrls[0]);
    }
    for (const item of missing) {
      const url = imageByProductId.get(item.productId);
      if (url) item.thumbnail = url;
    }
  } catch {
    /* foto é cosmética — nunca quebra a resposta do carrinho */
  }
}

export async function cartResponse(rawCart: any, extraEvents: any[] = []): Promise<UiCart | null> {
  const cart = normalizeCart(rawCart, extraEvents);
  if (!cart) return null;
  await fillMissingThumbnails(cart);
  if (cart.hasRecurring) {
    const freqId = await getRecurFreq();
    if (freqId) {
      cart.recurringFrequencyId = freqId;
      try {
        const shop = await getShopData();
        const f = (shop?.recurringOrdersPolicy?.allowedFrequencies ?? []).find((x: any) => x._id === freqId);
        if (f?.title) cart.recurringFrequencyTitle = f.title;
      } catch {
        /* sem título não quebra a UI */
      }
    }
  }
  return cart;
}
