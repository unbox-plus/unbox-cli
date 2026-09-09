# Agente 13 — Unbox AI CRO Package

## Objetivo

Ativar os módulos de otimização de conversão (CRO) escolhidos pelo usuário. Cada módulo é independente — ative apenas os que fazem sentido para a loja atual.

---

## Apresentação ao usuário

Ao iniciar este agente, exiba o menu abaixo e pergunte quais módulos ativar:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Unbox AI CRO Package — Módulos disponíveis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [1] Prova Social no PDP
      Avaliações reais em destaque (badge "X compraram hoje" só com contador do backend)
      ⚙️  Requer: reviews reais em lib/enrichment/products.json. NÃO existe valor mockup:
          sem dado, o módulo fica bloqueado (regra do CLAUDE.md e gate unbox:honestidade)

  [2] Urgência de Estoque
      "Restam X unidades" quando stock ≤ threshold configurável
      ⚙️  Requer: campo de estoque na API Unbox (productStock)

  [3] Countdown Flash Sale
      Banner com temporizador regressivo para ofertas com prazo
      ⚙️  Requer: definir data/hora de fim da promoção

  [4] Barra de Frete Grátis
      Progress bar no carrinho: "Faltam R$X para frete grátis"
      ⚙️  Requer: definir threshold de frete grátis (ex: R$149)

  [5] Upsell Pós-Checkout
      Seção "Você também vai gostar" na página de pedido confirmado
      ⚙️  Requer: lógica de recomendação (por categoria ou manual)

  [6] Recently Viewed
      Histórico de produtos vistos (localStorage, sem backend)
      ⚙️  Sem dependências — funciona sem credenciais

  [7] Sticky CTA Mobile
      Botão "Adicionar ao carrinho" fixo no scroll do PDP (mobile)
      ⚙️  Sem dependências

  [8] Trust Strip Customizável
      Ícones de confiança editáveis: entrega, troca, pagamento seguro
      ⚙️  Sem dependências — apenas editar os textos

  [9] Kits & Combos com Cross-sell
      Seção de kits na home com produtos complementares
      ⚙️  Requer: definir os combos em lib/enrichment/combos.ts

  [10] Brindes (Gift with Purchase)
       Exibe brinde desbloqueado quando carrinho atinge valor mínimo
       ⚠️  Requer configuração no back-end Unbox ANTES do lançamento
       ⚙️  Requer: regra de brinde ativa no painel + SKU do brinde

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️  Módulos 4 e 10 dependem de configuração no back-end
      antes de ir ao ar. Veja a seção "Pré-requisitos de back-end".
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Opções: "all", números separados por vírgula (ex: 1,4,7), ou "none"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Aguarde a resposta antes de qualquer implementação.

---

## Módulos — especificação técnica

### [1] Prova Social no PDP

**Arquivo:** `components/product/pdp/social-proof.tsx`

**Contador de compras ("X pessoas compraram hoje"): BLOQUEADO.** A API pública da loja não
expõe volume de vendas por SKU e o enrichment não tem campo pra isso (`lib/enrichment/index.ts`).
Um número "configurável" ou "hardcoded por SKU" é fabricação, e o `unbox:honestidade` derruba o
build (`\d+ pessoas compraram`, `compraram nas últimas 24h`). Só implemente se o lojista fornecer
um contador REAL (integração própria), e registre a fonte no `marca/DESIGN-<MARCA>.md`.

O que este módulo faz HOJE: destacar as avaliações reais do produto (`reviews` do enrichment)
logo abaixo do preço no `buy-box.tsx`: nota média + 1 depoimento curto + link pra seção completa.
Sem reviews, o bloco não existe.

---

### [2] Urgência de Estoque

**Arquivo:** `components/product/pdp/stock-urgency.tsx`

```tsx
// Exibe "Restam 8 unidades" quando o estoque REAL <= THRESHOLD
const THRESHOLD = 15; // configurável
```

