// OS NOMES DOS TIPOS DO CATÁLOGO DA LOJA ("+ Adicionar seção"), sem nenhum import de componente.
//
// Arquivo próprio porque quem lê esta lista no SERVIDOR (o `generateMetadata` de uma página do lojista, que
// precisa saber quais seções criadas a casca renderiza para achar o primeiro texto do corpo) não deve arrastar o
// registry inteiro só para ler strings. O que cada tipo desenha está em ./catalogo.ts.
//
// `tipo` é CHAVE PRIMÁRIA: vai para o documento (`sections.<container>.criadas: { id → tipo }`) e para o id da
// seção (`novo-<tipo>-<n>`). Renomear um depois que alguém publicou faz as seções já adicionadas apontarem para
// um tipo que o catálogo não tem mais, e elas somem da tela em silêncio. Tipo novo entra no FIM.
export const TIPOS_DA_LOJA = [
  "texto",
  "banner",
  "vitrine-de-produtos",
  "beneficios",
  "como-funciona",
  "cards-de-imagem",
  "citacao",
  "bloco-html",
  // desde a foundation 18: todo tipo da loja em toda página
  "bloco-de-compra",
  "categorias",
  "destaques",
  "economia",
  "kits",
  "depoimentos",
  "avaliacoes",
  "selos-de-confianca",
  "diferenciais",
  "faixa-rolante",
  "ficha-tecnica",
  "videos",
  "nossa-historia",
  "comparativo",
  "numeros",
  "comunidade",
  "newsletter",
] as const;

export type TipoDaLoja = (typeof TIPOS_DA_LOJA)[number];
