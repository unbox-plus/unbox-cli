"use client";

// Grid de destaques com imagem circular + texto (na loja de referência: estatísticas de eficácia).
// ⚠️ NÚMERO SÓ COM DADO REAL: os defaults são qualitativos de propósito. Se a marca tiver
// pesquisa/estatística de verdade, a receita passa `stats` com os valores reais e a fonte.
import type { SectionComponentProps } from "./registry";
import { Foto } from "@/components/ui/foto";

type Stat = { value?: string; text: string; image?: string; source?: string };

const DEFAULT_STATS: Stat[] = [
  { text: "Clientes que voltam pra segunda compra", image: "/brand/ph/avatar-a.svg" },
  { text: "Entrega acompanhada do pedido à porta", image: "/brand/ph/avatar-b.svg" },
  { text: "Troca simples se algo não ficar certo", image: "/brand/ph/avatar-c.svg" },
  { text: "Atendimento que responde de verdade", image: "/brand/ph/avatar-d.svg" },
];

export function StatsGridSection({ sectionProps = {} }: SectionComponentProps) {
  const { title = "O que sustenta a nossa promessa" } = sectionProps as Record<string, string>;
  const stats = (sectionProps.stats as Stat[] | undefined) ?? DEFAULT_STATS;
  return (
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[var(--section-gap,52px)] sm:px-6">
      <h2 className="font-display mx-auto max-w-[560px] text-center text-[28px] font-extrabold leading-[1.15]">{title}</h2>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-4 store-card rounded-2xl px-5 py-7 text-center">
            {s.image && <Foto src={s.image} width={160} height={160} sizes="80px" className="h-20 w-20 rounded-full object-cover" />}
            {s.value && <div className="font-display text-[34px] font-extrabold leading-none text-[var(--store-primary,#18181B)]">{s.value}</div>}
            <p className="text-[14px] font-medium leading-[1.5] text-[var(--store-ink-2)]">{s.text}</p>
            {s.source && <div className="text-[11px] text-[var(--store-faint)]">{s.source}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
