// Acompanhamento de pedido por convidado: exige referenceId + e-mail CORRESPONDENTE.
// Mitiga a enumeração por referenceId (doc 09): conhecer o código não basta — tem que bater o e-mail.
import { withStoreClient } from "@/lib/unbox/store";
import { shapeOrder } from "@/lib/orders";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { emailSchema } from "@/lib/schemas";
import { ok, fail, failFrom } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rl = rateLimit(`track:${clientIp(req)}`, 15, 10 * 60 * 1000);
  if (!rl.ok) return fail("Muitas tentativas. Aguarde.", 429);
  try {
    const { referenceId, email } = await req.json();
    const e = emailSchema.safeParse(email);
    if (!referenceId || !e.success) return fail("Informe o código do pedido e o e-mail.", 422);

    const o = await withStoreClient((c) => c.getOrder(String(referenceId).trim()));
    if (!o || (o.email ?? "").toLowerCase() !== e.data.toLowerCase()) {
      // resposta uniforme — não revela se o pedido existe
      return fail("Pedido não encontrado para este código e e-mail.", 404);
    }
    return ok({ order: shapeOrder(o) });
  } catch (e) {
    return failFrom(e);
  }
}
