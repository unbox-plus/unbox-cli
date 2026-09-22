// ═══════════════════════════════════════════════════════════════════════════
// O CATÁLOGO DA LOJA: o que o lojista pode ADICIONAR ("+ Adicionar seção") em QUALQUER página.
//
// Quem declara o que pode ser adicionado é a LOJA, nunca o editor: são 100 lojas, 100 catálogos. E desde a
// foundation 18 o catálogo é UM SÓ para a loja inteira: a home, a oferta, as páginas e os artigos do lojista, a
// listagem de uma coleção, o catálogo de produtos e a página de produto oferecem exatamente as mesmas seções. O
// lojista não precisa saber que "o bloco de compra só entra na oferta": toda seção que a loja tem entra em toda
// página que tem seções.
//
// ── A REGRA: SÓ ENTRA O QUE APARECE ───────────────────────────────────────────
// Um tipo só entra no "+" se, adicionado, ele RENDERIZA alguma coisa. Três jeitos de uma seção ter o que mostrar:
//   1. ELA MESMA: nasce com a copy neutra e a arte de /brand/ph do componente, que o lojista troca no primeiro
//      clique (banner, benefícios, como funciona, cards de imagem, citação, texto, bloco de HTML);
//   2. O CATÁLOGO DA UNBOX: as seções de produto mostram o que a loja vende (vitrine, bloco de compra, categorias,
//      destaques, economia, kits). As quatro últimas só entram quando o catálogo tem o que elas mostram, porque
//      sem isso elas somem da página;
//   3. A RECEITA DESTA LOJA: depoimentos, avaliações, selos, diferenciais, faixa rolante, ficha técnica, vídeos,
//      nossa história, comparativo, números, comunidade e newsletter só existem com CONTEÚDO REAL da marca, que o
//      briefing escreve nas props da receita (components/home/home-recipe.ts, components/landing/landing-recipe.ts).
//      Elas entram quando alguma receita da loja as traz com conteúdo, e a seção adicionada nasce com ESSE
//      conteúdo (os textos editáveis dela o lojista troca). Sem conteúdo real, não entram: nada de depoimento,
//      número ou pessoa de mentira (números e comunidade até renderizam com o exemplo do componente, e é
//      justamente por isso que exigem a receita: o exemplo convidaria a inventar).
//
// A EXCEÇÃO: o bloco de HTML nasce vazio e some da loja enquanto está vazio; no editor ele aparece com o convite
// para colar. E o bloco de compra e a vitrine, sem nenhum produto, também ficam só no editor (com a moldura para
// escolher o produto), e voltam sozinhos quando há o que mostrar.
//
// ── `tipo` É CHAVE PRIMÁRIA (não renomeie) ────────────────────────────────────
// A chave de cada entrada vai para o documento (`sections.<container>.criadas: { id → tipo }`) e para o id da
// seção (`novo-<tipo>-<n>`). Renomear um `tipo` depois que alguém publicou faz as seções já adicionadas
// apontarem para um tipo que o catálogo não tem mais, `Editable.Sections` as filtra fora e elas SOMEM DA TELA em
// silêncio. A lista de nomes mora em ./tipos.ts (o servidor a lê sem carregar os componentes).
//
// ── `variant` sim, `props` só da receita ──────────────────────────────────────
// A seção do tipo 1 nasce com os LITERAIS do componente: nada é escrito em `values` e nenhuma copy mora aqui
// (ela viveria em dois lugares e divergiria). A do tipo 3 nasce com as props da receita, que é o lugar único
// desse conteúdo: se o briefing trocar um depoimento, a seção adicionada acompanha até o lojista editá-la.
//
// JSX não entra aqui porque o arquivo é `.ts` (o catálogo é declaração, não tela): a instância sai de
// `React.createElement`. Quem chama de um componente de SERVIDOR (a oferta, a página de produto) usa
// `<SecoesComCatalogo>` (./secoes-com-catalogo.tsx): o catálogo carrega funções de desenho, e função não atravessa
// do servidor para o navegador.
// ═══════════════════════════════════════════════════════════════════════════
import * as React from "react";
import type { CatalogoDeSecoes, SectionKind } from "@/lib/editable";
import { homeRecipe } from "@/components/home/home-recipe";
import { landingRecipe } from "@/components/landing/landing-recipe";
import { TextoSection } from "@/components/paginas/sections/texto";
import { SECTIONS, type HomeData, type RecipeEntry, type SectionComponentProps, type SectionName } from "./registry";
import type { TipoDaLoja } from "./tipos";

