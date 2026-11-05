# Agente 08 — Customer (Área da Conta)

## Escopo
Área logada do cliente: visão geral, pedidos, assinaturas, endereços e preferências. Tudo
protegido por sessão via cookie httpOnly (token do **cliente**, distinto do token de loja).

## Dependências
- Agente 07 (Auth) — `lib/session.ts` (`getCustomerToken`), fluxo de login OTP
- Agente 00 (Scaffold) — `UnboxCustomerClient` do `@unbox-plus/sdk`

## Arquivos proprietários

| Arquivo | Descrição |
|---------|-----------|
| `app/(loja)/conta/page.tsx` | Visão geral (resumo de pedidos/assinaturas recentes) |
| `app/(loja)/conta/pedidos/page.tsx` + `[referenceId]/page.tsx` | Lista e detalhe de pedidos |
| `app/(loja)/conta/assinaturas/page.tsx` + `[referenceId]/page.tsx` | Lista e detalhe de assinaturas (pausar/cancelar/pular ciclo, editar produtos) |
| `app/(loja)/conta/enderecos/page.tsx` | CRUD de endereços salvos |
| `app/(loja)/conta/preferencias/page.tsx` | Preferências de marketing/notificação |
| `components/account/account-shell.tsx` | Shell com sidebar de navegação + breadcrumb, usado por todas as páginas acima |
| `components/account/address-book.tsx` | Lista + formulário de endereços |
| `components/account/preferences-form.tsx` | Formulário de preferências |
| `components/account/subscription-actions.tsx` | Ações de assinatura (pausar/cancelar/pular, cartão, endereço) e o botão "Alterar itens" |
| `components/account/subscription-items-section.tsx` | Seção "Itens" da assinatura: abre o modal de edição e é a dona do salvar protegido |
| `components/account/subscription-editor/*` | O modal "Editar produtos" e suas peças (ver a seção abaixo) |
| `lib/subscription-draft.ts` / `lib/subscription-items.ts` | Rascunho da edição (puro, com teste) e regra de permissão por item (usada na rota) |
| `app/api/subscriptions/[id]/route.ts` | Ações da assinatura: `pause`, `skip`, `cancel`, `get`, `items`, `card`, `address` |
| `components/account/reorder-button.tsx` | "Comprar novamente" a partir de um pedido |
| `components/account/signout-button.tsx` | Logout |
| `lib/customer-session.ts` | `getCustomerClient()` / `requireCustomerClient()` — client autenticado com o token do cliente |
| `app/api/account/{me,addresses,preferences,signout}/route.ts` | Route Handlers que usam `requireCustomerClient()` |

## Regra de ouro — dois tokens
`lib/customer-session.ts` usa o token do **cliente** (cookie httpOnly, setado pelo Agente 07),
nunca o `serverEnv.apiKey`/token de loja do Agente 00 (`lib/unbox.ts`). Misturar os dois
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

## Assinaturas: edição de produtos
O cliente edita os produtos da assinatura num modal ("Editar produtos"), aberto pelo botão "Alterar itens".
O modal não chama API: recebe tudo por props (`SubscriptionItemsEditor`) e devolve a lista completa em `onSave`.

| Peça | Papel |
|------|-------|
| `subscription-items-editor.tsx` | O modal: tela cheia no mobile, lista e painel de adicionar lado a lado no desktop (a partir de 1024px) |
| `subscription-editor-item.tsx` | A linha de um produto: quantidade, remover/desfazer, troca de variante e, no kit, os itens escolhidos |
| `variant-switcher.tsx` + `variant-chips.tsx` | "Trocar {variação}": chips em radio, a variante que outro item já usa fica desabilitada |
| `add-product-panel.tsx` + `catalog-product-card.tsx` | Adicionar produto: abas por categoria (só com mais de 1), busca (só com mais de 5 produtos) |
| `kit-picks-builder.tsx` | Escolha dos itens de um kit: a soma tem de bater exatamente com a cota |
| `item-status-tag.tsx`, `inline-alert.tsx`, `price-compare.tsx` | Etiquetas, avisos e preço de assinatura com o avulso riscado |

