import Link from "next/link";
import Image from "next/image";
import { Truck, Receipt, Package, CheckCircle, MapPin, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import type { ShapedOrder } from "@/lib/orders";
import { formatarDataHora } from "@/lib/format";

type Tone = "ok" | "bad" | "warn" | "muted";

const TONES: Record<Tone, { bg: string; fg: string; bd: string }> = {
  ok: { bg: "var(--store-primary-soft,#F1F1F3)", fg: "var(--store-primary,#18181B)", bd: "var(--store-primary-soft)" },
  bad: { bg: "var(--store-sale-soft)", fg: "var(--store-sale)", bd: "var(--store-sale-soft)" },
  warn: { bg: "var(--store-cta-soft)", fg: "var(--store-cta-fg)", bd: "var(--store-cta-soft)" },
  muted: { bg: "var(--store-surface)", fg: "var(--store-ink-2)", bd: "var(--store-line-2)" },
};

/** Tom (cor) a partir do status cru do pedido. Vale para a LISTA; o selo da página do pedido segue o
 *  pagamento (ver `orderSeal`). */
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

/**
 * O SELO DO PEDIDO segue o PAGAMENTO ("Pedido pago"), que é o que o cliente quer saber ao abrir o
 * pedido. Sem status de pagamento na resposta (a seleção enxuta não traz), cai no status do pedido.
 */
export function orderSeal(order: ShapedOrder): { label: string; tone: Tone } {
  return order.payment?.seal ?? { label: order.statusLabel, tone: statusTone(order.status) };
}

/** Bloco da página do pedido: título e conteúdo, filete de 1px, sem sombra. */
function Bloco({ titulo, lateral, children, semRecuo = false }: { titulo: string; lateral?: React.ReactNode; children: React.ReactNode; semRecuo?: boolean }) {
  return (
    <section className="rounded-xl border border-[var(--store-line)] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--store-surface-2)] px-5 py-3">
        <p className="font-display text-[15px] font-extrabold text-[var(--store-ink)]">{titulo}</p>
        {lateral}
      </div>
      <div className={semRecuo ? "" : "px-5 py-4"}>{children}</div>
    </section>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12.5px] font-semibold text-[var(--store-muted)]">{rotulo}</dt>
      <dd className="mt-0.5 break-words text-[14px] text-[var(--store-ink)]">{children}</dd>
    </div>
  );
}

function Linha({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`flex justify-between gap-6 ${destaque ? "border-t border-[var(--store-surface-2)] pt-2.5" : ""}`}>
      <dt className={destaque ? "font-display text-[15px] font-extrabold text-[var(--store-ink)]" : "text-[var(--store-muted)]"}>{rotulo}</dt>
      <dd className={destaque ? "font-display text-[16px] font-extrabold text-[var(--store-primary,#18181B)]" : "text-[var(--store-ink-2)]"}>{valor}</dd>
    </div>
  );
}

/**
 * PÁGINA DO PEDIDO EM BLOCOS, na ordem da conta hospedada da Unbox: cabeçalho → Detalhes da compra →
 * Histórico de rastreio → Produto e preço → Resumo. Era um card único com tudo empilhado, e pagamento,
 * endereço e entrega se misturavam. Bloco sem dado não aparece: pedido lido com a seleção enxuta mostra
 * menos, e mostra certo.
 */
