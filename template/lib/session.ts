// Helpers de sessão via cookies httpOnly (Next 15 → cookies() é async).
//
// Três cookies, três exposições (doc 09):
//   unbox_cart      = {cartId, cartToken}  → httpOnly. O par {id, token} VAI na URL do
//                     checkout de propósito, mesmo contrato do checkout hospedado da Unbox:
//                     é o que permite recuperar carrinho abandonado (o CRM lê a URL navegada,
//                     não o cookie) e colar o carrinho em outro aparelho. Decisão da Unbox,
//                     garantida pelo middleware e cobrada pelo build. Fora do checkout, o
//                     token não aparece em URL nenhuma.
//   unbox_customer  = token do cliente (OTP); httpOnly+Secure+SameSite=Lax
//   unbox_order_<ref> = token do placeOrder → prova de POSSE p/ ver o pedido como guest
import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { serverEnv } from "./config";

const isProd = process.env.NODE_ENV === "production";
const base = { httpOnly: true, secure: isProd, sameSite: "lax" as const, path: "/" };

const CART = "unbox_cart";
const CUSTOMER = "unbox_customer";
const RECUR_FREQ = "unbox_recur_freq"; // frequência de assinatura escolhida (vai no placeOrder)
const orderKey = (ref: string) => `unbox_order_${ref.replace(/[^a-zA-Z0-9_-]/g, "")}`;

export interface CartRef { cartId: string; cartToken: string }

// ----------------------------------------------------------------- carrinho
export async function getCartRef(): Promise<CartRef | null> {
  const raw = (await cookies()).get(CART)?.value;
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (o?.cartId && o?.cartToken) return o;
  } catch {}
  return null;
}

export async function setCartRef(ref: CartRef): Promise<void> {
  (await cookies()).set(CART, JSON.stringify(ref), { ...base, maxAge: 60 * 60 * 24 * 7 }); // 7 dias
}

export async function clearCartRef(): Promise<void> {
  (await cookies()).delete(CART);
  (await cookies()).delete(RECUR_FREQ);
}

// ----------------------------------------- frequência de assinatura (até o checkout)
// A frequência NÃO pode ser gravada no carrinho (o input não aceita); guardamos aqui até
// o placeOrder, onde vira orderRecurrence.recurringItemsFrequencyId.
export async function setRecurFreq(freqId: string): Promise<void> {
  (await cookies()).set(RECUR_FREQ, freqId, { ...base, maxAge: 60 * 60 * 24 * 7 });
}

export async function getRecurFreq(): Promise<string | null> {
  return (await cookies()).get(RECUR_FREQ)?.value ?? null;
}

// ------------------------------------------------------------------ cliente
export async function getCustomerToken(): Promise<string | null> {
  return (await cookies()).get(CUSTOMER)?.value ?? null;
}

export async function setCustomerToken(token: string): Promise<void> {
  (await cookies()).set(CUSTOMER, token, { ...base, maxAge: 60 * 60 * 24 }); // 24h (igual ao JWT)
}

export async function clearCustomerToken(): Promise<void> {
  (await cookies()).delete(CUSTOMER);
}

// ----------------------------------------------------- posse de pedido (guest)
// O cookie carrega `<token>.<hmac>`, com hmac = HMAC-SHA256(SESSION_SECRET, referenceId:token).
// SEM isso a posse era forjável: getOwnedOrder só testava se o cookie EXISTIA, e no modo
// parceiro o token não chega a ser validado na consulta — qualquer valor de cookie abria qualquer pedido
// (e-mail, endereço, itens, bandeira do cartão) só com o referenceId, que é curto. Agora o
// cookie precisa ter sido emitido por este servidor, para este pedido, depois de um
// placeOrder bem-sucedido neste navegador. Cookie httpOnly impede LER, não impede ENVIAR.
function assinarPosse(referenceId: string, token: string): string {
  return crypto.createHmac("sha256", serverEnv.sessionSecret).update(`${referenceId}:${token}`).digest("hex");
}

export async function setOrderToken(referenceId: string, token: string): Promise<void> {
  const valor = `${token}.${assinarPosse(referenceId, token)}`;
  (await cookies()).set(orderKey(referenceId), valor, { ...base, maxAge: 60 * 60 * 24 * 30 }); // 30 dias
}

/** Token de posse VERIFICADO. Cookie ausente, malformado ou com assinatura errada → null. */
export async function getOrderToken(referenceId: string): Promise<string | null> {
  const raw = (await cookies()).get(orderKey(referenceId))?.value;
  if (!raw) return null;
  const i = raw.lastIndexOf(".");
  if (i <= 0) return null;
  const token = raw.slice(0, i);
  const dado = Buffer.from(raw.slice(i + 1), "hex");
  const esperado = Buffer.from(assinarPosse(referenceId, token), "hex");
  if (dado.length !== esperado.length || !crypto.timingSafeEqual(dado, esperado)) return null;
  return token;
}
