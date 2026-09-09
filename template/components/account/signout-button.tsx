"use client";

import { SignOut } from "@phosphor-icons/react/dist/ssr";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/account/signout", { method: "POST" });
        // Documento inteiro (não router.push): garante que nenhum payload RSC logado
        // sobreviva ao fim da sessão — mesma classe de bug do pós-login.
        window.location.assign("/");
      }}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[14px] font-semibold text-[var(--store-muted)] transition-colors hover:bg-[var(--store-sale-soft)] hover:text-[var(--store-sale)]"
    >
      <SignOut weight="bold" className="text-[18px]" /> Sair
    </button>
  );
}
