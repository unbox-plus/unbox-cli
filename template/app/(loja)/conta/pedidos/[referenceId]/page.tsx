import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { getCustomerClient } from "@/lib/customer-session";
import { getOwnedOrder } from "@/lib/orders";
import { AccountShell } from "@/components/account/account-shell";
import { OrderStatusCard } from "@/components/order-status";
import { EmptyState } from "@/components/empty-state";
import { ReorderButton, type ReorderItem } from "@/components/account/reorder-button";
import { mockupOr } from "@/lib/mockup";

export const metadata: Metadata = { title: "Detalhe do pedido", robots: { index: false } };

export default async function PedidoDetalhePage({ params }: { params: Promise<{ referenceId: string }> }) {
  const me = await getCustomerClient();
  if (!me) redirect("/conta/entrar");
  const { referenceId } = await params;
  const order = await mockupOr(getOwnedOrder(referenceId), null, "pedido/getOwnedOrder");

  return (
    <AccountShell title={`Pedido #${referenceId}`}>
      {!order ? (
        <EmptyState title="Pedido não encontrado" />
      ) : (
        <>
          <OrderStatusCard order={order} />
          <div className="mt-4 flex flex-wrap gap-2.5">
            <ReorderButton
              items={order.items
                .filter((it) => it.productId && it.variantId && it.price != null)
                .map((it): ReorderItem => ({
                  productId: it.productId!,
                  variantId: it.variantId!,
                  price: it.price!,
                  quantity: it.quantity,
                  title: it.title,
                  thumbnail: it.thumbnail,
                }))}
            />
            <Link href="/conta/pedidos" className="inline-flex h-11 items-center gap-2 rounded-xl border-[1.5px] border-[var(--store-line-2)] bg-white px-4 text-[14px] font-bold text-[var(--store-ink-2)] no-underline transition-colors hover:border-[var(--store-primary,#18181B)] hover:text-[var(--store-primary,#18181B)]">
              <ArrowLeft weight="bold" /> Voltar aos pedidos
            </Link>
          </div>
        </>
      )}
    </AccountShell>
  );
}
