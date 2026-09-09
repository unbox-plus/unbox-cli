"use client";

// TRUST BAR clara — selos de confiança logo abaixo do hero. Os itens vêm da RECEITA
// (props.items: [{ icon?, text }]); o selo de frete grátis entra sozinho quando a loja tem a
// regra real (store-config). Sem itens e sem frete grátis, a seção não renderiza: "Entrega
// rápida para todo o Brasil" e "Satisfação garantida" são promessas do lojista, não da foundation.
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Truck, Lightning, LockSimple, SealCheck, Package, Heart, Clock, Shield, CreditCard, ChatCircle } from "@phosphor-icons/react/dist/ssr";
import type { SectionComponentProps } from "./registry";

export const TRUST_ICONS: Record<string, PhosphorIcon> = {
  truck: Truck, lightning: Lightning, lock: LockSimple, seal: SealCheck, package: Package,
  heart: Heart, clock: Clock, shield: Shield, card: CreditCard, chat: ChatCircle,
};
export type TrustItem = { icon?: string; text: string };

export function TrustBarSection({ data, sectionProps = {} }: SectionComponentProps) {
  const custom = (sectionProps.items as TrustItem[] | undefined) ?? [];
  const items: { icon: PhosphorIcon; text: string }[] = [
    ...(data.freeShipLabel ? [{ icon: Truck, text: `Frete Grátis acima de ${data.freeShipLabel}` }] : []),
    ...custom.filter((t) => t?.text).map((t) => ({ icon: (t.icon && TRUST_ICONS[t.icon]) || SealCheck, text: t.text })),
  ];
  if (items.length === 0) return null;
  const cols = items.length >= 4 ? "md:grid-cols-4" : items.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";
  return (
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[18px] sm:px-6">
      <div className={`grid grid-cols-2 store-card rounded-2xl ${cols}`}>
        {items.map((t, i) => (
          <div key={i} className="flex items-center gap-3 px-[22px] py-[18px]" style={{ borderRight: i < items.length - 1 ? "1px solid var(--store-surface-2)" : "none" }}>
            <t.icon weight="fill" className="shrink-0 text-[25px] text-[var(--store-primary,#18181B)]" />
            <div className="text-[13px] font-semibold leading-[1.35] text-[var(--store-ink-2)]">{t.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
