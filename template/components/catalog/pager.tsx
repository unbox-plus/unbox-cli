import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";

// Paginador por offset (server component). hrefForPage é chamado no servidor (não serializado).
export function Pager({
  page,
  totalPages,
  hrefForPage,
}: {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const pages = pageWindow(page, totalPages);

  const arrow = "flex h-10 items-center gap-1.5 rounded-xl border-[1.5px] border-[var(--store-line-2)] bg-white px-3.5 text-[13.5px] font-bold text-[var(--store-ink-2)] no-underline transition-colors hover:border-[var(--store-primary,#18181B)] hover:text-[var(--store-primary,#18181B)]";
  const disabled = "flex h-10 items-center gap-1.5 rounded-xl border-[1.5px] border-[var(--store-surface-2)] bg-[var(--store-surface)] px-3.5 text-[13.5px] font-bold text-[var(--store-faint)]";

  return (
    <nav className="mt-9 flex items-center justify-center gap-2" aria-label="Paginação">
      {page > 1 ? (
        <Link href={hrefForPage(page - 1)} className={arrow}><CaretLeft weight="bold" /> Anterior</Link>
      ) : (
        <span className={disabled} aria-disabled><CaretLeft weight="bold" /> Anterior</span>
      )}

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-[var(--store-faint)]">…</span>
        ) : (
          <Link
            key={p}
            href={hrefForPage(p as number)}
            aria-current={p === page ? "page" : undefined}
            className="flex h-10 w-10 items-center justify-center rounded-xl border-[1.5px] text-[14px] font-bold no-underline transition-colors"
            style={
              p === page
                ? { background: "var(--store-primary,#18181B)", borderColor: "var(--store-primary,#18181B)", color: "var(--store-surface)" }
                : { background: "var(--store-surface)", borderColor: "var(--store-line-2)", color: "var(--store-ink-2)" }
            }
          >
            {p}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link href={hrefForPage(page + 1)} className={arrow}>Próxima <CaretRight weight="bold" /></Link>
      ) : (
        <span className={disabled} aria-disabled>Próxima <CaretRight weight="bold" /></span>
      )}
    </nav>
  );
}

function pageWindow(page: number, total: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  const add = (n: number) => out.push(n);
  const range = 1;
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || (p >= page - range && p <= page + range)) add(p);
    else if (out[out.length - 1] !== "…") out.push("…");
  }
  return out;
}
