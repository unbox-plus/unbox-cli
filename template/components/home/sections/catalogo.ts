// ═══════════════════════════════════════════════════════════════════════════
// CATÁLOGO DE SEÇÕES QUE O LOJISTA PODE ADICIONAR ("+ Adicionar seção" do editor)
//
// Quem declara o que pode ser adicionado é a LOJA, nunca o editor. O editor não tem, e não pode ter,
// lista própria: são 100 lojas, 100 catálogos. O que existe aqui não é um catálogo de EDITABILIDADE
// (isso continua sendo as "4 latas" da foundation); é o catálogo de COMPONENTES desta loja, que já
// mora em `registry.ts`, recortado na fatia que o lojista consegue usar sozinho.
//
// ── O CORTE: 8 dos 24 do registry ─────────────────────────────────────────────
// Um tipo só entra se, instanciado SEM props da receita, ele:
//   1. RENDERIZA algo (não cai em `return null` por lista vazia), e
//   2. o que ele renderiza é EDITÁVEL: a copy nasce dentro de primitivo (`Editable.Text` &cia.).
// A regra 1 é a que mais corta nesta foundation: por honestidade, várias seções só renderizam com dado
// da receita (depoimentos reais, vídeo real, ficha do produto, atributos da marca, promessa de
// newsletter com endereço de envio). Adicionar uma delas pelo "+" entregaria ao lojista uma seção que
// não aparece em lugar nenhum. Pior que não oferecer.
//
// ── A EXCEÇÃO DA REGRA 1: o bloco de HTML ─────────────────────────────────────
// "bloco-html" é a única entrada que, recém-adicionada, renderiza NADA na loja publicada, e isso é o
// desenho, não o modo de falha que a regra 1 persegue. As seções cortadas somem porque falta DADO que
// o lojista não tem como fornecer; esta nasce vazia porque o conteúdo dela é justamente o que ele vai
// colar, e no editor (o único lugar onde ele acabou de clicar no "+") ela SEMPRE aparece, com o convite
// para colar. Sumir da loja enquanto está vazia é o certo.
//
// ── PLACEHOLDER NA SEÇÃO CRIADA ───────────────────────────────────────────────
// Benefícios, como funciona, cards de imagem e citação nascem com a arte de /brand/ph (o SVG que o
// create-unbox-store recolore com a paleta da marca) e com a copy neutra do componente. É a mesma arte
// e a mesma copy com que a home da foundation já nasce: o lojista clica na foto e sobe a dele. Se uma
// loja decidir que o "+" não pode entregar placeholder, tire a entrada daqui; nada mais muda.
//
// ── `tipo` É CHAVE PRIMÁRIA (não renomeie) ────────────────────────────────────
// A chave de cada entrada é o que vai para o documento (`sections.home.criadas: { id → tipo }`) e para
// o id da seção (`novo-<tipo>-<n>`). Renomear um `tipo` depois que alguém publicou: as seções já
// adicionadas apontam para um tipo que o catálogo não tem mais, `Editable.Sections` as filtra fora e
// elas SOMEM DA TELA em silêncio (o painel continua listando, porque ele deriva do rascunho). Tratar
// como id de seção da receita: nome em pt-br, escolhido uma vez, nunca mais mexido.
//
// ── `variant` sim, `props` não ────────────────────────────────────────────────
// A seção criada nasce com os LITERAIS do componente: nada é escrito em `values`. Por isso este
// arquivo não passa `sectionProps`: copy que morasse aqui viveria em dois lugares (receita e
// catálogo) e divergiria, e é justamente a copy que o lojista vai trocar no primeiro clique.
// `variant` é a exceção porque não é conteúdo, é QUAL composição o componente renderiza.
//
// ── FICARAM DE FORA (motivo curto, para quem for mexer depois) ────────────────
//   attributes-marquee, trust-bar, trust-strip, spec-table, video-wall, reviews, reviews-carousel,
//   comparison, founder-story, newsletter ..... `return null` sem dado da receita (regra 1). É
//                   decisão de honestidade da foundation 0.19, e vale igual no "+".
//   category-pills, combos-carousel, savings, kits, purchase-hero ..... dependem do catálogo/da
//                   configuração comercial; somem ou esvaziam sem eles.
//   social-row ..... renderiza com defaults, mas os defaults são gente placeholder ("@suamarca"), e a
//                   regra da seção é GENTE REAL com autorização: não entra pelo "+".
//   stats-grid ..... renderiza e é editável, mas é a seção de NÚMERO com dado real; no "+" ela nasceria
//                   como quatro cards qualitativos e convidaria a inventar estatística.
//
// JSX não entra aqui porque o arquivo é `.ts` (o catálogo é declaração, não tela): a instância sai de
// `React.createElement`.
// ═══════════════════════════════════════════════════════════════════════════
import * as React from "react";
import type { CatalogoDeSecoes, SectionKind } from "@/lib/editable";
import { SECTIONS, type HomeData, type SectionComponentProps, type SectionName } from "./registry";

