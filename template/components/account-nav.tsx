"use client";

// Link de conta no header. Mantém o layout estático (ISR): busca o nome do cliente no client.
// Logado → primeiro nome com uma pimentinha; senão → "Entrar".
import * as React from "react";
import Link from "next/link";
import { User, UserCircle } from "@phosphor-icons/react/dist/ssr";

export function AccountNav({
  /** "ink" = sobre fundo claro (padrão). "chrome" = sobre a cor de chrome (header sobreposto). */
  tone = "ink",
  /** Só o ícone, sem o rótulo — pra headers que alinham 3 ações em ícone. */
  iconOnly = false,
}: { tone?: "ink" | "chrome"; iconOnly?: boolean } = {}) {
  const cor = tone === "chrome" ? "text-[var(--store-chrome-text,#ffffff)]" : "text-[var(--store-ink)]";
  const [firstName, setFirstName] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/account/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.firstName) setFirstName(d.firstName); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (firstName) {
    return (
      <Link href="/conta" aria-label={`Conta de ${firstName}`} className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 text-[15px] font-semibold ${cor}`}>
        <UserCircle weight="fill" className={tone === "chrome" ? "text-[22px]" : "text-[22px] text-[var(--store-primary,#18181B)]"} />
        {!iconOnly && firstName}
      </Link>
    );
  }
  return (
    <Link href="/conta" aria-label="Entrar na minha conta" className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 text-[15px] font-medium ${cor}`}>
      <User className="text-[22px]" />
      {!iconOnly && "Entrar"}
    </Link>
  );
}
