// ═══════════════════════════════════════════════════════════════════════════
// O CATÁLOGO DE SEÇÕES DAS PÁGINAS DO LOJISTA ("+ Adicionar seção" numa página, num artigo ou numa coleção)
//
// O corpo de uma página do lojista é SÓ seção criada: a casca não traz nenhuma seção de conteúdo do código, e o
// que existe na tela é o que ele adicionou pelo "+". Desde a foundation 18 o catálogo é o DA LOJA INTEIRA
// (components/home/sections/catalogo.ts): o mesmo da home, da oferta e da página de produto, com o texto, o bloco
// de compra e as seções que a loja tem com conteúdo real. Uma lista própria das páginas divergiria da da loja no
// dia em que alguém acrescentasse um tipo, e o lojista não tem por que saber que "tal seção só entra na home".
//
// ── `tipo` É CHAVE PRIMÁRIA (não renomeie) ────────────────────────────────────
// A chave de cada entrada vai para o documento (`sections[<id da página>].criadas: { id → tipo }`). Renomear um
// `tipo` depois que alguém publicou faz as seções já adicionadas apontarem para um tipo que o catálogo não tem
// mais: elas somem da tela em silêncio.
// ═══════════════════════════════════════════════════════════════════════════
import type { CatalogoDeSecoes } from "@/lib/editable";
import { catalogoDaLoja } from "@/components/home/sections/catalogo";
import type { HomeData } from "@/components/home/sections/registry";

/**
 * O catálogo pronto para `Editable.Sections catalogo={…}` numa casca de página, de artigo ou de coleção.
 *
 * Recebe `data` porque é o que a rota já buscou no servidor: as seções de produto de uma página do lojista
 * enxergam o mesmo catálogo que as da home. Pode ser chamado a cada renderização: `Editable.Sections` compara o
 * catálogo por uma assinatura de texto, não por referência.
 */
export function catalogoDasPaginas(data: HomeData): CatalogoDeSecoes {
  return catalogoDaLoja(data);
}
