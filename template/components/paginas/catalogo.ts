// ═══════════════════════════════════════════════════════════════════════════
// O CATÁLOGO DE SEÇÕES DAS PÁGINAS DO LOJISTA ("+ Adicionar seção" numa página ou artigo)
//
// O corpo de uma página do lojista é SÓ seção criada: a casca não traz nenhuma seção de conteúdo do
// código, e o que existe na tela é o que ele adicionou pelo "+". Por isso este catálogo é a página
// inteira, e não um acréscimo a ela.
//
// ── O QUE ELE HERDA DA HOME ───────────────────────────────────────────────────
// As seções vêm do MESMO catálogo da home (components/home/sections/catalogo.ts), instanciadas com o
// mesmo `HomeData`: um banner, uma vitrine de produtos, benefícios, cards de imagem, uma citação e o
// bloco de HTML. Reaproveitar é o certo aqui, e não copiar: são os componentes desta loja, com o
// visual desta loja, e uma segunda lista divergiria da primeira no dia em que alguém trocasse um
// `tipo` (a chave é o que fica gravado no documento).
//
// FICOU DE FORA da lista da home: "como-funciona". Ela é uma seção de PÁGINA DE PRODUTO (passo a
// passo de uso, com selo e botão), e numa página institucional ou num artigo ela promete uma
// mecânica que a página não tem. As demais da home já estavam fora por falta de dado que o lojista
// não tem como fornecer.
//
// ── O QUE É NOVO AQUI ─────────────────────────────────────────────────────────
// "texto": o bloco de texto formatado. É ele que faz um artigo existir, então vem PRIMEIRO na lista
// (a ordem deste objeto é a ordem em que o lojista lê as opções).
//
// ── `tipo` É CHAVE PRIMÁRIA (não renomeie) ────────────────────────────────────
// A chave de cada entrada vai para o documento (`sections[<id da página>].criadas: { id → tipo }`).
// Renomear um `tipo` depois que alguém publicou faz as seções já adicionadas apontarem para um tipo
// que o catálogo não tem mais: elas somem da tela em silêncio.
// ═══════════════════════════════════════════════════════════════════════════
import * as React from "react";
import type { CatalogoDeSecoes } from "@/lib/editable";
import { catalogoDaHome } from "@/components/home/sections/catalogo";
import type { HomeData } from "@/components/home/sections/registry";
import { TextoSection } from "@/components/paginas/sections/texto";
// a lista de nomes mora em `tipos.ts`, sem import de componente: o servidor a lê sem carregar a tela
import { TIPOS_DA_HOME, TIPO_DE_TEXTO } from "@/components/paginas/tipos";

/**
 * O catálogo pronto para `Editable.Sections catalogo={…}` numa casca de página ou de artigo.
 *
 * Recebe `data` porque é o que a rota já buscou no servidor: as vitrines de uma página do lojista
 * enxergam o mesmo catálogo de produtos que as da home. Pode ser chamado a cada renderização:
 * `Editable.Sections` compara o catálogo por uma assinatura de texto, não por referência.
 */
export function catalogoDasPaginas(data: HomeData): CatalogoDeSecoes {
  const daHome = catalogoDaHome(data);
  const saida: CatalogoDeSecoes = {
    [TIPO_DE_TEXTO]: {
      label: "Texto",
      descricao: "Um texto para escrever com parágrafo, negrito, link, lista, subtítulo e citação. É o corpo de um artigo.",
      // "outro" é a escolha honesta: o vocabulário fechado da foundation não tem um tipo para "o
      // texto que o lojista escrever", e carimbar um dos existentes faria o painel afirmar um
      // conteúdo que ninguém conferiu.
      kind: "outro",
      render: () => React.createElement(TextoSection),
    },
  };
  for (const tipo of TIPOS_DA_HOME) {
    // `hasOwnProperty` e não só a leitura: um tipo que sumiu do catálogo da home tem de sumir daqui
    // junto, calado, em vez de virar uma entrada sem `render` que estouraria no primeiro clique.
    if (Object.prototype.hasOwnProperty.call(daHome, tipo)) saida[tipo] = daHome[tipo];
  }
  return saida;
}
