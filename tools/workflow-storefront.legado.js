export const meta = {
  name: 'unbox-storefront-builder',
  description: 'Constrói um storefront headless Unbox completo: Next.js 15 + shadcn/ui + Tailwind v4',
  phases: [
    { title: 'Scaffold', detail: 'Cria estrutura Next.js, dependências e fundação compartilhada' },
    { title: 'Implement', detail: 'Implementa as 10 seções do storefront em paralelo' },
    { title: 'Integrate', detail: 'Integra seções, resolve imports e configura providers' },
    { title: 'Review', detail: 'Valida regras de ouro, segurança e qualidade do código' },
  ],
}

// ─── Configuração ─────────────────────────────────────────────────────────────
const TARGET = args?.projectDir ?? '/tmp/unbox-storefront'
// Os dois caminhos apontavam para a pasta pessoal de quem escreveu este script, e viajavam
// para dentro do projeto de todo cliente. Agora vêm por argumento ou por variável de
// ambiente: quem for reaproveitar este padrão aponta para a SUA cópia do SDK e das docs.
const SDK_PATH = args?.sdkPath ?? process.env.UNBOX_SDK_PATH ?? '<caminho local do unbox-sdk>'
const DOCS_PATH = args?.docsPath ?? process.env.UNBOX_DOCS_PATH ?? '<caminho local das docs do storefront>'

// ─── Contexto compartilhado (injetado em todos os agentes) ───────────────────
const SHARED = `
## Projeto
- Diretório: ${TARGET}
- Stack: Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui sobre Base UI
- SDK Unbox: ${SDK_PATH}/src/index.ts → import from "@payflows/unbox-sdk"
- Docs: ${DOCS_PATH}/

## Regras de Ouro (NUNCA viole)
1. UNBOX_API_KEY só no servidor — nunca NEXT_PUBLIC_, nunca client component, nunca logs
2. Dois tokens: token de loja (catálogo/checkout) ≠ token do cliente (área /conta via OTP)
3. placeOrder não é idempotente — lock por cartId no BFF; nunca retentar cegamente
4. customerOTPRequest dispara e-mail real — jamais em testes, CI ou loops automáticos
5. Preço e estoque vêm do servidor — nunca computar preço no cliente
6. Menu de navegação: use tags() — navigation tree dá erro com token de loja
7. displayStatus(language) está quebrado — use status + orderStatusLabel() do SDK
8. shadcn/ui usa Base UI (@base-ui/react) — prop render, não asChild
9. Tailwind v4 — use tokens/utilitários do tema; evite style inline quando há utilitário
10. Erros GraphQL chegam no body HTTP 200 — sempre cheque errors[] antes de usar data
11. recurringItemsFrequencyId não existe no live — use isRecurring:true + frequência no placeOrder

## Padrão de arquivo server-only
\`\`\`ts
// lib/unbox.ts
import "server-only"
import { UnboxClient } from "@payflows/unbox-sdk"
let _client: UnboxClient | null = null
export function getUnboxClient(): UnboxClient { ... }
\`\`\`

## Contratos entre seções
- lib/unbox.ts     → UnboxClient singleton (server-only)
- lib/auth.ts      → getCustomerToken(): cookie httpOnly do cliente
- lib/metadata.ts  → buildMetadata(product) → Metadata
- lib/feedback.ts  → re-exporta friendlyError, cartEventLabel do SDK
- components/cart/ → CartDrawer + useCart hook (client)
- components/promotions/ → ShopSalesBanner (server component)
`

// ─── Schemas ──────────────────────────────────────────────────────────────────
const FILE_SCHEMA = {
  type: 'object',
  properties: {
    files: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho relativo ao diretório do projeto' },
          content: { type: 'string', description: 'Conteúdo completo do arquivo' },
        },
        required: ['path', 'content'],
      },
    },
    packages: { type: 'array', items: { type: 'string' }, description: 'npm packages extras além do base' },
    notes: { type: 'string', description: 'Notas de implementação, gotchas, próximos passos' },
  },
  required: ['files'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    violations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          rule: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['rule', 'file', 'fix'],
      },
    },
    approved: { type: 'boolean' },
    summary: { type: 'string' },
  },
  required: ['violations', 'approved', 'summary'],
}

