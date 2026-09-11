"use client";

// ═══════════════════════════════════════════════════════════════════════════
// A CASCA DE UMA PÁGINA DO LOJISTA (e de um artigo).
//
// É um MOLDE, como a PDP: uma casca serve todas as páginas avulsas e todos os artigos. O que muda de
// uma para outra é o CONTAINER (`pagina-<endereço>`, `artigo-<coleção>--<endereço>`), e é do container
// que sai a copy e a lista de seções. Nenhuma página tem código próprio, e nenhuma precisa.
//
// ── O QUE É DA CASCA E O QUE É DO LOJISTA ─────────────────────────────────────
// Da casca: UMA seção fixa, `cabecalho`, com o título (o h1 da página), o resumo e a imagem de
// destaque. Nada mais. O CORPO inteiro são seções criadas (`catalogoDasPaginas`), porque o corpo é o
// que ele escreve, e uma seção de conteúdo que viesse do código apareceria em toda página que ele
// criasse, sem ele ter pedido.
//
// ── O QUE FICA FORA DO EDITÁVEL (`data-editor-ignore`) ────────────────────────
// O caminho de migalhas, a data, o nome de quem assina e as tags do artigo NÃO são copy: são o
// REGISTRO da página, e quem os muda é a ficha dela no painel, não um clique no texto. Editáveis
// aqui, o lojista trocaria a data na tela sem trocar a do dado estruturado, e a página passaria a
// dizer duas coisas. O atributo é o mesmo que o gate de cobertura respeita.
//
// A DATA É UMA SÓ, e vem de `dataDoArtigo` (components/paginas/data-do-artigo.ts): o mesmo cálculo
// alimenta esta linha e o `BlogPosting` que a rota emite.
//
// ── A TARJA DE PÁGINA OCULTA ──────────────────────────────────────────────────
// Em produção uma página oculta é 404, e esta casca nem chega a renderizar. Em modo edição ela abre
// (é o único jeito de o lojista trabalhar nela antes de publicar), e então a tarja diz o estado, para
// ele não achar que já está no ar. Quem calcula o estado é a rota, no servidor: `visivelAgora`
// depende do relógio, e uma página agendada calculada no navegador daria hidratação divergente.
// ═══════════════════════════════════════════════════════════════════════════
import Link from "next/link";
import { Editable, useEditableContext } from "@/lib/editable";
import { resolveValue, SECAO_CABECALHO, type ImageValue, type PaginaDoLojista } from "@/lib/editable/document";
import type { HomeData } from "@/components/home/sections/registry";
import { catalogoDasPaginas } from "@/components/paginas/catalogo";
import { dataDoArtigo } from "@/components/paginas/data-do-artigo";
import { enderecoComoTitulo } from "@/components/paginas/titulos";

/**
 * SÓ O QUE A CASCA LÊ DO REGISTRO, e não o registro inteiro. A casca é de CLIENTE, então tudo o que
 * chega nesta prop viaja serializado no HTML da página. O registro carrega também o `seo` (título,
 * descrição, imagem, "ocultar de buscadores"), que é campo de SERVIDOR — quem o usa é o
 * `generateMetadata` e o JSON-LD — e que ia junto em toda página do lojista sem ninguém ler. Medido:
 * numa página com imagem de SEO recusada, a URL recusada continuava no HTML servido.
 *
 * É a mesma régua do `documentoSemPaginas` do app/layout.tsx, aplicada à prop.
 */
export type RegistroNaCasca = Pick<PaginaDoLojista, "tipo" | "handle" | "colecao" | "autor" | "tags" | "publicadoEm" | "criadoEm">;

/** um degrau do caminho de migalhas; o último (a página atual) não tem link */
export interface Migalha {
  nome: string;
  href?: string;
}

/** a arte que o lojista vê no lugar da imagem de destaque enquanto não sobe a dele (só em edição) */
const IMAGEM_PLACEHOLDER: ImageValue = { src: "/brand/ph/photo-a.svg", alt: "" };
const SEM_IMAGEM: ImageValue = { src: "", alt: "" };

