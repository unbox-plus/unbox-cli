import { clearCustomerToken } from "@/lib/session";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearCustomerToken();
  return ok({ ok: true });
}
