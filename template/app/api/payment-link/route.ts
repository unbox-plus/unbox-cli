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
    // ITEM DE PAYMENT LINK É PRODUTO VIRTUAL, não item de carrinho: título, preço e quantidade
    // são do link (o vínculo com o catálogo, quando existe, é por código de ERP). Enviar
    // `{productId, productVariantId}` aqui cria um link sem nome e sem valor, que a página
    // pública mostra vazio — por isso os três campos são exigidos antes de chamar a Unbox.
    const items = body.items;
    const valido = Array.isArray(items) && items.length > 0 && items.every(
      (i: any) => typeof i?.title === "string" && i.title.trim() && typeof i?.quantity === "number" && typeof i?.price?.amount === "number",
    );
    if (!valido) return fail("Itens inválidos: cada item precisa de title, quantity e price.amount.");
    if (typeof body.title !== "string" || !body.title.trim()) return fail("Informe o título do link.");
    const link = await withStoreClient((c) =>
      c.createPaymentLink({
        title: body.title,
        description: body.description,
        items: items.map((i: any) => ({ ...i, price: { currencyCode: "BRL", ...i.price } })),
        constraints: body.constraints,
        customerData: body.customerData,
      }),
    );
    return ok({ paymentLink: link });
  } catch (e) {
    return failFrom(e);
  }
}
