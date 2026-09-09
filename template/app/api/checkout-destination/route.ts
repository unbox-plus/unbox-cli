// Decide pro onde o botão "ir para o checkout" navega — SEMPRE no servidor, nunca no client
// (ver lib/checkout-nav.ts). Dois modos, escolhidos no setup do CLI (create-unbox-store) e nunca
// misturados no mesmo projeto — não há UI de checkout customizada quando o modo é "hospedado":
//
// 1) UNBOX_HOSTED_CHECKOUT_URL vazia (padrão) → checkout customizado interno, /checkout.
// 2) UNBOX_HOSTED_CHECKOUT_URL preenchida → checkout PADRÃO hospedado pela Unbox, no mesmo
//    domínio da loja (ex.: https://sualoja.com.br/carrinho/finalizar-pedido). Precisa do
//    {cartId, cartToken} na URL — mesmo contrato do link de recuperação de carrinho (doc 06) —
//    porque cartToken é httpOnly e o client não tem acesso a ele para montar a URL sozinho.
import { getCartRef, getRecurFreq } from "@/lib/session";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const ref = await getCartRef();
  const hostedUrl = process.env.UNBOX_HOSTED_CHECKOUT_URL;

  if (!ref) return ok({ url: "/carrinho" }); // nada pra finalizar ainda

  // NOS DOIS MODOS a URL do checkout carrega ?id=&token=[&freq=]&step=1 — mesmo contrato do
  // link de recuperação. É isso que deixa o CRM montar o e-mail de abandono a partir da URL
  // navegada (pixel/GTM capturam a URL) e o link colar em outro aparelho. Sem os params na
  // URL, a recuperação de carrinho não existe pra quem só enxerga a navegação.
  const base = hostedUrl || "/checkout";
  let url = `${base}?id=${encodeURIComponent(ref.cartId)}&token=${encodeURIComponent(ref.cartToken)}`;
  const freq = await getRecurFreq();
  if (freq) url += `&freq=${encodeURIComponent(freq)}`;
  url += "&step=1";
  return ok({ url });
}
