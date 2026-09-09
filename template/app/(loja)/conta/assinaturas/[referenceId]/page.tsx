import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { getCustomerClient } from "@/lib/customer-session";
import { getShopData } from "@/lib/queries";
import { subscriptionStatusLabel } from "@/lib/unbox/customer";
import { AccountShell } from "@/components/account/account-shell";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/order-status";
import { SubscriptionActions } from "@/components/account/subscription-actions";

export const metadata: Metadata = { title: "Assinatura", robots: { index: false } };

export default async function AssinaturaDetalhePage({ params }: { params: Promise<{ referenceId: string }> }) {
  const me = await getCustomerClient();
  if (!me) redirect("/conta/entrar");
  const { referenceId } = await params;

  const [sub, shop] = await Promise.all([
    me.subscription(referenceId).catch(() => null),
    getShopData().catch(() => null),
  ]);

  if (!sub) {
    return (
      <AccountShell title="Assinatura">
        <EmptyState title="Assinatura não encontrada" />
      </AccountShell>
    );
  }

  const cycles = await me.subscriptionCycles(sub._id, 12).catch(() => ({ nodes: [] }));
  const actions = shop?.recurringOrdersPolicy?.customerActions ?? {};
  const status = sub.status?.value ?? "ACTIVE";
  const card = sub.unboxPayCustomerCreditCard;
  const addr = sub.shippingAddressBook;
  const tone = status === "CANCELED" ? "bad" : status === "PAUSED" ? "warn" : "ok";

  return (
    <AccountShell title={`Assinatura #${sub.referenceId}`}>
      <div className="rounded-xl border border-[var(--store-line)] bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12.5px] font-semibold text-[var(--store-muted)]">Frequência</p>
            <p className="font-display text-[18px] font-extrabold text-[var(--store-ink)]">{sub.frequency?.title ?? "—"}</p>
          </div>
          <StatusBadge label={subscriptionStatusLabel(status)} tone={tone} />
        </div>

        <div className="my-4 border-t border-[var(--store-surface-2)]" />
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {sub.totalAmount?.displayAmount && <Info label="Valor por ciclo" value={sub.totalAmount.displayAmount} />}
          {sub.cyclesInformation?.nextCycleDate && (
            <Info label="Próxima cobrança" value={new Date(sub.cyclesInformation.nextCycleDate).toLocaleDateString("pt-BR")} />
          )}
          {card && <Info label="Cartão" value={`•••• ${card.last4Digits} (${card.expirationMonth}/${card.expirationYear})`} />}
          {addr && <Info label="Entrega" value={`${addr.address1}, ${addr.number ?? ""} · ${addr.city}/${addr.region}`} />}
          {sub.pricingPolicy?.type === "PERCENTAGE_OFF" && <Info label="Desconto" value={`${sub.pricingPolicy.value}%`} />}
        </dl>

        {sub.items?.length > 0 && (
          <>
            <div className="my-4 border-t border-[var(--store-surface-2)]" />
            <p className="mb-2 text-[13px] font-bold text-[var(--store-ink-2)]">Itens</p>
            <ul className="flex flex-col gap-1 text-sm text-[var(--store-muted)]">
              {sub.items.map((it: any, i: number) => (
                <li key={i}><span className="font-bold text-[var(--store-primary,#18181B)]">{it.quantity}×</span> {it.productERPCode ?? it.productId}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      <SubscriptionActions
        recurringOrderId={sub._id}
        status={status}
        actions={actions}
        items={(sub.items ?? []).map((it: any) => ({ productId: it.productId, variantId: it.variantId, quantity: it.quantity }))}
      />

      {cycles.nodes?.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display mb-2.5 text-[16px] font-bold text-[var(--store-ink)]">Histórico de ciclos</h2>
          <ul className="flex flex-col divide-y divide-[var(--store-surface-2)] rounded-lg border border-[var(--store-line)] bg-white text-sm">
            {cycles.nodes.map((c: any) => (
              <li key={c._id} className="flex items-center justify-between p-3.5">
                <span className="font-semibold text-[var(--store-ink-2)]">Ciclo #{c.cycleIndex}</span>
                <span className="text-[var(--store-muted)]">
                  {c.skipped ? "Pulado" : c.completedAt ? `Concluído em ${new Date(c.completedAt).toLocaleDateString("pt-BR")}` : "Pendente"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link href="/conta/assinaturas" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl border-[1.5px] border-[var(--store-line-2)] bg-white px-4 text-[14px] font-bold text-[var(--store-ink-2)] no-underline transition-colors hover:border-[var(--store-primary,#18181B)] hover:text-[var(--store-primary,#18181B)]">
        <ArrowLeft weight="bold" /> Voltar
      </Link>
    </AccountShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--store-muted)]">{label}</dt>
      <dd className="font-semibold text-[var(--store-ink)]">{value}</dd>
    </div>
  );
}
