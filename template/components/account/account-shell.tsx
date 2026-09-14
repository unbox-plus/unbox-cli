import Link from "next/link";
import { House, Package, Gear, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { SignOutButton } from "@/components/account/signout-button";

// Menu enxuto por decisão de produto: Assinaturas e Endereços saíram da navegação
// (as rotas /conta/assinaturas e /conta/enderecos continuam existindo pra deep links,
// ex.: e-mail de assinatura). Pra reexibir, basta recolocar os itens aqui.
const NAV = [
  { href: "/conta", label: "Visão geral", icon: House },
  { href: "/conta/pedidos", label: "Pedidos", icon: Package },
  { href: "/conta/preferencias", label: "Preferências", icon: Gear },
];

export function AccountShell({
  title,
  /** Ao lado do título: o selo do pedido, na página do pedido. */
  aoLado,
  children,
}: {
  title: string;
  aoLado?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="store-layout full-bleed bg-white text-[var(--store-ink)]">
      <div className="mx-auto max-w-[1240px] px-4 py-7 sm:px-6">
        {/* breadcrumb */}
        <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--store-muted)]">
          <Link href="/" className="no-underline hover:text-[var(--store-ink)]">Início</Link>
          <CaretRight className="text-[11px]" />
          <span className="font-semibold text-[var(--store-ink)]">Minha conta</span>
        </div>

        <div className="mt-6 grid items-start gap-7 md:grid-cols-[248px_1fr]">
          {/* No celular o menu vem DEPOIS do conteúdo: quem abre um pedido quer ver o pedido, não a
              navegação. A partir de md volta a ser a coluna da esquerda. */}
          <aside className="order-2 h-fit rounded-xl border border-[var(--store-line)] bg-white p-3 md:order-1 md:sticky md:top-6">
            <nav className="flex flex-col gap-1">
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[14px] font-semibold text-[var(--store-ink-2)] no-underline transition-colors hover:bg-[var(--store-primary-soft,#F1F1F3)] hover:text-[var(--store-primary,#18181B)]">
                  <Icon weight="bold" className="text-[18px] text-[var(--store-primary,#18181B)]" /> {label}
                </Link>
              ))}
              <div className="mt-1.5 border-t border-[var(--store-surface-2)] pt-1.5">
                <SignOutButton />
              </div>
            </nav>
          </aside>

          <section className="order-1 min-w-0 md:order-2">
            <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="font-display">{title}</h1>
              {aoLado}
            </div>
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}
