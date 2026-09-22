// ═══════════════════════════════════════════════════════════════════════════
// AS PÁGINAS DO CÓDIGO QUE ESCONDEM CABEÇALHO E RODAPÉ (foundation 18).
//
// A landing `/oferta` recebe o anúncio, e o lojista pode tirar dela o cabeçalho (com a faixa de avisos) e o rodapé
// grande, como já faz na página avulsa pela ficha. A página do código não tem ficha: os dois interruptores ficam na
// aba Seções do editor, no grupo "Cabeçalho e rodapé", e o pedido mora no estado do container da página
// (`sections.oferta.ocultarCabecalho`, `ocultarRodape`).
//
// Esta lista é o que o app/layout.tsx declara ao editor (`ocultaChromeEm`). Página nova só entra aqui junto com o
// `<PedidoDeChrome container="…"/>` dela (components/landing/pedido-de-chrome.tsx): declarada sem ele, o interruptor
// gravaria e a página continuaria com cabeçalho. O check-editable confere a marca, o CSS e a barra do rodapé.
// ═══════════════════════════════════════════════════════════════════════════
import type { ManifestChromeOcultavel } from "@/lib/editable/document";

export const OCULTA_CHROME_EM: ManifestChromeOcultavel[] = [{ container: "oferta", nome: "Oferta" }];
