import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, Gear, CaretRight, ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";
import { getCustomerClient, lerDaConta } from "@/lib/customer-session";
import { AccountShell } from "@/components/account/account-shell";
import { getShopData } from "@/lib/queries";

export const metadata: Metadata = { title: "Minha conta", robots: { index: false } };

// Cards enxutos (Endereços saiu da navegação da conta; Assinaturas só com a política ligada, ver account-shell.tsx)
const CARDS = [
  { href: "/conta/pedidos", label: "Meus pedidos", desc: "Acompanhe status e rastreio", icon: Package },
  { href: "/conta/assinaturas", label: "Minhas assinaturas", desc: "Itens, endereço, cartão e próximas entregas", icon: ArrowsClockwise, soComPolitica: true },
  { href: "/conta/preferencias", label: "Preferências", desc: "Notificações e dados da conta", icon: Gear },
];

export default async function ContaPage() {
  const me = await getCustomerClient();
  if (!me) redirect("/conta/entrar");

  // a visão geral só usa a conta para a saudação: sem ela, cai no genérico, mas a falha fica no log
  const [leitura, shop] = await Promise.all([lerDaConta("/conta", me.me()), getShopData().catch(() => null)]);
  const cards = CARDS.filter((c) => !c.soComPolitica || shop?.recurringOrdersPolicy?.enabled);
  const account = leitura.ok ? leitura.valor : null;

  return (
    <AccountShell title="Minha conta">
      <p className="mb-6 text-[15px] text-[var(--store-ink-2)]">
        {account?.email ? <>Olá, <span className="font-bold text-[var(--store-ink)]">{account.email}</span>.</> : "Bem-vindo(a)."}
        {account?.isFirstAccess && " Este é o seu primeiro acesso, confira seus dados."}
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ href, label, desc, icon: Icon }) => (
          <Link key={href} href={href} className="group flex flex-col rounded-xl border border-[var(--store-line)] bg-white p-5 no-underline transition-all hover:-translate-y-0.5 hover:border-[var(--store-primary,#18181B)] hover:shadow-[0_10px_28px_rgba(24,24,27,.10)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--store-primary-soft,#F1F1F3)] text-[var(--store-primary,#18181B)]">
              <Icon weight="bold" className="text-[22px]" />
            </span>
            <div className="mt-3.5 font-display text-[16px] font-bold text-[var(--store-ink)]">{label}</div>
            <div className="mt-0.5 text-[13px] text-[var(--store-muted)]">{desc}</div>
            <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-[var(--store-primary,#18181B)]">
              Acessar <CaretRight weight="bold" className="text-[11px] transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </AccountShell>
  );
}
