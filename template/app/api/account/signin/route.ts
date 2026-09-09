// Troca o OTP pelo token DO CLIENTE e grava em cookie httpOnly. Rate-limit.
import { withStoreClient } from "@/lib/unbox/store";
import { setCustomerToken } from "@/lib/session";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";
import { otpSchema } from "@/lib/schemas";
import { ok, fail, failFrom } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rl = rateLimit(`signin:${clientIp(req)}`, LIMITS.signin.limit, LIMITS.signin.windowMs);
  if (!rl.ok) return fail("Muitas tentativas. Aguarde.", 429);
  try {
    const body = await req.json();
    const parsed = otpSchema.safeParse(body);
    if (!parsed.success) return fail("Código inválido.", 422);

    const { accessToken, firstAccess } = await withStoreClient((c) =>
      c.customerSignIn(parsed.data.email, parsed.data.otp),
    );
    if (!accessToken) return fail("Código ou credenciais inválidos.", 401);
    await setCustomerToken(accessToken);
    return ok({ ok: true, firstAccess });
  } catch (e) {
    return failFrom(e, 401);
  }
}
