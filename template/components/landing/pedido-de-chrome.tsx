"use client";

// O PEDIDO DE CABEÇALHO E RODAPÉ DE UMA PÁGINA DO CÓDIGO (foundation 18; a declaração e o porquê estão em
// lib/chrome-das-paginas.ts).
//
// Este componente só MARCA o pedido, com as mesmas classes da casca da página avulsa (`.lp-sem-cabecalho`,
// `.lp-sem-rodape`), e quem esconde é o app/globals.css, por `body:has(...)`: o HTML já sai certo do servidor, sem JS
// e sem piscar. O pedido sai do documento do provider: o publicado na loja, o efetivo na versão de um público (que
// herda o que vale para todos os públicos) e o RASCUNHO na prévia do editor, onde o interruptor aparece na hora.
import { useEditableContext } from "@/lib/editable";

export function PedidoDeChrome({ container }: { container: string }) {
  const { doc } = useEditableContext();
  const estado = doc.sections[container];
  const classes = [estado?.ocultarCabecalho ? "lp-sem-cabecalho" : "", estado?.ocultarRodape ? "lp-sem-rodape" : ""].filter(Boolean).join(" ");
  return classes ? <span hidden className={classes} /> : null;
}