interface EntradaDoCatalogo {
  /** chave do catálogo: vira `novo-<tipo>-<n>` e o valor de `criadas`. NÃO RENOMEAR (ver topo). */
  tipo: TipoDaLoja;
  /** componente do registry que instancia este tipo ("texto" é o da casca das páginas) */
  section: SectionName | "texto";
  /** composição do componente; omitida = a da receita, ou a default dele */
  variant?: string;
  /** o nome que o lojista lê no "+", nunca o nome de código */
  label: string;
  /** uma frase dizendo o que a seção mostra (o v1 não tem imagem de prévia) */
  descricao: string;
  /** tipo no vocabulário fechado da foundation (`SECTION_KINDS`) */
  kind: SectionKind;
  /**
   * de onde vem o que ela mostra, quando não é dela mesma: `catalogo` = só entra quando o catálogo da Unbox tem o
   * que ela mostra (`temDado`); `receita` = só entra quando uma receita da loja a traz com conteúdo, e nasce com
   * ele; `receita-opcional` = entra sempre, e usa o conteúdo da receita quando ele existe (o bloco de compra)
   */
  origem?: "catalogo" | "receita" | "receita-opcional";
  temDado?: (data: HomeData) => boolean;
}

const CATALOGO_DA_LOJA: EntradaDoCatalogo[] = [
  {
    tipo: "texto",
    section: "texto",
    label: "Texto",
    descricao: "Um texto para escrever com parágrafo, negrito, link, lista, subtítulo e citação. É o corpo de um artigo.",
    // "outro" é a escolha honesta: o vocabulário fechado da foundation não tem um tipo para "o texto que o
    // lojista escrever", e carimbar um dos existentes faria o painel afirmar um conteúdo que ninguém conferiu.
    kind: "outro",
  },
  {
    tipo: "banner",
    section: "hero",
    // "imagem-full" é a única variante do banner que não escreve texto na tela: nasce com a arte da
    // foundation, e o lojista sobe a imagem dele (uma para computador, outra para celular).
    variant: "imagem-full",
    label: "Banner",
    descricao: "Uma imagem larga, com versão para computador e para celular, que leva aos destaques da loja.",
    kind: "banner",
  },
  {
    // A VITRINE. Cada uma adicionada ganha id próprio (`novo-vitrine-de-produtos-1`, `-2`, …), e o caminho da
    // escolha sai desse id (`<container>.<id>.vitrine`): DUAS vitrines na mesma página têm DUAS escolhas.
    tipo: "vitrine-de-produtos",
    section: "product-showcase",
    label: "Vitrine de produtos",
    descricao: "Uma grade de produtos que você escolhe (uma categoria inteira, uma lista sua ou uma busca), com foto, preço e botão de comprar em cada card.",
    kind: "vitrine-de-produtos",
  },
  {
    // O BLOCO DE COMPRA: o produto que o lojista escolhe (o mesmo seletor da vitrine, e vale o primeiro), com as
    // quantidades com desconto e o botão que leva ao passo 2 já com esse produto. Nasce com o conteúdo do bloco
    // de compra da receita, quando a loja tem um (vantagens, chapéu, texto).
    tipo: "bloco-de-compra",
    section: "purchase-hero",
    label: "Bloco de compra",
    descricao: "Um produto em destaque, que você escolhe, com foto, preço, as quantidades com desconto e o botão de comprar.",
    kind: "produto-em-destaque",
    origem: "receita-opcional",
  },
  {
    tipo: "beneficios",
    section: "benefits",
    label: "Benefícios",
    descricao: "Título, duas colunas de benefícios com texto curto e uma foto no meio.",
    kind: "beneficios",
  },
  {
    tipo: "como-funciona",
    section: "ritual",
    label: "Como funciona",
    descricao: "Fotos que se alternam de um lado e, do outro, um selo, um título, uma lista de passos e um botão.",
    kind: "como-funciona",
  },
  {
    tipo: "cards-de-imagem",
    section: "media-cards",
    label: "Cards de imagem",
    descricao: "Título e uma fileira de cards com foto e legenda, que rolam para o lado.",
    kind: "galeria",
  },
  {
    tipo: "citacao",
    section: "quote-banner",
    label: "Citação",
    descricao: "Faixa de cor da marca com uma foto e uma frase grande assinada por alguém da loja.",
    kind: "sobre-a-marca",
  },
  // ── do catálogo da Unbox: só com o que mostrar ──
  {
    tipo: "categorias",
    section: "category-pills",
    label: "Categorias",
    descricao: "As categorias da loja em pílulas com foto, cada uma levando à sua página.",
    kind: "outro",
    origem: "catalogo",
    temDado: (d) => d.categories.length > 0,
  },
  {
    tipo: "destaques",
    section: "combos-carousel",
    label: "Destaques",
    descricao: "Um carrossel com os kits e os produtos em destaque da loja, com preço e botão de comprar.",
    kind: "vitrine-de-produtos",
    origem: "catalogo",
    temDado: (d) => d.combos.length > 0,
  },
  {
    tipo: "economia",
    section: "savings",
    label: "Economia",
    descricao: "Quanto se economiza no produto em destaque, com o preço de antes e o de agora.",
    kind: "produto-em-destaque",
    origem: "catalogo",
    temDado: (d) => d.featured?.oldPrice != null && d.featured.oldPrice > d.featured.price,
  },
  {
    tipo: "kits",
    section: "kits",
    label: "Kits e combos",
    descricao: "Os kits e combos da loja, com o que vem em cada um e o preço.",
    kind: "vitrine-de-produtos",
    origem: "catalogo",
    temDado: (d) => d.bundles.length > 0,
  },
  // ── da receita desta loja: só com conteúdo real ──
  { tipo: "depoimentos", section: "reviews", label: "Depoimentos", descricao: "Os depoimentos de clientes que a loja já tem, em grade.", kind: "depoimentos", origem: "receita" },
  { tipo: "avaliacoes", section: "reviews-carousel", label: "Avaliações", descricao: "As avaliações de clientes que a loja já tem, num carrossel.", kind: "depoimentos", origem: "receita" },
  { tipo: "selos-de-confianca", section: "trust-bar", label: "Selos de confiança", descricao: "A faixa de selos da loja (compra segura, entrega, troca), como na home.", kind: "beneficios", origem: "receita" },
  { tipo: "diferenciais", section: "trust-strip", label: "Diferenciais", descricao: "Os diferenciais da loja numa faixa de ícones.", kind: "beneficios", origem: "receita" },
  { tipo: "faixa-rolante", section: "attributes-marquee", label: "Faixa rolante", descricao: "Uma faixa que rola com os atributos da marca.", kind: "texto-rolante", origem: "receita" },
  { tipo: "ficha-tecnica", section: "spec-table", label: "Ficha técnica", descricao: "A ficha técnica que a loja já tem, em tabela.", kind: "outro", origem: "receita" },
  { tipo: "videos", section: "video-wall", label: "Vídeos", descricao: "Os vídeos que a loja já tem, lado a lado.", kind: "video", origem: "receita" },
  { tipo: "nossa-historia", section: "founder-story", label: "Nossa história", descricao: "A história da marca, com foto.", kind: "sobre-a-marca", origem: "receita" },
  { tipo: "comparativo", section: "comparison", label: "Comparativo", descricao: "A tabela que compara a marca com as alternativas.", kind: "comparacao", origem: "receita" },
  { tipo: "numeros", section: "stats-grid", label: "Números e destaques", descricao: "Os números da marca em cards.", kind: "beneficios", origem: "receita" },
  { tipo: "comunidade", section: "social-row", label: "Comunidade", descricao: "Fotos e perfis de clientes da marca.", kind: "galeria", origem: "receita" },
  { tipo: "newsletter", section: "newsletter", label: "Newsletter", descricao: "O convite para receber as novidades da loja por e-mail.", kind: "newsletter", origem: "receita" },
  {
    // O BLOCO DE HTML: a única entrada que não desenha nada por conta própria (ver A EXCEÇÃO no topo).
    // `kind: "outro"` é a escolha honesta: o vocabulário fechado não tem um tipo para "o que o lojista colar".
    tipo: "bloco-html",
    section: "bloco-html",
    label: "Bloco de HTML",
    // A frase diz o que NÃO entra porque a recusa acontece depois de colar: sem esse aviso aqui, o lojista
    // descobre a regra levando um "não" com o texto já no campo.
    descricao: "Para colar um código pronto que te passaram: um selo, uma tabela de medidas, um trecho de conteúdo. Código que roda (script) e formulário não entram.",
    kind: "outro",
  },
];

