// Lock de checkout por cartId (doc 11): placeOrder NÃO é idempotente e cobra na hora.
// Evita que dois cliques / duas requisições concorrentes do mesmo carrinho gerem DOIS pedidos.
//
// PROD: trocar por lock distribuído (Vercel KV SET NX com TTL / Redis). Em dev é em memória.
import "server-only";

const locks = new Map<string, number>(); // cartId -> expiresAt
const TTL_MS = 60 * 1000;

/** Tenta adquirir o lock. Retorna false se já há um placeOrder em voo para este cartId. */
export function acquireCheckoutLock(cartId: string): boolean {
  const now = Date.now();
  const exp = locks.get(cartId);
  if (exp && exp > now) return false;
  locks.set(cartId, now + TTL_MS);
  return true;
}

export function releaseCheckoutLock(cartId: string): void {
  locks.delete(cartId);
}
