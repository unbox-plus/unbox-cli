# Cobertura — SDK Unbox + 11 documentos → onde está no storefront

Mapa recurso → arquivo. Tudo validado: `npm run unbox:test` → **17/17**, `npm run build` limpo,
smoke test HTTP do BFF (carrinho→endereço→frete) **200** em todas as etapas.

## Métodos do SDK (`UnboxClient`) — todos usados

| Método | Onde |
|---|---|
| `signIn` + cache/re-signin | `lib/unbox/store.ts` (`getStoreClient`/`withStoreClient`) |
| `gql` (checa `errors` em HTTP 200, `x-captcha`) | `lib/unbox/client.ts` |
| `getCatalog` (first/offset/search/tagIds/sort) | `lib/queries.ts` → home, `/produtos`, `/busca`, `/categoria/[tagSlug]` |
| `getProductBySlug` | `app/(loja)/produto/[productSlug]/page.tsx` |
| `getProductById` | `lib/unbox/client.ts` (fallback/deep link) |
| `getTags` | `components/site-header.tsx`, home, categoria |
| `getShop` (shopSales, política de assinatura, settings) | `lib/queries.ts` → header, home, PDP, checkout |
| `getPaymentMethods` | `app/(loja)/checkout/page.tsx` |
| `listDiscountCodes` | `lib/queries.ts`, resolução de cupom no route |
| `createCart` / `addCartItems` / `updateItemQuantity` / `removeCartItems` | `app/api/cart/**` |
| `getCart` (rehidratar) | `app/api/cart` (GET), checkout, recuperação |
| `getFulfillmentGroupIds` (N grupos) | `app/api/checkout/address`, `shipping` |
| `setShippingAddress` | `app/api/checkout/address` |
| `quoteShipping` (obrigatório p/ cotar) | `app/api/checkout/shipping` (POST) |
| `selectShipping` | `app/api/checkout/shipping` (PUT) |
| `applyDiscount` / `findDiscountIdByCode` / `removeDiscount` | `app/api/cart/coupon` |
| `buildOrderItems` (exclui brindes) | `app/api/checkout` |
| `placeOrder` (Pix/Cartão + `orderRecurrence` + `device` antifraude no root) | `app/api/checkout` |
| API de PARCEIROS (nova): signIn GQL, tags, cupons, pedido, parcelas, `simpleInventory`, webhook, cart template — roteados via `UNBOX_PARTNER_API_KEY` | `lib/unbox/client.ts` (`usesPartnerApi`) |
| `getOrder` (com token de posse) | `lib/orders.ts`, `app/api/order/[ref]`, `/api/track` |
| `requestCustomerOtp` / `customerSignIn` / `customerAccountExists` | `app/api/account/{otp,signin,exists}` |
| `getAddressByPostalCode` | `app/api/cep/[code]`, `AddressFields` |
| `quoteShippingForProduct` (calcule-o-frete na PDP) | `app/api/shipping/quote` |
| `createPaymentLink` / `getPublicPaymentLink` | `app/api/payment-link` |
| `createCartByTemplate` | `lib/unbox/client.ts` (campanhas) |
| `subscribeWebhook` | `scripts/subscribe-webhook.ts` |

## `UnboxCustomerClient` — área do cliente

| Método | Onde |
|---|---|
| `me` (currentCustomerAccount) | `/conta`, `/conta/enderecos`, `/conta/preferencias` |
| `updateAccount` | `app/api/account/preferences` |
| `orders` / `order` | `/conta/pedidos` + `[referenceId]`, `lib/orders.ts` |
| `subscriptions` / `subscription` / `subscriptionCycles` | `/conta/assinaturas` + `[referenceId]` |
| `pause` / `skipNextCycle` / `cancel` | `app/api/subscriptions/[id]` (+ `SubscriptionActions`) |
| `updateItems` / `updateCard` / `updateAddress` | idem |
| `addressBooks` / `upsertAddress` / `deleteAddresses` | `app/api/account/addresses` (+ `AddressBook`) |
| Rótulos `orderStatusLabel` / `paymentStatusLabel` / `subscriptionStatusLabel` | `components/order-status.tsx`, listas |

## Helpers do SDK

