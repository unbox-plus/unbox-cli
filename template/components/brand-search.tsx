"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

export function BrandSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  return (
    <form
      role="search"
      className={`flex h-[50px] items-center overflow-hidden rounded-full border border-[var(--store-line-2)] bg-[var(--store-surface)] pl-1 ${className ?? ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        router.push(term ? `/busca?q=${encodeURIComponent(term)}` : "/produtos");
      }}
    >
      <input
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar produtos..."
        aria-label="Buscar produtos"
        className="min-w-0 flex-1 border-none bg-transparent px-4 text-[15px] text-[var(--store-ink)] outline-none"
      />
      <button type="submit" aria-label="Buscar" className="flex h-[50px] w-[62px] shrink-0 items-center justify-center rounded-full bg-[var(--store-primary,#18181B)] text-white transition-colors hover:bg-[var(--store-primary-dark,#09090B)]">
        <MagnifyingGlass weight="bold" className="text-[19px]" />
      </button>
    </form>
  );
}
