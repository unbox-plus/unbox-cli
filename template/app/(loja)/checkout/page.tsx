import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCatalog, getPaymentMethods, getShopData } from "@/lib/queries";
import { getCartRef, getRecurFreq } from "@/lib/session";
import { resolveProductPrice } from "@/lib/format";
import { CheckoutClient, type UpsellOffer } from "@/components/checkout/checkout-client";
import { DataLayerReady } from "@/components/analytics/data-layer-ready";
import { mockupOr } from "@/lib/mockup";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // GARANTIA: a URL do checkout SEMPRE carrega ?id=&token= do carrinho (contrato do link de
  // recuperação — igual ao checkout hospedado da Unbox). Quem chega sem os params (refresh,
  // link direto, navegação antiga) é redirecionado pra URL enriquecida, lida do cookie.
  // Sem isso, CRM que captura a URL navegada (pixel/GTM) não tem como montar a recuperação.
  const sp = await searchParams;
  if (!sp.id || !sp.token) {
    const ref = await getCartRef();
    if (ref) {
      const q = new URLSearchParams();
      // preserva params existentes (ex.: step) antes de anexar o ponteiro do carrinho
      for (const [k, v] of Object.entries(sp)) {
        if (typeof v === "string" && k !== "id" && k !== "token") q.set(k, v);
      }
      q.set("id", ref.cartId);
      q.set("token", ref.cartToken);
      const freq = await getRecurFreq();
      if (freq && !q.has("freq")) q.set("freq", freq);
      redirect(`/checkout?${q.toString()}`);
    }
  }
  const [methods, shop, catalog] = await Promise.all([
    mockupOr(getPaymentMethods(), [], "checkout/getPaymentMethods"), // sem métodos não há checkout: falha com credenciais tem que aparecer
    getShopData().catch(() => null),
    getCatalog({ first: 12 }).catch(() => ({ nodes: [] as any[] })),
  ]);

  // Ofertas reais para o passo de upsell (produtos do catálogo + quick-add real).
  const upsells: UpsellOffer[] = (catalog.nodes ?? [])
    .map((n: any) => n.product ?? n)
    // só em estoque (não esgotado) e com preço válido
    .filter((rp: any) => rp?.slug && !rp.isSoldOut && rp.variants?.[0]?.pricing?.[0]?.price != null)
    .slice(0, 4)
    .map((rp: any): UpsellOffer => {
      const rprice = resolveProductPrice(rp);
      const rv0 = rp.variants?.[0];
      const price = rv0?.pricing?.[0]?.price ?? 0;
      const compareAt = rv0?.pricing?.[0]?.compareAtPrice?.amount ?? null;
      return {
        productId: rp.productId,
        variantId: rv0?._id ?? "",
        name: rp.title,
        weight: rv0?.title ?? "",
        desc: rp.shortDescription ?? "Combina com o que você já escolheu.",
        imageUrl: rp.imageUrls?.[0] ?? null,
        price,
        displayPrice: rprice.displayPrice,
        oldPrice: compareAt && compareAt > price ? compareAt : null,
      };
    });

  return (
    <>
    <DataLayerReady pageType="checkout" />
    <h1 className="sr-only">Finalizar compra</h1>
    <CheckoutClient
      methods={methods as any}
      maxInstallments={shop?.settings?.maxInstallments ?? 12}
      acceptsCard={shop?.acceptsCreditCard ?? true}
      upsells={upsells}
      shopName={shop?.name ?? "Minha Loja"}
    />
    </>
  );
}
