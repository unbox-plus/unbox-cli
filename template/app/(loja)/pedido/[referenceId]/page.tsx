import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { getOwnedOrder } from "@/lib/orders";
import { OrderStatusCard } from "@/components/order-status";
import { EmptyState } from "@/components/empty-state";
import { PurchaseTracker } from "@/components/analytics/purchase-tracker";
import { DataLayerReady } from "@/components/analytics/data-layer-ready";
import { parseBRL } from "@/lib/format";
import { mockupOr } from "@/lib/mockup";

export const metadata: Metadata = { title: "Pedido", robots: { index: false } };

export default async function PedidoPage({ params }: { params: Promise<{ referenceId: string }> }) {
  const { referenceId } = await params;
  const order = await mockupOr(getOwnedOrder(referenceId), null, "pedido/getOwnedOrder");

  if (!order) {
    return (
      <div className="store-layout full-bleed bg-white text-[var(--store-ink)]">
        <div className="mx-auto max-w-[560px] px-4 py-12 sm:px-6">
          <EmptyState
            title="Não foi possível exibir este pedido"
            description="Entre na sua conta para ver este pedido."
          >
            <div className="flex flex-wrap justify-center gap-2.5">
              <Link href="/conta/entrar" className="font-display inline-flex h-11 items-center rounded-xl bg-[var(--store-primary,#18181B)] px-5 text-[14px] font-bold text-white no-underline transition-colors hover:bg-[var(--store-primary-dark,#09090B)]">Entrar</Link>
            </div>
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="store-layout full-bleed bg-white text-[var(--store-ink)]">
      <div className="mx-auto max-w-[560px] px-4 py-12 sm:px-6">
        <div className="mb-6 flex items-center gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--store-primary-soft,#F1F1F3)] text-[var(--store-primary,#18181B)]">
            <CheckCircle weight="fill" className="text-[30px]" />
          </span>
          <div>
            <h1 className="font-display text-[26px] font-extrabold leading-[1.1]">Pedido recebido</h1>
            <p className="mt-0.5 text-[14px] text-[var(--store-muted)]">
              {order.paid ? "Pagamento confirmado." : "Acompanhe o status do pagamento abaixo."}
            </p>
          </div>
        </div>

        <OrderStatusCard order={order} />

        {/* purchase / Purchase — só quando pago (ex.: cartão aprovado); dedupe por referenceId */}
        <DataLayerReady
          pageType={order.paid ? "purchase" : "other"}
          products={order.items.map((it) => ({ id: it.productId ?? it.variantId ?? it.title, name: it.title, price: it.price, quantity: it.quantity }))}
        />
        <PurchaseTracker
          transactionId={order.referenceId}
          paid={order.paid}
          value={parseBRL(order.total) ?? undefined}
          items={order.items.map((it) => ({
            id: it.productId ?? it.variantId ?? it.title,
            name: it.title,
            variant: it.variantTitle,
            price: it.price,
            quantity: it.quantity,
          }))}
          user={{ email: order.email, firstName: order.address?.fullName?.split(" ")[0], lastName: order.address?.fullName?.split(" ").slice(1).join(" ") || undefined }}
        />

        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link href="/produtos" className="font-display inline-flex h-12 items-center rounded-xl bg-[var(--store-primary,#18181B)] px-5 text-[14px] font-bold text-white no-underline transition-colors hover:bg-[var(--store-primary-dark,#09090B)]">Continuar comprando</Link>
          <Link href="/conta/pedidos" className="inline-flex h-12 items-center rounded-xl border-[1.5px] border-[var(--store-line-2)] bg-white px-5 text-[14px] font-bold text-[var(--store-ink-2)] no-underline transition-colors hover:border-[var(--store-primary,#18181B)] hover:text-[var(--store-primary,#18181B)]">Meus pedidos</Link>
        </div>
      </div>
    </div>
  );
}
