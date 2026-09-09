import Link from "next/link";
import Image from "next/image";
import { Truck, Receipt, Package, CheckCircle, MapPin } from "@phosphor-icons/react/dist/ssr";
import type { ShapedOrder } from "@/lib/orders";

type Tone = "ok" | "bad" | "warn" | "muted";

const TONES: Record<Tone, { bg: string; fg: string; bd: string }> = {
  ok: { bg: "var(--store-primary-soft,#F1F1F3)", fg: "var(--store-primary,#18181B)", bd: "var(--store-primary-soft)" },
  bad: { bg: "var(--store-sale-soft)", fg: "var(--store-sale)", bd: "var(--store-sale-soft)" },
  warn: { bg: "var(--store-cta-soft)", fg: "var(--store-cta-fg)", bd: "var(--store-cta-soft)" },
  muted: { bg: "var(--store-surface)", fg: "var(--store-ink-2)", bd: "var(--store-line-2)" },
};

/** Tom (cor) a partir do status cru do pedido. */
export function statusTone(status?: string): Tone {
  switch (status) {
    case "COMPLETED":
    case "PROCESSING":
      return "ok";
    case "CANCELED":
    case "FAILED":
      return "bad";
    case "REFUNDED":
      return "muted";
    default:
      return "warn"; // PENDING e afins
  }
}

/** Badge de status. */
export function StatusBadge({ label, tone = "muted" }: { label: string; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-extrabold tracking-[0.2px]"
      style={{ background: t.bg, color: t.fg, border: `1px solid ${t.bd}` }}
    >
      {label}
    </span>
  );
}

export function OrderStatusCard({ order }: { order: ShapedOrder }) {
  return (
    <div className="rounded-xl border border-[var(--store-line)] bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--store-muted)]">Pedido</p>
          <p className="font-display text-[20px] font-extrabold text-[var(--store-ink)]">#{order.referenceId}</p>
        </div>
        <StatusBadge label={order.statusLabel} tone={statusTone(order.status)} />
      </div>

      <div className="my-4 border-t border-[var(--store-surface-2)]" />

      <dl className="flex flex-col gap-2.5 text-sm">
        {order.total && (
          <div className="flex justify-between gap-6">
            <dt className="text-[var(--store-muted)]">Total</dt>
            <dd className="font-display text-[15px] font-extrabold text-[var(--store-primary,#18181B)]">{order.total}</dd>
          </div>
        )}
        {order.payment && (
          <div className="flex justify-between gap-6">
            <dt className="text-[var(--store-muted)]">Pagamento</dt>
            <dd className="text-right font-semibold text-[var(--store-ink)]">
              {order.payment.displayName ?? "—"}
              {order.payment.cardBrand ? ` · ${order.payment.cardBrand}` : ""}
              {order.payment.statusLabel ? ` · ${order.payment.statusLabel}` : ""}
            </dd>
          </div>
        )}
        {order.payment?.errorMessage && (
          <p className="rounded-lg bg-[var(--store-sale-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--store-sale)]">{order.payment.errorMessage}</p>
        )}
      </dl>

      {order.items.length > 0 && (
        <>
          <div className="my-4 border-t border-[var(--store-surface-2)]" />
          <p className="mb-2.5 text-[13px] font-bold text-[var(--store-ink-2)]">Itens do pedido</p>
          <ul className="flex flex-col gap-2.5">
            {order.items.map((it, i) => {
              const row = (
                <>
                  <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--store-line)] bg-[var(--store-surface)]">
                    {it.thumbnail ? <Image src={it.thumbnail} alt={it.title} fill sizes="48px" className="object-contain p-1" /> : <Package className="text-[var(--store-faint)]" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-bold leading-[1.25] text-[var(--store-ink)] line-clamp-2">{it.title}</div>
                    <div className="mt-0.5 text-[12.5px] text-[var(--store-muted)]">
                      {it.quantity}× {it.displayPrice ? `· ${it.displayPrice}` : ""}
                    </div>
                  </div>
                  {it.displaySubtotal && <span className="shrink-0 text-[14px] font-extrabold text-[var(--store-primary,#18181B)]">{it.displaySubtotal}</span>}
                </>
              );
              return it.slug ? (
                <li key={i}>
                  <Link href={`/produto/${encodeURIComponent(it.slug)}`} className="flex items-center gap-3 rounded-md border border-[var(--store-line)] bg-white p-2.5 no-underline transition-colors hover:border-[var(--store-primary,#18181B)]">{row}</Link>
                </li>
              ) : (
                <li key={i} className="flex items-center gap-3 rounded-md border border-[var(--store-line)] bg-white p-2.5">{row}</li>
              );
            })}
          </ul>
        </>
      )}

      {order.address && (order.address.line || order.address.cityRegion) && (
        <>
          <div className="my-4 border-t border-[var(--store-surface-2)]" />
          <div className="flex items-start gap-2 text-sm">
            <MapPin weight="fill" className="mt-0.5 shrink-0 text-[var(--store-primary,#18181B)]" />
            <div>
              <p className="font-bold text-[var(--store-ink-2)]">Endereço de entrega</p>
              <p className="mt-0.5 text-[var(--store-ink-2)]">
                {order.address.fullName && <span className="font-semibold text-[var(--store-ink)]">{order.address.fullName}<br /></span>}
                {[order.address.line, order.address.cityRegion].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        </>
      )}

      {order.fulfillment.length > 0 && (
        <>
          <div className="my-4 border-t border-[var(--store-surface-2)]" />
          <div className="flex flex-col gap-2.5 text-sm">
            <p className="flex items-center gap-2 font-bold text-[var(--store-ink-2)]"><Truck weight="bold" className="text-[var(--store-primary,#18181B)]" />Entrega</p>
            {order.fulfillment.map((f, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <span className="text-[var(--store-muted)]">{f.type ?? "Envio"}{f.status ? ` · ${f.status}` : ""}</span>
                {f.trackingCode ? (
                  <span className="rounded-md bg-[var(--store-surface)] px-2 py-0.5 font-mono text-xs text-[var(--store-ink-2)]">Rastreio: {f.trackingCode}</span>
                ) : (
                  <span className="text-[12.5px] text-[var(--store-faint)]">Sem rastreio ainda</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {(order.invoiceIssued || order.dispatched || order.delivered) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {order.invoiceIssued && <PillIcon icon={Receipt} label="Nota fiscal emitida" />}
          {order.dispatched && <PillIcon icon={Package} label="Despachado" />}
          {order.delivered && <PillIcon icon={CheckCircle} label="Entregue" />}
        </div>
      )}
    </div>
  );
}

function PillIcon({ icon: Icon, label }: { icon: React.ComponentType<any>; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--store-line-2)] bg-[var(--store-surface)] px-3 py-1 text-[12px] font-semibold text-[var(--store-ink-2)]">
      <Icon weight="fill" className="text-[var(--store-primary,#18181B)]" />{label}
    </span>
  );
}
