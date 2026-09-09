// Rate-limit em memória (token-bucket simples por chave). Protege OTP, signin, checkout e
// verificação de conta contra spam/abuso/enumeração (doc 09 — o x-captcha-verification NÃO é
// um captcha real).
//
// PROD: substituir por @upstash/ratelimit + Vercel KV (compartilhado entre lambdas). Em dev /
// single-instance, este mapa em memória é suficiente.
import "server-only";

interface Bucket { count: number; resetAt: number }
const store = new Map<string, Bucket>();

export interface RateLimitResult { ok: boolean; remaining: number; resetInMs: number }

/**
 * @param key      identificador (ex.: `otp:${ip}` ou `otp:${email}`)
 * @param limit    máximo de chamadas na janela
 * @param windowMs tamanho da janela em ms
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const b = store.get(key);
  if (!b || now > b.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetInMs: windowMs };
  }
  b.count += 1;
  const ok = b.count <= limit;
  return { ok, remaining: Math.max(0, limit - b.count), resetInMs: b.resetAt - now };
}

/** Extrai um identificador de IP do request (best-effort, atrás de proxy/Vercel). */
export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

/** Limites pré-configurados por rota sensível. */
export const LIMITS = {
  otp: { limit: 5, windowMs: 10 * 60 * 1000 },        // 5 / 10min
  signin: { limit: 10, windowMs: 10 * 60 * 1000 },    // 10 / 10min
  checkout: { limit: 8, windowMs: 5 * 60 * 1000 },     // 8 / 5min
  exists: { limit: 20, windowMs: 10 * 60 * 1000 },     // 20 / 10min
} as const;
