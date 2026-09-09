"use client";

// Benefícios em grid 2+foto+2 (lista esquerda / imagem central / lista direita).
// Portado de uma loja Unbox real em produção e genericizado. Conteúdo via receita; defaults
// neutros SEM claims inventados (nada de estatística ou promessa de resultado fake).
import type { SectionComponentProps } from "./registry";
import { Foto } from "@/components/ui/foto";

type Benefit = { title: string; text: string };

const DEFAULT_LEFT: Benefit[] = [
  { title: "Seleção com critério", text: "Cada item do catálogo passa por curadoria de verdade antes de entrar na loja." },
  { title: "Qualidade que se percebe", text: "Materiais escolhidos pra durar e entregar o que prometem." },
];
const DEFAULT_RIGHT: Benefit[] = [
  { title: "Entrega bem cuidada", text: "Embalagem pensada pra chegar inteiro, bonito e pronto pra usar." },
  { title: "Suporte de gente", text: "Ficou com dúvida? A gente responde rápido e resolve junto." },
];

export function BenefitsSection({ sectionProps = {} }: SectionComponentProps) {
  const {
    title = "Por que escolher a gente",
    subtitle = "O essencial, bem feito, do jeito que você espera.",
    image = "/brand/ph/photo-a.svg",
  } = sectionProps as Record<string, string>;
  const left = (sectionProps.left as Benefit[] | undefined) ?? DEFAULT_LEFT;
  const right = (sectionProps.right as Benefit[] | undefined) ?? DEFAULT_RIGHT;

  const Item = ({ b }: { b: Benefit }) => (
    <div>
      <div className="font-display text-[17px] font-bold text-[var(--store-primary,#18181B)]">{b.title}</div>
      <p className="mt-1.5 text-[14px] leading-[1.55] text-[var(--store-muted)]">{b.text}</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[var(--section-gap,52px)] sm:px-6">
      <div className="mx-auto max-w-[620px] text-center">
        <h2 className="font-display text-[28px] font-extrabold leading-[1.15]">{title}</h2>
        <p className="mt-2 text-[15px] text-[var(--store-muted)]">{subtitle}</p>
      </div>
      <div className="mt-9 grid items-center gap-8 md:grid-cols-[1fr_minmax(240px,340px)_1fr]">
        <div className="flex flex-col gap-7">{left.map((b) => <Item key={b.title} b={b} />)}</div>
        {/* TODO: trocar por foto real do produto/marca (o agente de branding cuida disso) */}
        <Foto src={image} width={680} height={680} sizes="340px" className="mx-auto w-full max-w-[340px] rounded-2xl object-cover" />
        <div className="flex flex-col gap-7">{right.map((b) => <Item key={b.title} b={b} />)}</div>
      </div>
    </div>
  );
}
