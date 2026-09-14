import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerClient, lerDaConta } from "@/lib/customer-session";
import { EmptyState } from "@/components/empty-state";
import { AccountShell } from "@/components/account/account-shell";
import { AddressBook } from "@/components/account/address-book";

export const metadata: Metadata = { title: "Meus endereços", robots: { index: false } };

export default async function EnderecosPage() {
  const me = await getCustomerClient();
  if (!me) redirect("/conta/entrar");
  const leitura = await lerDaConta("/conta/enderecos", me.me());

  return (
    <AccountShell title="Meus endereços">
      {/* Sem a leitura, a lista vazia diria "nenhum endereço salvo" a quem tem vários. */}
      {leitura.ok ? (
        <AddressBook initial={leitura.valor?.addressBooks ?? []} />
      ) : (
        <EmptyState title="Não conseguimos carregar seus endereços" description="Eles continuam salvos. Tente de novo em instantes." />
      )}
    </AccountShell>
  );
}