interface EntradaDoCatalogo {
  /** chave do catálogo: vira `novo-<tipo>-<n>` e o valor de `criadas`. NÃO RENOMEAR (ver topo). */
  tipo: string;
  /** componente do registry que instancia este tipo */
  section: SectionName;
  /** composição do componente; omitida = a default dele */
  variant?: string;
  /** o nome que o lojista lê no "+", nunca o nome de código */
  label: string;
  /** uma frase dizendo o que a seção mostra (o v1 não tem imagem de prévia) */
  descricao: string;
  /** tipo no vocabulário fechado da foundation (`SECTION_KINDS`) */
  kind: SectionKind;
}

const CATALOGO_DA_HOME: EntradaDoCatalogo[] = [
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
    // A VITRINE. Cada uma adicionada ganha id próprio (`novo-vitrine-de-produtos-1`, `-2`, …), e o
    // caminho da escolha sai desse id (`home.<id>.vitrine`): DUAS vitrines na mesma página têm DUAS
    // escolhas independentes, sem uma pisar na outra.
    tipo: "vitrine-de-produtos",
    section: "product-showcase",
    label: "Vitrine de produtos",
    descricao: "Uma grade de produtos que você escolhe (uma categoria inteira, uma lista sua ou uma busca), com foto, preço e botão de comprar em cada card.",
    kind: "vitrine-de-produtos",
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
  {
    // O BLOCO DE HTML: a única entrada que não desenha nada por conta própria (ver "A EXCEÇÃO DA
    // REGRA 1" no topo). `kind: "outro"` é a escolha honesta: o vocabulário fechado da foundation não
    // tem um tipo para "o que o lojista colar", e carimbar "beneficios" ou "sobre-a-marca" faria o
    // painel afirmar um conteúdo que ninguém conferiu.
    tipo: "bloco-html",
    section: "bloco-html",
    label: "Bloco de HTML",
    // A frase diz o que NÃO entra porque a recusa acontece depois de colar: sem esse aviso aqui, o
    // lojista descobre a regra levando um "não" com o texto já no campo.
    descricao: "Para colar um código pronto que te passaram: um selo, uma tabela de medidas, um trecho de conteúdo. Código que roda (script) e formulário não entram.",
    kind: "outro",
  },
];

/**
 * O catálogo pronto para `Editable.Sections catalogo={…}`.
 *
 * Recebe `data` porque é o que a home já buscou no servidor: `render` fecha por closure e as seções
 * criadas enxergam o mesmo catálogo de produtos das que vêm do código. Pode ser chamado a cada render:
 * `Editable.Sections` compara o catálogo por uma ASSINATURA de texto, não por referência, então um
 * objeto novo por render não re-registra os tipos nem impede o manifesto de assentar.
 */
export function catalogoDaHome(data: HomeData): CatalogoDeSecoes {
  return Object.fromEntries(
    CATALOGO_DA_HOME.map((e) => {
      // o componente do registry é um union de todas as seções; todas recebem `SectionComponentProps`
      const Componente = SECTIONS[e.section] as React.ComponentType<SectionComponentProps>;
      return [
        e.tipo,
        {
          label: e.label,
          descricao: e.descricao,
          kind: e.kind,
          render: () => React.createElement(Componente, { data, variant: e.variant }),
        },
      ];
    }),
  );
}
