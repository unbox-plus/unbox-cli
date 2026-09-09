// Status do pedido com VERIFICAÇÃO DE POSSE (doc 09): referenceId é curto/adivinhável.
// Usado pelo polling do Pix (checkout e app/checkout/pix/[ref]).
import { getOwnedOrder } from "@/lib/orders";
import { ok, fail, failFrom } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  try {
    const { ref } = await params;
    const order = await getOwnedOrder(ref);
    if (!order) return fail("Pedido não encontrado ou acesso negado.", 403);
    return ok({ order });
  } catch (e) {
    return failFrom(e);
  }
}
