"use client";

// Navega pro checkout — decidido pelo SERVIDOR (nunca no client), porque a rota real depende de
// UNBOX_HOSTED_CHECKOUT_URL (checkout padrão hospedado pela Unbox, doc 06) e essa variável não é
// NEXT_PUBLIC_. Se configurada, o destino é externo (mesmo domínio da loja, path
// /carrinho/finalizar-pedido, com ?id=&token=&freq=&step= — o servidor monta a URL completa,
// nunca o client, porque cartToken é httpOnly e não pode ser lido em JS). Sem a variável, cai no
// /checkout interno de sempre.
export async function goToCheckout(router: { push: (href: string) => void }): Promise<void> {
  try {
    const res = await fetch("/api/checkout-destination");
    const data = await res.json().catch(() => ({}));
    const url: string = data?.url || "/checkout";
    if (/^https?:\/\//i.test(url)) {
      window.location.href = url; // destino externo — precisa de navegação completa, não router.push
    } else {
      router.push(url);
    }
  } catch {
    router.push("/checkout");
  }
}
