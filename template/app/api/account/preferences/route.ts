// Atualiza preferências da conta (token do cliente do cookie).
import { requireCustomerClient } from "@/lib/customer-session";
import { ok, failFrom } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const me = await requireCustomerClient();
    const body = await req.json();
    const input: { receiveNewOrderEmail?: boolean; reuseDataBetweenShops?: boolean } = {};
    if (typeof body.receiveNewOrderEmail === "boolean") input.receiveNewOrderEmail = body.receiveNewOrderEmail;
    if (typeof body.reuseDataBetweenShops === "boolean") input.reuseDataBetweenShops = body.reuseDataBetweenShops;
    const r = await me.updateAccount(input);
    return ok({ account: r });
  } catch (e) {
    return failFrom(e);
  }
}
