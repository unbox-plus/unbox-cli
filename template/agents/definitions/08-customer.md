# Agente 08 — Customer (Área da Conta)

## Escopo
Área logada do cliente: visão geral, pedidos, assinaturas, endereços e preferências. Tudo
protegido por sessão via cookie httpOnly (token do **cliente**, distinto do token de loja).

## Dependências
- Agente 07 (Auth) — `lib/session.ts` (`getCustomerToken`), fluxo de login OTP
- Agente 00 (Scaffold) — `lib/unbox/customer.ts` (`UnboxCustomerClient`)

## Arquivos proprietários

| Arquivo | Descrição |
|---------|-----------|
| `app/(loja)/conta/page.tsx` | Visão geral (resumo de pedidos/assinaturas recentes) |
| `app/(loja)/conta/pedidos/page.tsx` + `[referenceId]/page.tsx` | Lista e detalhe de pedidos |
| `app/(loja)/conta/assinaturas/page.tsx` + `[referenceId]/page.tsx` | Lista e detalhe de assinaturas (pausar/cancelar/pular ciclo) |
| `app/(loja)/conta/enderecos/page.tsx` | CRUD de endereços salvos |
| `app/(loja)/conta/preferencias/page.tsx` | Preferências de marketing/notificação |
| `components/account/account-shell.tsx` | Shell com sidebar de navegação + breadcrumb, usado por todas as páginas acima |
| `components/account/address-book.tsx` | Lista + formulário de endereços |
| `components/account/preferences-form.tsx` | Formulário de preferências |
| `components/account/subscription-actions.tsx` | Ações de assinatura (pausar/cancelar/pular) |
| `components/account/reorder-button.tsx` | "Comprar novamente" a partir de um pedido |
| `components/account/signout-button.tsx` | Logout |
| `lib/customer-session.ts` | `getCustomerClient()` / `requireCustomerClient()` — client autenticado com o token do cliente |
| `app/api/account/{me,addresses,preferences,signout}/route.ts` | Route Handlers que usam `requireCustomerClient()` |

## Regra de ouro — dois tokens
`lib/customer-session.ts` usa o token do **cliente** (cookie httpOnly, setado pelo Agente 07),
nunca o `serverEnv.apiKey`/token de loja do Agente 00 (`lib/unbox/store.ts`). Misturar os dois
client factories é o erro mais comum nessa área — sempre confirme qual client está sendo importado.

```ts
// Server Component de página protegida:
const client = await getCustomerClient();
if (!client) redirect("/conta/entrar?next=/conta/pedidos");
```

## Proteção de rotas
Páginas sob `/conta/*` (exceto `/conta/entrar`) checam `getCustomerClient()` e redirecionam para
`/conta/entrar?next=<rota>` se não houver sessão — sem `middleware.ts` global, a checagem é feita
em cada `page.tsx` (Server Component) para poder usar `AccountShell` mesmo no estado deslogado de
algumas páginas públicas (ex.: rastreio de pedido pelo `/pedido/[referenceId]` não exige login).

## Assinaturas — ações sensíveis
`subscription-actions.tsx` chama mutations que alteram cobrança recorrente (pausar/cancelar/pular
ciclo) — sempre exigir confirmação explícita (dialog) antes de disparar, e mostrar o novo estado
otimisticamente só após resposta 200 da API.

## Link de recuperação e frequência de assinatura
`recurringItemsFrequencyId` é um campo do pedido (`placeOrder`), não do carrinho, e por isso
vive em cookie no meio do caminho — ao restaurar um carrinho de assinatura por link (`?id=&token=`, doc 05-cart), é
obrigatório também repassar `&freq=` (ver `app/api/cart/link/route.ts`), senão o cliente reabre o
checkout sem frequência selecionada e não consegue finalizar.