| Recurso | Onde |
|---|---|
| `friendlyError` / `cartEventLabel` (feedback PT-BR) | `lib/api.ts`, `cart-provider` (toasts) |
| `datalayer.*` (GA4 + contrato do GTM central) | `lib/analytics.ts` — camada única (+ GTM/GA4 em `app/layout.tsx`) |
| `verifyUnboxWebhook` / `parseUnboxWebhook` (HMAC corpo cru) | `app/api/webhooks/unbox` |

## Documentos (01–11) — recursos cobertos

- **01 Autenticação** — signin REST, JWT Bearer, cache/renovação, `x-captcha-verification`, dois contextos de auth, shopId/slug do JWT, erros em HTTP 200 → `lib/config.ts`, `lib/unbox/store.ts`, `lib/unbox/client.ts`.
- **02 Catálogo** — `catalogItems`, `catalogItemProductBySlug`/`ById`, `tags`, variantes/preço, de/por, badges de estoque, min/max, mídia, HTML sanitizado → catálogo/PDP + `lib/sanitize.ts`.
- **03 Carrinho & assinatura** — create/add/update/remove/get, brindes, `recurringItemsFrequencyId`, cart templates → `app/api/cart/**`, PDP (assinar), checkout.
- **04 Promoções** — `shopSales` (banner), `applyDiscountCodeToCart` (antes do frete), `removeDiscountCodeFromCart` (por discountId), brinde automático, `discountCodes` → header/home + `app/api/cart/coupon`.
- **05 Checkout** — endereço → frete (N grupos) → Pix/Cartão → `placeOrder`, QR copia-e-cola, parcelas, releitura antes do pedido → `app/api/checkout/**`, `components/checkout/*`, `/checkout/pix/[ref]`.
- **06 Área do cliente** — OTP 2 passos, conta, pedidos/rastreio, assinaturas self-service, address book + CEP, guest tracking → `/conta/**`, `/pedido/[referenceId]`.
- **07 Webhooks & extras** — `subscribeToWebhook`, HMAC, PING, idempotência, ORDER_CREATED/STATUS_UPDATE, payment links, flags NF/entrega → `app/api/webhooks/unbox`, `scripts/subscribe-webhook.ts`, `OrderStatusCard`.
- **08 Feedback/erros** — ordem de sinais (errors→failures→cartEvents), `friendlyError`, rótulos de status, reconciliação de preço → `lib/api.ts`, `cart-provider`, `order-status`.
- **09 Segurança** — BFF, isolamento de tokens (cookies httpOnly), posse de pedido, rate-limit/anti-enumeração, headers/Referrer-Policy, PCI (PAN só passa pelo BFF) → `lib/session.ts`, `lib/ratelimit.ts`, `next.config.ts`, `app/api/**`.
- **10 URLs/SEO/carrinho** — `generateMetadata`, canonical (`publishedUrl`), `sitemap.ts` (paginado, só visíveis), `robots.ts`, JSON-LD, ISR, persistência/recuperação de carrinho → PDP, `app/sitemap.ts`, `app/robots.ts`, `lib/crm.ts`, `scripts/abandoned-cart.ts`.
- **11 Produção/resiliência** — idempotência (lock por cartId, anti-duplo-clique, sem retry cego), N grupos, releitura antes do placeOrder, confirmação de Pix (webhook + polling), cache de token + re-signin, CDC art. 49, a11y → `lib/checkout-lock.ts`, `app/api/checkout`, `/checkout/pix/[ref]`, `lib/unbox/store.ts`, `/devolucoes`.

## Limitações conhecidas (da API, não da implementação)

- O `Cart` lido (`anonymousCartByCartId`) **não expõe** os ids de cupons aplicados nem `cartEvents`;
  o `discountId` para remoção é resolvido por código via `findDiscountIdByCode` e mantido na sessão.
- **N fulfillmentGroups**: a loja de exemplo retorna 1 grupo; o BFF cota/seleciona por grupo, mas o
  `placeOrder` do SDK monta 1 grupo `SHIPPING` (suficiente aqui; multi-grupo exigiria estender o payload).
- **Payment links / cart templates / cancelOrderItem / refund total**: existem no SDK/doc mas dependem de
  permissões admin/efeitos reais; expostos via rota/script protegidos, não no fluxo público.
- Infra de produção (KV, Redis, DB, CRM) está como implementação **em memória/cookie** com pontos `// PROD:`.
