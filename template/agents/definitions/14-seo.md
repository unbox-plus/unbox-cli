# Agente 14 — Unbox AI SEO Agent

## Objetivo

Otimização avançada de SEO para o storefront headless. Complementa o agente 11 (infraestrutura básica) com schemas ricos, OG images dinâmicas, breadcrumbs, otimização de títulos e Core Web Vitals.

**Pré-requisito:** agente 11 concluído — `app/(loja)/produto/[productSlug]/page.tsx` (metadata/JSON-LD inline — não existe lib/metadata.ts na foundation), `sitemap.ts` e `robots.ts` já existem.

---

## Apresentação ao usuário

Ao iniciar este agente, exiba o menu abaixo e pergunte quais módulos ativar:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Unbox AI SEO Agent — Módulos disponíveis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [1] Schemas JSON-LD Avançados
      Organization, WebSite+SearchAction, BreadcrumbList,
      AggregateRating e Review no Product schema
      ⚙️  Sem dependências

  [2] OG Images Dinâmicas
      Imagem Open Graph gerada por produto e categoria
      via Next.js ImageResponse (rota opengraph-image.tsx)
      ⚙️  Sem dependências (usa dados já disponíveis no RSC)

  [3] Breadcrumbs
      Componente visual + BreadcrumbList JSON-LD integrado
      Inserido no PDP e páginas de categoria
      ⚙️  Sem dependências

  [4] Templates de Título e Description
      Templates configuráveis por tipo de página com variáveis
      dinâmicas: {productName}, {categoryName}, {siteName}, {price}
      ⚙️  Sem dependências

  [5] Canonical e Paginação de Catálogo
      Canonical limpo em URLs com query params de filtro/ordem
      rel prev/next (ou canonical único) para paginação
      ⚙️  Sem dependências

  [6] Core Web Vitals
      fetchpriority="high" no LCP image, preconnect hints,
      font-display: swap, lazy loading estratégico
      ⚙️  Sem dependências

  [7] Search Console Setup
      Meta tag de verificação, guia de submissão do sitemap,
      teste de rich results para Product schema
      ⚙️  Requer: acesso ao Google Search Console

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Opções: "all", números separados por vírgula (ex: 1,3,6), ou "none"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Aguarde a resposta antes de qualquer implementação.

---

## Módulos — especificação técnica

### [1] Schemas JSON-LD Avançados

**Arquivo:** `app/(loja)/produto/[productSlug]/page.tsx` (metadata/JSON-LD inline — não existe lib/metadata.ts na foundation) (estender o existente)

#### Organization + WebSite (global)

**A foundation JÁ emite os dois** em `app/(loja)/page.tsx` (Organization + WebSite/SearchAction).
ESTENDA esse bloco (sameAs, logo, contactPoint); não crie outro no `app/layout.tsx`: schema
duplicado é penalizado. O exemplo abaixo mostra o formato completo pra comparar.

```tsx
// Formato de referência: a foundation já tem este bloco em app/(loja)/page.tsx
const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: process.env.NEXT_PUBLIC_SITE_NAME,
  url: process.env.NEXT_PUBLIC_SITE_URL,
  logo: `${process.env.NEXT_PUBLIC_SITE_URL}/brand/logo.svg`,
  // TODO: adicionar sameAs com redes sociais da loja
  sameAs: [],
}

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: process.env.NEXT_PUBLIC_SITE_NAME,
  url: process.env.NEXT_PUBLIC_SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${process.env.NEXT_PUBLIC_SITE_URL}/busca?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
}
```

SearchAction habilita o **Sitelinks Searchbox** do Google — caixa de busca direta nos resultados.

#### AggregateRating no Product JSON-LD

Estender o objeto `jsonLd` em `app/(loja)/produto/[productSlug]/page.tsx` (metadata/JSON-LD inline — não existe lib/metadata.ts na foundation):

```ts
// Adicionar ao objeto de retorno quando reviews existirem
aggregateRating: reviews?.length ? {
  "@type": "AggregateRating",
  ratingValue: avgRating,        // média calculada localmente
  reviewCount: reviews.length,
  bestRating: 5,
  worstRating: 1,
} : undefined,
review: reviews?.slice(0, 5).map(r => ({
  "@type": "Review",
  author: { "@type": "Person", name: r.author },
  reviewRating: { "@type": "Rating", ratingValue: r.stars },
  reviewBody: r.comment,
})),
```

**Fonte dos reviews:** `lib/enrichment/products.json` (campo `reviews[]`) ou array vazio como fallback.

