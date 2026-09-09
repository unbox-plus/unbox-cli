// AS PERGUNTAS MODELO DO FAQ DA PÁGINA DE PRODUTO, e o eco delas para o dado estruturado.
//
// Módulo SEM "use client" de propósito: a lista (components/product/pdp/interactive.tsx, cliente) e a
// página (app/(loja)/produto/[productSlug]/page.tsx, servidor) leem a MESMA constante. Um server
// component que importasse a constante de um módulo de cliente receberia uma referência, não a lista.
//
// Só perguntas com resposta que o template CONSEGUE afirmar: o prazo de arrependimento do CDC (lei, vale
// para toda loja online no Brasil) e a regra de frete grátis SE configurada em lib/store-config.ts.
// Prazo de entrega e validade não entram: eram inventados. As perguntas do PRODUTO vêm do enriquecimento
// (lib/enrichment/products.json) e são dado do catálogo, não copy do molde.
//
// EDITOR: estas são as perguntas MODELO do molde, uma LISTA editável (reordenar, ocultar, duplicar), com
// id por PAPEL: a de frete só existe com regra real de frete grátis, e um id posicional deslizaria (a
// resposta que o lojista escreveu na pergunta 2 apareceria na 1) quando a regra mudasse. Ids e caminhos
// são chave de arquivo (README do editor, §6): não existe renomear.
import { FREE_SHIPPING_THRESHOLD } from "@/lib/store-config";
import { orderSections, resolveValue, type ContentDocument } from "@/lib/editable/document";

export interface PerguntaResposta {
  question: string;
  answer: string;
}
export interface PerguntaModelo extends PerguntaResposta {
  id: string;
  label: string;
}

export const FAQ_MODELO: readonly PerguntaModelo[] = [
  ...(FREE_SHIPPING_THRESHOLD != null
    ? [{ id: "frete", label: "Pergunta sobre frete", question: "Tem frete grátis?", answer: `Sim, para compras a partir de R$ ${FREE_SHIPPING_THRESHOLD}. Abaixo disso o frete é calculado pelo CEP no carrinho.` }]
    : []),
  {
    id: "devolucao",
    label: "Pergunta sobre devolução",
    question: "Posso desistir da compra?",
    answer: "Sim. Você tem 7 dias corridos a partir do recebimento para desistir, com reembolso integral, conforme o art. 49 do Código de Defesa do Consumidor. Os detalhes estão na página de trocas e devoluções.",
  },
];

/** caminhos de cada pergunta, RELATIVOS ao item (`produto.qualidade-faq.faq.devolucao.pergunta`) */
export const CAMINHO_PERGUNTA = "pergunta";
export const CAMINHO_RESPOSTA = "resposta";

// Onde a lista mora no documento: container da PDP, seção, cartão do FAQ, pergunta. São os mesmos ids que
// pdp-view.tsx e a FaqList escrevem; mudar um lado sem o outro descola o dado estruturado da tela.
export const CONTAINER_DA_PDP = "produto";
export const SECAO_QUALIDADE_FAQ = "qualidade-faq";
export const CARTAO_FAQ = "faq";

/**
 * O FAQ COMO ELE ESTÁ NA TELA, lido do documento publicado, para o FAQPage (JSON-LD) da página.
 *
 * A regra da página é uma só: o dado estruturado nasce da MESMA lista que o accordion renderiza. Se o
 * bloco some da tela, some do JSON-LD; pergunta que a loja não responde não vira schema. Com o editor, a
 * lista que o accordion renderiza depende do publicado: a seção pode estar oculta, o cartão do FAQ pode
 * estar oculto ou duplicado, e cada pergunta modelo pode ter sido reordenada, ocultada, duplicada ou
 * reescrita. Este eco lê tudo isso do documento do mesmo jeito que os primitivos leem (ordem e ocultas
 * por `orderSections`, valor por `resolveValue`), sem registrar ponto editável nenhum: é a mesma técnica
 * da faixa corrida da home. Sem documento (loja nunca publicou, editor fora), o que vale é o código.
 *
 * As perguntas do enriquecimento entram antes das modelo, na ordem em que a FaqList as mostra.
 */
export function faqNaTela(doc: ContentDocument | null | undefined, doEnriquecimento: readonly PerguntaResposta[]): PerguntaResposta[] {
  const secoes = doc?.sections ?? {};
  const lista: PerguntaResposta[] = [];
  // a seção e as cópias dela que estão visíveis, na ordem do container `produto`
  for (const secao of orderSections([SECAO_QUALIDADE_FAQ], secoes[CONTAINER_DA_PDP]).visible) {
    const escopoDaSecao = `${CONTAINER_DA_PDP}.${secao}`;
    // o cartão do FAQ e as cópias dele, dentro da seção
    for (const cartao of orderSections([CARTAO_FAQ], secoes[escopoDaSecao]).visible) {
      const escopoDoCartao = `${escopoDaSecao}.${cartao}`;
      const estado = secoes[escopoDoCartao];
      lista.push(...doEnriquecimento);
      for (const id of orderSections(FAQ_MODELO.map((f) => f.id), estado).visible) {
        // uma cópia lê o texto no próprio escopo e cai no modelo da origem quando o lojista não o mudou
        const base = FAQ_MODELO.find((f) => f.id === (estado?.clones?.[id] ?? id));
        if (!base) continue;
        lista.push({
          question: resolveValue(doc, `${escopoDoCartao}.${id}.${CAMINHO_PERGUNTA}`, base.question),
          answer: resolveValue(doc, `${escopoDoCartao}.${id}.${CAMINHO_RESPOSTA}`, base.answer),
        });
      }
    }
  }
  return lista;
}
