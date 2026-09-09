import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerClient } from "@/lib/customer-session";
import { AccountShell } from "@/components/account/account-shell";
import { PreferencesForm } from "@/components/account/preferences-form";

export const metadata: Metadata = { title: "Preferências", robots: { index: false } };

export default async function PreferenciasPage() {
  const me = await getCustomerClient();
  if (!me) redirect("/conta/entrar");
  const account = await me.me().catch(() => null);

  return (
    <AccountShell title="Preferências">
      <PreferencesForm
        initial={{
          receiveNewOrderEmail: account?.metafields?.receiveNewOrderEmail ?? true,
          reuseDataBetweenShops: account?.reuseDataBetweenShops ?? false,
        }}
      />
    </AccountShell>
  );
}