---

### [2] OG Images Dinâmicas

**Arquivos:**
- `app/(loja)/produto/[productSlug]/opengraph-image.tsx` — OG image por produto
- `app/(loja)/categoria/[tagSlug]/opengraph-image.tsx` — OG image por categoria

```tsx
// app/(loja)/produto/[productSlug]/opengraph-image.tsx
import { ImageResponse } from "next/og"

export const runtime = "edge"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image({ params }: { params: { productSlug: string } }) {
  const product = await withStoreClient((c) => c.getProductBySlug(params.productSlug)) // lib/unbox/store.ts

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#18181B" }}>
      {/* Imagem do produto à direita */}
      {product.imageUrls?.[0] && (
        <img src={product.imageUrls[0]} style={{ width: 400, height: 630, objectFit: "cover" }} />
      )}
      {/* Texto à esquerda */}
      <div style={{ flex: 1, padding: "60px 48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ color: "#D97706", fontSize: 18, marginBottom: 16 }}>
          {process.env.NEXT_PUBLIC_SITE_NAME}
        </div>
        <div style={{ color: "white", fontSize: 48, fontWeight: 800, lineHeight: 1.1 }}>
          {product.title}
        </div>
        {product.pricing?.[0]?.price && (
          <div style={{ color: "#D97706", fontSize: 36, marginTop: 24 }}>
            R$ {product.pricing[0].price.toFixed(2).replace(".", ",")}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Runtime:** não force `runtime = "edge"`: `withStoreClient` usa Node (cookies/`server-only`) e `ImageResponse` roda no Node normalmente. `app/opengraph-image.tsx` da foundation é o exemplo.

---

### [3] Breadcrumbs

**Arquivo:** `components/ui/breadcrumbs.tsx`

```tsx
interface Crumb { label: string; href?: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.label,
      ...(crumb.href ? { item: `${process.env.NEXT_PUBLIC_SITE_URL}${crumb.href}` } : {}),
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {items.map((crumb, i) => (
            <li key={i} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden>/</span>}
              {crumb.href && i < items.length - 1
                ? <a href={crumb.href} className="hover:text-foreground transition-colors">{crumb.label}</a>
                : <span className="text-foreground font-medium">{crumb.label}</span>
              }
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
}
```

**Inserir no PDP:**
```tsx
<Breadcrumbs items={[
  { label: "Home", href: "/" },
  { label: category.name, href: `/categoria/${category.slug}` },
  { label: product.title },
]} />
```

---

### [4] Templates de Título e Description

**Arquivo:** `lib/seo-templates.ts`

```ts
// Configurar aqui — usar variáveis entre chaves
export const SEO_TEMPLATES = {
  product: {
    title:       "{productName} | {siteName}",
    description: "Compre {productName} por R${price}. {shortDescription}",
  },
  category: {
    title:       "{categoryName} — {siteName}",
    description: "Confira nossa seleção de {categoryName} em {siteName}.",
  },
  home: {
    title:       "{siteName} — Loja Oficial",
    description: "Compre em {siteName}: {shortDescription}",
  },
  search: {
    title:       'Resultados para "{query}" | {siteName}',
    description: 'Encontre "{query}" em {siteName}. Filtros por categoria, preço e disponibilidade.',
  },
}

// ⚠️ Nenhuma promessa comercial no template. Frete grátis só entra interpolado de
// FREE_SHIPPING_THRESHOLD (lib/store-config.ts) quando não for null; prazo de entrega só se o
// lojista tiver SLA documentado no DESIGN-<MARCA>.md. O unbox:honestidade derruba
// "frete grátis acima de R$N" e "entrega rápida" escritos à mão.
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (str, [k, v]) => str.replaceAll(`{${k}}`, v),
    template,
  )
}
```

Substituir chamadas hardcoded em `app/(loja)/produto/[productSlug]/page.tsx` (metadata/JSON-LD inline — não existe lib/metadata.ts na foundation) por `fillTemplate(SEO_TEMPLATES.product.title, { ... })`.

---

### [5] Canonical e Paginação de Catálogo

**Problema:** `/categoria/camisetas?sort=price&page=2` → Google vê URL diferente de `/categoria/camisetas`.

**Solução em `buildCategoryMetadata`:**

```ts
export function buildCategoryMetadata(
  tag: { name: string; displayTitle?: string; description?: string; slug: string },
  page?: number,
): Metadata {
  const base = `${URL}/categoria/${tag.slug}`
  const canonical = page && page > 1 ? `${base}?page=${page}` : base

  return {
    title: fillTemplate(SEO_TEMPLATES.category.title, { categoryName: tag.displayTitle ?? tag.name, siteName: SITE }),
    description: tag.description,
    alternates: {
      canonical,
      // rel prev/next para paginação — sinaliza série ao Google
      ...(page && page > 1 ? { prev: page === 2 ? base : `${base}?page=${page - 1}` } : {}),
    },
    // Parâmetros de filtro e ordem não devem gerar URLs canônicas distintas
    robots: { index: true, follow: true },
  }
}
```

**robots.txt** — bloquear parâmetros de ordenação/filtro que não mudam conteúdo:

```ts
disallow: [
  "/conta/", "/checkout", "/pedido/", "/api/", "/busca?",
  "/categoria/*?sort=",    // ordenação não cria página nova
  "/categoria/*?filter=",  // filtros internos, se houver
]
```

---

### [6] Core Web Vitals

#### LCP Image — fetchpriority

```tsx
// No hero / primeira imagem do PDP
// next/image com priority={true} gera automaticamente fetchpriority="high" + preload link
<Image
  src={product.imageUrls[0]}
  priority={true}   // ← crucial para LCP
  sizes="(max-width: 768px) 100vw, 50vw"
  fill
  alt={product.title}
