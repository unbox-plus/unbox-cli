// Link de recuperação de carrinho — formato ÚNICO usado em todo o projeto.
// Abrir o link em qualquer browser restaura o carrinho: o CartProvider lê ?id=&token=
// e chama /api/cart/link, que regrava o cookie e reidrata (mesma convenção do link
// nativo da Unbox, ex.: finalizar-pedido?...&step=1).
//
// Sem "server-only" de propósito: o cron de abandono (scripts/abandoned-cart.ts) roda
// fora do Next e precisa montar o MESMO link.

export function buildRecoveryUrl(
  siteUrl: string,
  cartId: string,
  cartToken: string,
): string {
  // Sem `&freq=`: a frequência de assinatura mora no próprio carrinho e vem junto com ele.
  // Checkout hospedado (UNBOX_HOSTED_CHECKOUT_URL): o /checkout deste projeto nem existe —
  // o link tem que cair no checkout da Unbox, com o mesmo ?id=&token=.
  const base = process.env.UNBOX_HOSTED_CHECKOUT_URL || `${siteUrl.replace(/\/+$/, "")}/checkout`;
  return `${base}?id=${encodeURIComponent(cartId)}&token=${encodeURIComponent(cartToken)}&step=1`;
}
