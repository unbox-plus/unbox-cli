// ═══════════════════════════════════════════════════════════════════════════
// O SEO DAS PÁGINAS DO CÓDIGO (foundation 16): a página inicial e o catálogo.
//
// O lojista escreve título, descrição e imagem de compartilhamento no editor (Configurações gerais →
// Como a loja aparece no Google), e o `generateMetadata` destas rotas lê do documento publicado. Até a
// foundation 16 isso só mudava com deploy: o título estava escrito no app/layout.tsx e a descrição vinha
// de uma variável lida no build. As páginas que o lojista CRIA têm o mesmo campo na ficha delas, e o SEO
// delas mora em lib/paginas-seo.ts.
//
// ── AS DECISÕES ───────────────────────────────────────────────────────────────
// · SEM EDIÇÃO, NADA MUDA: a rota emite exatamente o que emitia (a canônica, e no catálogo o título
//   "Catálogo"), herdando título, descrição e cartão social do layout. Ligar isto numa loja pronta não
//   mexe numa linha do HTML enquanto ninguém escrever nada.
// · TÍTULO DA PÁGINA INICIAL sai como o lojista escreveu (`absolute`): é o título da marca no Google, e
//   quem escreve já põe o nome da loja onde quiser. Nas outras rotas o `title.template` do layout põe
//   o nome no fim, como em toda página da loja. O painel mostra essa diferença antes de salvar
//   (`sufixoDoTitulo`).
// · CAMPO EM BRANCO herda: descrição sem texto do lojista é a de `NEXT_PUBLIC_SITE_DESCRIPTION`.
// · OPEN GRAPH REPETIDO POR INTEIRO, com a imagem da loja quando o lojista não escolheu outra: o App
//   Router substitui o objeto do layout, e `images` ausente apagaria o cartão (ver lib/paginas-seo.ts).
// · "OCULTAR DE BUSCADORES" NÃO EXISTE AQUI: na página inicial seria tirar a loja inteira do Google.
// · A LISTA `ROTAS_COM_SEO` é o que o layout declara ao editor. Rota nova só entra nela junto com o
//   `generateMetadata` que lê `metadadosDaRotaDoCodigo`: declarada sem ler, o lojista salvaria e o
//   Google continuaria vendo o título antigo.
// ═══════════════════════════════════════════════════════════════════════════
import "server-only";
import type { Metadata } from "next";
import { seoDaRota, type ContentDocument, type ManifestRotaComSeo } from "@/lib/editable/document";
import { SITE_NAME, imagemAbsoluta, imagensDoCartao } from "@/lib/paginas-seo";

/** o nome da loja no fim do título das páginas; o create-unbox-store reescreve o literal no scaffold */
export const NOME_NO_TITULO = "Minha Loja";
/** o que o `title.template` do app/layout.tsx acrescenta ao título de cada página */
export const SUFIXO_DO_TITULO = ` · ${NOME_NO_TITULO}`;
/** o título da página inicial enquanto o lojista não escreve outro (é o `title.default` do layout) */
export const TITULO_DA_LOJA = "Minha Loja · Compre Online";

const DESCRICAO_DO_AMBIENTE = process.env.NEXT_PUBLIC_SITE_DESCRIPTION?.trim() || undefined;

export type RotaDoCodigo = "/" | "/produtos";

/** o que cada rota emite sem edição: o título curto que o template completa (a página inicial usa o do layout) */
const TITULO_SEM_EDICAO: Record<RotaDoCodigo, string | undefined> = {
  "/": undefined,
  "/produtos": "Catálogo",
};

/** as rotas que o layout declara ao editor, com o que o Google já vê em cada uma */
export const ROTAS_COM_SEO: ManifestRotaComSeo[] = [
  { rota: "/", nome: "Página inicial", tituloAtual: TITULO_DA_LOJA, ...(DESCRICAO_DO_AMBIENTE ? { descricaoAtual: DESCRICAO_DO_AMBIENTE } : {}) },
  { rota: "/produtos", nome: "Catálogo", tituloAtual: `Catálogo${SUFIXO_DO_TITULO}`, sufixoDoTitulo: SUFIXO_DO_TITULO, ...(DESCRICAO_DO_AMBIENTE ? { descricaoAtual: DESCRICAO_DO_AMBIENTE } : {}) },
];

/** os metadados de uma página do código: o que o lojista escreveu por cima do que a rota já emitia */
export function metadadosDaRotaDoCodigo(doc: ContentDocument | null | undefined, rota: RotaDoCodigo): Metadata {
  const alternates = { canonical: rota };
  const semEdicao = TITULO_SEM_EDICAO[rota];
  const seo = seoDaRota(doc, rota);
  if (!seo) return { ...(semEdicao ? { title: semEdicao } : {}), alternates };

  const inicial = rota === "/";
  const escrito = seo.title ?? (inicial ? TITULO_DA_LOJA : semEdicao ?? NOME_NO_TITULO);
  // o cartão social não passa pelo `title.template`: o nome da loja entra aqui à mão, igual ao `<title>`
  const tituloCompleto = inicial ? escrito : `${escrito}${SUFIXO_DO_TITULO}`;
  const description = seo.description ?? DESCRICAO_DO_AMBIENTE;
  const imagem = imagemAbsoluta(seo.image?.src);
  const images = imagem ? [{ url: imagem, alt: seo.image?.alt || undefined }] : imagensDoCartao(undefined);
  return {
    title: inicial ? { absolute: escrito } : escrito,
    description,
    alternates,
    openGraph: { type: "website", locale: "pt_BR", siteName: SITE_NAME, url: rota, title: tituloCompleto, description, images },
    twitter: { card: "summary_large_image", title: tituloCompleto, description, images },
  };
}
