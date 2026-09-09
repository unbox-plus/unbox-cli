// Verifica se há conta para o e-mail nesta loja (login vs. primeiro acesso). Rate-limit anti-enumeração.
import { withStoreClient } from "@/lib/unbox/store";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";
import { emailSchema } from "@/lib/schemas";
import { ok, fail, failFrom } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rl = rateLimit(`exists:${clientIp(req)}`, LIMITS.exists.limit, LIMITS.exists.windowMs);
  if (!rl.ok) return fail("Muitas tentativas. Aguarde.", 429);
  try {
    const { email } = await req.json();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return fail("E-mail inválido.", 422);
    const exists = await withStoreClient((c) => c.customerAccountExists(parsed.data));
    return ok({ exists });
  } catch (e) {
    return failFrom(e);
  }
}
