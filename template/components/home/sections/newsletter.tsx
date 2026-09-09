"use client";

// NEWSLETTER — variantes: "bloco" (bloco CTA chamativo, default) e "inline" (linha fina
// discreta). Renderiza SÓ com `title` e `action` na receita: o título é a promessa do lojista
// ("receba ofertas exclusivas" é dele, não da foundation) e `action` é a URL que recebe o
// e-mail (endpoint do CRM/ESP). Sem `action`, um formulário que descarta o e-mail é mentira.
// O form é POST de verdade (campo `email`), sem preventDefault.
//
// EDITOR: o título e o texto do botão são copy (caminhos `titulo` e `botao`); campo e placeholder do
// formulário são INTERFACE, e a `action` é configuração: ficam fora do editor (README §8). O botão é
// um `Editable.Slot`: ele é filho direto de um flex e precisa manter type="submit"; o Slot devolve o
// MESMO elemento, sem invólucro.
import { Editable } from "@/lib/editable";
import type { SectionComponentProps } from "./registry";

export function NewsletterSection({ variant = "bloco", sectionProps = {} }: SectionComponentProps) {
  const { title = "", action = "", buttonLabel = "Quero receber", placeholder = "Seu melhor e-mail" } = sectionProps as Record<string, string>;
  if (!title || !action) return null;

  if (variant === "inline") {
    return (
      <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pb-12 pt-8 sm:px-6">
        <div className="flex flex-wrap items-center gap-5 store-card rounded-xl px-6 py-5">
          <Editable.Text as="div" path="titulo" fallback={title} label="Título" className="font-display flex-1 text-[16px] font-bold leading-[1.3] text-[var(--store-ink)]" />
          <form method="post" action={action} className="flex w-full max-w-[420px] items-center gap-1.5 rounded-full border border-[var(--store-line-2)] bg-[var(--store-surface)] p-1">
            <input type="email" name="email" required placeholder={placeholder} className="h-10 min-w-0 flex-1 rounded-full bg-transparent px-4 text-sm outline-none" />
            <Editable.Slot path="botao" type="text" fallback={buttonLabel} label="Texto do botão">
              {(v, attrs, ref, estilo) => (
                <button ref={ref} {...attrs} type="submit" className="font-display h-10 shrink-0 rounded-full bg-[var(--store-primary,#18181B)] px-5 text-[13px] font-extrabold text-white transition-colors hover:bg-[var(--store-primary-hover,#3F3F46)]" style={estilo}>
                  {v}
                </button>
              )}
            </Editable.Slot>
          </form>
        </div>
      </div>
    );
  }

  // bloco (default)
  return (
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pb-12 pt-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-7 rounded-xl bg-[var(--store-cta,#D97706)] px-8 py-7">
        <Editable.Text as="div" path="titulo" fallback={title} label="Título" multiline className="font-display flex-1 text-[20px] font-extrabold leading-[1.25] text-[var(--store-cta-fg,#1C1207)] sm:text-[23px]" />
        <form method="post" action={action} className="flex w-full max-w-[480px] items-center gap-1.5 rounded-full bg-white p-1.5">
          <input type="email" name="email" required placeholder={placeholder} className="h-11 min-w-0 flex-1 rounded-full bg-transparent px-4 text-sm outline-none" />
          <Editable.Slot path="botao" type="text" fallback={buttonLabel} label="Texto do botão">
            {(v, attrs, ref, estilo) => (
              <button ref={ref} {...attrs} type="submit" className="font-display h-11 shrink-0 rounded-full bg-[var(--store-chrome-bg,#18181B)] px-6 text-[14px] font-extrabold tracking-[0.5px] text-[var(--store-chrome-text,#ffffff)] transition-opacity hover:opacity-90" style={estilo}>
                {v}
              </button>
            )}
          </Editable.Slot>
        </form>
      </div>
    </div>
  );
}
