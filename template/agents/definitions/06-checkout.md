# Agente 06 — Checkout (Pagamento)

> ⚠️ **Doc de plano (histórico).** A implementação entregue pela foundation difere em nomes e
> caminhos de arquivo citados abaixo. O mapa REAL de arquivos por área é a tabela "Agentes
> 00-11" do `agents/MANAGER.md` — em conflito, valem o MANAGER e o código.

## Escopo
Fluxo completo de checkout: endereço → cotação de frete → seleção → pagamento (Pix/Cartão) → pedido.

## Dependências
- Agente 00 (Scaffold)
- Agente 05 (Cart) — `cartId` e `cartToken` vêm do CartContext

## Arquivos proprietários

| Arquivo | Descrição |
|---------|-----------|
| `app/api/checkout/route.ts` | Route Handler com lock de idempotência por cartId |
| `app/(loja)/checkout/page.tsx` | Multi-step checkout (client-heavy) |
| `app/(loja)/pedido/[referenceId]/page.tsx` | Confirmação de pedido |
| `components/checkout/AddressForm.tsx` | Formulário de endereço |
| `components/checkout/ShippingSelector.tsx` | Lista de opções de frete |
| `components/checkout/PaymentSelector.tsx` | Pix ou Cartão |
| `components/checkout/PixPayment.tsx` | QR code + copia-e-cola + polling |
| `components/checkout/CreditCardForm.tsx` | Dados do cartão |
| `components/checkout/OrderSummary.tsx` | Resumo dos itens (sidebar) |
| `components/checkout/CheckoutProgress.tsx` | Steps: Endereço → Frete → Pagamento |

## Fluxo da API (ordem obrigatória)

```
1. setShippingAddressOnCart  →  fulfillmentGroupId
2. updateFulfillmentOptionsForGroup  →  availableFulfillmentOptions[]
3. (opcional) applyDiscountCodeToCart
4. selectFulfillmentOptionForGroup  →  total com frete
5. placeOrder  →  order (Pix QR | resultado cartão)
```

## device (antifraude/3DS) — OBRIGATÓRIO no placeOrder

Vai no **nível raiz** do `PlaceOrderInput` (irmão de `order` e `payments`), campo único
com enum `type`:

- `type: "BROWSER"` — 8 campos reais do navegador (colorDepth, javaEnabled, userAgent,
  language, screenHeight, screenWidth, timezoneOffset), coletados em
  `components/checkout/checkout-client.tsx` e repassados pelo BFF (`/api/checkout`).
- `type: "API"` — fallback para pedidos server-side (scripts) — o SDK aplica
  automaticamente quando `device` é omitido.

`timezoneOffset` em **minutos** (`getTimezoneOffset()`, BRT → 180) — ponto aberto com a
Unbox se seria em horas; ver `lib/unbox/types.ts`.

## AddressInput — campos obrigatórios

```ts
// NON_NULL no schema: fullName, phone, postal, address1, city, region, country
// Validados ao vivo (obrigatórios na prática): taxPayerId, number, neighborhood
interface AddressInput {
  fullName: string; taxPayerId: string; postal: string
  address1: string; number: string; neighborhood: string
  city: string; region: string; phone: string
  country?: string    // default "BR"
  address2?: string
  isCommercial?: boolean
}
```

## Idempotência (CRÍTICO)

```ts
// Em memória (dev/single-instance) — em prod usar KV/Redis
const inFlight = new Map<string, true>()

export async function POST(req: Request) {
  const { action, cartId, cartToken, ...rest } = await req.json()

  if (action === "place") {
    if (inFlight.has(cartId)) {
      return Response.json({ error: "pedido_em_andamento" }, { status: 409 })
    }
    inFlight.set(cartId, true)
    try {
      const result = await doPlaceOrder(cartId, cartToken, rest)
      return Response.json(result)
    } finally {
      inFlight.delete(cartId)
    }
  }
  // ... outros actions
}
```

## Pix — polling de status

```tsx
// Polling a cada 5s até status !== "new" e !== "processing"
useEffect(() => {
  if (!orderId || status === "paid") return
  const id = setInterval(async () => {
    const res = await fetch(`/api/checkout?orderId=${orderId}`)
    const { order } = await res.json()
    if (order.status !== "new" && order.status !== "processing") {
      setStatus(order.status)
      clearInterval(id)
      if (order.status === "paid") router.push(`/pedido/${order.referenceId}`)
    }
  }, 5000)
  return () => clearInterval(id)
}, [orderId, status])
```

## Múltiplos grupos de frete

```ts
// NUNCA assuma fulfillmentGroups[0] apenas
// Itere todos os grupos:
for (const group of cart.checkout.fulfillmentGroups) {
  await updateFulfillmentOptionsForGroup({ cartId, cartToken, fulfillmentGroupId: group._id })
}
// Ao selecionar frete, selecionar para CADA grupo
// No placeOrder, incluir TODOS os grupos
```

## Página de confirmação (/pedido/[referenceId])

```ts
// Buscar pedido por referenceId
// Status: use orderStatusLabel(order.status) — NUNCA displayStatus(language)
// Rastreio: order.fulfillmentGroups.data[0].tracking.trackingCode (não trackingUrl)
```

## Submit do formulário — botão único

```tsx
// Prevenir duplo clique:
const [submitting, setSubmitting] = useState(false)
async function handleSubmit() {
  if (submitting) return
  setSubmitting(true)
  try { await placeOrder() }
  finally { setSubmitting(false) }
}
<button disabled={submitting} aria-busy={submitting}>
  {submitting ? "Processando..." : "Finalizar Pedido"}
</button>
```
