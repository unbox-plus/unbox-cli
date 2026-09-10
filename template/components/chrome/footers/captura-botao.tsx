"use client";

// O BOTÃO da captura de e-mail do rodapé "conversão", isolado num componente de CLIENTE.
//
// POR QUE ELE EXISTE, e por que não pode voltar para dentro do conversao.tsx:
// `EditableSlot` é client e recebe os filhos como FUNÇÃO (render-prop) para devolver o mesmo
// elemento sem invólucro. O rodapé é Server Component, e função não atravessa a fronteira
// servidor→cliente: o build quebra com "Functions cannot be passed directly to Client Components".
// Como o rodapé vive no layout de `(loja)`, o erro derrubava o prerender de TODA página, não só do
// rodapé — e só no estilo promocional, que é o único preset que usa este rodapé por padrão.
import { EditableSlot } from "@/lib/editable";

export function CapturaBotao({ label = "QUERO" }: { label?: string }) {
  return (
    <EditableSlot path="captura.botao" type="text" fallback={label} label="Texto do botão da captura">
      {(v, attrs, ref) => (
        <button
          ref={ref as React.Ref<HTMLButtonElement>}
          {...attrs}
          type="submit"
          className="font-display h-11 shrink-0 rounded-full bg-[var(--store-cta,#D97706)] px-6 text-[14px] font-extrabold tracking-[0.5px] text-[var(--store-cta-fg,#1C1207)] transition-opacity hover:opacity-90"
        >
          {v}
        </button>
      )}
    </EditableSlot>
  );
}
