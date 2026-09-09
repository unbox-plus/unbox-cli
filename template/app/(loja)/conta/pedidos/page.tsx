import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { CaretRight, ArrowsClockwise, MapPin, Package } from "@phosphor-icons/react/dist/ssr";
import { getCustomerClient } from "@/lib/customer-session";
import { shapeOrderSummary, type ShapedOrderSummary } from "@/lib/orders";
import { AccountShell } from "@/components/account/account-shell";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge, statusTone } from "@/components/order-status";

export const metadata: Metadata = { title: "Meus pedidos", robots: { index: false } };

export default async function PedidosPage() {
  const me = await getCustomerClient();
  if (!me) redirect("/conta/entrar");

  const orders = await me.orders({ first: 30 }).catch(() => ({ nodes: [], totalCount: 0 }));
  const list: ShapedOrderSummary[] = (orders.nodes ?? []).map((n: any) => shapeOrderSummary(n));

  return (
    <AccountShell title="Meus pedidos">
      {list.length === 0 ? (
        <EmptyState
          title="Você ainda não tem pedidos"
          description="Quando você fizer uma compra, ela aparece aqui com status, itens e rastreio."
        >
          <Link href="/produtos" className="font-display inline-flex h-11 items-center rounded-xl bg-[var(--store-primary,#18181B)] px-5 text-[14px] font-bold text-white no-underline transition-colors hover:bg-[var(--store-primary-dark,#09090B)]">
            Ver produtos
          </Link>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3.5">
          {list.map((o) => (
            <Link
              key={o.referenceId}
              href={`/conta/pedidos/${o.referenceId}`}
              className="group flex flex-col gap-3.5 rounded-lg border border-[var(--store-line)] bg-white p-4 no-underline transition-all hover:border-[var(--store-primary,#18181B)] hover:shadow-[0_8px_22px_rgba(24,24,27,.08)]"
            >
              {/* topo: ref + data + status */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-[15.5px] font-extrabold text-[var(--store-ink)]">#{o.referenceId}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-[var(--store-muted)]">
                    {o.createdAt ? new Date(o.createdAt).toLocaleDateString("pt-BR") : ""}
                    {o.recurring && (
                      <span className="inline-flex items-center gap-1 font-semibold text-[var(--store-primary,#18181B)]">
                        <ArrowsClockwise weight="bold" className="text-[12px]" />assinatura
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {o.delivered ? (
                    <StatusBadge label="Entregue" tone="ok" />
                  ) : o.dispatched ? (
                    <StatusBadge label="Despachado" tone="warn" />
                  ) : (
                    <StatusBadge label={o.statusLabel} tone={statusTone(o.status)} />
                  )}
                  <CaretRight weight="bold" className="text-[var(--store-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--store-primary,#18181B)]" />
                </div>
              </div>

              {/* produtos: miniaturas + resumo + total */}
              <div className="flex items-center gap-3 border-t border-[var(--store-surface-2)] pt-3.5">
                <div className="flex shrink-0 -space-x-2">
                  {o.thumbnails.length > 0 ? (
                    o.thumbnails.map((src, i) => (
                      <span key={i} className="relative h-11 w-11 overflow-hidden rounded-md border border-[var(--store-line)] bg-[var(--store-surface)]">
                        <Image src={src} alt="" fill sizes="44px" className="object-contain p-1" />
                      </span>
                    ))
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-md border border-[var(--store-line)] bg-[var(--store-surface)]"><Package className="text-[var(--store-faint)]" /></span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--store-ink-2)]">
                    {o.firstTitles.join(" · ") || `${o.itemCount} item(ns)`}
                  </p>
                  <p className="text-[12px] text-[var(--store-muted)]">{o.itemCount} item(ns)</p>
                </div>
                {o.total && <span className="font-display shrink-0 text-[15px] font-extrabold text-[var(--store-primary,#18181B)]">{o.total}</span>}
              </div>

              {/* endereço de entrega */}
              {o.address && (o.address.line || o.address.cityRegion) && (
                <div className="flex items-start gap-2 rounded-md bg-[var(--store-surface)] px-3 py-2.5 text-[12.5px] text-[var(--store-ink-2)]">
                  <MapPin weight="fill" className="mt-px shrink-0 text-[14px] text-[var(--store-primary,#18181B)]" />
                  <span className="min-w-0">
                    {o.address.fullName && <b className="text-[var(--store-ink)]">{o.address.fullName}</b>}
                    {o.address.fullName && (o.address.line || o.address.cityRegion) ? " · " : ""}
                    {[o.address.line, o.address.cityRegion].filter(Boolean).join(" · ")}
                  </span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </AccountShell>
  );
}
