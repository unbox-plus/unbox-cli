# Agente 09 — Promotions (Kits & Combos)

## Escopo
Sistema de kits/combos promocionais — bundles curados de produtos com desconto, resolvidos
dinamicamente contra o catálogo real da loja (preço e estoque nunca são hardcoded).

## Dependências
- Agente 03 (Catalog) — usa o mesmo catálogo (`getCatalog`) e `lib/enrichment` para indexar produtos
- Agente 02 (Homepage) — consome `<CombosSection>`/`<CombosHome>` na home

## Arquivos proprietários

| Arquivo | Descrição |
|---------|-----------|
| `lib/enrichment/combos.ts` | Define `COMBOS` (specs do kit) e `resolveCombos()` (resolve contra o catálogo) |
| `components/home/combos-section.tsx` | Seção completa da home: carrossel + CTA "Adicionar combo ao carrinho" |
| `components/home/combos-home.tsx` | Wrapper que busca o catálogo e chama `resolveCombos()` |
| `components/home/combo-card-compact.tsx` | Card compacto reusado em outros pontos (ex.: cross-sell) |

## ⚠️ Estado no template base: vazio por padrão
`COMBOS: ComboDef[] = []` — a infraestrutura está pronta e testada, mas **sem nenhum kit
configurado**. Sem isso, `<CombosSection>` não renderiza nada (degrada graciosamente, não é erro),
mas a loja não tem essa alavanca de AOV até alguém preencher `COMBOS` com kits reais.

## Modelo de dados
Um `ComboDef` referencia **famílias de produto** (`familyCode` do `lib/enrichment/products.json`),
não SKUs fixos — a resolução escolhe o produto comprável mais barato (ou mais caro, via
`size: "max"`) daquela família no catálogo atual:

```ts
// lib/enrichment/combos.ts — popule com os kits reais da loja
export const COMBOS: ComboDef[] = [
  {
    id: "kit-essencial",
    name: "Kit Essencial",
    description: "Tudo o que você precisa para começar.",
    imageUrl: "/brand/combos/kit-essencial.webp",
    badge: "MAIS VENDIDO",
    discountPct: 15,
    highlights: [{ icon: "sparkle", label: "3 itens" }],
    items: [{ family: "FAMILIA_A" }, { family: "FAMILIA_B" }, { family: "FAMILIA_C", size: "min" }],
  },
];
```

## Regra de ouro — nunca hardcode preço
`resolveCombos()` calcula `subtotal`/`total`/`save` a partir do preço real do catálogo
(`resolveProductPrice`) multiplicado por `(1 - discountPct/100)` — **o componente nunca recebe
preço fixo**. Um combo cujos itens não resolvem no catálogo atual (produto fora de linha, sem
estoque) é descartado silenciosamente (`items.length < 2` → `continue`), nunca quebra a home.

## Ao configurar pra uma loja nova
1. Popular `lib/enrichment/products.json` à mão, no formato de `lib/enrichment/index.ts` (não há script gerador)
2. Definir `familyCode` para os grupos de produto que formarão kits
3. Preencher `COMBOS` em `combos.ts` com os kits desejados (`items`, `discountPct`, `highlights`)
4. Adicionar as imagens temáticas em `public/brand/combos/`

## Fora de escopo aqui — não confundir com CRO
Banners de oferta genéricos ("shopSales" da loja), contadores de urgência e prova social **não**
são deste agente — isso é escopo do Agente 13 (CRO Package), que hoje só tem o módulo de frete
grátis (`FREE_SHIPPING_THRESHOLD`) implementado; os outros 9 módulos ainda não existem no template
base.
