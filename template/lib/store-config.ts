// Configuração comercial do storefront — centraliza valores que antes estavam espalhados/hardcoded.
//
// ═══ REGRA DE OURO DESTA CONFIG ═══
// Os defaults saem VAZIOS/ZERADOS de propósito: cada valor aqui é uma PROMESSA exibida ao
// cliente, e prometer desconto/brinde/frete que o backend da SUA loja não cumpre faz o
// checkout mostrar um total e cobrar outro. Preencha só com o que EXISTE no painel Unbox
// (confira com `npm run unbox:dump` — imprime as shopSales reais da loja).

/**
 * Desconto do Pix (%). O desconto REAL é aplicado pelo BACKEND (shopSale do tipo
 * CalculationDiscountByPaymentMethod) — este número é só o rótulo/estimativa exibido.
 * ⚠️ Default 0: só suba depois de confirmar que a promoção existe na SUA loja
 * (`shopSales` com CalculationDiscountByPaymentMethod). Com 0, todos os selos/frases de
 * Pix somem da loja.
 */
export const PIX_DISCOUNT_PCT = 0;

/**
 * Limiar de "Frete Grátis" exibido (régua/banner). ⚠️ Default null = a loja NÃO exibe nada
 * de frete grátis. Só preencha se a regra existir de verdade (no painel Unbox ou como
 * decisão comercial consciente da loja) — o frete REAL vem da cotação da transportadora, e
 * banner de frete grátis sem regra real gera cobrança surpresa no checkout.
 */
export const FREE_SHIPPING_THRESHOLD: number | null = null;

/**
 * Patamares de brinde exibidos na "gift ladder" do carrinho/checkout.
 * ⚠️ Default vazio = a régua de brinde NÃO renderiza. Preencha com a promoção REAL do
 * backend (shopSale CalculationFreeItemByTier — o `getShop` já traz os `tiers` com
 * cartSubtotalGTE e o nome do brinde; ver `npm run unbox:dump`). O brinde efetivo é
 * decidido pelo servidor (isBonus).
 */
export const GIFT_TIERS: readonly { name: string; threshold: number }[] = [];

/** Primeiro patamar de brinde (derivado dos tiers; null sem promoção de brinde). */
export const GIFT_THRESHOLD: number | null = GIFT_TIERS[0]?.threshold ?? null;

/**
 * Tiers de quantidade da landing de oferta (/oferta) — "leve mais, pague menos por unidade".
 * ⚠️ MARKETING NO FRONT: o desconto REAL precisa existir no painel Unbox (cupom automático ou
 * shopSale por quantidade), senão o total do checkout DIVERGE do prometido aqui. Por isso os
 * defaults saem com offPct 0 (sem promessa falsa) — o agente de branding/lojista preenche com
 * os valores reais quando a promoção existir no backend. `perks` é texto livre (ex.: "frete
 * grátis", "brinde surpresa") e segue a mesma regra: só prometa o que o backend cumpre.
 */
export const QUANTITY_TIERS: {
  quantity: number;
  offPct: number;
  perks: string[];
  /** chip visual do tier (ex.: "mais vendido", "melhor valor") — só com base real */
  badge?: string;
  /** tier pré-selecionado no hero de compra (default: o do meio) */
  selected?: boolean;
}[] = [
  { quantity: 3, offPct: 0, perks: [] },
  { quantity: 2, offPct: 0, perks: [], selected: true },
  { quantity: 1, offPct: 0, perks: [] },
];

/**
 * Linhas de produtos RELACIONADOS na PDP: produtos distintos de uma mesma linha (famílias
 * diferentes, não tamanhos), oferecidos para navegar entre eles. `tag` é a tag do enriquecimento
 * que agrupa a linha; `title` é o rótulo do seletor.
 * Ex.: [{ tag: "Fragrâncias", title: "Escolha a fragrância" }]
 * Default vazio: a foundation não sabe que linhas a sua loja tem.
 */
export const RELATED_GROUPS: { tag: string; title: string }[] = [];
