// Factory do UnboxCustomerClient a partir do cookie httpOnly do cliente (área "minha conta").
// Lança 401 implícito devolvendo null quando não há token.
import "server-only";
import { UnboxCustomerClient } from "./unbox/customer";
import { getCustomerToken } from "./session";
import { getShopContext } from "./unbox/store";

/** Retorna um UnboxCustomerClient autenticado, ou null se o cliente não estiver logado. */
export async function getCustomerClient(): Promise<UnboxCustomerClient | null> {
  const token = await getCustomerToken();
  if (!token) return null;
  const { shopId } = await getShopContext();
  return new UnboxCustomerClient({ token, shopId });
}

/** Igual ao acima, mas lança um Error 401-like se não logado (para Route Handlers). */
export async function requireCustomerClient(): Promise<UnboxCustomerClient> {
  const c = await getCustomerClient();
  if (!c) throw new Error("UNAUTHENTICATED");
  return c;
}
