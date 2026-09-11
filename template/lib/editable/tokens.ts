// O que o lojista pode mudar na loja INTEIRA: as cores da marca, a letra e o tamanho
// dos títulos. É a ÚNICA lista feita à mão do editor — e é por loja: o construtor
// acrescenta os tokens próprios da marca. Tudo que não está aqui fica fora do alcance
// do editor.
import type { EditableTokenSpec } from "./provider";

export const EDITABLE_TOKENS: EditableTokenSpec[] = [
  { token: "--store-primary", label: "Cor principal" },
  { token: "--store-cta", label: "Cor do botão de compra" },
  { token: "--store-cta-fg", label: "Texto do botão de compra" },
  { token: "--store-bg", label: "Fundo da página" },
  { token: "--store-ink", label: "Cor do texto" },
  { token: "--store-surface", label: "Fundo de cartões" },
  { token: "--store-sale", label: "Cor de oferta" },
  // O lojista pediu "trocar a cor da barra de cima" e não havia como: o cabeçalho pinta com
  // `--store-surface-2` e o rodapé com `--store-chrome-bg`, e nenhum dos dois estava aqui. O chat
  // então mexeu na cor da marca, disse "alterada" e a tela não mudou. Lista curta demais é uma
  // forma de esconder a loja do dono dela.
  { token: "--store-surface-2", label: "Fundo do cabeçalho" },
  { token: "--store-chrome-bg", label: "Fundo do rodapé" },
  { token: "--store-chrome-text", label: "Texto sobre o rodapé" },
  { token: "--store-line", label: "Cor dos filetes" },

  // ── LETRA E TAMANHO (a loja precisa ser foundation 14 para ler estes três) ──────────────
  // Token deixou de ser sempre cor: `tipo` ausente continua sendo cor, que é o que ele
  // sempre foi. As duas letras guardam uma família que ESTA loja carregou — quem diz quais
  // são é o manifesto (`Manifest.fontes`, lido do navegador na prévia), nunca uma lista do
  // editor: as fontes de uma loja são as que estão no projeto dela.
  { token: "--store-fonte-titulo", label: "Fonte dos títulos", tipo: "fonte" },
  { token: "--store-fonte-texto", label: "Fonte do texto", tipo: "fonte" },
  // O tamanho é UM número que multiplica a escada inteira de h1 a h4 (app/globals.css), e
  // não um tamanho por título: número escolhido olhando o computador congela o celular, e a
  // escada é quem sabe quanto cada degrau pode encolher ali. Os degraus têm nome porque
  // "1.25" não diz nada a quem vende; e não há degrau abaixo de "Menor" porque a escada tem
  // piso de 16px nos dois degraus de baixo e mais um passo não mexeria em nada.
  {
    token: "--store-escala-titulos",
    label: "Tamanho dos títulos",
    tipo: "escala",
    opcoes: [
      { valor: "0.9", label: "Menor" },
      { valor: "1", label: "Padrão" },
      { valor: "1.1", label: "Maior" },
      { valor: "1.25", label: "Bem maior" },
    ],
  },
];
