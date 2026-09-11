// A PÁGINA DE PRODUTO É UM MOLDE.
//
// Um valor para TODOS os produtos: o documento do lojista não tem dimensão de produto, de propósito.
// Nome, preço, fotos, descrição, variantes, tamanhos, estoque, selos regulados e avaliações vêm do
// catálogo da Unbox e do enriquecimento e NÃO viram primitivo: são DADO, e o gate os desconta por
// `data-editor-ignore` (README do editor, §8). O que vira primitivo é o que o lojista mudaria SEM mudar
// o produto: chapéu, links do caminho, selos de confiança, promessa de entrega, título e atributos de
// qualidade, título e perguntas MODELO do FAQ, chapéu/título/link do catálogo, newsletter.
//
// Container PRÓPRIO (`produto`, declarado em lib/rotas-editaveis.ts): a faixa de confiança e a newsletter
// daqui NÃO reaproveitam o `home`, porque "frete grátis acima de R$ 150" na home e na PDP são frases que
// o lojista pode querer diferentes (a ordem é do container; a copy é do container). Ids de seção
// descrevem o PAPEL do bloco e são chave de arquivo: não existe renomear.
//
// Esta view recebe TUDO por prop (nada de fetch aqui): é o que permite renderizá-la com um produto de
// mentira num teste, já que a loja local não fala com o catálogo. Quem busca é page.tsx.
//
// Server component: exportações NOMEADAS (`EditableSection`...), nunca o objeto `Editable` (README §4).
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { EditableLink, EditableSection, EditableSections, EditableText } from "@/lib/editable";
import { PdpGallery } from "@/components/product/pdp/gallery";
import {
  BuyBox,
  type PdpBenefit,
  type PdpRelatedOption,
  type PdpSizeOption,
  type PdpSubscription,
  type PdpVariant,
} from "@/components/product/pdp/buy-box";
import { ProductTabs, FaqList, type KV } from "@/components/product/pdp/interactive";
import { TrustStrip, SecurityBar, ReviewsCard, QualidadeCard, QUALIDADE, type ReviewItem } from "@/components/product/pdp/sections";
import { Newsletter } from "@/components/product/pdp/newsletter";
import { CatalogGrid, CatalogCta, type CatalogItem } from "@/components/product/pdp/catalog-grid";
import type { PerguntaResposta } from "@/components/product/pdp/faq-modelo";

export interface PdpViewProps {
  /** Dado do catálogo e do enriquecimento: nunca copy do molde. */
  produto: {
    id: string;
    titulo: string;
    imagens: string[];
    videos: string[];
    /** desconto REAL (compareAtPrice) para o selo da galeria; null = sem selo */
    descontoPct: number | null;
    descricaoCurta?: string | null;
    esgotado: boolean;
    minQty: number;
    maxQty: number | null;
  };
  compra: {
    variants: PdpVariant[];
    benefits?: PdpBenefit[];
    sizeOptions: PdpSizeOption[];
    relatedTitle?: string;
    relatedOptions: PdpRelatedOption[];
    subscription: PdpSubscription | null;
    /** nota e contagem REAIS (reviews do enriquecimento); sem elas o bloco de avaliação da buy box não aparece */
    ratingAverage?: number;
    ratingCount?: number;
  };
  detalhes: {
    descHtml?: string | null;
    infoHtml?: string | null;
    specItems: KV[];
    nutriItems: KV[];
    nutriBase?: string | null;
    usageSteps?: string[] | null;
  };
  /** null = sem avaliação real: o card não entra na página */
  avaliacoes: { ratingCount: number; average: number; reviews: ReviewItem[] } | null;
  /** FAQ do enriquecimento (por produto), dado do catálogo. As perguntas MODELO do molde entram sempre (faq-modelo.ts). */
  faq?: readonly PerguntaResposta[];
  catalogo: CatalogItem[];
}

