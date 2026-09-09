// Cria um Payment Link hospedado pela Unbox (compartilhar carrinho / WhatsApp).
// ⚠️ Operação de loja (admin-ish). Protegida por REVALIDATE_SECRET (header x-admin-secret) por padrão.
import { withStoreClient } from "@/lib/unbox/store";
import { serverEnv } from "@/lib/config";
import { ok, fail, failFrom } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // FAIL-CLOSED: sem REVALIDATE_SECRET configurado a rota fica FECHADA, não aberta. A versão
  // anterior era `if (secret && ...)`: com o secret vazio (o default do .env) a guarda sumia e
  // qualquer pessoa criava Payment Links reais com a marca da loja, em massa ou pré-preenchidos
  // para phishing. Mesmo padrão da /api/revalidate.
  if (!serverEnv.revalidateSecret || req.headers.get("x-admin-secret") !== serverEnv.revalidateSecret) {
    return fail("Não autorizado.", 401);
  }
  try {
    const body = await req.json();
    const items = body.items;
    if (!Array.isArray(items) || !items.length) return fail("Itens inválidos.");
    const link = await withStoreClient((c) =>
      c.createPaymentLink({ items, constraints: body.constraints, customerData: body.customerData }),
    );
    return ok({ paymentLink: link });
  } catch (e) {
    return failFrom(e);
  }
}
