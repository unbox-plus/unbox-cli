// BFF do carrinho. O browser NUNCA fala com a Unbox direto — só com estas rotas same-origin.
import { withStoreClient } from "@/lib/unbox/store";
import { UnboxError } from "@/lib/unbox/client";
import { getCartRef, setCartRef, clearCartRef, setRecurFreq } from "@/lib/session";
import { cartResponse } from "@/lib/cart-response";
import { getShopData } from "@/lib/queries";
import { ok, fail, failFrom } from "@/lib/api";
import type { CartItemInput } from "@/lib/unbox/types";

export const dynamic = "force-dynamic";

// GET /api/cart → reidrata o carrinho do cookie ({cartId, cartToken})
export async function GET() {
  try {
    const ref = await getCartRef();
    if (!ref) return ok({ cart: null });
    const cart = await withStoreClient((c) => c.getCart(ref.cartId, ref.cartToken));
    if (!cart) {
      // A query respondeu OK mas sem carrinho → o cartId/cartToken realmente não existe mais.
      await clearCartRef();
      return ok({ cart: null });
    }
    return ok({ cart: await cartResponse(cart) });
  } catch (e) {
    // Só limpa o cookie quando o erro CONFIRMA que o carrinho/token é inválido — nunca em
    // falha transitória (timeout, rede, 5xx da Unbox). Limpar nesses casos apagava carrinhos
    // válidos por uma simples intermitência de rede, forçando o cliente a montar tudo de novo.
    if (isCartGone(e)) await clearCartRef();
    return ok({ cart: null });
  }
}

// Só considera o carrinho "morto" (cookie deve ser limpo) quando o erro da Unbox indica
// explicitamente que o cartId/cartToken não é mais válido. Qualquer outra falha (timeout,
// rede, 5xx, GraphQL genérico) é tratada como transitória — mantém o cookie pra tentar de novo.
function isCartGone(e: unknown): boolean {
  if (e instanceof UnboxError) {
    const msg = (e.errors?.[0]?.message ?? e.message ?? "").toUpperCase();
    // SÓ códigos do CARRINHO. UNAUTHENTICATED/ACCESS_DENIED são o token da LOJA expirado ou a
    // Unbox Auth instável — transitório. Tratá-los como "carrinho morto" apagava o cookie de
    // TODOS os visitantes numa rotação de senha ou numa oscilação da API.
    return /NOT_FOUND|INVALID_TOKEN|INVALID_CART|CART_EXPIRED/.test(msg);
  }
  return false;
}

// POST /api/cart → adiciona itens (cria o carrinho se ainda não existir)
//
// ═══ ASSINATURA (item recorrente) — leia antes de montar o payload ═══
// `isRecurring: true` no item SOZINHO não assina nada: sem `recurringItemsFrequencyId` o
// pedido é aceito e registrado como compra avulsa, sem erro. Os dois sempre juntos:
//   1. item com `isRecurring: true`  +  2. `recurringItemsFrequencyId` (id vindo de
//   shop.recurringOrdersPolicy.allowedFrequencies) no body.
// O desconto de assinante REAL é shop.recurringOrdersPolicy.pricingPolicy
// ({ type: "PERCENTAGE_OFF", value: N }) — nunca invente o percentual no front.
// Implementação de referência: components/landing/product-picker.tsx (monta os dois campos).
export async function POST(req: Request) {
  try {
    const body = await req.json();
    let items: CartItemInput[] = body.items ?? [];
    if (!items.length) return fail("Nenhum item informado.");
    // A Unbox valida `thumbnail` como URI absoluta — path relativo ("/produto.png") derruba o
    // addCartItems inteiro com `"[0].thumbnail" must be a valid uri`. Melhor sem thumbnail
    // (o carrinho renderiza placeholder) do que carrinho quebrado.
    items = items.map(({ thumbnail, ...it }) => /^https?:\/\//.test(thumbnail ?? "") ? { ...it, thumbnail } : it);
    // A frequência NÃO entra no carrinho (input não aceita); guardamos em cookie p/ o placeOrder.
    const recurringItemsFrequencyId: string | undefined = body.recurringItemsFrequencyId;

    let ref = await getCartRef();
    const result = await withStoreClient(async (c) => {
      if (!ref) {
        const created = await c.createCart(items);
        ref = { cartId: created.cartId, cartToken: created.cartToken };
        return { quantityFailures: failuresOf(created) };
      }
      const added = await c.addCartItems(ref.cartId, ref.cartToken, items);
      return { quantityFailures: failuresOf(added) };
    });

    if (ref) await setCartRef(ref);
    // Item recorrente SEM frequência vira "Frequência: Não selecionada" no checkout, em vermelho,
    // com o preço já descontado (caso real em produção). As telas que adicionam ao carrinho
    // decidem `isRecurring` e a frequência em expressões separadas, então basta a fonte da
    // frequência estar vazia num instante para sair uma sem a outra, e o sintoma só aparece no
    // fim. Quando dois campos só fazem sentido juntos, quem garante o par é o servidor: ele
    // sempre sabe a política da loja.
    if (items.some((it) => it.isRecurring)) {
      let freq = recurringItemsFrequencyId;
      if (!freq) {
        const shop = await getShopData().catch(() => null);
        freq = shop?.recurringOrdersPolicy?.allowedFrequencies?.[0]?._id;
      }
      if (freq) await setRecurFreq(freq);
    }
    const full = await withStoreClient((c) => c.getCart(ref!.cartId, ref!.cartToken));
    return ok({ cart: await cartResponse(full), warnings: result.quantityFailures });
  } catch (e) {
    return failFrom(e);
  }
}

// DELETE /api/cart → esvazia o carrinho (limpa o cookie)
export async function DELETE() {
  await clearCartRef();
  return ok({ cart: null });
}

function failuresOf(r: any): string[] {
  const out: string[] = [];
  for (const f of r?.minOrderQuantityFailures ?? []) out.push(`Quantidade mínima: ${f.minOrderQuantity}.`);
  for (const f of r?.maxOrderQuantityFailures ?? []) out.push(`Quantidade máxima: ${f.maxOrderQuantity}.`);
  return out;
}
