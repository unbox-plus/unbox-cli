import { NextResponse } from "next/server";
import { getCustomerClient, lerDaConta } from "@/lib/customer-session";

export const dynamic = "force-dynamic";

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

/** Primeiro nome do cliente: do endereço salvo, senão da parte local do e-mail. */
function firstNameFrom(account: any): string | null {
  const full: string =
    account?.addressBooks?.find((a: any) => a.isShippingDefault)?.fullName ||
    account?.addressBooks?.[0]?.fullName ||
    "";
  const fromName = full.trim().split(/\s+/)[0];
  if (fromName) return cap(fromName);
  const local = String(account?.email ?? "").split("@")[0]?.split(/[._-]/)[0];
  return local ? cap(local) : null;
}

export async function GET() {
  const customer = await getCustomerClient();
  if (!customer) return NextResponse.json({ firstName: null });
  // Sem o nome, o cabeçalho mostra "Entrar". É o sintoma mais rápido de que o contexto da loja não está
  // resolvendo (ver customer.ts, me()), então a falha tem de ficar no log e não só virar null.
  const leitura = await lerDaConta("/api/account/me", customer.me());
  return NextResponse.json({ firstName: leitura.ok && leitura.valor ? firstNameFrom(leitura.valor) : null });
}