// ─── Helper: escreve arquivos retornados pelo agente ─────────────────────────
async function writeSection(result, label) {
  if (!result?.files?.length) { log(`⚠️  ${label}: nenhum arquivo retornado`); return }
  const writer = await agent(
    `Escreva os seguintes arquivos no disco. Para cada arquivo, use o caminho exato fornecido
    (se o caminho for relativo, prefixe com "${TARGET}/"). Crie os diretórios necessários.
    Arquivos:
    ${JSON.stringify(result.files, null, 2)}
    Após escrever todos os arquivos, retorne apenas "OK: <N> arquivos escritos".`,
    { label: `write:${label}`, effort: 'low' },
  )
  log(`✓ ${label}: ${writer}`)
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 1 — SCAFFOLD
// ═══════════════════════════════════════════════════════════════════════════════
phase('Scaffold')
log(`Scaffolding projeto em ${TARGET}...`)

const scaffold = await agent(
  `${SHARED}

## Tarefa: Scaffold do projeto Next.js

Crie a estrutura completa de um projeto Next.js 15 em "${TARGET}".

### O que criar:

**1. package.json**
\`\`\`json
{
  "name": "unbox-storefront",
  "version": "0.1.0",
  "private": true,
  "scripts": { "dev": "next dev --turbopack", "build": "next build", "start": "next start", "lint": "next lint" },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@base-ui-components/react": "^1.0.0",
    "server-only": "^0.0.1",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0"
  }
}
\`\`\`

**2. tsconfig.json** — padrão Next.js 15 com paths: { "@/*": ["./src/*"] } mas SEM src dir

**3. next.config.ts** — minimal, com images.domains vazio (será preenchido depois)

**4. app/globals.css** — import do Tailwind v4: \`@import "tailwindcss"\`

**5. app/layout.tsx** — RootLayout shell com html/body, Geist font, CartProvider placeholder

**6. lib/unbox.ts** — UnboxClient singleton server-only:
\`\`\`ts
import "server-only"
import { UnboxClient } from "@payflows/unbox-sdk"
// configura com env vars UNBOX_API_KEY, UNBOX_SHOP_ID
// implementa signInIfNeeded() com token cacheado (unstable_cache ou módulo-level)
\`\`\`

**7. lib/auth.ts** — placeholder para getCustomerToken():
\`\`\`ts
import { cookies } from "next/headers"
export async function getCustomerToken(): Promise<string | undefined> {
  return (await cookies()).get("unbox_customer_token")?.value
}
\`\`\`

**8. lib/feedback.ts** — re-exporta do SDK:
\`\`\`ts
export { friendlyError, cartEventLabel } from "@payflows/unbox-sdk"
\`\`\`

**9. lib/metadata.ts** — buildMetadata(product) → Metadata do Next.js

**10. Estrutura de rotas (arquivos com "// TODO: implementado pelo agente X"):**
- app/page.tsx
- app/produtos/page.tsx
- app/c/[tagSlug]/page.tsx
- app/p/[productSlug]/page.tsx
- app/p/[productSlug]/loading.tsx
- app/carrinho/page.tsx
- app/checkout/page.tsx
- app/conta/entrar/page.tsx
- app/conta/pedidos/page.tsx
- app/conta/assinaturas/page.tsx
- app/pedido/[referenceId]/page.tsx
- app/busca/page.tsx
- app/sitemap.ts
- app/robots.ts
- app/error.tsx
- app/not-found.tsx
- app/loading.tsx
- app/api/cart/route.ts
- app/api/checkout/route.ts
- app/api/auth/otp/route.ts
- app/api/auth/signin/route.ts
- app/api/webhooks/unbox/route.ts

**11. .env.local.example:**
\`\`\`
UNBOX_API_KEY=
UNBOX_SHOP_ID=
UNBOX_USERNAME=
UNBOX_PASSWORD=
UNBOX_WEBHOOK_SECRET=
\`\`\`

**12. Diretórios (criar com .gitkeep):**
components/layout/, components/catalog/, components/pdp/,
components/cart/, components/checkout/, components/customer/,
components/promotions/, components/ui/

Retorne TODOS os arquivos com conteúdo completo (não apenas placeholders vazios para lib/ e app/layout.tsx).`,
  { label: 'scaffold', schema: FILE_SCHEMA, effort: 'high' },
)

await writeSection(scaffold, 'scaffold')
const extraPackages = scaffold?.packages ?? []
log(`Scaffold completo. Packages extras: ${extraPackages.join(', ') || 'nenhum'}`)

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 2 — IMPLEMENT (paralelo)
// ═══════════════════════════════════════════════════════════════════════════════
phase('Implement')
log('Iniciando implementação paralela das 10 seções...')

const SECTION_AGENTS = [
  {
    id: 'layout',
    label: 'Layout (Header/Footer/Nav)',
    prompt: `${SHARED}

## Tarefa: Agente de Layout

Implemente o header, footer e navegação do storefront.

### Arquivos a criar:
- components/layout/Header.tsx — header com logo, menu de categorias (via tags), carrinho, login
- components/layout/Footer.tsx — links institucionais, redes sociais, copyright
- components/layout/Navigation.tsx — menu mobile + desktop (usa tags como categorias)
- components/layout/CartButton.tsx — ícone de carrinho com badge de quantidade (client component)

### Dados (SDK):
\`\`\`ts
// Dentro de um Server Component ou generateStaticParams:
import { getUnboxClient } from "@/lib/unbox"
const client = await getUnboxClient()
const tags = await client.getTags(true) // categorias top-level para o menu
\`\`\`

### Regras críticas:
- getTags usa token de loja — correto para header
- Navigation deve ter loading state e ser Suspense-friendly
- CartButton é um client component que lê o contexto do carrinho
- Header fixo (sticky) com z-index adequado para o CartDrawer
- Links de categoria: href="/c/[tag.slug]"
- Acessibilidade: role="navigation", aria-label, foco visível

### shadcn/ui (Base UI):
\`\`\`tsx
// Exemplo de Dropdown correto com Base UI:
import * as DropdownMenu from "@base-ui-components/react/menu"
<DropdownMenu.Root>
  <DropdownMenu.Trigger render={<button>Menu</button>} />
  <DropdownMenu.Positioner>
    <DropdownMenu.Popup>...</DropdownMenu.Popup>
  </DropdownMenu.Positioner>
</DropdownMenu.Root>
\`\`\``,
  },
  {
    id: 'homepage',
    label: 'Homepage',
    prompt: `${SHARED}

## Tarefa: Agente de Homepage

Implemente a página inicial do storefront (app/page.tsx).

### Arquivos a criar:
- app/page.tsx — Server Component com Suspense por seção
- components/home/HeroBanner.tsx — banner principal com CTA
- components/home/FeaturedProducts.tsx — grade de produtos em destaque
- components/home/ShopSalesSection.tsx — promoções ativas da loja
- components/home/CategoryGrid.tsx — grade de categorias (tags)

### Dados (SDK):
\`\`\`ts
const client = await getUnboxClient()
const [shop, featuredItems, tags] = await Promise.all([
  client.getShop(),          // shopSales (promoções automáticas)
  client.getCatalog({ first: 8, sortBy: "updatedAt", sortOrder: "desc" }),
  client.getTags(true),      // categorias
])
const shopSales = shop.shopSales ?? []
\`\`\`

### ShopSales (promoções automáticas):
\`\`\`ts
interface ShopSale {
  _id: string
  name: string
  description?: string
  discountType: string  // "percentage" | "fixed"
  discountAmount: number
  triggerType?: string  // "all" | "payment_method" (ex: "pix")
}
\`\`\`

### SEO:
\`\`\`ts
export const metadata: Metadata = {
  title: "Loja | Unbox Store",
  description: "...",
  openGraph: { ... }
}
\`\`\`

### Padrões:
- generateStaticParams NÃO se aplica à homepage
- Use unstable_cache ou Next.js fetch cache para dados públicos
- HeroBanner pode ser um image carrossel simples com Tailwind
- FeaturedProducts renderiza ProductCard (componente genérico reutilizado pelo Catalog)
- Cada seção deve ter loading.tsx com skeleton adequado`,
  },
  {
    id: 'catalog',
    label: 'Catalog (Listagem)',
    prompt: `${SHARED}

## Tarefa: Agente de Catalog

Implemente as páginas de listagem de produtos, categoria e busca.

### Arquivos a criar:
- app/produtos/page.tsx — catálogo completo, paginado
- app/c/[tagSlug]/page.tsx — categoria/tag filtrada
- app/busca/page.tsx — busca por texto (?q=)
- app/produtos/loading.tsx — skeleton de grid
- components/catalog/ProductGrid.tsx — grade responsiva de produtos
- components/catalog/ProductCard.tsx — card com imagem, título, preço, badge assinatura
- components/catalog/Pagination.tsx — paginação com offset
- components/catalog/FilterBar.tsx — filtros de categoria e ordenação
- components/catalog/SearchBar.tsx — campo de busca (client, redireciona para /busca)

### Dados (SDK):
\`\`\`ts
// Listagem com filtros
const result = await client.getCatalog({
  first: 24,
  offset: page * 24,       // page vem de searchParams
  tagIds: tagId ? [tagId] : undefined,
  searchText: q || undefined,
  sortBy: "updatedAt",
  sortOrder: "desc",
})
// result.nodes.map(n => n.product)
// result.totalCount
// result.pageInfo.hasNextPage

// Categoria por slug
const tags = await client.getTags(true)
const tag = tags.find(t => t.slug === tagSlug)
\`\`\`

### ProductCard — campos a exibir:
- Imagem: product.imageUrls?.[0]
- Título: product.title
- Preço: product.pricing?.[0]?.displayPrice
- Preço de: product.variants?.[0]?.pricing?.[0]?.compareAtPrice?.displayAmount
- Badge "Assine e Poupe" se product.recurrenceAllowed
- Badge "Esgotado" se product.isSoldOut
- Badge "Pré-venda" se product.isBackorder
- Link: /p/[product.slug]

### Paginação:
- Use URL searchParams (?page=2) — stateful via Link
- Não usar state do cliente para paginação (SSR-friendly)

### SEO de categoria:
\`\`\`ts
export async function generateMetadata({ params }) {
  const tag = await getTag(params.tagSlug)
  return { title: tag.displayTitle ?? tag.name }
}
export async function generateStaticParams() {
  const tags = await getTags()
  return tags.map(t => ({ tagSlug: t.slug }))
}
\`\`\``,
  },
  {
    id: 'pdp',
    label: 'PDP (Product Detail)',
    prompt: `${SHARED}

## Tarefa: Agente de PDP — Product Detail Page

Implemente a página de detalhe de produto (/p/[productSlug]).

### Arquivos a criar:
- app/p/[productSlug]/page.tsx — Server Component com SSG + ISR
- components/pdp/ProductImages.tsx — galeria de imagens (main + thumbs)
- components/pdp/ProductInfo.tsx — título, preço, badges, descrição
- components/pdp/VariantSelector.tsx — seleção de variante (client component)
- components/pdp/AddToCartForm.tsx — quantidade + botão "Adicionar ao Carrinho" (client)
- components/pdp/SubscriptionToggle.tsx — toggle "Avulso / Assine e Poupe" (client)
- components/pdp/ProductDescription.tsx — descrição e informações adicionais (accordion)

### Dados (SDK):
\`\`\`ts
const client = await getUnboxClient()
const item = await client.getProductBySlug(params.productSlug)
// item.product.variants[] — seleção de variante
// item.product.recurrenceAllowed — mostrar toggle de assinatura
// item.product.isSoldOut / isBackorder / isLowQuantity — badges
// item.shortDescription — descrição curta (acima do fold)
// item.product.description — descrição longa (abaixo)
// item.product.additionalInformation — informações adicionais (accordion)
\`\`\`

### ISR:
\`\`\`ts
export const revalidate = 3600 // 1h
export async function generateStaticParams() {
  const catalog = await client.getCatalog({ first: 200 })
  return catalog.nodes.map(n => ({ productSlug: n.product.slug }))
}
\`\`\`

### SubscriptionToggle:
- Só exibir se product.recurrenceAllowed
- Ao selecionar "Assinar", mostrar frequências disponíveis
- As frequências vêm de getShop().recurringOrdersPolicy.frequencyOptions
- No AddToCartForm: enviar isRecurring: true no cartItem
- A frequência só vai no placeOrder, não no cartItem (regra 11 do AGENTS.md)

### VariantSelector:
- Produto pode ter N variantes (ex.: tamanhos, sabores)
- Cada variante tem pricing próprio
- isSoldOut pode ser no produto OU por variante (checar ambos)

### AddToCartForm (client):
\`\`\`ts
// Chama a API Route /api/cart (POST) com:
// { action: "add", productId, productVariantId, price, quantity, isRecurring }
// Após sucesso, atualiza contexto do carrinho e mostra CartDrawer
\`\`\`

### SEO:
\`\`\`ts
export async function generateMetadata({ params }) {
  const item = await client.getProductBySlug(params.productSlug)
  return buildMetadata(item.product) // usa lib/metadata.ts
}
\`\`\``,
  },
  {
    id: 'cart',
    label: 'Cart (Carrinho)',
    prompt: `${SHARED}

## Tarefa: Agente de Cart — Carrinho

Implemente o carrinho completo: contexto, drawer e API routes.

### Arquivos a criar:
- app/api/cart/route.ts — Route Handler (server-only): create, add, update, remove, get
- components/cart/CartContext.tsx — Context + Provider (client, lê cookie cartId/cartToken)
- components/cart/CartDrawer.tsx — drawer lateral (Base UI Dialog)
- components/cart/CartItem.tsx — item com imagem, título, quantidade, preço, remover
- components/cart/CartSummary.tsx — total, desconto, frete estimado, botão checkout
- components/cart/EmptyCart.tsx — estado vazio
- app/carrinho/page.tsx — página full do carrinho (mesmos componentes, layout expandido)
- components/cart/DiscountCodeInput.tsx — input + botão aplicar cupom

### Persistência:
- cartId e cartToken em cookies do browser (httpOnly=false para leitura no cliente)
- CartContext lê os cookies e sincroniza estado
- Ao criar novo carrinho, salvar cookies via document.cookie

### API Route (/api/cart):
\`\`\`ts
// POST /api/cart
// body: { action: "create" | "add" | "update" | "remove" | "get" | "discount" | "clear", ...params }
import { getUnboxClient } from "@/lib/unbox"
export async function POST(req: Request) {
  const client = await getUnboxClient()
  const { action, cartId, cartToken, ...rest } = await req.json()
  // Rotear por action e chamar o método SDK correto
  // create → client.createCart()
  // add    → client.addCartItems(cartId, cartToken, [item])
  // update → client.updateCartItem(cartId, cartToken, itemId, qty)
  // remove → client.removeCartItem(cartId, cartToken, itemId)
  // get    → client.getCart(cartId, cartToken)
  // discount → client.applyDiscountCode(cartId, cartToken, code)
}
\`\`\`

### CartDrawer (Base UI):
\`\`\`tsx
import * as Dialog from "@base-ui-components/react/dialog"
<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
  <Dialog.Backdrop />
  <Dialog.Popup render={<aside className="fixed inset-y-0 right-0 w-96" />}>
    ...
  </Dialog.Popup>
</Dialog.Root>
\`\`\`

### DiscountCode:
- SDK: client.applyDiscountCode(cartId, cartToken, code) → CartResult
- Mostrar erro amigável via friendlyError() do lib/feedback.ts
- Mostrar desconto aplicado no CartSummary

### CartContext — interface mínima:
\`\`\`ts
interface CartContextValue {
  cartId: string | null
  cartToken: string | null
  items: CartItem[]
  totalCount: number
  total: number
  isOpen: boolean
  isLoading: boolean
  openCart(): void
  closeCart(): void
  addItem(item: CartItemInput & { isRecurring?: boolean }): Promise<void>
  updateQuantity(itemId: string, qty: number): Promise<void>
  removeItem(itemId: string): Promise<void>
  applyDiscount(code: string): Promise<void>
  refreshCart(): Promise<void>
}
\`\`\``,
  },
  {
    id: 'checkout',
    label: 'Checkout (Pagamento)',
    prompt: `${SHARED}

## Tarefa: Agente de Checkout

Implemente o fluxo completo de checkout: endereço → frete → pagamento → pedido.

### Arquivos a criar:
- app/checkout/page.tsx — página de checkout (multi-step, client-heavy)
- app/api/checkout/route.ts — Route Handler para todas as etapas
- app/pedido/[referenceId]/page.tsx — confirmação de pedido
- components/checkout/AddressForm.tsx — formulário de endereço completo
- components/checkout/ShippingSelector.tsx — seleção de opção de frete
- components/checkout/PaymentSelector.tsx — Pix ou Cartão de Crédito
- components/checkout/PixPayment.tsx — QR code + copia-e-cola + polling de status
- components/checkout/CreditCardForm.tsx — dados do cartão (número, nome, validade, CVV)
- components/checkout/OrderSummary.tsx — resumo do pedido (sidebar)
- components/checkout/CheckoutProgress.tsx — indicador de etapas

### Fluxo (API Unbox):
\`\`\`
1. setShippingAddressOnCart  → fulfillmentGroupId
2. updateFulfillmentOptionsForGroup → availableFulfillmentOptions[]
3. (opcional) applyDiscountCodeToCart
4. selectFulfillmentOptionForGroup → total com frete
5. placeOrder → order (Pix: QR + copia-e-cola | Cartão: aprovado/recusado)
\`\`\`

### API Route (/api/checkout):
\`\`\`ts
// POST /api/checkout
// { action: "address" | "quote" | "select-shipping" | "place" | "apply-discount" }
// IDEMPOTÊNCIA: lock por cartId (use Map em memória ou KV store)
// Desabilitar botão de submit + token de uso único no form
\`\`\`

### Idempotência (CRÍTICO):
\`\`\`ts
const inFlight = new Map<string, Promise<any>>()
export async function POST(req: Request) {
  const { cartId, action } = await req.json()
  if (action === "place") {
    if (inFlight.has(cartId)) return Response.json({ error: "pedido_em_andamento" }, { status: 409 })
    const promise = doPlaceOrder(...)
    inFlight.set(cartId, promise)
    try { return Response.json(await promise) }
    finally { inFlight.delete(cartId) }
  }
}
\`\`\`

### Pix:
- placeOrder retorna paymentMethod.data.pixQrCode e pixQrCodeText
- Exibir QR code (como <img src="data:image/png;base64,..."> ou via qrcode lib)
- Mostrar copia-e-cola para Pix
- Polling de status: GET /api/checkout?orderId=... a cada 5s (usa client.getOrder())
- Redirecionar para /pedido/[referenceId] quando status mudar de PENDING

### Cartão de Crédito (UnboxPay):
\`\`\`ts
// No placeOrder, paymentInput:
{
  paymentMethodId: "unboxpay_credit",
  amount: totalAmount,
  data: {
    cardNumber: "...",
    cardholderName: "...",
    expiryMonth: "12",
    expiryYear: "2027",
    cvv: "..."
  }
}
\`\`\`

### AddressInput (campos obrigatórios):
fullName, phone, postal, address1, city, region, country, taxPayerId, number, neighborhood

### Página de confirmação (/pedido/[referenceId]):
- Busca pedido por referenceId + token (ou session do cliente)
- Mostra status, itens, tracking se disponível
- status: use orderStatusLabel() do SDK (não displayStatus)`,
  },
  {
    id: 'auth',
    label: 'Auth (OTP Login)',
    prompt: `${SHARED}

## Tarefa: Agente de Autenticação

Implemente login passwordless (OTP) e gestão de sessão do cliente.

### Arquivos a criar:
- app/conta/entrar/page.tsx — página de login (2 etapas: email → código)
- app/api/auth/otp/route.ts — POST: dispara OTP; GET/DELETE: status/logout
- app/api/auth/signin/route.ts — troca OTP pelo token do cliente
- lib/auth.ts — getCustomerToken(), setCustomerToken(), clearCustomerToken()
- components/auth/OTPForm.tsx — formulário de email + campo de código OTP
- middleware.ts — protege rotas /conta/pedidos e /conta/assinaturas

### lib/auth.ts:
\`\`\`ts
import { cookies } from "next/headers"
const COOKIE = "unbox_customer_token"
const OPTS = { httpOnly: true, secure: true, sameSite: "lax", path: "/" } as const

export async function getCustomerToken() {
  return (await cookies()).get(COOKIE)?.value
}
export async function setCustomerToken(token: string, maxAge = 86400 * 7) {
  (await cookies()).set(COOKIE, token, { ...OPTS, maxAge })
}
export async function clearCustomerToken() {
  (await cookies()).delete(COOKIE)
}
\`\`\`

### /api/auth/otp (POST):
\`\`\`ts
// Dispara OTP por email
// ⚠️ Exige x-captcha-verification no SDK (já implementado internamente)
// ⚠️ NUNCA chamar em testes — manda e-mail real
// Rate-limit: máximo 1 requisição por email a cada 60s
const client = await getUnboxClient()
await client.gql(\`mutation($i:CustomerOTPRequestInput!){ customerOTPRequest(input:$i){success} }\`,
  { i: { email, shopId: process.env.UNBOX_SHOP_ID } },
  { captcha: true }
)
\`\`\`

### /api/auth/signin (POST):
\`\`\`ts
// Troca o código OTP pelo token do cliente
const data = await client.gql(\`
  mutation($i:CustomerPasswordlessSignInInput){
    customerPasswordlessSignIn(input:$i){
      accessToken idToken firstAccess newShopSignIn
    }
  }\`,
  { i: { email, otpCode: code, shopId } },
  { captcha: true }
)
// Salvar accessToken em cookie httpOnly via setCustomerToken()
// Redirecionar para /conta/pedidos
\`\`\`

### middleware.ts:
\`\`\`ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
export function middleware(req: NextRequest) {
  const token = req.cookies.get("unbox_customer_token")?.value
  if (!token) return NextResponse.redirect(new URL("/conta/entrar", req.url))
  return NextResponse.next()
}
export const config = { matcher: ["/conta/pedidos/:path*", "/conta/assinaturas/:path*"] }
\`\`\`

### OTPForm (client component):
- Step 1: campo de email → POST /api/auth/otp
- Step 2: campo de 6 dígitos → POST /api/auth/signin
- Auto-foco no step 2
- Botão "Reenviar código" com cooldown de 60s
- Erro amigável via friendlyError()`,
  },
  {
    id: 'customer',
    label: 'Customer Area (Conta)',
    prompt: `${SHARED}

## Tarefa: Agente de Área do Cliente

Implemente a área logada: pedidos, rastreio e gerenciamento de assinaturas.

### Arquivos a criar:
- app/conta/pedidos/page.tsx — lista de pedidos do cliente
- app/conta/pedidos/[orderId]/page.tsx — detalhe de pedido + rastreio
- app/conta/assinaturas/page.tsx — lista de assinaturas ativas
- app/conta/assinaturas/[subscriptionId]/page.tsx — detalhe + ações da assinatura
- app/conta/layout.tsx — layout compartilhado da área logada (sidebar de navegação)
- components/customer/OrderCard.tsx — card de pedido na listagem
- components/customer/OrderDetail.tsx — detalhe completo com itens e status
- components/customer/SubscriptionCard.tsx — card de assinatura
- components/customer/SubscriptionActions.tsx — pausar/retomar/pular/cancelar

### Token do cliente (DIFERENTE do token de loja):
\`\`\`ts
import { getCustomerToken } from "@/lib/auth"
import { UnboxCustomerClient } from "@payflows/unbox-sdk"

export async function getCustomerClient() {
  const token = await getCustomerToken()
  if (!token) throw new Error("Não autenticado")
  return new UnboxCustomerClient({
    apiKey: process.env.UNBOX_API_KEY!,
    shopId: process.env.UNBOX_SHOP_ID!,
    customerToken: token,
  })
}
\`\`\`

### Pedidos:
\`\`\`ts
const client = await getCustomerClient()
const orders = await client.getOrders({ first: 20 }) // paginado
// order.status → use orderStatusLabel(order.status) para texto PT-BR
// order.referenceId → ID curto para exibição
// order.totalPrice?.amount → total pago
// ⚠️ NÃO use totalItemQuantity (campo quebrado)
// ⚠️ NÃO use displayStatus(language) (resolver quebrado)
\`\`\`

### Rastreio:
\`\`\`ts
// Em contexto de cliente: use trackingCode, não trackingUrl
const tracking = order.fulfillmentGroups?.data?.[0]?.tracking
// tracking.trackingCode — código de rastreio
// tracking.carrier — transportadora
\`\`\`

### Assinaturas (RecurringOrders):
\`\`\`ts
const subscriptions = await client.getRecurringOrders({ first: 10 })
// subscription.status: "active" | "paused" | "cancelled"
// subscription.nextOrderDate — próxima data de cobrança
// subscription.items[] — produtos
// subscription.recurrencePolicy.frequencyOptions[] — frequências

// Ações disponíveis:
await client.pauseRecurringOrder(subscriptionId)
await client.resumeRecurringOrder(subscriptionId)
await client.skipRecurringOrderCycle(subscriptionId)
await client.cancelRecurringOrder(subscriptionId)
// Status: use subscriptionStatusLabel() do SDK
\`\`\`

### Status labels:
\`\`\`ts
import { orderStatusLabel, paymentStatusLabel, subscriptionStatusLabel } from "@payflows/unbox-sdk"
orderStatusLabel("new")        // "Novo"
subscriptionStatusLabel("active") // "Ativa"
\`\`\`

### Paginação de pedidos:
- Implementar paginação com cursor (pageInfo.endCursor)
- "Carregar mais" (não paginação por página — UX mais suave para histórico)`,
  },
  {
    id: 'promotions',
    label: 'Promotions (Promoções)',
    prompt: `${SHARED}

## Tarefa: Agente de Promoções

Implemente os componentes de promoções da loja (shopSales e cupons).

### Arquivos a criar:
- components/promotions/ShopSalesBanner.tsx — banner de promoções automáticas (topo do site)
- components/promotions/SalesBadge.tsx — badge numa listagem/card de produto
- components/promotions/DiscountBanner.tsx — banner de desconto em destaque (homepage)
- components/promotions/CouponInput.tsx — input de cupom reutilizável (usado no Checkout e Cart)
- components/promotions/ActiveDiscount.tsx — exibe desconto aplicado com valor e remoção
- app/api/promotions/route.ts — GET shopSales cached

### shopSales (promoções automáticas — sem código):
\`\`\`ts
const shop = await client.getShop()
interface ShopSale {
  _id: string
  name: string
  description?: string
  discountType: "percentage" | "fixed"
  discountAmount: number
  triggerType?: string   // "all" | "payment_method" (ex: "5% no Pix")
  conditions?: object
}
\`\`\`

### ShopSalesBanner — lógica:
- Se há shopSale com triggerType "payment_method" para Pix → banner "5% de desconto no Pix"
- Se há shopSale geral → banner de desconto global
- Banner deve ser dismissível (localStorage) e acessível (role="banner")
- Server Component por default (dados em cache), com parte client só para dismiss

### Cupons (discountCodes):
\`\`\`ts
// Listar cupons disponíveis (para exibir na homepage se quiser)
const codes = await client.listDiscountCodes({ first: 20 })
// ⚠️ first deve ser ≤ 20 (ConnectionLimitInt, não Int comum)

// Aplicar cupom (via CartContext / API Route /api/cart)
await client.applyDiscountCode(cartId, cartToken, "CODIGO10")
// Resultado vem no CartResult — exibir via ActiveDiscount
\`\`\`

### SalesBadge — uso nos ProductCards:
\`\`\`tsx
// Recebe shopSales como prop e exibe o desconto aplicável ao produto
// Ex: "5% OFF no Pix" ou "10% OFF assinatura"
<SalesBadge sales={shopSales} isRecurring={product.recurrenceAllowed} />
\`\`\`

### Cache:
- shopSales: cache de 5min (dados mudam pouco, mas são dinâmicos)
- discountCodes: não cachear (podem expirar)
\`\`\`ts
import { unstable_cache } from "next/cache"
const getShopSales = unstable_cache(
  async () => { const s = await client.getShop(); return s.shopSales ?? [] },
  ["shop-sales"],
  { revalidate: 300 }
)
\`\`\``,
  },
  {
    id: 'feedback',
    label: 'Feedback/UX',
    prompt: `${SHARED}

## Tarefa: Agente de Feedback e UX

Implemente os padrões de UX: estados de loading, erros, toasts e páginas especiais.

### Arquivos a criar:
- components/ui/Toast.tsx — toast notifications (Base UI Toast ou custom)
- components/ui/ToastProvider.tsx — provider global
- components/ui/LoadingSpinner.tsx — spinner genérico
- components/ui/Skeleton.tsx — skeleton genérico (polimórfico com className)
- components/ui/ErrorBoundary.tsx — error boundary client component
- components/ui/EmptyState.tsx — estado vazio genérico
- app/error.tsx — error page global (client component)
- app/not-found.tsx — 404 page
- app/loading.tsx — loading page global (Suspense fallback)
- lib/feedback.ts — re-exporta + mapeia erros Unbox para mensagens PT-BR

### lib/feedback.ts:
\`\`\`ts
export { friendlyError, cartEventLabel } from "@payflows/unbox-sdk"

// Mapas de UX extras:
export const CHECKOUT_STEP_LABELS = {
  address: "Endereço",
  shipping: "Frete",
  payment: "Pagamento",
  confirmation: "Confirmação",
} as const

export function getPaymentErrorMessage(error: string): string {
  const map: Record<string, string> = {
    INSUFFICIENT_FUNDS_ERROR: "Cartão sem limite disponível",
    CARD_DECLINED: "Cartão recusado pela operadora",
    INVALID_CARD: "Dados do cartão inválidos",
    EXPIRED_CARD: "Cartão expirado",
  }
  return map[error] ?? "Erro no pagamento. Tente outro cartão."
}
\`\`\`

### Toast (Base UI se disponível, senão custom):
\`\`\`tsx
// Interface de uso:
const { toast } = useToast()
toast({ title: "Produto adicionado!", description: "Veja seu carrinho", type: "success" })
toast({ title: "Erro ao aplicar cupom", description: friendlyError(error), type: "error" })
\`\`\`

### Skeleton — polimórfico:
\`\`\`tsx
// <Skeleton className="h-4 w-32" /> → linha
// <Skeleton className="aspect-square w-full" /> → imagem
// ProductCardSkeleton, CartItemSkeleton, etc.
\`\`\`

### app/error.tsx (CRÍTICO — client component):
\`\`\`tsx
"use client"
export default function Error({ error, reset }: { error: Error; reset(): void }) {
  // Não exibir detalhes técnicos ao usuário final
  // Log interno: console.error(error.message) apenas
  // Botão "Tentar novamente" chama reset()
}
\`\`\`

### Padrões de loading states:
- Catálogo: grid de 8 ProductCardSkeleton
- PDP: ImageSkeleton + InfoSkeleton lado a lado
- Carrinho: lista de CartItemSkeleton
- Checkout: FormSkeleton por seção
- Usar Tailwind animate-pulse nos skeletons

### Acessibilidade:
- aria-live="polite" nos toasts
- aria-busy="true" em botões durante carregamento
- Focus trap no CartDrawer e dialogs
- Não remover foco visível (outline)`,
  },
  {
    id: 'seo',
    label: 'SEO + Infra',
    prompt: `${SHARED}

## Tarefa: Agente de SEO e Infraestrutura

Implemente SEO, sitemap, robots, metadados e páginas de suporte.

### Arquivos a criar:
- app/sitemap.ts — sitemap dinâmico (produtos + categorias)
- app/robots.ts — robots.txt
- lib/metadata.ts — buildMetadata(product) e helpers
- app/pedido/[referenceId]/page.tsx — confirmação de pedido (noindex)
- app/conta/layout.tsx — layout da área logada (se não criado pelo auth agent)

### lib/metadata.ts:
\`\`\`ts
import type { Metadata } from "next"
import type { CatalogProduct } from "@payflows/unbox-sdk"

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "Unbox Store"
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://seudominio.com.br"

export function buildMetadata(product: CatalogProduct, canonical?: string): Metadata {
  const title = product.pageTitle ?? product.title
  const description = product.metaDescription ?? product.description?.slice(0, 160)
  const image = product.imageUrls?.[0]
  const url = canonical ?? \`\${SITE_URL}/p/\${product.slug}\`
  return {
    title: \`\${title} | \${SITE_NAME}\`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      images: image ? [{ url: image, alt: title }] : [],
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : [] },
  }
}

export function buildCategoryMetadata(tag: { name: string; description?: string; slug: string }): Metadata {
  return {
    title: \`\${tag.name} | \${SITE_NAME}\`,
    description: tag.description,
    alternates: { canonical: \`\${SITE_URL}/c/\${tag.slug}\` },
  }
}
\`\`\`

### app/sitemap.ts:
\`\`\`ts
import type { MetadataRoute } from "next"
import { getUnboxClient } from "@/lib/unbox"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const client = await getUnboxClient()
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? ""

  // Páginas estáticas
  const staticRoutes = ["/", "/produtos", "/busca"].map(path => ({
    url: \`\${SITE_URL}\${path}\`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: path === "/" ? 1 : 0.8,
  }))

  // Categorias
  const tags = await client.getTags(true)
  const categoryRoutes = tags.filter(t => t.isVisible).map(tag => ({
    url: \`\${SITE_URL}/c/\${tag.slug}\`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }))

  // Produtos (paginado para não buscar tudo de uma vez)
  const productRoutes = []
  let offset = 0
  for (;;) {
    const page = await client.getCatalog({ first: 100, offset })
    const visible = page.nodes.filter(n => n.product.isVisible)
    productRoutes.push(...visible.map(n => ({
      url: \`\${SITE_URL}/p/\${n.product.slug}\`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })))
    if (!page.pageInfo?.hasNextPage) break
    offset += 100
  }

  return [...staticRoutes, ...categoryRoutes, ...productRoutes]
}
\`\`\`

### app/robots.ts:
\`\`\`ts
import type { MetadataRoute } from "next"
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/conta/", "/checkout", "/api/"] }
    ],
    sitemap: \`\${process.env.NEXT_PUBLIC_SITE_URL}/sitemap.xml\`,
  }
}
\`\`\`

### Variáveis de ambiente públicas (NEXT_PUBLIC):
Apenas NEXT_PUBLIC_SITE_NAME e NEXT_PUBLIC_SITE_URL são seguros como public —
NÃO expor shopId, apiKey ou qualquer credencial Unbox.

### Dados estruturados (JSON-LD) — PDP:
\`\`\`ts
export function buildProductJsonLd(product: CatalogProduct) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.imageUrls,
    sku: product.variants?.[0]?.sku,
    offers: {
      "@type": "Offer",
      availability: product.isSoldOut
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      price: product.pricing?.[0]?.price,
      priceCurrency: "BRL",
    },
  }
}
\`\`\``,
  },
]

const sectionResults = await parallel(
  SECTION_AGENTS.map(section => async () => {
    const result = await agent(section.prompt, {
      label: section.label,
      phase: 'Implement',
      schema: FILE_SCHEMA,
      effort: 'high',
    })
    await writeSection(result, section.id)
    return { id: section.id, files: result?.files?.map(f => f.path) ?? [], notes: result?.notes }
  })
)

const validSections = sectionResults.filter(Boolean)
log(`Implement completo: ${validSections.length}/10 seções implementadas`)

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 3 — INTEGRATE
// ═══════════════════════════════════════════════════════════════════════════════
phase('Integrate')
log('Integrando seções...')

const sectionSummary = validSections.map(s =>
  `${s.id}: ${s.files?.slice(0, 5).join(', ')}${s.files?.length > 5 ? '...' : ''}`
).join('\n')

const integration = await agent(
  `${SHARED}

## Tarefa: Agente Integrador

As seções do storefront foram implementadas em paralelo. Agora integre tudo.

### Seções implementadas:
${sectionSummary}

### O que fazer:

1. **Leia todos os arquivos em ${TARGET}** e identifique:
   - Imports quebrados ou inconsistentes
   - Exports que faltam nos arquivos de índice
   - Tipos compartilhados que precisam ser centralizados

2. **Atualize app/layout.tsx** para incluir:
   - CartProvider wrapping tudo
   - ToastProvider
   - Header e Footer reais (não placeholder)
   - Fonts do Next.js (Geist ou Inter)

3. **Atualize next.config.ts** com:
   - domains de imagem (unbox CDN: images.unbox.com.br ou similar)
   - redirects se necessário

4. **Crie/atualize index de componentes** (barrel exports) se necessário

5. **Verifique middleware.ts** — deve proteger /conta/pedidos e /conta/assinaturas

6. **Resolva conflitos** entre seções (ex: se dois agentes criaram o mesmo componente)

7. **Crie tsconfig paths** corretos para todos os @/ imports

8. **Verifique app/globals.css** — deve ter @import "tailwindcss" e variáveis CSS base

Leia os arquivos existentes antes de editar. Use Edit, não Write, para modificações parciais.`,
  { label: 'integrate', effort: 'high' },
)

log(`Integração concluída.`)

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 4 — REVIEW
// ═══════════════════════════════════════════════════════════════════════════════
phase('Review')
log('Verificando regras de ouro e qualidade...')

const review = await agent(
  `${SHARED}

## Tarefa: Agente Revisor

Faça uma revisão de segurança e qualidade do storefront gerado em ${TARGET}.

### Checklist das Regras de Ouro:

1. **UNBOX_API_KEY**: grep por "UNBOX_API_KEY" em arquivos com "use client" → VIOLAÇÃO se encontrar
2. **NEXT_PUBLIC_**: grep por "NEXT_PUBLIC_UNBOX" → VIOLAÇÃO
3. **placeOrder idempotência**: verificar se há lock por cartId na API route de checkout
4. **customerOTPRequest**: confirmar que só é chamado em Route Handlers (nunca client)
5. **Token de cliente**: confirmar que UnboxCustomerClient só é instanciado com customerToken
6. **displayStatus**: grep por "displayStatus(" → se encontrar, é VIOLAÇÃO
7. **trackingUrl**: grep por "trackingUrl" em contexto cliente → VIOLAÇÃO (use trackingCode)
8. **asChild**: grep por 'asChild' → VIOLAÇÃO (shadcn/ui usa Base UI, prop render)
9. **totalItemQuantity**: grep → VIOLAÇÃO no contexto customer
10. **recurringItemsFrequencyId**: grep → VIOLAÇÃO

### Checklist de qualidade:
- Todo Server Component que busca dados tem \`export const revalidate\` ou cache configurado
- Páginas de catálogo/PDP têm generateMetadata
- Há loading.tsx para rotas lentas
- CartContext não vaza para componentes server
- Formulários têm validação de campos obrigatórios do AddressInput
- Erros são tratados com try/catch e exibidos via friendlyError()

### Execute os greps e leia os arquivos críticos, então retorne o resultado estruturado.`,
  { label: 'review', schema: REVIEW_SCHEMA, effort: 'high' },
)

if (review?.violations?.length) {
  log(`⚠️  ${review.violations.length} violação(ões) encontrada(s):`)
  review.violations.forEach(v => log(`  ❌ [${v.rule}] ${v.file}: ${v.fix}`))
} else {
  log('✅ Nenhuma violação encontrada')
}

log(review?.summary ?? '')

return {
  sections: validSections,
  approved: review?.approved ?? false,
  violations: review?.violations ?? [],
  summary: review?.summary ?? '',
}
