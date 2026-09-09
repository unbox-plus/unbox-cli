// Passo 2 do funil (/carrinho/oferta): o cliente distribui a quantidade escolhida entre os
// produtos, escolhe a frequência de envio (assinatura REAL da política da loja, se houver)
// e segue pro checkout. Tela split sem o chrome do site. Produtos e preços do catálogo.
import type { Metadata } from "next";
import { Suspense } from "react";
import { getCatalog, getTopTags, getShopData } from "@/lib/queries";
import { buildTagMap, mapCatalogItems } from "@/lib/catalog-map";
import { ProductPicker, type PickerSubscription } from "@/components/landing/product-picker";
import { mockupOr } from "@/lib/mockup";

export const revalidate = 300;
export const metadata: Metadata = { title: "Monte seu pedido", robots: { index: false } };

const isCombo = (s: string) => /kit|combo/i.test(s);

export default async function CarrinhoOfertaPage() {
  const [catalog, tags, shop] = await Promise.all([
    mockupOr(getCatalog({ first: 100 }), ({ nodes: [] as any[] }), "carrinho-oferta/getCatalog"),
    mockupOr(getTopTags(), [], "carrinho-oferta/getTopTags"),
    mockupOr(getShopData(), null, "carrinho-oferta/getShopData"),
  ]);
  const nodes = (catalog.nodes ?? []) as any[];
  const items = mapCatalogItems(nodes, buildTagMap(tags as any[]));

  // Mesma seleção da landing: combos → ofertas → destaques (o herói vem primeiro).
  let list = items.filter((it) => it.categories.some(isCombo));
  if (list.length < 2) {
    const deals = items.filter((it) => it.oldPrice != null);
    list = deals.length >= 2 ? deals : items.slice(0, 8);
  }
  list = list.slice(0, 8);

  // Assinatura: política REAL da loja + produtos que permitem recorrência.
  const recurrableIds = nodes
    .map((n: any) => n.product ?? n)
    .filter((p: any) => p?.recurrenceAllowed)
    .map((p: any) => String(p.productId));
  const policy = (shop as any)?.recurringOrdersPolicy;
  const subscription: PickerSubscription | null =
    policy?.enabled && (policy.allowedFrequencies?.length ?? 0) > 0 && recurrableIds.length > 0
      ? {
          percentOff: policy.pricingPolicy?.type === "PERCENTAGE_OFF" ? policy.pricingPolicy.value : null,
          frequencies: (policy.allowedFrequencies ?? []).map((f: any) => ({ id: f._id, title: f.title })),
        }
      : null;

  return (
    <Suspense>
      <ProductPicker
        products={list}
        shopName={(shop as any)?.name ?? "Nossa loja"}
        subscription={subscription}
        recurrableIds={recurrableIds}
      />
    </Suspense>
  );
}
