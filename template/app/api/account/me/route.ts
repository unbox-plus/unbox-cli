import { NextResponse } from "next/server";
import { getCustomerClient } from "@/lib/customer-session";

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
  const account = await customer.me().catch(() => null);
  return NextResponse.json({ firstName: account ? firstNameFrom(account) : null });
}