Inserir no `buy-box.tsx`, abaixo do seletor de quantidade.

**Dependência API:** o catálogo público NÃO expõe quantidade (`productStock` não existe; só
`isSoldOut`). Quantidade real vem de `simpleInventory` na API de parceiros (`agents/COVERAGE.md`),
via `withStoreClient` no servidor. Sem esse dado, o módulo fica BLOQUEADO: contador que "desce
sozinho" ou threshold sem estoque real é fabricação.

---

### [3] Countdown Flash Sale

**Arquivo:** `components/home/flash-sale-banner.tsx`

```tsx
// Banner full-width com countdown regressivo
// Configurar: SALE_END_DATE (ISO string) e mensagem da oferta
const SALE_END_DATE = "2025-12-31T23:59:59-03:00"; // TODO: atualizar
```

Inserir na home, entre o hero e os combos. Condicionado: se `Date.now() < SALE_END_DATE`, exibe; caso contrário, não renderiza (null).

---

### [4] Barra de Frete Grátis

⚠️ **A foundation JÁ tem isso** — régua de frete grátis no mini-cart, checkout, buy-box e
header, todos lendo `FREE_SHIPPING_THRESHOLD` de `lib/store-config.ts` (que nasce `null` =
nada renderiza até existir regra real; ver `npm run unbox:dump`). Este módulo NÃO cria
componente novo nem segundo limiar: se a régua não aparece, o motivo é o threshold `null` —
preencha a store-config com a regra REAL. Só crie UI adicional (ex.: barra no topo da página
de carrinho) consumindo o MESMO `FREE_SHIPPING_THRESHOLD`, nunca um número hardcoded.

---

### [5] Upsell Pós-Checkout

**Arquivo:** `components/order/upsell-section.tsx`

```tsx
// Recomendações na página de pedido confirmado
// Fonte: últimos produtos vistos (localStorage) ou lista manual
```

Inserir em `app/(loja)/pedido/[referenceId]/page.tsx` (confirmação de pedido).

---

### [6] Recently Viewed

**Arquivo:** `lib/recently-viewed.ts` + `components/product/recently-viewed.tsx`

```ts
// localStorage: salva array de slugs visitados (max 8)
// Hook: useRecentlyViewed()
```

- Salvar no `useEffect` do PDP (client component).
- Exibir no carrinho e na home como seção "Vistos recentemente".
- **Sem dependências externas** — funciona com qualquer storeToken.

---

### [7] Sticky CTA Mobile

**Arquivo:** `components/product/pdp/sticky-cta.tsx`

```tsx
// Visível apenas em mobile (md:hidden)
// Aparece após scroll passar o botão principal (IntersectionObserver)
// Posição: fixed bottom-0, acima da nav bar (bottom-[84px])
```

Inserir no layout do PDP (`app/(loja)/produto/[productSlug]/page.tsx`).

---

### [8] Trust Strip Customizável

⚠️ **A foundation JÁ tem trust strips** — `components/home/sections/trust-strip.tsx` (escura)
e `trust-bar.tsx` (clara), registradas no `registry.ts` e documentadas no `agents/PADROES.md`.
Este módulo customiza os ITENS das existentes via receita: `props.items: [{ icon?, text }]`
(ícones em `TRUST_ICONS`, `trust-bar.tsx`). Sem `items`, as duas seções NÃO renderizam: os
selos são promessas do lojista ("entrega em 24h", "garantia de 1 ano"), não da foundation.

**Arquivo (só se precisar de variante nova):** `components/home/sections/` + registro no registry

```tsx
// Array configurável de itens: { icon, label, sub }
const TRUST_ITEMS = [
  { icon: "Truck",    label: "Entrega rápida",      sub: "Prazo conforme CEP" },
  { icon: "RotateCcw", label: "Troca sem burocracia", sub: "Até 7 dias após recebimento" },
  { icon: "Shield",   label: "Pagamento seguro",     sub: "SSL + antifraude" },
  { icon: "Award",    label: "Produto original",     sub: "Nota fiscal inclusa" },
];
```

