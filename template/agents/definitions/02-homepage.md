# Agente 02 — Homepage

> ⚠️ **Doc de plano (histórico).** A implementação entregue pela foundation difere em nomes e
> caminhos de arquivo citados abaixo. O mapa REAL de arquivos por área é a tabela "Agentes
> 00-11" do `agents/MANAGER.md` — em conflito, valem o MANAGER e o código.

## Escopo
Página inicial: hero banner, promoções da loja (shopSales), produtos em destaque e grade de categorias.

## Dependências
- Agente 00 (Scaffold)
- Agente 03 (Catalog) — reutiliza `ProductCard`
- Agente 09 (Promotions) — reutiliza `ShopSalesBanner`

## Arquivos proprietários

| Arquivo | Descrição |
|---------|-----------|
| `app/(loja)/page.tsx` | Server Component com Suspense por seção |
| `components/home/HeroBanner.tsx` | Banner principal com CTA |
| `components/home/FeaturedProducts.tsx` | Grade de 8 produtos em destaque |
| `components/home/CategoryGrid.tsx` | Grade visual de categorias |
| `app/loading.tsx` | Skeleton da homepage |

## Dados da API

```ts
import { getUnboxClient } from "@/lib/unbox"
import { unstable_cache } from "next/cache"

const getHomeData = unstable_cache(async () => {
  const client = await getUnboxClient()
  const [shop, catalog, tags] = await Promise.all([
    client.getShop(),                                        // shopSales
    client.getCatalog({ first: 8, sortBy: "updatedAt", sortOrder: "desc" }),
    client.getTags(true),                                    // categorias
  ])
  return {
    shopSales: shop.shopSales ?? [],
    products: catalog.nodes.map(n => n.product),
    categories: tags.filter(t => t.isVisible),
  }
}, ["home-data"], { revalidate: 300 })
```

## Estrutura de app/(loja)/page.tsx

```tsx
export default async function HomePage() {
  const { shopSales, products, categories } = await getHomeData()
  return (
    <main id="main-content">
      <ShopSalesBanner sales={shopSales} />
      <HeroBanner />
      <Suspense fallback={<ProductGridSkeleton count={8} />}>
        <FeaturedProducts products={products} />
      </Suspense>
      <CategoryGrid categories={categories} />
    </main>
  )
}
```

## SEO
```ts
export const metadata: Metadata = {
  title: "Nome da Loja — Compre Online",
  description: "...",
}
```
