"use client";

// Barra de navegação inferior (mobile). Flutua acima do conteúdo,
// oculta no checkout (.site-chrome). O <body> recebe padding-bottom no mobile (globals.css).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, SquaresFour, Tag, User } from "@phosphor-icons/react/dist/ssr";

const ITEMS = [
  { href: "/", label: "Início", icon: House, match: (p: string) => p === "/" },
  { href: "/produtos", label: "Categorias", icon: SquaresFour, match: (p: string) => p.startsWith("/produtos") || p.startsWith("/categoria") },
  { href: "/produtos", label: "Ofertas", icon: Tag, match: () => false },
  { href: "/conta", label: "Conta", icon: User, match: (p: string) => p.startsWith("/conta") },
];

export function MobileBottomNav() {
  const pathname = usePathname() || "/";

  return (
    <nav className="site-chrome fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden" aria-label="Navegação">
      <div className="mx-auto flex max-w-[460px] items-stretch justify-around gap-1.5 rounded-2xl border border-[var(--store-line)] bg-white p-1.5 shadow-[var(--store-shadow-card-lg)]">
        {ITEMS.map(({ href, label, icon: Icon, match }, i) => {
          const active = match(pathname);
          return (
            <Link
              key={i}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 no-underline transition-colors"
              style={{
                background: active ? "var(--store-primary,#18181B)" : "transparent",
                color: active ? "#FFFFFF" : "var(--store-ink-2)",
                boxShadow: active ? "var(--store-shadow-glow)" : "none",
              }}
            >
              <Icon weight={active ? "fill" : "bold"} className="text-[22px]" />
              <span className="font-display text-[11px] font-bold not-italic tracking-[0.2px]">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