export function PdpView({ produto, compra, detalhes, avaliacoes, faq, catalogo }: PdpViewProps) {
  return (
    <div className="full-bleed store-layout bg-white text-[var(--store-ink)]">
      <div className="mx-auto max-w-[1240px] px-4 pb-2 sm:px-6">
        <EditableSections container="produto">
          {/* FIXA: a galeria e o bloco de compra SÃO a página; reordenar e ocultar valem para o resto. */}
          <EditableSection id="compra" kind="produto-em-destaque" label="Bloco de compra" fixed>
            {/* caminho de navegação: os dois links são copy de navegação da marca; o nome do produto é dado */}
            <div className="flex items-center gap-2 pt-4 text-[13px] font-medium text-[var(--store-muted)]">
              <EditableLink
                path="trilha.inicio"
                fallback={{ href: "/", label: "Início" }}
                label="Caminho: link da página inicial"
                className="no-underline hover:text-[var(--store-ink)]"
              />
              <CaretRight className="text-[11px]" />
              <EditableLink
                path="trilha.produtos"
                fallback={{ href: "/produtos", label: "Produtos" }}
                label="Caminho: link da lista de produtos"
                className="no-underline hover:text-[var(--store-ink)]"
              />
              <CaretRight className="text-[11px]" />
              <span data-editor-ignore className="font-semibold text-[var(--store-ink)] line-clamp-1">{produto.titulo}</span>
            </div>

            <div className="grid grid-cols-1 items-start gap-7 pt-4 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
              <PdpGallery images={produto.imagens} videos={produto.videos} title={produto.titulo} discountPct={produto.descontoPct} />
              <BuyBox
                ratingAverage={compra.ratingAverage}
                ratingCount={compra.ratingCount}
                productId={produto.id}
                title={produto.titulo}
                shortDescription={produto.descricaoCurta}
                imageUrl={produto.imagens[0]}
                variants={compra.variants}
                benefits={compra.benefits}
                sizeOptions={compra.sizeOptions}
                relatedTitle={compra.relatedTitle}
                relatedOptions={compra.relatedOptions}
                subscription={compra.subscription}
                minQty={produto.minQty}
                maxQty={produto.maxQty}
                isSoldOut={produto.esgotado}
              />
            </div>
          </EditableSection>

          {/* Abaixo do frame principal: confiança, conteúdo do produto, qualidade + FAQ, catálogo, newsletter. */}
          <EditableSection id="confianca" kind="beneficios" label="Faixa de confiança">
            <div className="mt-10"><TrustStrip /></div>
          </EditableSection>

          <EditableSection id="seguranca" kind="beneficios" label="Barra de compra segura e pagamento">
            <div className="mt-5"><SecurityBar /></div>
          </EditableSection>

          {/* descrição, ficha, tabela nutricional e modo de uso: TUDO dado do produto; os rótulos das abas são interface */}
          <EditableSection id="detalhes" kind="outro" label="Descrição e ficha do produto">
            <div className="mt-12" data-editor-ignore>
              <ProductTabs
                descHtml={detalhes.descHtml}
                infoHtml={detalhes.infoHtml}
                specItems={detalhes.specItems}
                nutriItems={detalhes.nutriItems}
                nutriBase={detalhes.nutriBase}
                usageSteps={detalhes.usageSteps}
              />
            </div>
          </EditableSection>

          {/* avaliações só entram quando existem de verdade */}
          {avaliacoes && (
            <EditableSection id="avaliacoes" kind="depoimentos" label="Avaliações">
              <div id="avaliacoes" className="mt-12">
                <ReviewsCard ratingCount={avaliacoes.ratingCount} average={avaliacoes.average} reviews={avaliacoes.reviews} />
              </div>
            </EditableSection>
          )}

          {/* qualidade + FAQ dividem UMA linha da grade. Os dois cartões são ITENS de uma lista aninhada: cada
              um oculta e reordena por si, e cada um hospeda a própria lista (atributos de qualidade,
              perguntas) num container só dele. A grade é auto-fit: com um cartão só (qualidade vazia ou
              oculta pelo lojista) o FAQ ocupa a linha inteira em vez de deixar uma coluna vazia. */}
          <EditableSection id="qualidade-faq" kind="perguntas-frequentes" label="Qualidade e perguntas frequentes">
            <div className="mt-12 grid items-start gap-[22px] lg:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
              <EditableSections nested>
                {/* o cartão de qualidade só existe com atributos declarados (sections.tsx, QUALIDADE) */}
                {QUALIDADE.length > 0 && (
                  <EditableSection item id="qualidade" label="Qualidade do produto">
                    <QualidadeCard />
                  </EditableSection>
                )}
                <EditableSection item id="faq" label="Perguntas frequentes">
                  <div className="rounded-xl border border-[var(--store-line)] bg-white p-[28px]">
                    <EditableText
                      as="h3"
                      path="titulo"
                      fallback="Perguntas frequentes"
                      label="Título das perguntas frequentes"
                      className="font-display mb-[22px] italic text-[var(--store-primary,#18181B)]"
                    />
                    <FaqList items={faq} />
                  </div>
                </EditableSection>
              </EditableSections>
            </div>
          </EditableSection>

          {/* catálogo: chapéu, título, frase e link são copy do molde; os produtos da grade são dado */}
          {catalogo.length > 0 && (
            <EditableSection id="catalogo" kind="vitrine-de-produtos" label="Mais produtos do catálogo">
              <div className="mt-[52px]">
                <div className="mb-1.5 flex items-end justify-between">
                  <div>
                    <EditableText
                      as="div"
                      path="chapeu"
                      fallback="CATÁLOGO"
                      label="Chapéu do catálogo"
                      className="text-xs font-extrabold tracking-[1.5px] text-[var(--store-primary,#18181B)]"
                    />
                    <EditableText
                      as="h2"
                      path="titulo"
                      fallback="Explore mais do catálogo"
                      label="Título do catálogo"
                      className="font-display mt-1.5"
                    />
                  </div>
                  <CatalogCta />
                </div>
                <EditableText
                  as="p"
                  path="texto"
                  fallback="Clientes que viram este produto também levam:"
                  label="Frase de apoio do catálogo"
                  className="mb-[22px] mt-1 text-sm text-[var(--store-muted)]"
                />
                <CatalogGrid items={catalogo} />
              </div>
            </EditableSection>
          )}

          <EditableSection id="newsletter" kind="newsletter" label="Newsletter">
            <div className="mt-12"><Newsletter /></div>
          </EditableSection>
        </EditableSections>
      </div>
    </div>
  );
}
