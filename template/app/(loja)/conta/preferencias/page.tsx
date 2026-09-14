import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerClient, lerDaConta } from "@/lib/customer-session";
import { EmptyState } from "@/components/empty-state";
import { AccountShell } from "@/components/account/account-shell";
import { PreferencesForm } from "@/components/account/preferences-form";

export const metadata: Metadata = { title: "Preferências", robots: { index: false } };

export default async function PreferenciasPage() {
  const me = await getCustomerClient();
  if (!me) redirect("/conta/entrar");
  const leitura = await lerDaConta("/conta/preferencias", me.me());
  const account = leitura.ok ? leitura.valor : null;

  return (
    <AccountShell title="Preferências">
      {/* Sem a leitura, o formulário abriria com valores padrão, e salvar sobrescreveria a escolha real. */}
      {leitura.ok ? (
        <PreferencesForm
          initial={{
            receiveNewOrderEmail: account?.metafields?.receiveNewOrderEmail ?? true,
            reuseDataBetweenShops: account?.reuseDataBetweenShops ?? false,
          }}
        />
      ) : (
        <EmptyState title="Não conseguimos carregar suas preferências" description="Nada foi alterado. Tente de novo em instantes." />
      )}
    </AccountShell>
  );
}
