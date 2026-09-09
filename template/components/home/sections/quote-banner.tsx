"use client";

// Faixa full-width com foto + citação grande (na loja de referência: depoimento da fundadora).
// Conteúdo via receita; default neutro assinado pela própria loja (nunca invente
// depoimento de terceiro).
//
// EDITOR: foto, citação, autor e cargo (quando a receita traz) são caminhos da seção. A citação é
// um `Editable.Slot`: as aspas curvas ficam no render, fora do valor, para o lojista não ter de
// digitá-las (e não perdê-las) ao trocar a frase. A foto continua passando pelo `Foto` (otimizador
// do Next): o `Editable.Slot` só lhe entrega o src/alt do lojista e os atributos de seleção.
import { Editable } from "@/lib/editable";
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
        <Editable.Slot path="imagem" type="image" fallback={{ src: image, alt: "" }} label="Foto">
          {(v, attrs, ref) => <Foto ref={ref} attrs={attrs} src={v.src} alt={v.alt ?? ""} width={1240} height={840} sizes="(min-width: 768px) 50vw, 100vw" className="h-full max-h-[420px] w-full object-cover md:max-h-none" />}
        </Editable.Slot>
        <div className="flex flex-col justify-center gap-5 px-6 py-10 sm:px-10 sm:py-14">
          <Editable.Slot path="citacao" type="text" fallback={quote} label="Citação">
            {(v, attrs, ref, estilo) => (
              <p ref={ref} className="font-display text-[22px] font-bold leading-[1.35] text-[var(--store-chrome-text,#ffffff)] sm:text-[26px]" style={estilo} {...attrs}>
                “{v}”
              </p>
            )}
          </Editable.Slot>
          <div className="text-[14px] text-[var(--store-chrome-muted)]">
            <Editable.Text path="autor" fallback={author} label="Quem assina a citação" className="font-bold text-[var(--store-chrome-text,#ffffff)]" />
            {role ? (
              <>
                {" · "}
                <Editable.Text path="cargo" fallback={role} label="Cargo de quem assina" />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
