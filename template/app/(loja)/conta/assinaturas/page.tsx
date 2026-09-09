import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CaretRight, ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";
import { getCustomerClient } from "@/lib/customer-session";
import { AccountShell } from "@/components/account/account-shell";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Minhas assinaturas", robots: { index: false } };

export default async function AssinaturasPage() {
  const me = await getCustomerClient();
  if (!me) redirect("/conta/entrar");
  const subs = await me.subscriptions({ first: 20 }).catch(() => ({ nodes: [], totalCount: 0 }));
  const nodes: any[] = subs.nodes ?? [];

  return (
    <AccountShell title="Minhas assinaturas">
      {nodes.length === 0 ? (
        <EmptyState title="Você não tem assinaturas" description="Assine um produto e receba periodicamente com desconto.">
          <Link href="/produtos" className="font-display inline-flex h-11 items-center rounded-xl bg-[var(--store-primary,#18181B)] px-5 text-[14px] font-bold text-white no-underline transition-colors hover:bg-[var(--store-primary-dark,#09090B)]">
            Ver produtos
          </Link>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {nodes.map((s) => (
            <Link
              key={s._id}
              href={`/conta/assinaturas/${s.referenceId}`}
              className="group flex items-center justify-between gap-3 rounded-lg border border-[var(--store-line)] bg-white p-4 no-underline transition-all hover:border-[var(--store-primary,#18181B)] hover:shadow-[0_8px_22px_rgba(24,24,27,.08)]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--store-primary-soft,#F1F1F3)] text-[var(--store-primary,#18181B)]">
                  <ArrowsClockwise weight="bold" className="text-[18px]" />
                </span>
                <div>
                  <p className="font-display text-[15.5px] font-bold text-[var(--store-ink)]">Assinatura #{s.referenceId}</p>
                  <p className="mt-0.5 text-[12.5px] text-[var(--store-muted)]">
                    {s.createdAt ? `desde ${new Date(s.createdAt).toLocaleDateString("pt-BR")}` : ""}
                  </p>
                </div>
              </div>
              <CaretRight weight="bold" className="text-[var(--store-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--store-primary,#18181B)]" />
            </Link>
          ))}
        </div>
      )}
    </AccountShell>
  );
}
