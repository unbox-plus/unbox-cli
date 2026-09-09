# Agente 11 — SEO + Infraestrutura

> ⚠️ **Doc de plano (histórico).** A implementação entregue pela foundation difere em nomes e
> caminhos de arquivo citados abaixo. O mapa REAL de arquivos por área é a tabela "Agentes
> 00-11" do `agents/MANAGER.md` — em conflito, valem o MANAGER e o código.

## Escopo
SEO técnico: sitemap dinâmico, robots.txt, metadados estruturados, JSON-LD e helpers de metadata.

## Dependências
- Agente 00 (Scaffold) — `lib/metadata.ts` base

## Arquivos proprietários

| Arquivo | Descrição |
|---------|-----------|
| `app/sitemap.ts` | Sitemap dinâmico com produtos + categorias |
| `app/robots.ts` | robots.txt com bloqueio de /conta e /api |
| `lib/metadata.ts` | Helpers buildMetadata, buildCategoryMetadata, buildProductJsonLd |
| `app/(loja)/pedido/[referenceId]/page.tsx` | Confirmação de pedido (noindex) |

## lib/metadata.ts (completo)

```ts
import type { Metadata } from "next"

const SITE = process.env.NEXT_PUBLIC_SITE_NAME ?? "Loja"
const URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://seudominio.com.br"

export function buildMetadata(
  product: { title: string; pageTitle?: string; metaDescription?: string; description?: string; imageUrls?: string[]; slug: string },
  canonical?: string,
): Metadata {
  const title = product.pageTitle ?? product.title
  const description = product.metaDescription ?? product.description?.replace(/<[^>]+>/g, "").slice(0, 160)
  const image = product.imageUrls?.[0]
  const url = canonical ?? `${URL}/p/${product.slug}`
  return {
    title: `${title} | ${SITE}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title, description, url, type: "website",
      images: image ? [{ url: image, alt: title, width: 800, height: 800 }] : [],
    },
    twitter: {
      card: "summary_large_image", title, description,
      images: image ? [image] : [],
    },
    robots: { index: true, follow: true },
  }
}

export function buildCategoryMetadata(tag: {
  name: string; displayTitle?: string; description?: string; slug: string
}): Metadata {
  const title = tag.displayTitle ?? tag.name
  return {
    title: `${title} | ${SITE}`,
    description: tag.description,
    alternates: { canonical: `${URL}/c/${tag.slug}` },
  }
}

export function buildProductJsonLd(product: {
  title: string; description?: string; imageUrls?: string[];
  variants?: Array<{ sku?: string | null }>
  isSoldOut: boolean; pricing?: Array<{ price: number | null }>
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description?.replace(/<[^>]+>/g, ""),
    image: product.imageUrls ?? [],
    sku: product.variants?.[0]?.sku,
    offers: {
      "@type": "Offer",
      availability: product.isSoldOut
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      price: product.pricing?.[0]?.price ?? 0,
      priceCurrency: "BRL",
    },
  }
}
```

## app/sitemap.ts — paginação correta

```ts
// Iterar catálogo completo com paginação (não buscar tudo com first grande)
let offset = 0
for (;;) {
  const page = await client.getCatalog({ first: 100, offset })
  // processar page.nodes
  if (!page.pageInfo?.hasNextPage) break
  offset += 100
}
```

## app/robots.ts

```ts
import type { MetadataRoute } from "next"
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/conta/", "/checkout", "/pedido/", "/api/", "/busca?"],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  }
}
```

## Variáveis NEXT_PUBLIC seguras

```ts
// PERMITIDOS como NEXT_PUBLIC (não são credenciais):
NEXT_PUBLIC_SITE_NAME=Minha Loja
NEXT_PUBLIC_SITE_URL=https://seudominio.com.br

// PROIBIDOS como NEXT_PUBLIC:
// NEXT_PUBLIC_UNBOX_API_KEY  ← NUNCA
// NEXT_PUBLIC_UNBOX_SHOP_ID  ← evitar (não é credencial mas não precisa ser público)
```

## Página de confirmação de pedido

```tsx
// app/(loja)/pedido/[referenceId]/page.tsx
export const metadata: Metadata = {
  robots: { index: false, follow: false }  // noindex — evitar indexar URLs de pedido
}

async function getOrder(referenceId: string) {
  const client = await getUnboxClient()
  // buscar por referenceId — ver SDK
  return client.getOrderByReferenceId(referenceId)
}

// Status: orderStatusLabel(order.status) — NUNCA displayStatus(language)
// Rastreio: tracking.trackingCode (não trackingUrl no contexto cliente)
```

## Performance — checklist

```
- getCatalog para homepage: unstable_cache({ revalidate: 300 })
- getProductBySlug (PDP): export const revalidate = 3600
- getTags: unstable_cache({ revalidate: 3600 })
- getShop/shopSales: unstable_cache({ revalidate: 300 })
- Sitemap: sem cache explícito (Next.js revalida conforme revalidate da rota)
- Imagens: next/image com sizes corretos para evitar oversized downloads
```
