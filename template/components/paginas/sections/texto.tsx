"use client";

// ═══════════════════════════════════════════════════════════════════════════
// TEXTO: a seção que faz um artigo existir.
//
// Parágrafo, negrito, itálico, link, lista, subtítulo e citação: é o que separa um artigo de uma
// sequência de blocos. `Editable.Text multiline` não serve (só quebra linha) e o bloco de HTML exige
// HTML na mão, que não é o que alguém faz para escrever um texto.
//
// O PRIMITIVO É QUEM DECIDE O QUE ENTRA. `Editable.RichText` (lib/editable/primitives.tsx) roda a
// lista FECHADA de tags antes de injetar, e é a única das três camadas que existe na prévia. A
// aparência (espaçamento de parágrafo, lista, citação, link) é do CSS de `.texto-rico`, em
// app/globals.css: o primitivo não traz estilo nenhum.
//
// AS CLASSES VÃO NO PRIMITIVO, não num invólucro em volta. Texto vazio não renderiza nada em
// produção (nem invólucro), e um `<div>` com respiro vertical por fora continuaria na página abrindo
// uma faixa branca no meio do artigo enquanto o lojista não escrevesse. O `<div className="w-full">`
// de fora existe por outro motivo: o fundo de seção do editor pinta o primeiro filho do invólucro da
// seção, que é `display: contents`, e sem um filho de largura cheia o fundo escolhido pararia na
// largura da coluna.
//
// A COLUNA É ESTREITA de propósito: linha longa demais cansa quem lê, e este é o único bloco da loja
// feito para leitura corrida.
// ═══════════════════════════════════════════════════════════════════════════
import { Editable } from "@/lib/editable";

/** Não recebe props: o conteúdo é do documento, não da receita. */
export function TextoSection() {
  return (
    <div className="w-full">
      <Editable.RichText
        path="corpo"
        label="Texto"
        className="mx-auto max-w-[720px] px-4 py-5 text-[16.5px] leading-[1.75] text-[var(--store-ink)] sm:px-6"
      />
    </div>
  );
}
