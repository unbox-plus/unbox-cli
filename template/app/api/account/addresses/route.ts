// CRUD de endereços do cliente (address book). Token do cliente do cookie.
import { requireCustomerClient } from "@/lib/customer-session";
import { addressSchema } from "@/lib/schemas";
import { ok, fail, failFrom } from "@/lib/api";

export const dynamic = "force-dynamic";

// POST → upsert (com _id atualiza; sem _id cria)
export async function POST(req: Request) {
  try {
    const me = await requireCustomerClient();
    const body = await req.json();
    const parsed = addressSchema.safeParse(body.address);
    if (!parsed.success) return fail("Endereço inválido.", 422, { issues: parsed.error.flatten() });
    const r = await me.upsertAddress({
      ...(parsed.data as any),
      _id: body.address?._id,
      alias: body.address?.alias,
      isShippingDefault: body.address?.isShippingDefault,
      isBillingDefault: body.address?.isBillingDefault,
    });
    return ok({ address: r });
  } catch (e) {
    return failFrom(e);
  }
}

// DELETE { ids: string[] }
export async function DELETE(req: Request) {
  try {
    const me = await requireCustomerClient();
    const { ids } = await req.json();
    if (!Array.isArray(ids) || !ids.length) return fail("Nenhum endereço informado.");
    await me.deleteAddresses(ids);
    return ok({ ok: true });
  } catch (e) {
    return failFrom(e);
  }
}
