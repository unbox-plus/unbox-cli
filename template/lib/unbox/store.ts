// Factory do UnboxClient de LOJA (server-only) com cache de token em memória.
//
// Regra de ouro (doc 11): NÃO fazer signIn() a cada request. O JWT vale ~24h; cacheamos num
// singleton de módulo e renovamos com folga (~23h). Em produção serverless, troque este cache
// por Vercel KV / Edge Config compartilhado entre lambdas (ver pontos `// PROD:`).
import "server-only";
import { UnboxClient, UnboxError } from "./client";
import { serverEnv, hasUnboxCredentials, decodeJwtClaims, SHOP_ID_CLAIM, SHOP_SLUG_CLAIM } from "../config";

interface CachedToken {
  token: string;
  expMs: number; // epoch ms em que devemos renovar (exp - folga)
  shopId: string;
  shopSlug: string;
}

// PROD: substituir por KV. Em dev/single-instance, o módulo singleton basta.
let cache: CachedToken | null = null;
let inFlight: Promise<CachedToken> | null = null;

const RENEW_BUFFER_MS = 60 * 60 * 1000; // renova 1h antes de expirar

async function doSignIn(): Promise<CachedToken> {
  if (!hasUnboxCredentials) {
    throw new Error(
      "[unbox] credenciais ausentes (UNBOX_API_KEY/UNBOX_USER/UNBOX_PASS) — preencha .env.local. Rodando em modo mockup."
    );
  }
  const client = new UnboxClient({
    apiKey: serverEnv.apiKey,
    shopId: serverEnv.shopId,
    apiBaseUrl: serverEnv.authUrl,
    gqlUrl: serverEnv.gqlUrl,
    partnerApiKey: serverEnv.partnerApiKey,
    partnerGqlUrl: serverEnv.partnerGqlUrl,
    captchaBypass: serverEnv.captchaBypass,
  });
  const token = await client.signIn(serverEnv.user, serverEnv.pass);
  const claims = decodeJwtClaims(token);
  const expSec = typeof claims.exp === "number" ? claims.exp : Math.floor(Date.now() / 1000) + 23 * 3600;
  return {
    token,
    expMs: expSec * 1000 - RENEW_BUFFER_MS,
    shopId: serverEnv.shopId || claims[SHOP_ID_CLAIM] || "",
    shopSlug: serverEnv.shopSlug || claims[SHOP_SLUG_CLAIM] || "",
  };
}

async function getCachedToken(force = false): Promise<CachedToken> {
  if (!force && cache && Date.now() < cache.expMs) return cache;
  if (inFlight) return inFlight;
  inFlight = doSignIn()
    .then((c) => {
      cache = c;
      return c;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** shopId/shopSlug resolvidos (env tem prioridade; senão extrai do JWT). */
export async function getShopContext(): Promise<{ shopId: string; shopSlug: string }> {
  const c = await getCachedToken();
  return { shopId: c.shopId, shopSlug: c.shopSlug };
}

/**
 * Retorna um UnboxClient de loja já autenticado (token do cache). Re-signin automático
 * em 401/ACCESS_DENIED (token expirado) é tratado por `withStoreClient`.
 */
export async function getStoreClient(): Promise<UnboxClient> {
  const c = await getCachedToken();
  const client = new UnboxClient({
    apiKey: serverEnv.apiKey,
    shopId: c.shopId,
    apiBaseUrl: serverEnv.authUrl,
    gqlUrl: serverEnv.gqlUrl,
    partnerApiKey: serverEnv.partnerApiKey,
    partnerGqlUrl: serverEnv.partnerGqlUrl,
    captchaBypass: serverEnv.captchaBypass,
  });
  client.setToken(c.token);
  return client;
}

/**
 * Executa uma operação com o client de loja; se falhar por token expirado
 * (401/ACCESS_DENIED/FORBIDDEN de auth), força re-signin UMA vez e repete.
 */
export async function withStoreClient<T>(fn: (c: UnboxClient) => Promise<T>): Promise<T> {
  const client = await getStoreClient();
  try {
    return await fn(client);
  } catch (e) {
    if (isAuthExpired(e)) {
      const c = await getCachedToken(true);
      client.setToken(c.token);
      return fn(client);
    }
    throw e;
  }
}

function isAuthExpired(e: unknown): boolean {
  if (e instanceof UnboxError) {
    const msg = (e.errors?.[0]?.message ?? e.message ?? "").toUpperCase();
    return /ACCESS_DENIED|UNAUTHENTICATED|TOKEN|EXPIRED|401/.test(msg);
  }
  if (e instanceof Error) return /401|ACCESS_DENIED/i.test(e.message);
  return false;
}