**Flags.** Vêm de `getShopData().recurringOrdersPolicy.customerActions` e valem cada uma por si:
`canChangeProductQuantity` (contador de quantidade; sem ela, só o texto "Qtd.: N"), `canRemoveProducts`
(botão Remover) e `canAddProducts` (painel de adicionar). Trocar a variante de um produto vale sempre, até
com as três desligadas: é uma substituição, e não uma remoção seguida de adição. O item adicionado nesta
edição sempre pode sair, e o último item ativo nunca sai (a assinatura precisa de pelo menos 1 produto).

**Entrada na página.** O botão "Alterar itens" só aparece com a assinatura `ACTIVE` e alguma coisa para
editar. `PAUSED` mostra o link "Reative a assinatura" no lugar; `ERROR` mostra o alerta "Atualize a forma de
pagamento" no topo; `CANCELED` fica só leitura.

**Rascunho.** O cliente mexe num rascunho (`lib/subscription-draft.ts`) que sempre começa da lista salva.
Remover só marca o item (com "Desfazer"); nada vai ao servidor até o Salvar, e o Salvar manda a lista
**completa**, nunca item por item. "Salvar" fica desabilitado sem alteração e com erro de validação do
rascunho. Sair com alteração pergunta "Sair sem salvar?", e a aba também avisa (`beforeunload`).

**Salvar protegido.** O backend não protege contra conflito nem contra envio duplicado, então a página se
protege (`subscription-items-section.tsx`): relê a assinatura (`action: "get"`) e **não envia** se ela não
estiver mais ativa ou se a lista mudou desde que o modal abriu; envia uma vez só (clique duplo); mantém o
rascunho e mostra o erro dentro do modal ("Tentar de novo"); e só chama `router.refresh()` depois da resposta
200. Nada na página muda antes disso.

**Validação na rota.** `app/api/subscriptions/[id]` valida a lista com `subscriptionItemsSchema` (422), exige
a assinatura ativa (409) e confere cada permissão com `checkItemsChange` (403). Trocar a variante de um
produto que já estava, com a mesma quantidade, sempre passa. Teste das regras: `npx tsx scripts/check-subscription-items.ts`
e, para o rascunho, `npx tsx scripts/check-subscription-draft.ts`.

**Kits.** O kit é **1 item** da assinatura, com `productKitId` e `productKitItemsConfigurations` (os itens
escolhidos e a quantidade de cada um). A soma dos itens tem de ser igual à cota (`requiredPicksPerGroup`);
quantidade e remoção valem para o kit inteiro, nunca para um item dele. Na loja, cada tamanho de kit (ex.:
"2 Box", "3 Box") é um produto de kit à parte: o painel junta os de mesmo título num card só, com as opções
vindas de `relatedInfo.title`. Em um kit que já está na assinatura, "Ver itens escolhidos" e "Editar itens"
abrem o construtor já preenchido; mudar só os itens conta como 1 alteração e a linha ganha a etiqueta
"Itens alterados". A cota é conferida no cliente (o "Salvar" não habilita com kit incompleto); a rota da loja
não a revalida, quem recusa é a API. O texto da tela diz "itens", e não o nome de um ramo: vocabulário
específico vem da loja.

**Dados.** Nomes, fotos e preços vêm de `getProductsByIds` (itens da assinatura) e `getSubscribableCatalog`
(catálogo para adicionar), sempre com `mockupOr`; os componentes de um kit vêm de `getProductKit`. Exige
`@unbox-plus/sdk` 0.4.0 ou mais novo.

## Link de recuperação e frequência de assinatura
`recurringItemsFrequencyId` é um campo do pedido (`placeOrder`), não do carrinho, e por isso
vive em cookie no meio do caminho — ao restaurar um carrinho de assinatura por link (`?id=&token=`, doc 05-cart), é
obrigatório também repassar `&freq=` (ver `app/api/cart/link/route.ts`), senão o cliente reabre o
checkout sem frequência selecionada e não consegue finalizar.
