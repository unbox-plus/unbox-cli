"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

export function SearchBox({ defaultValue = "", className }: { defaultValue?: string; className?: string }) {
  const router = useRouter();
  const [q, setQ] = React.useState(defaultValue);
  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        router.push(term ? `/busca?q=${encodeURIComponent(term)}` : "/produtos");
      }}
    >
      <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-[var(--store-line-2)] bg-white px-3.5 transition-colors focus-within:border-[var(--store-primary,#18181B)]">
        <MagnifyingGlass weight="bold" className="shrink-0 text-[19px] text-[var(--store-muted)]" />
        <input
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar produtos..."
          aria-label="Buscar produtos"
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[var(--store-ink)] outline-none placeholder:text-[var(--store-faint)]"
        />
        <button type="submit" className="font-display shrink-0 cursor-pointer rounded-lg bg-[var(--store-primary,#18181B)] px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[var(--store-primary-dark,#09090B)]">
          Buscar
        </button>
      </div>
    </form>
  );
}
