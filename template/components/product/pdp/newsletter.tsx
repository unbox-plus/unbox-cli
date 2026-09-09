"use client";

import * as React from "react";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
// EDITOR: módulo de cliente ("use client"): aqui o namespace `Editable.*` é a forma de uso (README §4).
import { Editable } from "@/lib/editable";

// EDITOR: o título vem em três caixas (uma por trecho da composição, como a home faz com o título por
// linha), porque o destaque sublinhado e a quebra são tipografia que o primitivo não deve engolir num
// `multiline` só. Campo, placeholder e a mensagem de confirmação são interface do formulário e ficam
// fora (README do editor, §8); o texto do botão é copy e vai por `Slot`, porque o <button> é filho
// direto de um flex e precisa continuar sendo o MESMO elemento, com type="submit".
export function Newsletter() {
  const [email, setEmail] = React.useState("");
  const [done, setDone] = React.useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/.+@.+\..+/.test(email)) return;
    setDone(true);
  }

  return (
    <div className="relative flex min-h-[120px] items-center gap-7 overflow-hidden rounded-xl bg-[var(--store-cta,#D97706)] py-6 pl-10 max-md:flex-col max-md:items-stretch max-md:gap-4 max-md:p-6">
      <div className="shrink-0">
        {/* TODO: personalize a oferta de boas-vindas da newsletter */}
        <div className="font-display text-[23px] font-extrabold leading-tight text-[var(--store-cta-fg,#1C1207)]">
          <Editable.Text path="titulo.1" fallback="Cadastre-se e receba" label="Título (parte 1)" />{" "}
          <Editable.Text path="titulo.2" fallback="ofertas exclusivas" label="Título (destaque sublinhado)" className="underline decoration-2 underline-offset-2" />
          <br />
          <Editable.Text path="titulo.3" fallback="e novidades da loja!" label="Título (parte 3)" />
        </div>
      </div>
      {done ? (
        <div className="flex flex-1 items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-bold text-[var(--store-primary,#18181B)] max-md:justify-center md:max-w-[480px]">
          <CheckCircle weight="fill" className="text-xl" /> Pronto! Seu cupom chega no e-mail.
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-1 items-center rounded-full bg-white p-1.5 md:max-w-[480px]">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Seu melhor e-mail"
            className="h-11 min-w-0 flex-1 border-none bg-transparent px-5 text-[15px] text-[var(--store-ink)] outline-none"
          />
          <Editable.Slot path="botao" type="text" fallback="EU QUERO!" label="Texto do botão">
            {(v, attrs, ref, estilo) => (
              <button
                ref={ref}
                {...attrs}
                type="submit"
                className="font-display h-11 shrink-0 cursor-pointer whitespace-nowrap border-none bg-transparent px-[22px] text-[15px] font-extrabold tracking-[0.5px] text-[var(--store-ink)]"
                style={estilo}
              >
                {v}
              </button>
            )}
          </Editable.Slot>
        </form>
      )}
    </div>
  );
}
