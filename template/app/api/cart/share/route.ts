// Gera o link compartilhável do carrinho atual: lê {cartId, cartToken} do cookie httpOnly e
// monta a URL de restauração (ver app/api/cart/link/route.ts, modo id+token). Quem tem o link
// tem o carrinho — e-mail/endereço/CPF ficam legíveis e editáveis por quem abrir (ver doc 12).
import { getCartRef, getRecurFreq } from "@/lib/session";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ref = await getCartRef();
  if (!ref) return fail("Nenhum carrinho ativo para compartilhar.", 404);
  const origin = new URL(req.url).origin;
  // No modo hospedado o /checkout deste projeto não existe: o link vai pro checkout da Unbox.
  const base = process.env.UNBOX_HOSTED_CHECKOUT_URL || `${origin}/checkout`;
  let url = `${base}?id=${encodeURIComponent(ref.cartId)}&token=${encodeURIComponent(ref.cartToken)}`;
  // A frequência de assinatura vive só em cookie — sem incluí-la, restaurar esse link em outra
  // sessão perde a frequência escolhida (ver app/api/cart/link/route.ts).
  const freq = await getRecurFreq();
  if (freq) url += `&freq=${encodeURIComponent(freq)}`;
  return ok({ url });
}
