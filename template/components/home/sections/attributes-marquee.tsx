"use client";

// Marquee infinito de atributos da marca (artesanal, feito no Brasil, edição limitada...).
// Portado de uma loja Unbox real em produção e genericizado: itens via receita
// (props.items: [{ label, icon?, slashed? }]). Sem itens, não renderiza.
// Ícones por nome (mapa abaixo) pra receita ser serializável.
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Leaf, Drop, Cube, Bread, Heart, Sparkle, ShieldCheck, Star } from "@phosphor-icons/react/dist/ssr";
import type { SectionComponentProps } from "./registry";

const ICONS: Record<string, PhosphorIcon> = {
  leaf: Leaf, drop: Drop, cube: Cube, bread: Bread,
  heart: Heart, sparkle: Sparkle, shield: ShieldCheck, star: Star,
};

type Attribute = { label: string; icon?: string; text?: string; slashed?: boolean };


function IconBadge({ item }: { item: Attribute }) {
  const Icon = item.icon ? ICONS[item.icon] : undefined;
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--store-primary,#18181B)]/70 text-[var(--store-primary,#18181B)]">
      {Icon ? <Icon weight="bold" className="text-[18px]" /> : <span className="text-[9px] font-extrabold">{(item.text ?? item.label).slice(0, 3).toUpperCase()}</span>}
      {item.slashed && (
        <span className="pointer-events-none absolute left-[-2px] right-[-2px] top-1/2 h-[2px] -translate-y-1/2 rotate-45 bg-[var(--store-primary,#18181B)]/70" />
      )}
    </span>
  );
}

// Cada item carrega a própria margem à direita (em vez de gap no pai): a largura de um "set"
// já inclui o espaço até o próximo e a duplicata encaixa exata com translateX(-50%).
function BadgeRow({ items }: { items: Attribute[] }) {
  return (
    <>
      {items.map((a) => (
        <span key={a.label} className="mr-6 flex shrink-0 items-center gap-3">
          <IconBadge item={a} />
          <span className="rounded-full bg-[var(--store-primary-soft,#F1F1F3)]/70 px-4 py-2 text-[13px] font-semibold text-[var(--store-primary,#18181B)]">{a.label}</span>
        </span>
      ))}
    </>
  );
}

export function AttributesMarqueeSection({ sectionProps = {} }: SectionComponentProps) {
  const items = ((sectionProps.items as Attribute[] | undefined) ?? []).filter((a) => a?.label);
  if (items.length === 0) return null;
  return (
    // Dentro do container (--container-max), como as demais seções: uma faixa que sangrava
    // de ponta a ponta enquanto hero e trust-bar ficam recuados lê como erro de layout.
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[18px] sm:px-6">
      <div className="overflow-hidden rounded-2xl border border-[var(--store-primary,#18181B)]/10 bg-[var(--store-surface)] py-3">
        {/* 4 cópias, não 2: com frases curtas, duas cópias dão ~700px por metade e a partir de
            ~1400px de viewport abria um vão antes do loop fechar. A animação anda -50% (duas
            cópias) em 44s — o dobro do tempo de antes, para a velocidade não mudar. */}
        <div className="flex w-max animate-marquee [animation-duration:44s]">
          <div className="flex shrink-0 items-center"><BadgeRow items={items} /></div>
          <div className="flex shrink-0 items-center" aria-hidden="true"><BadgeRow items={items} /></div>
          <div className="flex shrink-0 items-center" aria-hidden="true"><BadgeRow items={items} /></div>
          <div className="flex shrink-0 items-center" aria-hidden="true"><BadgeRow items={items} /></div>
        </div>
      </div>
    </div>
  );
}
