import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Trocas e devoluções", alternates: { canonical: "/devolucoes" } };

export default function DevolucoesPage() {
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Trocas e devoluções</h1>

      <h2 className="mt-6 text-lg font-semibold">Direito de arrependimento (CDC, art. 49)</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Você pode desistir da compra em até <strong>7 dias corridos</strong> a partir do recebimento do
        produto. Nesse caso, devolvemos o valor pago, incluindo o frete.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Como solicitar</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Entre na sua conta, localize o pedido em <Link href="/conta/pedidos" className="text-primary underline">Meus pedidos</Link> e
        solicite o cancelamento/devolução, ou fale com nosso atendimento informando o código do pedido.
        O reembolso é processado pelo mesmo meio de pagamento (Pix ou cartão).
      </p>

      <p className="mt-3 text-xs text-muted-foreground">
        Observação: o cancelamento/reembolso total é tratado pela equipe da loja. Itens individuais de um
        pedido podem ser cancelados conforme disponibilidade.
      </p>

      <div className="mt-6 flex gap-2">
        <Button nativeButton={false} render={<Link href="/conta/pedidos" />}>Meus pedidos</Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/conta/entrar" />}>Acompanhar pedido</Button>
      </div>
    </article>
  );
}
