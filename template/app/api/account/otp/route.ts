// Pede o código OTP por e-mail. ⚠️ EFEITO REAL: dispara e-mail de verdade (customerOTPRequest).
// Exige x-captcha-verification (o SDK cuida). Rate-limit anti-spam. NÃO retentar automaticamente.
import { withStoreClient } from "@/lib/unbox/store";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";
import { emailSchema } from "@/lib/schemas";
import { ok, fail, failFrom } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return fail("E-mail inválido.", 422);

    // limita por IP e por e-mail
    const ip = rateLimit(`otp:ip:${clientIp(req)}`, LIMITS.otp.limit, LIMITS.otp.windowMs);
    const byEmail = rateLimit(`otp:email:${parsed.data}`, LIMITS.otp.limit, LIMITS.otp.windowMs);
    if (!ip.ok || !byEmail.ok) return fail("Muitas solicitações de código. Aguarde alguns minutos.", 429);

    await withStoreClient((c) => c.requestCustomerOtp(parsed.data));
    return ok({ ok: true });
  } catch (e) {
    return failFrom(e);
  }
}
