# Agente 05 — Cart (Carrinho)

> ⚠️ **Doc de plano (histórico).** A implementação entregue pela foundation difere em nomes e
> caminhos de arquivo citados abaixo. O mapa REAL de arquivos por área é a tabela "Agentes
> 00-11" do `agents/MANAGER.md` — em conflito, valem o MANAGER e o código.

## Escopo
Contexto global do carrinho, drawer lateral, página `/carrinho`, API route server-side e input de cupom.

## Dependências
- Agente 00 (Scaffold) — `lib/unbox.ts`

## Arquivos proprietários

| Arquivo | Descrição |
|---------|-----------|
| `app/api/cart/route.ts` | Route Handler: create, add, update, remove, get, discount |
| `components/cart/CartContext.tsx` | Context + Provider + useCart hook (client) |
| `components/cart/CartDrawer.tsx` | Drawer lateral Base UI Dialog |
| `components/cart/CartItem.tsx` | Item com imagem, qtd, preço, remover |
| `components/cart/CartSummary.tsx` | Subtotal, desconto, frete, botão checkout |
| `components/cart/EmptyCart.tsx` | Estado vazio com CTA para catálogo |
| `components/cart/DiscountCodeInput.tsx` | Input + aplicar cupom |
| `app/(loja)/carrinho/page.tsx` | Versão full-page do carrinho |

## Interface do CartContext

```ts
interface CartContextValue {
  cartId: string | null
  cartToken: string | null
  items: CartLineItem[]
  totalCount: number        // soma de quantities
  subtotal: number
  total: number
  appliedDiscount?: { code: string; amount: number }
  isOpen: boolean
  isLoading: boolean
  openCart(): void
  closeCart(): void
  addItem(params: AddParams): Promise<void>
  updateQuantity(itemId: string, qty: number): Promise<void>
  removeItem(itemId: string): Promise<void>
  applyDiscount(code: string): Promise<{ success: boolean; error?: string }>
  refreshCart(): Promise<void>
}
```

## Persistência de cookies

```ts
// Browser-side (client component) — cartId e cartToken NÃO são sensíveis
function saveCartCookies(cartId: string, cartToken: string) {
  const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `unbox_cart_id=${cartId}; expires=${exp}; path=/; SameSite=Lax`
  document.cookie = `unbox_cart_token=${cartToken}; expires=${exp}; path=/; SameSite=Lax`
}
function readCartCookies() {
  const get = (n: string) => document.cookie.match(new RegExp(`(?:^|; )${n}=([^;]*)`))?.[1]
  return { cartId: get("unbox_cart_id") ?? null, cartToken: get("unbox_cart_token") ?? null }
}
```

## API Route /api/cart

```ts
// POST /api/cart — actions: create | add | update | remove | get | discount | clear
import { getUnboxClient } from "@/lib/unbox"

export async function POST(req: Request) {
  const client = await getUnboxClient()
  const body = await req.json()

  switch (body.action) {
    case "create":
      return Response.json(await client.createCart({ shopId: client.shopId }))
    case "add":
      return Response.json(await client.addCartItems(body.cartId, body.cartToken, [body.item]))
    case "update":
      return Response.json(await client.updateCartItem(body.cartId, body.cartToken, body.itemId, body.qty))
    case "remove":
      return Response.json(await client.removeCartItem(body.cartId, body.cartToken, body.itemId))
    case "get":
      return Response.json(await client.getCart(body.cartId, body.cartToken))
    case "discount":
      return Response.json(await client.applyDiscountCode(body.cartId, body.cartToken, body.code))
    default:
      return Response.json({ error: "Ação inválida" }, { status: 400 })
  }
}
```

## CartDrawer (Base UI)

```tsx
import * as Dialog from "@base-ui-components/react/dialog"

<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
  <Dialog.Backdrop className="fixed inset-0 bg-black/40" />
  <Dialog.Popup render={
    <aside className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl flex flex-col" />
  }>
    <Dialog.Title>Meu Carrinho ({totalCount})</Dialog.Title>
    {/* items */}
    <CartSummary />
  </Dialog.Popup>
</Dialog.Root>
```

## Cupom — regra crítica

```ts
// discountCodes(first:) recebe ConnectionLimitInt — máximo 20
// Ao aplicar: mostrar erro via friendlyError() se falhar
// Erro de cupom inválido: cartEventLabel("COUPON_NOT_APPLICABLE") → "Cupom não aplicável"
```
