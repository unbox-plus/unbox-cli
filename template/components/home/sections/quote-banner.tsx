"use client";

// Faixa full-width com foto + citação grande (na loja de referência: depoimento da fundadora).
// Conteúdo via receita; default neutro assinado pela própria loja (nunca invente
// depoimento de terceiro).
import type { SectionComponentProps } from "./registry";
import { Foto } from "@/components/ui/foto";

export function QuoteBannerSection({ sectionProps = {} }: SectionComponentProps) {
  const {
    quote = "A gente montou essa loja do jeito que gostaria de comprar: produto honesto, entrega cuidada e zero enrolação.",
    author = "Time da loja",
    role = "",
    image = "/brand/ph/photo-b.svg",
  } = sectionProps as Record<string, string>;
  return (
    <div className="reveal mt-[52px] bg-[var(--store-chrome-bg,#18181B)]">
      <div className="mx-auto grid max-w-[var(--container-max,1240px)] items-stretch md:grid-cols-[44fr_56fr]">
        {/* TODO: trocar por foto real (fundador/bastidor/produto) */}
        <Foto src={image} width={1240} height={840} sizes="(min-width: 768px) 50vw, 100vw" className="h-full max-h-[420px] w-full object-cover md:max-h-none" />
        <div className="flex flex-col justify-center gap-5 px-6 py-10 sm:px-10 sm:py-14">
          <p className="font-display text-[22px] font-bold leading-[1.35] text-[var(--store-chrome-text,#ffffff)] sm:text-[26px]">“{quote}”</p>
          <div className="text-[14px] text-[var(--store-chrome-muted)]">
            <span className="font-bold text-[var(--store-chrome-text,#ffffff)]">{author}</span>
            {role ? ` · ${role}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
