// ═══════════════════════════════════════════════════════════════════════════
// O SEO DAS PÁGINAS DO LOJISTA: título, descrição, canônica, cartão social e dado estruturado.
//
// Num arquivo só porque as quatro rotas (página, artigo, listagem e listagem paginada) precisam da
// MESMA régua, e porque o `generateMetadata` e o JSON-LD de uma mesma rota têm de concordar: se o
// `<title>` diz uma coisa e o `BlogPosting` diz outra, o buscador desconfia dos dois.
//
// ── AS DECISÕES ───────────────────────────────────────────────────────────────
// · TÍTULO: o que o lojista escreveu em SEO, senão o título da página. O nome da loja entra no fim
//   pelo `title.template` do app/layout.tsx (é ele que faz "%s · Nome da loja"), então aqui nunca se
//   escreve o nome da loja no `title`, ou ele sairia duas vezes.
// · DESCRIÇÃO: a de SEO, senão o resumo, senão o começo do corpo. Nunca inventada, e nunca a mesma
//   frase em todas as páginas.
// · CANÔNICA relativa: `metadataBase` (app/layout.tsx) a torna absoluta com o domínio desta loja.
//   Cada página da listagem é canônica de si mesma, inclusive `/pagina/2`.
// · OPEN GRAPH REPETIDO POR INTEIRO: o App Router SUBSTITUI o objeto `openGraph` do layout pai, não
//   faz merge. Declarar só `title` aqui apagaria `siteName` e `locale`, e a loja publicaria cartão
//   social sem identificação.
// · IMAGEM: a de SEO, senão a de destaque, senão a IMAGEM SOCIAL DA LOJA, escrita aqui. É o mesmo
//   motivo do item acima, e ele engana: `app/opengraph-image.tsx` é injetado pelo Next só enquanto
//   ninguém declara `openGraph`, e este arquivo declara. Deixar `images` ausente não "cai" na imagem
//   da loja — apaga o cartão. Uma listagem de coleção nem tem campo de imagem, então sem esta linha
//   todo `/blog` compartilhado sairia sem foto para sempre. (Passar `[]` também apagaria o cartão.)
// · `robots.index = false` quando o lojista marcou "ocultar de buscadores", quando a página não
//   está no ar (a prévia e só ela chega a renderizar uma página fora do ar) ou quando a listagem
//   ainda não tem nenhum artigo.
// ═══════════════════════════════════════════════════════════════════════════
import "server-only";
import type { Metadata } from "next";
import { TIPOS_DAS_PAGINAS } from "@/components/paginas/tipos";
import { dataDoArtigo } from "@/components/paginas/data-do-artigo";
import { tituloDaPaginaOuEndereco } from "@/components/paginas/titulos";
import type { Migalha } from "@/components/paginas/casca-de-pagina";
import {
  isHtmlPath,
  isRichPath,
  isSafeUrl,
  orderSections,
  SECAO_CABECALHO,
  SUFIXO_RICO,
  textoDoTextoRico,
  type ContentDocument,
  type ImageValue,
  type PaginaDoLojista,
} from "@/lib/editable/document";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
// O nome sai do ambiente (o create-unbox-store escreve `NEXT_PUBLIC_SITE_NAME` no scaffold), como em
// app/llms.txt e em /api/unbox/paginas. O literal é só o último recurso.
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Minha Loja";

/** os `@id` das entidades da loja: uma entidade só, referenciada por `@id` em vez de repetida inteira */
export const ID_DA_ORGANIZACAO = `${SITE_URL}#organizacao`;
export const ID_DO_SITE = `${SITE_URL}#site`;

/** o logotipo da marca (public/brand/logo.svg, em toda loja do CLI), absoluto porque quem o lê é outro servidor */
const LOGO_DA_MARCA = `${SITE_URL}/brand/logo.svg`;

/**
 * A imagem social da loja (`app/opengraph-image.tsx`, 1200×630). Absoluta porque quem lê o cartão é
 * outro servidor, que não resolve caminho relativo. Toda loja do CLI tem esse arquivo, e é ele que
 * responde por quem não subiu imagem nenhuma.
 *
 * Com `width` e `height`, que aqui se sabem (`size` daquele arquivo): quem monta o cartão desenha o
 * espaço certo antes de baixar a imagem, e sem eles o primeiro compartilhamento sai com o formato
 * errado. A imagem que o LOJISTA subiu vai sem medida, porque medida a gente não tem, e chutar seria
 * pior do que omitir.
 */
const IMAGEM_SOCIAL_DA_LOJA = { url: new URL("/opengraph-image", SITE_URL).toString(), width: 1200, height: 630 };

