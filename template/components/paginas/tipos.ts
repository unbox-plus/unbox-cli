// Os NOMES dos tipos do catálogo das páginas do lojista, sem nenhum import de componente.
//
// Arquivo próprio porque quem lê esta lista no SERVIDOR (o `generateMetadata`, que precisa saber
// quais seções criadas a casca renderiza para achar o primeiro texto do corpo) não deve arrastar o
// registry inteiro da home só para ler seis strings.
//
// `tipo` é chave primária: renomear um depois que alguém publicou faz as seções já adicionadas
// apontarem para um tipo que o catálogo não tem mais, e elas somem da tela em silêncio.

/** os tipos do catálogo da home que uma página ou um artigo sabe usar (o porquê está em catalogo.ts) */
export const TIPOS_DA_HOME = ["banner", "vitrine-de-produtos", "beneficios", "cards-de-imagem", "citacao", "bloco-html"] as const;

/** o tipo NOVO das páginas: o texto formatado, que é o que faz um artigo existir */
export const TIPO_DE_TEXTO = "texto";

/** todos os tipos que a casca de página e a de artigo sabem instanciar */
export const TIPOS_DAS_PAGINAS: readonly string[] = [TIPO_DE_TEXTO, ...TIPOS_DA_HOME];
