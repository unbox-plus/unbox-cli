// Autocomplete de endereço por CEP (getAddressByPostalCode). Usado no checkout e address book.
import { withStoreClient } from "@/lib/unbox/store";
import { ok, fail, failFrom } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const cep = (code ?? "").replace(/\D/g, "");
    if (cep.length !== 8) return fail("CEP inválido.", 422);
    const addr = await withStoreClient((c) => c.getAddressByPostalCode(cep));
    if (!addr) return fail("CEP não encontrado.", 404);
    return ok({ address: addr });
  } catch (e) {
    return failFrom(e);
  }
}
