# Agente 04 — PDP (Product Detail Page)

> ⚠️ **Doc de plano (histórico).** A implementação entregue pela foundation difere em nomes e
> caminhos de arquivo citados abaixo. O mapa REAL de arquivos por área é a tabela "Agentes
> 00-11" do `agents/MANAGER.md` — em conflito, valem o MANAGER e o código.

## Escopo
Página de detalhe de produto: galeria de imagens, seleção de variante, toggle assinatura,
botão de adicionar ao carrinho.

## Dependências
- Agente 00 (Scaffold)
- Agente 05 (Cart) — AddToCartForm chama /api/cart

## Arquivos proprietários

| Arquivo | Descrição |
|---------|-----------|
| `app/(loja)/produto/[productSlug]/page.tsx` | Server Component com SSG + ISR (revalidate: 3600) |
| `app/(loja)/produto/[productSlug]/loading.tsx` | Skeleton de PDP |
| `components/pdp/ProductImages.tsx` | Galeria: imagem principal + miniaturas |
| `components/pdp/ProductInfo.tsx` | Título, preço, badges, short description |
| `components/pdp/VariantSelector.tsx` | Botões de seleção de variante (client) |
| `components/pdp/SubscriptionToggle.tsx` | Toggle Avulso/Assine, seleção de frequência (client) |
| `components/pdp/AddToCartForm.tsx` | Quantidade + botão Adicionar (client) |
| `components/pdp/ProductDescription.tsx` | Descrição longa + Informações Adicionais (accordion) |

## Dados da API

```ts
export const revalidate = 3600 // ISR: revalidar a cada 1h

const item = await client.getProductBySlug(params.productSlug)
// item.product.variants[]              — variantes para seleção
// item.product.recurrenceAllowed       — exibir SubscriptionToggle
// item.product.pricing[].displayPrice  — preço base
// item.shortDescription                — texto acima do fold
// item.product.description             — descrição longa (HTML)
// item.product.additionalInformation   — accordion extra

// Frequências de assinatura (se recurrenceAllowed):
const shop = await client.getShop()
const frequencies = shop.recurringOrdersPolicy?.frequencyOptions ?? []
```

## generateStaticParams

```ts
export async function generateStaticParams() {
  const client = await getUnboxClient()
  const catalog = await client.getCatalog({ first: 200 })
  return catalog.nodes.map(n => ({ productSlug: n.product.slug }))
}
```

## SubscriptionToggle — lógica crítica

```
- Só exibir se product.recurrenceAllowed === true
- "Avulso" (default) → isRecurring: false
- "Assinar" → isRecurring: true + selecionar frequência
- A FREQUÊNCIA vai no placeOrder (orderRecurrence), NÃO no cartItem
- No cartItem: apenas isRecurring: true (sem frequencyId — campo não existe no live)
```

## AddToCartForm

```tsx
// Client component
async function handleAddToCart() {
  const res = await fetch("/api/cart", {
    method: "POST",
    body: JSON.stringify({
      action: "add",
      productId: product._id,
      productVariantId: selectedVariantId,
      price: selectedVariant.pricing?.[0]?.price ?? 0,
      quantity,
      isRecurring,
    }),
  })
  if (!res.ok) toast.error(friendlyError(await res.json()))
  else { openCart(); toast.success("Produto adicionado!") }
}
```

## SEO

```ts
export async function generateMetadata({ params }) {
  const item = await client.getProductBySlug(params.productSlug)
  return buildMetadata(item.product, `${SITE_URL}/p/${params.productSlug}`)
}
```

## JSON-LD
Incluir `<script type="application/ld+json">` com Product schema na página.
