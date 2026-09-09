import { Package } from "@phosphor-icons/react/dist/ssr";

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--store-line-2)] bg-[var(--store-surface)] px-6 py-16 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--store-primary-soft,#F1F1F3)] text-[var(--store-primary,#18181B)]">
        <Package weight="duotone" className="text-[34px]" />
      </span>
      <h2 className="font-display text-[18px] font-extrabold text-[var(--store-ink)]">{title}</h2>
      {description && <p className="mt-1.5 max-w-sm text-[14px] leading-[1.5] text-[var(--store-muted)]">{description}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