Reutilizável: inserir no PDP, na home e/ou no checkout.

---

### [9] Kits & Combos com Cross-sell

**Arquivo:** `lib/enrichment/combos.ts` (já existe, vazio por padrão)

```ts
// Preencher com os combos da loja:
export const COMBOS: ComboDef[] = [
  {
    id: "kit-essencial",
    name: "Kit Essencial",
    description: "Os mais vendidos juntos",
    items: [{ family: "FAMILIA_A" }, { family: "FAMILIA_B" }],
  },
];
```

Os dados vivem em `lib/enrichment/combos.ts` (`COMBOS` + `resolveCombos`, chamado em `app/(loja)/page.tsx`; a seção da home é `kits`)

---

### [10] Brindes (Gift with Purchase)

**Arquivo:** `components/cart/gift-indicator.tsx`

```tsx
// Exibe brinde desbloqueado quando carrinho atinge valor mínimo.
// A lógica de elegibilidade e o SKU do brinde vêm da API Unbox
// (campo `gifts` retornado no payload do carrinho).
//
// ⚠️  PRÉ-REQUISITO DE BACK-END — configurar no painel Unbox:
//   1. Criar regra de brinde (mínimo de valor, SKU do produto brinde)
//   2. Garantir que o SKU do brinde está com estoque ativo
//   Sem isso, o componente renderiza vazio — nunca exibe brinde falso.
```

**Comportamento:**
- Carrinho abaixo do mínimo: `"Adicione mais R$X e ganhe [nome do brinde]"` com progress bar
- Carrinho acima do mínimo: `"🎁 Brinde desbloqueado: [nome do brinde]!"` em destaque
- Sem regra configurada no back: componente não renderiza (null)

Inserir no `app/(loja)/carrinho/page.tsx`, abaixo da barra de frete grátis (módulo 4) se ativo, senão no topo do sumário.

**Dependência API:** `cart.gifts[]` — array de brindes elegíveis retornado pela Unbox API.

---

## Pré-requisitos de back-end

> Estes módulos exibem dados que vêm do painel Unbox. **Configurar antes do lançamento da loja.**

| Módulo | O que configurar no painel Unbox |
|--------|----------------------------------|
| **[4] Barra de Frete Grátis** | Regra de frete grátis: valor mínimo do pedido, CEPs/regiões elegíveis |
| **[10] Brindes** | Regra de brinde: valor mínimo, SKU do produto brinde, estoque ativo |

Sem essas configurações, os componentes renderizam vazios (não inventam dados). Isso é intencional — nunca exibir promoção que não existe.

---

## Fluxo do agente

1. **Apresentar menu** e aguardar escolha.
2. **Confirmar escopo:** listar módulos selecionados e suas dependências.
3. **Perguntar configurações** específicas de cada módulo (ex: threshold de frete, data do flash sale).
4. **Implementar** um módulo por vez, em ordem numérica.
5. **Para cada módulo:** criar/editar arquivo → inserir no componente pai → confirmar sem erros de TypeScript.
6. **Ao final:** listar TODOs de configuração que ainda precisam de dados reais (ex: `SALE_END_DATE`, combos, reviews).

---

## Regras

- **Nunca ativar módulo sem perguntar.** O template base é intencionalmente simples.
- **Módulos são opcionais e independentes** — remover um não quebra os outros.
- Usar os **brand tokens** (`--store-primary`, `--store-cta`) para cores, nunca hardcodar hex.
- Módulos sem dependência de API (6, 7, 8) podem ser ativados mesmo em modo mockup.
- Módulos com dependência (1, 2, 3, 4, 5, 9) devem exibir aviso se `.env.local` não estiver configurado.