export function CascaDePagina({
  id,
  registro,
  data,
  modo,
  migalhas,
  aviso,
}: {
  /** o container desta página: `pagina-<endereço>` ou `artigo-<coleção>--<endereço>` */
  id: string;
  registro: RegistroNaCasca;
  /** o mesmo `HomeData` da home: é o que alimenta a vitrine de produtos das seções criadas */
  data: HomeData;
  modo: "pagina" | "artigo";
  /** o caminho de migalhas, montado no servidor (o mesmo que vai para o `BreadcrumbList`) */
  migalhas: Migalha[];
  /** em modo edição, o estado da página quando ela não está no ar ("oculta", "agendada") */
  aviso?: string | null;
}) {
  const ctx = useEditableContext();
  const caminhoDaImagem = `${id}.${SECAO_CABECALHO}.imagem`;
  const caminhoDoResumo = `${id}.${SECAO_CABECALHO}.resumo`;
  // com fallback VAZIO: a pergunta é "o lojista pôs alguma?", e um fallback com arte responderia
  // sempre que sim. Sem imagem, em produção, a página começa pelo título, sem buraco no lugar da foto.
  const temImagem = Boolean((resolveValue(ctx.doc, caminhoDaImagem, SEM_IMAGEM) as ImageValue).src);
  const temResumo = Boolean(resolveValue(ctx.doc, caminhoDoResumo, "").trim());
  const quando = modo === "artigo" ? dataDoArtigo(registro) : null;
  const tags = modo === "artigo" ? (registro.tags ?? []) : [];

  return (
    // `--store-bg` (o fundo da marca), e não `bg-white`: medido no render, a casca pintava uma faixa
    // de branco puro de ponta a ponta sobre o fundo do `body`, com emenda visível onde ela acabava.
    // Toda página e todo artigo que o lojista publicasse nasceria nesse branco, fora da marca.
    <div className="store-layout full-bleed bg-[var(--store-bg)] text-[var(--store-ink)]">
      <Editable.Sections container={id} catalogo={catalogoDasPaginas(data)}>
        <Editable.Section id={SECAO_CABECALHO} kind="banner" label="Cabeçalho da página" fixed>
          <header className="mx-auto w-full max-w-[720px] px-4 pt-7 sm:px-6">
            {ctx.editing && aviso ? (
              <p data-editor-ignore="" className="mb-5 rounded-[10px] border border-[var(--store-line)] bg-[var(--store-surface-2)] px-4 py-2.5 text-[13px] font-medium text-[var(--store-ink-2)]">
                {aviso}
              </p>
            ) : null}

            {migalhas.length > 1 ? (
              <nav data-editor-ignore="" aria-label="Você está aqui" className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-[var(--store-muted)]">
                {migalhas.map((m, i) => (
                  <span key={`${m.nome}-${i}`} className="flex items-center gap-2">
                    {i > 0 ? <span aria-hidden="true">›</span> : null}
                    {m.href ? (
                      <Link href={m.href} className="no-underline hover:text-[var(--store-ink)]">{m.nome}</Link>
                    ) : (
                      <span className="text-[var(--store-ink)]">{m.nome}</span>
                    )}
                  </span>
                ))}
              </nav>
            ) : null}

            <Editable.Text
              as="h1"
              path="titulo"
              fallback={enderecoComoTitulo(registro.handle)}
              label="Título"
              // `break-words`: o título é texto do LOJISTA, e a régua da foundation limita o
              // TAMANHO dele, não o tamanho de uma palavra. Colar um link no campo de título dá uma
              // palavra de 62 caracteres, e medido a 375 px ela empurrava a página inteira
              // (scrollWidth 575 × clientWidth 375). Vale para o card e para a casca de coleção.
              className="font-display titulo-capa mt-4 block break-words text-[var(--store-ink)]"
            />

            {modo === "artigo" && (quando || registro.autor || tags.length) ? (
              <div data-editor-ignore="" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13.5px] text-[var(--store-muted)]">
                {quando ? <time dateTime={quando.iso}>{quando.porExtenso}</time> : null}
                {quando && registro.autor ? <span aria-hidden="true">·</span> : null}
                {registro.autor ? <span>por {registro.autor}</span> : null}
                {tags.length ? (
                  <span className="flex flex-wrap gap-2">
                    {tags.map((t) => (
                      <span key={t} className="rounded-full bg-[var(--store-surface-2)] px-2.5 py-1 text-[12px] font-medium text-[var(--store-ink-2)]">{t}</span>
                    ))}
                  </span>
                ) : null}
              </div>
            ) : null}

            {temResumo || ctx.editing ? (
              <Editable.Text
                as="p"
                path="resumo"
                fallback=""
                label="Resumo"
                multiline
                className="mt-5 block text-[17px] leading-[1.6] text-[var(--store-ink-2)]"
              />
            ) : null}
          </header>

          {temImagem || ctx.editing ? (
            <figure className="mx-auto mt-7 w-full max-w-[1240px] px-4 sm:px-6">
              {/* sem `loading="lazy"`: a imagem de destaque costuma ser o maior elemento da primeira
                  dobra, e adiar o carregamento dela piora o LCP da página inteira */}
              <Editable.Image
                path="imagem"
                fallback={IMAGEM_PLACEHOLDER}
                label="Imagem de destaque"
                width={1240}
                height={698}
                priority
                sizes="(max-width: 1240px) 100vw, 1240px"
                className="h-auto w-full rounded-[14px] object-cover"
              />
            </figure>
          ) : null}
        </Editable.Section>
      </Editable.Sections>
      <div className="pb-12" />
    </div>
  );
}
