"use client";

// TRUST STRIP escura — faixa de diferenciais sobre o chrome da marca. Itens SÓ via receita
// (props.items: [{ icon?, text }], ícones em TRUST_ICONS). Sem itens, não renderiza.
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { SealCheck } from "@phosphor-icons/react/dist/ssr";
import type { SectionComponentProps } from "./registry";
import { TRUST_ICONS, type TrustItem } from "./trust-bar";

export function TrustStripSection({ sectionProps = {} }: SectionComponentProps) {
  const items = ((sectionProps.items as TrustItem[] | undefined) ?? []).filter((t) => t?.text);
  if (items.length === 0) return null;
  const cols = items.length >= 4 ? "lg:grid-cols-4" : items.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";
  return (
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-10 sm:px-6">
      <div className={`grid grid-cols-1 rounded-xl bg-[var(--store-chrome-bg,#18181B)] sm:grid-cols-2 ${cols}`}>
        {items.map((t, i) => {
          const Icon: PhosphorIcon = (t.icon && TRUST_ICONS[t.icon]) || SealCheck;
          return (
            <div key={i} className="flex items-center gap-3.5 px-[26px] py-6">
              <Icon weight="fill" className="shrink-0 text-[30px] text-[var(--store-cta,#D97706)]" />
              <div className="text-[13px] font-medium leading-[1.4] text-[var(--store-chrome-muted)]">{t.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