export function OrderStatusCard({
  order,
  /** Linha com o número e o selo. A conta desenha isso no próprio título (AccountShell `aoLado`) e passa false. */
  mostrarNumero = true,
}: {
  order: ShapedOrder;
  mostrarNumero?: boolean;
}) {
  const selo = orderSeal(order);
  const dataCompra = formatarDataHora(order.createdAt);
  const envio = [order.shipping?.method, order.shipping?.carrier].filter(Boolean).join(" · ");
  const prazo = order.shipping?.days != null ? `${order.shipping.days} ${order.shipping.days === 1 ? "dia útil" : "dias úteis"}` : null;
  const entregas = order.fulfillment.filter((f) => f.status || f.type);
  const rastreio = order.tracking;
  const temRastreio = !!(rastreio?.code || rastreio?.url || rastreio?.events.length);

  return (
    <div className="flex flex-col gap-3.5">
      {mostrarNumero && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-display text-[20px] font-extrabold leading-tight text-[var(--store-ink)]">Pedido #{order.referenceId}</p>
          <StatusBadge label={selo.label} tone={selo.tone} />
        </div>
      )}

      {/* 1. Detalhes da compra */}
      <Bloco titulo="Detalhes da compra">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {dataCompra && <Campo rotulo="Data da compra">{dataCompra}</Campo>}
          <Campo rotulo="Número do pedido"><span className="font-mono text-[13px]">{order.referenceId}</span></Campo>
          {order.payment && (
            <Campo rotulo="Pagamento">
              {[order.payment.displayName, order.payment.cardBrand, order.payment.amount].filter(Boolean).join(" · ") || "Não informado"}
            </Campo>
          )}
          {(envio || prazo) ? (
            <Campo rotulo="Envio">
              {envio || "Entrega"}
              {prazo && <span className="block text-[12.5px] text-[var(--store-muted)]">{prazo}</span>}
            </Campo>
          ) : entregas.length > 0 ? (
            <Campo rotulo="Entrega">{entregas.map((f) => [f.type, f.status].filter(Boolean).join(" · ")).join(" / ")}</Campo>
          ) : null}
        </dl>

        {order.address && (order.address.line || order.address.cityRegion) && (
          <div className="mt-4 flex items-start gap-2 border-t border-[var(--store-surface-2)] pt-4">
            <MapPin weight="fill" className="mt-0.5 shrink-0 text-[var(--store-primary,#18181B)]" />
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-[var(--store-muted)]">Endereço de entrega</p>
              <p className="mt-0.5 text-[14px] leading-[1.5] text-[var(--store-ink)]">
                {order.address.fullName && <span className="block font-bold">{order.address.fullName}</span>}
                {order.address.line && <span className="block">{order.address.line}</span>}
                {order.address.cityRegion && <span className="block">{order.address.cityRegion}</span>}
              </p>
            </div>
          </div>
        )}

        {order.payment?.errorMessage && (
          <p className="mt-4 rounded-lg bg-[var(--store-sale-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--store-sale)]">{order.payment.errorMessage}</p>
        )}
      </Bloco>

      {/* 2. Histórico de rastreio */}
      {temRastreio && rastreio && (
        <Bloco
          titulo="Histórico de rastreio"
          lateral={rastreio.url ? (
            <a href={rastreio.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--store-primary,#18181B)] px-3.5 text-[13px] font-bold text-white no-underline transition-colors hover:bg-[var(--store-primary-dark,#09090B)]">
              <Truck weight="fill" /> Rastrear <ArrowSquareOut weight="bold" className="text-[12px]" />
            </a>
          ) : undefined}
        >
          {rastreio.code && (
            <p className="text-[13.5px] text-[var(--store-ink-2)]">
              Código de rastreio: <span className="font-mono font-bold text-[var(--store-ink)]">{rastreio.code}</span>
            </p>
          )}
          {rastreio.events.length > 0 && (
            <ol className={`flex list-none flex-col gap-3 border-l border-[var(--store-line-2)] pl-4 ${rastreio.code ? "mt-4" : ""}`}>
              {rastreio.events.map((e, i) => (
                <li key={i} className="relative">
                  <span aria-hidden className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${i === 0 ? "bg-[var(--store-primary,#18181B)]" : "bg-[var(--store-line-2)]"}`} />
                  <p className="text-[13.5px] font-bold text-[var(--store-ink)]">{e.label}</p>
                  {e.description && e.description !== e.label && <p className="text-[13px] text-[var(--store-ink-2)]">{e.description}</p>}
                  {e.at && <p className="text-[12px] text-[var(--store-muted)]">{formatarDataHora(e.at)}</p>}
                </li>
              ))}
            </ol>
          )}
        </Bloco>
      )}

      {/* 3. Produto e preço */}
      {order.items.length > 0 && (
        <Bloco titulo="Produto" lateral={<span className="font-display text-[15px] font-extrabold text-[var(--store-ink)]">Preço</span>} semRecuo>
          <ul className="flex list-none flex-col">
            {order.items.map((it, i) => {
              const linha = (
                <>
                  <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-[var(--store-line)] bg-[var(--store-surface)]">
                    <span className="absolute inset-0 overflow-hidden rounded-md">
                      {it.thumbnail ? <Image src={it.thumbnail} alt={it.title} fill sizes="56px" className="object-contain p-1" /> : <Package className="absolute inset-0 m-auto text-[var(--store-faint)]" />}
                    </span>
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--store-primary,#18181B)] px-1 text-[11px] font-extrabold text-white" aria-label={`${it.quantity} unidade(s)`}>{it.quantity}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-[14px] font-bold leading-[1.3] text-[var(--store-ink)]">{it.title}</div>
                    <div className="mt-0.5 text-[12.5px] text-[var(--store-muted)]">
                      {[it.variantTitle, it.displayPrice && it.quantity > 1 ? `${it.quantity} × ${it.displayPrice}` : null].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {it.displaySubtotal && <span className="shrink-0 text-[14px] font-extrabold text-[var(--store-ink)]">{it.displaySubtotal}</span>}
                </>
              );
              const classes = `flex items-center gap-3.5 px-5 py-3.5 no-underline ${i > 0 ? "border-t border-[var(--store-surface-2)]" : ""}`;
              return it.slug ? (
                <li key={i}>
                  <Link href={`/produto/${encodeURIComponent(it.slug)}`} className={`${classes} transition-colors hover:bg-[var(--store-surface)]`}>{linha}</Link>
                </li>
              ) : (
                <li key={i} className={classes}>{linha}</li>
              );
            })}
          </ul>
        </Bloco>
      )}

      {/* 4. Resumo: a quebra (Subtotal, Frete, Descontos) só quando a API entregou */}
      {(order.totals || order.total) && (
        <Bloco titulo="Resumo do pedido">
          <dl className="flex flex-col gap-2.5 text-sm">
            {order.totals?.subtotal && <Linha rotulo="Subtotal" valor={order.totals.subtotal} />}
            {order.totals?.shipping && <Linha rotulo="Frete" valor={order.totals.shipping} />}
            {order.totals?.discount && <Linha rotulo="Descontos" valor={`− ${order.totals.discount}`} />}
            {order.total && <Linha rotulo="Total" valor={order.total} destaque={!!order.totals} />}
          </dl>
        </Bloco>
      )}

      {(order.invoiceIssued || order.dispatched || order.delivered) && (
        <div className="flex flex-wrap gap-2">
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
