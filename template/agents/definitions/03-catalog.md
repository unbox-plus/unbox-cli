# Agente 03 — Catalog (Listagem de Produtos)

> ⚠️ **Doc de plano (histórico).** A implementação entregue pela foundation difere em nomes e
> caminhos de arquivo citados abaixo. O mapa REAL de arquivos por área é a tabela "Agentes
> 00-11" do `agents/MANAGER.md` — em conflito, valem o MANAGER e o código.

## Escopo
Páginas de catálogo geral, categoria/tag e busca. O `ProductCard` gerado aqui é reutilizado por
Homepage e outros agentes.

## Dependências
- Agente 00 (Scaffold)

## Arquivos proprietários

| Arquivo | Descrição |
|---------|-----------|
| `app/(loja)/produtos/page.tsx` | Catálogo completo, paginado por offset (searchParams) |
| `app/(loja)/categoria/[tagSlug]/page.tsx` | Produtos de uma categoria |
| `app/(loja)/busca/page.tsx` | Resultados de busca (?q=) |
| `app/(loja)/produtos/loading.tsx` | Skeleton do grid |
| `components/catalog/ProductCard.tsx` | **Componente central — reutilizado em todo o storefront** |
| `components/catalog/ProductGrid.tsx` | Grid responsivo (1→2→3→4 colunas) |
| `components/catalog/Pagination.tsx` | Links de paginação via URL (?page=) |
| `components/catalog/FilterBar.tsx` | Filtros de categoria e ordenação |
| `components/catalog/SearchBar.tsx` | Campo de busca client (redireciona para /busca) |

## Dados da API

```ts
// Catálogo geral
const result = await client.getCatalog({
  first: 24,
  offset: (page - 1) * 24,     // page vem de searchParams.page
  sortBy: "updatedAt",
  sortOrder: "desc",
})

// Categoria
const tags = await client.getTags(true)
const tag = tags.find(t => t.slug === tagSlug)
const result = await client.getCatalog({ first: 24, offset: 0, tagIds: [tag._id] })

// Busca
const result = await client.getCatalog({ first: 24, searchText: q })
```

## ProductCard — campos obrigatórios

```tsx
interface ProductCardProps {
  product: {
    _id: string
    title: string
    slug: string
    imageUrls?: string[]
    pricing?: Array<{ displayPrice: string; price: number | null }>
    variants?: Array<{ pricing?: Array<{ compareAtPrice?: { displayAmount: string } | null }> }>
    isSoldOut: boolean
    isBackorder?: boolean
    isLowQuantity?: boolean
    recurrenceAllowed?: boolean
  }
}

// Link: /p/[product.slug]
// Imagem: product.imageUrls?.[0] (Next.js <Image>)
// Preço: product.pricing?.[0]?.displayPrice
// Preço de: product.variants?.[0]?.pricing?.[0]?.compareAtPrice?.displayAmount
// Badges: "Esgotado" | "Pré-venda" | "Últimas unidades" | "Assine e Poupe"
```

## generateStaticParams (categoria)

```ts
export async function generateStaticParams() {
  const client = await getUnboxClient()
  const tags = await client.getTags(true)
  return tags.filter(t => t.isVisible).map(t => ({ tagSlug: t.slug }))
}
```

## Paginação
- URL-based: `?page=2` via Link (não state de cliente — SSR-friendly)
- Mostrar total de resultados (`result.totalCount`)
- Desabilitar "anterior" na página 1, "próxima" se `!result.pageInfo?.hasNextPage`
