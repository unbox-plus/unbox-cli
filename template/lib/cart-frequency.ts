// Frequência de assinatura: o CARRINHO é a fonte única.
//
// O checkout hospedado da Unbox lê a frequência de `cart.recurringItemsFrequencyId` e ignora
// cookie e `?freq=` na URL. Sem ela no carrinho, o cliente escolhe a assinatura na loja e chega
// lá com "Frequência: Não selecionada", já com o preço de assinante. O campo não entra no
// createCart/addCartItems (o input não aceita); só o `updateCart` o grava, e o SDK expõe isso como
// `setCartRecurringFrequency` (null limpa). O checkout interno lê o mesmo campo no placeOrder.
//
// O cookie `unbox_recur_freq` (lib/session.ts) virou FILA: guarda só o valor que ainda não chegou
// ao carrinho DESTE cookie de carrinho (`setCartRef` o apaga quando o carrinho muda). Dois tipos:
//   - pendente comum: carrinho de versão que guardava a frequência só no cookie, ou `?freq=` de
//     link antigo cuja gravação falhou. Só preenche carrinho SEM frequência;
//   - escolha (prefixo "!"): o cliente escolheu agora e a gravação falhou. Ela vence o valor que
//     estiver no carrinho, porque é mais nova que ele.
//
// Toda frequência que chega de fora (corpo, `?freq=`, cookie) passa por `allowedFrequencies` da
// loja antes de ir ao carrinho: o servidor grava qualquer id, e o checkout mostraria um que a
// loja não oferece.
//
// Nada aqui lança. Uma falha de rede nunca derruba a rota que chamou: os itens já estão no
// carrinho, e o valor pendente é tentado de novo no próximo GET /api/cart.
import "server-only";
import { withStoreClient } from "./unbox";
import { getShopData } from "./queries";
import { type CartRef, getPendingRecurFreq, setPendingRecurFreq, clearPendingRecurFreq } from "./session";

const ESCOLHA = "!";

export interface PendingFrequency { valor: string; escolha: boolean }

/** O carrinho cru (getCart do SDK) tem algum item de assinatura? */
export function hasRecurringItem(cart: any): boolean {
  return (cart?.items?.edges ?? []).some((e: any) => e?.node?.isRecurring === true);
}

function limpo(v: unknown): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
}

/** As frequências que a loja oferece. `null` quando não deu para saber: aí não se recusa nada. */
async function permitidas(): Promise<string[] | null> {
  try {
    const shop: any = await getShopData();
    const ids = (shop?.recurringOrdersPolicy?.allowedFrequencies ?? []).map((f: any) => f?._id).filter(Boolean);
    return ids.length ? ids : null;
  } catch {
    return null;
  }
}

/** A frequência, trimada, se a loja a oferece; `null` se vazia ou fora da política. */
export async function validFrequency(v: unknown): Promise<string | null> {
  const valor = limpo(v);
  if (!valor) return null;
  const ids = await permitidas();
  if (ids && !ids.includes(valor)) {
    console.warn("[cart] frequência fora da política da loja, ignorada:", valor);
    return null;
  }
  return valor;
}

/** O padrão da loja: a primeira frequência da política. */
export async function defaultFrequency(): Promise<string | null> {
  return (await permitidas())?.[0] ?? null;
}

async function gravarNoCarrinho(ref: CartRef, freq: string | null): Promise<boolean> {
  try {
    await withStoreClient((c) => c.setCartRecurringFrequency(ref.cartId, ref.cartToken, freq));
    return true;
  } catch (e: any) {
    console.warn("[cart] frequência não gravada no carrinho:", e?.message ?? e);
    return false;
  }
}

async function semPendente(): Promise<void> {
  try { await clearPendingRecurFreq(); } catch { /* fora de request: nada a apagar */ }
}

async function lerPendente(): Promise<PendingFrequency | null> {
  try {
    const bruto = limpo(await getPendingRecurFreq());
    if (!bruto) return null;
    const escolha = bruto.startsWith(ESCOLHA);
    const valor = limpo(escolha ? bruto.slice(ESCOLHA.length) : bruto);
    return valor ? { valor, escolha } : null;
  } catch {
    return null;
  }
}

async function guardarPendente(p: PendingFrequency): Promise<void> {
  try { await setPendingRecurFreq(p.escolha ? ESCOLHA + p.valor : p.valor); } catch { /* fora de request */ }
}

/** Há frequência pendente no cookie? (sem rede; decide se vale um getCart) */
export async function hasPendingFrequency(): Promise<boolean> {
  return (await lerPendente()) !== null;
}

/** Lê e apaga o pendente de uma vez (o POST /api/cart o tira do cookie antes de gravar). */
export async function takePendingFrequency(): Promise<PendingFrequency | null> {
  const p = await lerPendente();
  if (p) await semPendente();
  return p;
}