/** a receita com CONTEÚDO: pelo menos uma prop preenchida (lista com item, texto não vazio) */
function comConteudo(e: RecipeEntry): boolean {
  return Object.values(e.props ?? {}).some((v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== ""));
}

/**
 * A seção como ESTA loja a tem: a primeira entrada das receitas (a da home, depois a da oferta) com conteúdo.
 * É dela que a seção adicionada tira as props (o conteúdo real) e a variante.
 */
export function daReceita(section: SectionName): RecipeEntry | undefined {
  return [...homeRecipe, ...landingRecipe].find((e) => e.section === section && comConteudo(e));
}

/**
 * O catálogo pronto para `Editable.Sections catalogo={…}`, em qualquer página.
 *
 * Recebe `data` porque é o que a página já buscou no servidor: `render` fecha por closure, e as seções criadas
 * enxergam o mesmo catálogo de produtos (e as mesmas vitrines resolvidas) das que vêm do código. Pode ser chamado
 * a cada render: `Editable.Sections` compara o catálogo por uma ASSINATURA de texto, não por referência, então um
 * objeto novo por render não re-registra os tipos nem impede o manifesto de assentar.
 */
export function catalogoDaLoja(data: HomeData): CatalogoDeSecoes {
  const saida: CatalogoDeSecoes = {};
  for (const e of CATALOGO_DA_LOJA) {
    let render: (() => React.ReactElement) | null = null;
    if (e.section === "texto") render = () => React.createElement(TextoSection);
    else {
      // o componente do registry é um union de todas as seções; todas recebem `SectionComponentProps`
      const Componente = SECTIONS[e.section] as React.ComponentType<SectionComponentProps>;
      const receita = e.origem === "receita" || e.origem === "receita-opcional" ? daReceita(e.section) : undefined;
      if (e.origem === "receita" && !receita) continue;
      if (e.origem === "catalogo" && !e.temDado?.(data)) continue;
      const variant = receita?.variant ?? e.variant;
      const sectionProps = receita?.props;
      render = () => React.createElement(Componente, { data, variant, sectionProps });
    }
    saida[e.tipo] = { label: e.label, descricao: e.descricao, kind: e.kind, render };
  }
  return saida;
}

/** o nome de antes (a home foi a primeira a ter catálogo): o mesmo catálogo da loja */
export const catalogoDaHome = catalogoDaLoja;
