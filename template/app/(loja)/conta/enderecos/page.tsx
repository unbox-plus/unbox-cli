import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerClient } from "@/lib/customer-session";
import { AccountShell } from "@/components/account/account-shell";
import { AddressBook } from "@/components/account/address-book";

export const metadata: Metadata = { title: "Meus endereços", robots: { index: false } };

export default async function EnderecosPage() {
  const me = await getCustomerClient();
  if (!me) redirect("/conta/entrar");
  const account = await me.me().catch(() => null);
  const addresses = account?.addressBooks ?? [];

  return (
    <AccountShell title="Meus endereços">
      <AddressBook initial={addresses} />
    </AccountShell>
  );
}
