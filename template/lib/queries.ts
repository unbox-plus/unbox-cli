// Fetchers server-side reutilizáveis. Catálogo/loja/tags são públicos e estáveis → cacheados
// (unstable_cache, revalidável on-demand via /api/revalidate). cache() dedup por request.
import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { withStoreClient, getShopContext } from "./unbox/store";

const TTL = 300; // 5 min

export const getShopData = cache(
  unstable_cache(
    async () => {
      const { shopSlug } = await getShopContext();
      return withStoreClient((c) => c.getShop(shopSlug));
    },
    ["unbox-shop"],
    { revalidate: TTL, tags: ["shop"] },
  ),
);

export const getTopTags = cache(
  unstable_cache(
    async () => withStoreClient((c) => c.getTags()),
    ["unbox-top-tags"],
    { revalidate: 600, tags: ["tags"] },
  ),
);

export const getPaymentMethods = cache(
  unstable_cache(
    async () => withStoreClient((c) => c.getPaymentMethods()),
    ["unbox-payment-methods"],
    { revalidate: TTL, tags: ["shop"] },
  ),
);

/**
 * Lista paginada do catálogo (busca/filtro/ordenação). Cacheado por `opts` — o Next 15 NÃO
 * cacheia fetch() por padrão (diferente do 13/14), então sem unstable_cache explícito toda
 * chamada batia direto na Unbox: /produtos, /categoria/* e as ofertas de upsell do checkout
 * levavam de 1 a 8s por navegação. Com cache: consistentemente < 0.1s em hit.
 */
export const getCatalog = cache((opts: {
  first?: number; offset?: number; searchText?: string; tagIds?: string[];
  sortBy?: string; sortOrder?: "asc" | "desc";
} = {}) =>
  unstable_cache(
    () => withStoreClient((c) => c.getCatalog(opts)),
    ["unbox-catalog", JSON.stringify(opts)],
    { revalidate: TTL, tags: ["catalog"] },
  )(),
);

// Cacheado por slug: data cache compartilhado entre requests (revalidável) + dedup por
// request via cache() — a PDP busca o mesmo slug em generateMetadata e no corpo da página.
export const getProductBySlug = cache((slug: string) =>
  unstable_cache(
    () => withStoreClient((c) => c.getProductBySlug(slug)),
    ["unbox-product", slug],
    { revalidate: TTL, tags: ["catalog", `product:${slug}`] },
  )(),
);

export async function getDiscountCodes(first = 50) {
  return withStoreClient((c) => c.listDiscountCodes(first));
}