/** Devolve ao cookie um pendente que foi tirado e não chegou ao carrinho. */
export async function restorePendingFrequency(p: PendingFrequency): Promise<void> {
  await guardarPendente(p);
}

/**
 * Grava no carrinho a frequência que o cliente ESCOLHEU agora (já validada), com uma nova
 * tentativa. Se as duas falharem, ela fica no cookie como escolha (vence o que estiver no
 * carrinho) e a função devolve false. Quem chama não transforma isso em erro: os itens já entraram.
 */
export async function saveCartFrequency(
  ref: CartRef, freq: string, opts: { escolha?: boolean } = {},
): Promise<boolean> {
  const valor = limpo(freq);
  if (!valor) return false;
  if ((await gravarNoCarrinho(ref, valor)) || (await gravarNoCarrinho(ref, valor))) {
    await semPendente();
    return true;
  }
  await guardarPendente({ valor, escolha: opts.escolha !== false });
  return false;
}

/**
 * Leva ao carrinho a frequência pendente (cookie) ou a de um link antigo (`fromLink`, o `?freq=`).
 * Só age se o carrinho tem item recorrente. Pendente comum e `?freq=` só preenchem carrinho SEM
 * frequência; a escolha que falhou vence o valor do carrinho. Quando grava, escreve o valor em
 * `cart.recurringItemsFrequencyId` (o objeto cru, antes do normalizeCart) para o cartResponse de
 * quem chamou já sair certo. Devolve a frequência efetiva.
 *
 * `useCookie: false` quando o cookie pode ser de OUTRO carrinho. `setCartRef` já apaga o pendente
 * quando o carrinho muda; a flag é a segunda trava, para o link que restaura um carrinho por id+token.
 */
export async function syncCartFrequency(
  ref: CartRef,
  cart: any,
  opts: { fromLink?: string | null; useCookie?: boolean } = {},
): Promise<string | null> {
  try {
    if (!cart) return null;
    const usaCookie = opts.useCookie !== false;
    const noCarrinho = limpo(cart.recurringItemsFrequencyId);
    const pend = usaCookie ? await lerPendente() : null;

    if (!hasRecurringItem(cart)) return noCarrinho;

    const escolhaNova = pend?.escolha && pend.valor !== noCarrinho ? pend : null;
    if (noCarrinho && !escolhaNova) {
      if (pend) await semPendente();
      return noCarrinho;
    }

    let candidato: PendingFrequency | null = escolhaNova;
    if (!candidato) {
      const doLink = limpo(opts.fromLink);
      candidato = doLink ? { valor: doLink, escolha: false } : pend;
    }
    if (!candidato) return noCarrinho;
    const valor = await validFrequency(candidato.valor);
    if (!valor) {
      if (pend) await semPendente(); // fora da política: não adianta tentar de novo
      return noCarrinho;
    }

    // Pendente comum só preenche carrinho vazio. Relê antes de gravar: um POST em paralelo pode
    // ter gravado a escolha do cliente depois que este carrinho foi lido.
    if (!candidato.escolha) {
      const atual = await withStoreClient((c) => c.getCart(ref.cartId, ref.cartToken)).catch(() => null);
      const jaTem = limpo(atual?.recurringItemsFrequencyId);
      if (jaTem) {
        cart.recurringItemsFrequencyId = jaTem;
        if (pend) await semPendente();
        return jaTem;
      }
    }

    if (await gravarNoCarrinho(ref, valor)) {
      cart.recurringItemsFrequencyId = valor;
      if (pend) await semPendente();
      return valor;
    }
    // Falhou: guarda para tentar de novo. Seguro também para o `?freq=`, porque o cookie de
    // carrinho já aponta para o carrinho do link quando esta função roda.
    await guardarPendente({ valor, escolha: candidato.escolha });
    // O checkout interno ainda pode usar o valor no placeOrder.
    return valor;
  } catch (e: any) {
    console.warn("[cart] frequência pendente não sincronizada:", e?.message ?? e);
    return null;
  }
}

/**
 * Saiu o último item de assinatura: limpa a frequência do carrinho (null) e o cookie pendente.
 * É higiene, não correção (os dois checkouts ignoram a frequência sem item recorrente): evita
 * reaproveitar uma frequência velha quando o cliente voltar a assinar.
 */
export async function clearCartFrequencyIfNoRecurring(ref: CartRef, cart: any): Promise<void> {
  try {
    if (!cart || hasRecurringItem(cart)) return;
    await semPendente();
    if (!cart.recurringItemsFrequencyId) return;
    if (await gravarNoCarrinho(ref, null)) cart.recurringItemsFrequencyId = null;
  } catch (e: any) {
    console.warn("[cart] frequência não limpa no carrinho:", e?.message ?? e);
  }
}
