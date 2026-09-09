// Parcelas (sem juros) para um valor — exibição no checkout (cartão, não assinatura).
import { withStoreClient } from "@/lib/unbox/store";
import { ok, fail, failFrom } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const amount = Number(new URL(req.url).searchParams.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) return fail("Valor inválido.", 400);
  try {
    const installments = await withStoreClient((c) => c.getInstallments(amount));
    return ok({ installments });
  } catch (e) {
    return failFrom(e, 502);
  }
}
