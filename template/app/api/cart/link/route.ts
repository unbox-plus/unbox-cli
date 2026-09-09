// Link de carrinho: dois modos, pelo mesmo endpoint (URL compartilhável, chamado pelo
// CartProvider quando os parâmetros aparecem em QUALQUER rota, inclusive /checkout):
//
// 1) ?id=<cartId>&token=<cartToken> — RESTAURA um carrinho existente (recuperação de carrinho
//    abandonado / "continuar em outro aparelho"). Valida o par na Unbox antes de gravar o
//    cookie — um link velho/inválido nunca derruba o carrinho atual do visitante.
// 2) ?produtos=SKU:qtd,...&cupom=CODE — monta um carrinho NOVO a partir de SKUs (products.json).
//
// Não redireciona; devolve JSON.
import { withStoreClient } from "@/lib/unbox/store";
import { getCatalog } from "@/lib/queries";
import { getCartRef, setCartRef, setRecurFreq } from "@/lib/session";
import { parseProdutosParam, resolveSkusToItems } from "@/lib/cart-link";
import { cartResponse } from "@/lib/cart-response";
import { ok, fail, failFrom } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const token = url.searchParams.get("token");
  const freq = url.searchParams.get("freq");
  const produtos = url.searchParams.get("produtos");
  const cupom = url.searchParams.get("cupom");

  // Modo 1: restaurar carrinho existente por id+token — nunca combina com produtos/cupom.
  if (id && token) {
    try {
      const cart = await withStoreClient((c) => c.getCart(id, token));
      if (!cart) return fail("Carrinho expirado ou link inválido.", 404);
      await setCartRef({ cartId: id, cartToken: token });
      // A frequência de assinatura é um campo do pedido (placeOrder), não do carrinho: por
      // isso ela viaja em cookie — sem isso, um carrinho de assinatura restaurado em outra
      // sessão mostra "Assinatura" sem frequência e falha no checkout ("Selecione a frequência").
      if (freq) await setRecurFreq(freq);
      return ok({ ok: true, cart: await cartResponse(cart) });
    } catch {
      // Par inválido/expirado — NÃO grava o cookie, não derruba o carrinho atual do visitante.
      return fail("Carrinho expirado ou link inválido.", 404);
    }
  }

  try {
    let count = 0;
    // 1) monta um carrinho novo a partir dos SKUs (se houver)
    if (produtos) {
      const skuQtys = parseProdutosParam(produtos);
      const catalog = await getCatalog({ first: 200 }).catch(() => ({ nodes: [] as any[] }));
      const nodes = (catalog.nodes ?? []).map((n: any) => n.product ?? n);
      const items = resolveSkusToItems(skuQtys, nodes);
      if (items.length) {
        const cart = await withStoreClient((c) => c.createCart(items));
        await setCartRef({ cartId: cart.cartId, cartToken: cart.cartToken });
        count = items.reduce((s, i) => s + i.quantity, 0);
      }
    }

    // 2) aplica o cupom no carrinho atual (recém-criado ou o do cookie)
    if (cupom) {
      const ref = await getCartRef();
      if (ref) await withStoreClient((c) => c.applyDiscount(ref.cartId, ref.cartToken, cupom.trim())).catch(() => {});
    }

    return ok({ ok: true, count });
  } catch (e) {
    return failFrom(e, 502);
  }
}
