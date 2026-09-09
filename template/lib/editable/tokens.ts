// Tokens de cor que o lojista pode mudar. É a ÚNICA lista feita à mão do
// editor — e é por loja: o construtor acrescenta os tokens próprios da marca.
// Tudo que não está aqui fica fora do alcance do editor.
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
];
