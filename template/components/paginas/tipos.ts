// Os NOMES dos tipos que a casca de página e a de artigo sabem instanciar, sem nenhum import de componente.
//
// Desde a foundation 18 toda página da loja oferece o MESMO catálogo (components/home/sections/catalogo.ts), e a
// lista de nomes mora em components/home/sections/tipos.ts. Este arquivo continua existindo porque quem lê no
// SERVIDOR (o `generateMetadata`, que precisa saber quais seções criadas a casca renderiza para achar o primeiro
// texto do corpo) importa daqui.
import { TIPOS_DA_LOJA } from "@/components/home/sections/tipos";

/** o texto formatado, que é o que faz um artigo existir */
export const TIPO_DE_TEXTO = "texto";

/** todos os tipos que a casca de página e a de artigo sabem instanciar: os da loja inteira */
export const TIPOS_DAS_PAGINAS: readonly string[] = TIPOS_DA_LOJA;