/** as imagens do cartão: a da página quando existe, senão a da loja. Nunca vazio (ver o cabeçalho). */
function imagensDoCartao(imagem: string | undefined) {
  return imagem ? [imagem] : [IMAGEM_SOCIAL_DA_LOJA];
}

const DESCRICAO_MAX = 155;

/** o texto numa linha só, sem espaço sobrando; `undefined` quando não sobra nada */
function normalizar(texto: string | undefined): string | undefined {
  const limpo = (texto ?? "").replace(/\s+/g, " ").trim();
  return limpo || undefined;
}

/**
 * O mesmo texto, cortado numa palavra inteira. Vale para a descrição DERIVADA (o resumo, o começo do
 * corpo): ali quem escolheu o tamanho não foi o lojista, e uma frase cortada no meio de uma palavra é
 * o que aparece no resultado de busca. A descrição que ELE escreveu no campo de SEO não passa por
 * aqui: o teto dela é o do campo (200), e cortá-la em 155 seria a loja editando a escolha dele.
 */
function truncar(texto: string | undefined, teto = DESCRICAO_MAX): string | undefined {
  const limpo = normalizar(texto);
  if (!limpo) return undefined;
  if (limpo.length <= teto) return limpo;
  const corte = limpo.slice(0, teto);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > teto * 0.6 ? corte.slice(0, espaco) : corte).trimEnd()}…`;
}

/**
 * Uma URL de imagem sempre absoluta: o cartão social é lido por outro servidor, que não resolve
 * caminho relativo.
 *
 * `isSafeUrl` NA LEITURA, e não só na gravação: o que chega aqui é o documento PUBLICADO, que a loja
 * relê a cada revalidação e que pode ter sido gravado sob outra régua (ou por fora do editor). Um
 * `javascript:…` saía inteiro em `og:image`, em `twitter:image` e no `image` do dado estruturado, que
 * são três lugares onde a loja afirma alguma coisa em nome da marca. É a mesma porta que `server.ts`
 * já põe no bloco de HTML e no texto formatado, aplicada à imagem.
 */
function imagemAbsoluta(src: string | undefined): string | undefined {
  if (!src || !isSafeUrl(src)) return undefined;
  try {
    return new URL(src, SITE_URL).toString();
  } catch {
    return undefined;
  }
}

/** o texto que o lojista escreveu no cabeçalho da página (título, resumo, descrição da coleção) */
function doCabecalho(doc: ContentDocument | null | undefined, id: string, campo: string): string {
  const v = doc?.values[`${id}.${SECAO_CABECALHO}.${campo}`];
  return typeof v === "string" ? v.trim() : "";
}

function imagemDoCabecalho(doc: ContentDocument | null | undefined, id: string): string | undefined {
  const v = doc?.values[`${id}.${SECAO_CABECALHO}.imagem`];
  return v && typeof v === "object" && "src" in v && typeof (v as ImageValue).src === "string" ? (v as ImageValue).src : undefined;
}

/**
 * OS CAMPOS DE UMA SEÇÃO QUE SÃO PROSA, na ordem em que se lê a seção. Lista FECHADA, e é o miolo da
 * função abaixo.
 *
 * `doc.values` é um mapa PLANO: os campos de uma seção não guardam ordem nenhuma ali, e ordenar os
 * caminhos alfabeticamente (o que se fazia antes) é ordenar pelo NOME do campo. No banner os campos
 * são `arte-desktop, arte-mobile, cta, cta-icone, subtitulo, titulo`, e `cta` vinha primeiro: a
 * description de uma página sem resumo saía "Comprar agora". Na citação são `autor, cargo, citacao`, e
 * saía o nome de quem assinou a frase. É o caminho PADRÃO, porque `create_page` só grava o título e o
 * resumo é opcional.
 *
 * Fechada nos dois sentidos: campo que não está aqui NÃO vira descrição, nem quando é o único texto da
 * seção. Emitir nada é melhor do que emitir o rótulo de um botão: sem `description`, o buscador escreve
 * o trecho a partir da página; com uma errada, ele publica a errada. Campo de PROSA novo num componente
 * desta loja entra nesta lista; rótulo de botão, link, ícone e assinatura ficam de fora por serem o que
 * são.
 */
const CAMPOS_DE_PROSA: readonly string[] = ["titulo", "subtitulo", "citacao", "texto", "corpo", "descricao", "resumo", "legenda"];

/**
 * O COMEÇO DO CORPO, para a descrição de uma página que não tem resumo nem descrição de SEO. Percorre
 * as seções criadas NA ORDEM em que a loja as renderiza (é `orderSections` quem sabe a ordem, e é ela
 * que tira as ocultas) e, dentro de cada uma, os campos de prosa na ordem de `CAMPOS_DE_PROSA`. O
 * bloco de HTML fica de fora: é código colado de fora, e o que sairia dele não é uma frase sobre a
 * página.
 */
function primeiroTextoDoCorpo(doc: ContentDocument | null | undefined, id: string): string | undefined {
  if (!doc) return undefined;
  const estado = doc.sections[id];
  const { visible } = orderSections([SECAO_CABECALHO], estado, TIPOS_DAS_PAGINAS);
  for (const secao of visible) {
    if (secao === SECAO_CABECALHO) continue;
    const prefixo = `${id}.${secao}.`;
    const candidatos = Object.keys(doc.values)
      .filter((k) => k.startsWith(prefixo) && !isHtmlPath(k))
      .map((caminho) => {
        // o marcador `.rico` não é um campo: ele diz que o valor é marcação, e o campo é o segmento
        // antes dele (`corpo.rico` → `corpo`)
        const resto = isRichPath(caminho) ? caminho.slice(prefixo.length, -SUFIXO_RICO.length) : caminho.slice(prefixo.length);
        const partes = resto.split(".");
        return { caminho, campo: partes[partes.length - 1], profundidade: partes.length };
      })
      .filter((c) => CAMPOS_DE_PROSA.includes(c.campo))
      // o campo raso antes do de um item aninhado (o título da seção antes do título de um card
      // dela), que é a ordem em que a seção é lida na tela
      .sort((a, b) => a.profundidade - b.profundidade
        || CAMPOS_DE_PROSA.indexOf(a.campo) - CAMPOS_DE_PROSA.indexOf(b.campo)
        || (a.caminho < b.caminho ? -1 : a.caminho > b.caminho ? 1 : 0));
    for (const { caminho } of candidatos) {
      const v = doc.values[caminho];
      if (typeof v !== "string") continue;
      const texto = isRichPath(caminho) ? textoDoTextoRico(v) : v;
      const cortado = truncar(texto);
      if (cortado) return cortado;
    }
  }
  return undefined;
}

/** a descrição desta página: a de SEO, senão o resumo, senão o começo do corpo */
export function descricaoDaPagina(doc: ContentDocument | null | undefined, id: string, seo: PaginaDoLojista["seo"]): string | undefined {
  return normalizar(seo?.description) ?? truncar(doCabecalho(doc, id, "resumo")) ?? primeiroTextoDoCorpo(doc, id);
}

export interface MetadadosDaPagina {
  doc: ContentDocument | null | undefined;
  id: string;
  registro: PaginaDoLojista;
  /** o caminho desta página, relativo e sem barra no fim (`/paginas/sobre`, `/blog/titulo`) */
  caminho: string;
  /** o título da coleção, no artigo: vira `openGraph.section` */
  colecao?: string;
  /** a página está no ar? Fora do ar, `noindex` (só a prévia renderiza uma página assim) */
  noAr: boolean;
}

/** os metadados de uma página avulsa ou de um artigo */
export function metadadosDaPagina({ doc, id, registro, caminho, colecao, noAr }: MetadadosDaPagina): Metadata {
  const titulo = registro.seo?.title?.trim() || tituloDaPaginaOuEndereco(doc, id, registro.handle);
  const description = descricaoDaPagina(doc, id, registro.seo);
  const imagem = imagemAbsoluta(registro.seo?.image?.src || imagemDoCabecalho(doc, id));
  // sem imagem própria, a da loja: `images` ausente NÃO cai na imagem social (ver o cabeçalho)
  const images = imagensDoCartao(imagem);
  const indexavel = noAr && !registro.seo?.ocultarDeBuscadores;
  const quando = registro.tipo === "artigo" ? dataDoArtigo(registro) : null;
  return {
    title: titulo,
    description,
    alternates: { canonical: caminho },
    // `noindex, follow`, e não `nofollow`: tirar a página do índice não é motivo para o buscador parar
    // de seguir os links dela (a vitrine de produtos que ela tem leva ao catálogo, que é indexável).
    robots: { index: indexavel, follow: true },
    openGraph:
      registro.tipo === "artigo"
        ? {
            type: "article",
            locale: "pt_BR",
            siteName: SITE_NAME,
            url: caminho,
            title: titulo,
            description,
            images,
            publishedTime: quando?.iso,
            // só quando se lê: o registro de rascunho da prévia nasce com as datas em branco, e
            // `article:modified_time` vazio é uma data inválida publicada, não um campo ausente
            modifiedTime: dataLegivel(registro.atualizadoEm) ? registro.atualizadoEm : undefined,
            authors: registro.autor ? [registro.autor] : undefined,
            section: colecao,
            tags: registro.tags?.length ? [...registro.tags] : undefined,
          }
        : {
            type: "website",
            locale: "pt_BR",
            siteName: SITE_NAME,
            url: caminho,
            title: titulo,
            description,
            images,
          },
    twitter: { card: "summary_large_image", title: titulo, description, images },
  };
}

/** os metadados da listagem de uma coleção (página 1 ou N) */
export function metadadosDaColecao({
  doc,
  handle,
  titulo,
  pagina,
  totalDeArtigos,
}: {
  doc: ContentDocument | null | undefined;
  handle: string;
  /** o título já resolvido (o do lojista, senão o do código) */
  titulo: string;
  pagina: number;
  /** quantos artigos a coleção INTEIRA tem no ar; zero tira a listagem do índice (ver abaixo) */
  totalDeArtigos: number;
}): Metadata {
  const id = `colecao-${handle}`;
  const registro = doc?.colecoes?.[handle];
  const base = registro?.seo?.title?.trim() || titulo;
  // "Página N" no título da paginação: sem isto, as páginas 2..N têm o mesmo `<title>` da primeira, e
  // o buscador as trata como cópias uma da outra.
  const tituloFinal = pagina > 1 ? `${base} · Página ${pagina}` : base;
  const description = normalizar(registro?.seo?.description) ?? truncar(doCabecalho(doc, id, "descricao"));
  const caminho = pagina > 1 ? `/${handle}/pagina/${pagina}` : `/${handle}`;
  return {
    title: tituloFinal,
    description,
    alternates: { canonical: caminho },
    // COLEÇÃO SEM NENHUM ARTIGO CONTINUA RESPONDENDO 200 (a URL é da loja, e a rota explica por quê),
    // mas fica FORA do índice enquanto estiver vazia: uma loja recém-nascida põe no ar um `/blog` com
    // uma frase só e sem descrição, e é justamente essa a página que o buscador encontra primeiro se
    // alguém a linkar. `follow` continua: os links do cabeçalho e do rodapé valem. No dia do primeiro
    // artigo ela volta a ser indexável sozinha, sem ninguém mexer em nada.
    ...(totalDeArtigos > 0 ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: SITE_NAME,
      url: caminho,
      title: tituloFinal,
      description,
      // a listagem não tem campo de imagem nenhum: sem esta linha, todo `/blog` compartilhado sairia
      // com cartão sem foto, para sempre
      images: imagensDoCartao(undefined),
    },
    twitter: { card: "summary_large_image", title: tituloFinal, description, images: imagensDoCartao(undefined) },
  };
}

// ── DADO ESTRUTURADO ────────────────────────────────────────────────────────
// Só fato DERIVÁVEL do documento: título, datas, assinatura, endereço. Nada de nota, contagem de
// leitura ou tempo de leitura, que ninguém mediu.

/** a data existe e se lê? `""` (o registro de rascunho da prévia) é dado inválido, não data ausente */
function dataLegivel(iso: string | undefined): iso is string {
  return typeof iso === "string" && Number.isFinite(Date.parse(iso));
}

/**
 * A ENTIDADE DA LOJA, NA PÁGINA QUE A REFERENCIA — E É A MESMA EM TODA PÁGINA, INCLUSIVE NA HOME.
 *
 * O `BlogPosting` aponta `publisher` e `isPartOf` por `@id`, e um parser de dado estruturado não sai
 * da página para resolver `@id` declarado em outra: o que chegava ao buscador era um `publisher` sem
 * `name` e sem `url` — e, em artigo sem assinatura, um `author` igualmente vazio. Emitir o nó aqui,
 * com o MESMO `@id`, mantém uma entidade só (é exatamente o que o `@id` faz: os dois nós são o mesmo
 * nó) e a faz resolver onde é lida.
 *
 * A HOME CHAMA ESTA MESMA FUNÇÃO (app/(loja)/page.tsx). Enquanto ela montava o nó dela à parte, o
 * mesmo `@id` saía com dois nomes (um literal cravado na home, que o create-unbox-store reescreve,
 * contra o `NEXT_PUBLIC_SITE_NAME` de todas as outras páginas) e com o `logo` em só uma das
 * declarações. Um `@id` é uma promessa de que os dois nós são a mesma coisa; quebrada, o buscador vê
 * a entidade ora completa ora pela metade e não sabe qual das duas é a marca.
 *
 * O `logo` VAI JUNTO, e não fica só na home: é ele que o Google usa como logotipo do publisher no
 * resultado de um artigo, e é numa página de artigo que ele lê este nó. A ÚNICA coisa que continua
 * só na home é o `potentialAction` da busca interna, porque é lá que o Google pede que ela esteja.
 */
export function jsonLdDaLoja() {
  return [
    { "@context": "https://schema.org", "@type": "Organization", "@id": ID_DA_ORGANIZACAO, name: SITE_NAME, url: SITE_URL, logo: LOGO_DA_MARCA },
    { "@context": "https://schema.org", "@type": "WebSite", "@id": ID_DO_SITE, name: SITE_NAME, url: SITE_URL },
  ];
}

/** o caminho de migalhas como `BreadcrumbList`; é a MESMA lista que a casca mostra na tela */
export function jsonLdDeMigalhas(migalhas: Migalha[], caminhoAtual: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: migalhas.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: m.nome,
      item: new URL(m.href ?? caminhoAtual, SITE_URL).toString(),
    })),
  };
}

/** `BlogPosting` de um artigo, ou `WebPage` de uma página avulsa */
export function jsonLdDaPagina({ doc, id, registro, caminho, colecao }: Omit<MetadadosDaPagina, "noAr">) {
  const url = new URL(caminho, SITE_URL).toString();
  const titulo = tituloDaPaginaOuEndereco(doc, id, registro.handle);
  const description = descricaoDaPagina(doc, id, registro.seo);
  const imagem = imagemAbsoluta(registro.seo?.image?.src || imagemDoCabecalho(doc, id));
  const comum = {
    "@context": "https://schema.org",
    name: titulo,
    url,
    ...(description ? { description } : {}),
    ...(imagem ? { image: imagem } : {}),
    isPartOf: { "@id": ID_DO_SITE },
    inLanguage: "pt-BR",
  };
  if (registro.tipo !== "artigo") {
    return { ...comum, "@type": "WebPage" };
  }
  const quando = dataDoArtigo(registro);
  return {
    ...comum,
    "@type": "BlogPosting",
    headline: titulo,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(quando ? { datePublished: quando.iso } : {}),
    // só quando se lê, como `datePublished` e `image`: na PRÉVIA o registro de rascunho nasce com as
    // datas em branco, e `"dateModified": ""` não é uma data ISO — é dado estruturado inválido no
    // lugar onde o buscador mais acredita
    ...(dataLegivel(registro.atualizadoEm) ? { dateModified: registro.atualizadoEm } : {}),
    // sem assinatura, quem publica é a própria loja: é a verdade, e inventar um nome de autor em dado
    // estruturado é mentir onde o buscador mais acredita
    author: registro.autor ? { "@type": "Person", name: registro.autor } : { "@id": ID_DA_ORGANIZACAO },
    publisher: { "@id": ID_DA_ORGANIZACAO },
    ...(colecao ? { articleSection: colecao } : {}),
    ...(registro.tags?.length ? { keywords: registro.tags.join(", ") } : {}),
  };
}

/** `CollectionPage` com o `ItemList` dos artigos DESTA página da listagem */
export function jsonLdDaColecao({
  doc,
  handle,
  titulo,
  caminho,
  artigos,
}: {
  doc: ContentDocument | null | undefined;
  handle: string;
  titulo: string;
  caminho: string;
  artigos: { id: string; registro: PaginaDoLojista }[];
}) {
  const id = `colecao-${handle}`;
  const registro = doc?.colecoes?.[handle];
  const description = normalizar(registro?.seo?.description) ?? truncar(doCabecalho(doc, id, "descricao"));
  // O CARD VISÍVEL DE UM ARTIGO "ocultar de buscadores" CONTINUA NA TELA (quem lê a listagem tem de
  // chegar no texto), mas ele NÃO entra aqui: o `ItemList` é a loja dizendo ao robô "esta coleção
  // contém esta URL", e a mesma URL já está fora do sitemap e com `noindex` na própria página. Duas
  // afirmações contrárias sobre a mesma URL, na mesma feature, é o que faz o buscador desconfiar das
  // duas. `numberOfItems` conta a lista que sai, senão o número contradiz a lista logo abaixo dele.
  const listados = artigos.filter((a) => !a.registro.seo?.ocultarDeBuscadores);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: titulo,
    url: new URL(caminho, SITE_URL).toString(),
    ...(description ? { description } : {}),
    isPartOf: { "@id": ID_DO_SITE },
    inLanguage: "pt-BR",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: listados.length,
      itemListElement: listados.map((a, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: new URL(`/${handle}/${a.registro.handle}`, SITE_URL).toString(),
        name: tituloDaPaginaOuEndereco(doc, a.id, a.registro.handle),
      })),
    },
  };
}