/>
```

Garantir que `priority={true}` está em:
- Hero da home (`components/home/sections/hero.tsx`)
- Primeira imagem da galeria do PDP (`components/product/pdp/gallery.tsx`)
- Primeira imagem do catálogo (acima da dobra apenas — produto 1 e 2)

#### Preconnect hints em `app/layout.tsx`

```tsx
// No <head> via metadata ou diretamente no layout:
<link rel="preconnect" href="https://cdn.unbox.com.br" />   // CDN de imagens Unbox
<link rel="dns-prefetch" href="https://cdn.unbox.com.br" />
```

#### Font display

```ts
// No next/font (já configurado no layout.tsx) — garantir:
const plusJakarta = Plus_Jakarta_Sans({
  display: "swap",  // evita FOIT — texto invisível durante carregamento
  // ...
})
```

---

### [7] Search Console Setup

Este módulo não gera código — é um guia de ações manuais:

```
Checklist pós-deploy:

□ 1. Acessar https://search.google.com/search-console
□ 2. Adicionar propriedade (URL prefix) com a URL de produção
□ 3. Verificar via meta tag:
      → Copiar conteúdo do atributo "content" fornecido pelo GSC
      → Adicionar em app/layout.tsx:
         export const metadata = { verification: { google: "CODIGO_AQUI" } }
□ 4. Fazer deploy e confirmar verificação no GSC
□ 5. Submeter sitemap: Sitemaps → https://seudominio.com.br/sitemap.xml
□ 6. Aguardar 3-5 dias e verificar em Enhancements → Shopping (Product rich results)
□ 7. Testar JSON-LD em: https://search.google.com/test/rich-results
      → Testar URL de produto → confirmar Product + breadcrumb valid
```

---

## Fluxo do agente

1. **Apresentar menu** e aguardar escolha.
2. **Verificar pré-requisito:** confirmar que `app/(loja)/produto/[productSlug]/page.tsx` (metadata/JSON-LD inline — não existe lib/metadata.ts na foundation) existe (agente 11 concluído).
3. **Implementar** em ordem numérica — cada módulo é independente.
4. **Para módulos que estendem `app/(loja)/produto/[productSlug]/page.tsx` (metadata/JSON-LD inline — não existe lib/metadata.ts na foundation):** ler o arquivo atual antes de editar.
5. **Ao final:** listar o que foi implementado e qualquer TODO que exige ação manual (ex: sameAs de redes sociais, código do Search Console).

---

## Regras

- **Nunca duplicar** o que o agente 11 já fez — ler `app/(loja)/produto/[productSlug]/page.tsx` (metadata/JSON-LD inline — não existe lib/metadata.ts na foundation) antes de editar.
- `<script type="application/ld+json">` deve usar `JSON.stringify()` — nunca template string com interpolação direta (risco de XSS se dados contiverem `</script>`).
- OG images no Edge Runtime — não usar `import "server-only"` nem APIs Node.js nativas.
- `priority={true}` apenas na primeira imagem visível — não em todas; múltiplos preloads prejudicam LCP.
- Templates de título: nunca ultrapassar ~60 caracteres no título e ~155 na description para evitar truncamento no Google.
