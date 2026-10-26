import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { getCustomerClient, lerDaConta } from "@/lib/customer-session";
import { formatarData, formatBRL } from "@/lib/format";
import { Foto } from "@/components/ui/foto";
import { withStoreClient } from "@/lib/unbox";
import { getShopData } from "@/lib/queries";
import { subscriptionStatusLabel } from "@unbox-plus/sdk";
import { AccountShell } from "@/components/account/account-shell";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/order-status";
import { SubscriptionActions, type ItemDetalhe } from "@/components/account/subscription-actions";
import { nameKey } from "@/lib/subscription-items";

export const metadata: Metadata = { title: "Assinatura", robots: { index: false } };

export default async function AssinaturaDetalhePage({ params }: { params: Promise<{ referenceId: string }> }) {
  const me = await getCustomerClient();
  if (!me) redirect("/conta/entrar");
  const { referenceId } = await params;

  const [leitura, shop] = await Promise.all([
    lerDaConta("/conta/assinaturas/[referenceId]", me.subscription(referenceId)),
    getShopData().catch(() => null),
  ]);
  const sub = leitura.ok ? leitura.valor : null;

  if (!sub) {
    // "não encontrada" só quando a API respondeu que não existe; falha na leitura diz o que é
    return (
      <AccountShell title="Assinatura">
        {leitura.ok ? (
          <EmptyState title="Assinatura não encontrada" />
        ) : (
          <EmptyState title="Não conseguimos carregar esta assinatura" description="Ela continua como estava. Tente de novo em instantes." />
        )}
      </AccountShell>
    );
  }

  // a assinatura só traz ids; nome do produto e da variação vêm do SDK. Cosmético: sem nome, cai no código.
  const produtos = await withStoreClient((c) => c.getProductsByIds((sub.items ?? []).map((it: any) => it.productId))).catch(() => []);
  const detalhes: Record<string, ItemDetalhe> = {};
  const linhas = (sub.items ?? []).map((it: any) => {
    const p = produtos.find((x) => x.productId === it.productId || x._id === it.productId);
    const v = p?.variants?.find((x) => x._id === it.variantId);
    const variacao = v?.title && v.title !== p?.title ? v.title : null;
    const unit = v?.pricingOnRecurrence?.[0]?.price ?? v?.pricing?.[0]?.price ?? null;
    const avulso = v?.pricing?.[0]?.price ?? null;
    const titulo = p?.title ?? it.productERPCode ?? it.productId;
    const d: ItemDetalhe = { titulo, variacao, foto: p?.imageUrls?.[0], unit, riscado: unit != null && avulso != null && avulso > unit ? avulso : null };
    detalhes[nameKey(it)] = d;
    return { it, ...d };
  });
  const totalItens = linhas.every((l: any) => l.unit != null) ? linhas.reduce((t: number, l: any) => t + l.unit * l.it.quantity, 0) : null;
  const comDesconto = linhas.some((l: any) => l.riscado != null);

  const ciclos = await lerDaConta("/conta/assinaturas/[referenceId]/ciclos", me.subscriptionCycles(sub._id, 12));
  const cycles = ciclos.ok ? ciclos.valor : { nodes: [] };
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
            <Info label="Próxima cobrança" value={formatarData(sub.cyclesInformation.nextCycleDate)} />
          )}
          {card && <Info label="Cartão" value={`•••• ${card.last4Digits} (${card.expirationMonth}/${card.expirationYear})`} />}
          {addr && <Info label="Entrega" value={`${addr.address1}, ${addr.number ?? ""} · ${addr.city}/${addr.region}`} />}
          {sub.pricingPolicy?.type === "PERCENTAGE_OFF" && <Info label="Desconto" value={`${sub.pricingPolicy.value}%`} />}
        </dl>

        {sub.items?.length > 0 && (
          <>
            <div className="my-4 border-t border-[var(--store-surface-2)]" />
            <p className="mb-2 text-[13px] font-bold text-[var(--store-ink-2)]">Itens</p>
            <ul className="flex flex-col divide-y divide-[var(--store-surface-2)]">
              {linhas.map((l: any, i: number) => (
                <li key={i} className="flex items-start gap-3 py-3.5 first:pt-0">
                  <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-[var(--store-surface-2)]">
                    {l.foto && <Foto src={l.foto} alt="" width={56} height={56} sizes="56px" className="size-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-bold text-[var(--store-ink)]">{l.titulo}</p>
                    {l.variacao && <p className="text-[var(--store-muted)]">{l.variacao}</p>}
                    <p className="text-[13px] text-[var(--store-muted)]">
                      Qtd.: {l.it.quantity}
                      {l.unit != null && <> · {formatBRL(l.unit)} cada</>}
                      {l.riscado != null && <> <s>{formatBRL(l.riscado)}</s></>}
                    </p>
                  </div>
                  {l.unit != null && <p className="font-display whitespace-nowrap font-extrabold tabular-nums text-[var(--store-ink)]">{formatBRL(l.unit * l.it.quantity)}</p>}
                </li>
              ))}
            </ul>
            {totalItens != null && (
              <div className="mt-2 border-t border-[var(--store-surface-2)] pt-3.5">
                <div className="flex items-baseline justify-between font-bold text-[var(--store-ink)]">
                  <span>Total dos produtos</span>
                  <span className="font-display text-[17px] font-extrabold tabular-nums">{formatBRL(totalItens)}</span>
                </div>
                {comDesconto && <p className="text-[13px] text-[var(--store-muted)]">Já com desconto de assinatura</p>}
              </div>
            )}
          </>
        )}
      </div>

      <SubscriptionActions
        recurringOrderId={sub._id}
        status={status}
        detalhes={detalhes}
        actions={actions}
        items={(sub.items ?? []).map((it: any) => ({ productId: it.productId, variantId: it.variantId, quantity: it.quantity }))}
      />

      {cycles.nodes?.length > 0 && (
        <div className="mt-6">
          <h4 className="font-display mb-2.5 text-[var(--store-ink)]">Histórico de ciclos</h4>
          <ul className="flex flex-col divide-y divide-[var(--store-surface-2)] rounded-lg border border-[var(--store-line)] bg-white text-sm">
            {cycles.nodes.map((c: any) => (
              <li key={c._id} className="flex items-center justify-between p-3.5">
                <span className="font-semibold text-[var(--store-ink-2)]">Ciclo #{c.cycleIndex}</span>
                <span className="text-[var(--store-muted)]">
                  {c.skipped ? "Pulado" : c.completedAt ? `Concluído em ${formatarData(c.completedAt)}` : "Pendente"}
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
