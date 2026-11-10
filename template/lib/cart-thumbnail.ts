// A foto da linha do carrinho é SEMPRE a do catálogo da Unbox (`imageUrls[0]`), resolvida aqui
// no servidor. O `thumbnail` que a tela mandou é descartado antes de montar o payload.
//
// Por que no servidor e não em cada tela: `thumbnail` é campo de ENTRADA do item (`createCart` /
// `addCartItems`), a Unbox grava o que receber, e o que fica gravado segue para o pedido
// (`lib/orders.ts`) e para a área do cliente. Com a escolha espalhada pelas telas que chamam
// `add()`, bastava uma delas passar outra imagem para o cliente ver, no carrinho e depois no
// pedido, uma foto diferente do produto que vai ser enviado — e nada no build acusa isso. Aqui a
// decisão é uma só, no caminho por onde todo item passa.
import "server-only";
import type { CartItemInput } from "@unbox-plus/sdk";
import { getProductImage } from "./queries";

/** O id de catálogo da linha: o produto, ou o kit quando a linha é um bundle. */
function idDoCatalogo(item: Omit<CartItemInput, "thumbnail">): string | undefined {
  return item.productId ?? item.kit?.productKitId;
}

/**
 * Troca o `thumbnail` de cada item pela foto do catálogo. Item sem foto no catálogo (ou com o
 * catálogo fora do ar) vai SEM `thumbnail`: a linha renderiza o placeholder e `cartResponse`
 * tenta completar na leitura. Foto é cosmética e nunca derruba o "adicionar ao carrinho".
 */
export async function comImagemDoCatalogo(items: CartItemInput[]): Promise<CartItemInput[]> {
  return Promise.all(
    items.map(async ({ thumbnail: _daTela, ...item }) => {
      const productId = idDoCatalogo(item);
      const url = productId ? await getProductImage(productId).catch(() => null) : null;
      // A Unbox valida `thumbnail` como URI absoluta — path relativo derruba o `addCartItems`
      // INTEIRO com `"[0].thumbnail" must be a valid uri`. Melhor sem foto do que carrinho quebrado.
      return url && /^https?:\/\//.test(url) ? { ...item, thumbnail: url } : item;
    }),
  );
}
