// Grava o e-mail no carrinho (etapa de contato) → habilita recuperação de carrinho abandonado.
// Chamado pelo checkout assim que o e-mail é válido, antes do placeOrder.
//
// É AQUI que o carrinho vira recuperável: com o e-mail gravado, despachamos pro CRM o
// ponteiro completo (cartId + link pronto com id/token/freq). Sem este evento, o id+token
// vive só no cookie do cliente e nenhum cron/CRM tem como montar o e-mail de recuperação.
import { withStoreClient } from "@/lib/unbox/store";
import { getCartRef, getRecurFreq } from "@/lib/session";
import { ok, fail, failFrom } from "@/lib/api";
import { emailSchema } from "@/lib/schemas";
import { dispatchCrm } from "@/lib/crm";
import { buildRecoveryUrl } from "@/lib/cart-recovery";

export const dynamic = "force-dynamic";

// POST /api/checkout/email { email }
export async function POST(req: Request) {
  try {
    const ref = await getCartRef();
    if (!ref) return fail("Carrinho não encontrado.", 404);
    const body = await req.json();
    const parsed = emailSchema.safeParse(body.email);
    if (!parsed.success) return fail("E-mail inválido.", 422);

    await withStoreClient((c) => c.setEmailOnCart(ref.cartId, ref.cartToken, parsed.data));

    // Fire-and-forget: falha de CRM nunca pode travar o checkout.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const freq = await getRecurFreq();
    dispatchCrm({
      type: "checkout_started",
      email: parsed.data,
      cartId: ref.cartId,
      recoveryUrl: buildRecoveryUrl(siteUrl, ref.cartId, ref.cartToken, freq),
    }).catch(() => {});

    return ok({ ok: true });
  } catch (e) {
    return failFrom(e);
  }
}
