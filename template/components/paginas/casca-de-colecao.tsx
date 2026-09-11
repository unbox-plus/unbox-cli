"use client";

// ═══════════════════════════════════════════════════════════════════════════
// A CASCA DE UMA COLEÇÃO: a listagem dos artigos (`/<coleção>` e `/<coleção>/pagina/N`).
//
// Container próprio, `colecao-<endereço>`, com UMA seção fixa: o cabeçalho (título e descrição). É o
// que o lojista edita aqui. O RESTO da página é derivado dos artigos, e por isso não é editável: os
// cards mostram o título, o resumo, a foto, a data e a assinatura que cada ARTIGO tem, e trocá-los
// aqui faria a mesma frase existir em dois lugares, com duas respostas. Tudo isso leva
// `data-editor-ignore`, o atributo que o gate de cobertura respeita.
//
// A DESCRIÇÃO DA COLEÇÃO É EDITÁVEL de propósito: uma listagem sem texto próprio é uma página de
// categoria vazia aos olhos do buscador, e é o único texto que só existe aqui.
//
// ── PAGINAÇÃO COM URL PRÓPRIA ─────────────────────────────────────────────────
// `/<coleção>/pagina/2` em vez de `?page=2`: o segmento estático pré-renderiza com ISR, enquanto uma
// query obrigaria a rota a ser dinâmica em toda visita. Os links são `<Link>`, que renderiza um
// `<a href>` de verdade no HTML (o buscador precisa segui-los, e uma paginação feita com botão e
// JavaScript é uma listagem que ele nunca termina de ler), e há sempre um link para a primeira
// página, que é a que ele indexa.
// Sem `rel="prev"/"next"`: o Google não os usa mais, e cada página é canônica de si mesma.
// ═══════════════════════════════════════════════════════════════════════════
import Image from "next/image";
import Link from "next/link";
import { Editable, useEditableContext } from "@/lib/editable";
import { resolveValue, SECAO_CABECALHO, type ImageValue, type PaginaDoLojista } from "@/lib/editable/document";
import { dataDoArtigo } from "@/components/paginas/data-do-artigo";
import { enderecoComoTitulo } from "@/components/paginas/titulos";

/** um artigo da listagem: o registro (data, assinatura) e o container onde a copy dele mora */
export interface ArtigoDaLista {
  id: string;
  registro: PaginaDoLojista;
}

const SEM_IMAGEM: ImageValue = { src: "", alt: "" };

export function CascaDeColecao({
  handle,
  titulo,
  artigos,
  pagina,
  totalDePaginas,
}: {
  /** o endereço da coleção; o container é `colecao-<handle>` */
  handle: string;
  /** o título do CÓDIGO (o que a loja declara), usado enquanto o lojista não escreve o dele */
  titulo: string;
  /** os artigos DESTA página da listagem, já na ordem */
  artigos: ArtigoDaLista[];
  pagina: number;
  totalDePaginas: number;
}) {
  const ctx = useEditableContext();
  const id = `colecao-${handle}`;
  const temDescricao = Boolean(resolveValue(ctx.doc, `${id}.${SECAO_CABECALHO}.descricao`, "").trim());
  const rotaDaPagina = (n: number) => (n <= 1 ? `/${handle}` : `/${handle}/pagina/${n}`);

  return (
    // o fundo da MARCA, pelo motivo escrito em casca-de-pagina.tsx
    <div className="store-layout full-bleed bg-[var(--store-bg)] text-[var(--store-ink)]">
      <Editable.Sections container={id}>
        <Editable.Section id={SECAO_CABECALHO} kind="banner" label="Cabeçalho da coleção" fixed>
          <header className="mx-auto w-full max-w-[1240px] px-4 pt-7 sm:px-6">
            <nav data-editor-ignore="" aria-label="Você está aqui" className="flex items-center gap-2 text-[13px] font-medium text-[var(--store-muted)]">
              <Link href="/" className="no-underline hover:text-[var(--store-ink)]">Início</Link>
              <span aria-hidden="true">›</span>
              <span className="text-[var(--store-ink)]">{titulo}</span>
            </nav>
            <Editable.Text
              as="h1"
              path="titulo"
              fallback={titulo}
              label="Título"
              // `break-words` pelo motivo escrito em casca-de-pagina.tsx: o título é do lojista
              className="font-display mt-4 block break-words text-[clamp(28px,4.6vw,44px)] font-bold leading-[1.15] text-[var(--store-ink)]"
            />
            {temDescricao || ctx.editing ? (
              <Editable.Text
                as="p"
                path="descricao"
                fallback=""
                label="Descrição"
                multiline
                className="mt-4 block max-w-[720px] text-[17px] leading-[1.6] text-[var(--store-ink-2)]"
              />
            ) : null}
          </header>
        </Editable.Section>
      </Editable.Sections>

      <div data-editor-ignore="" className="mx-auto w-full max-w-[1240px] px-4 pb-14 pt-8 sm:px-6">
        {artigos.length === 0 ? (
          // A coleção existe (a loja declara o endereço dela) e ainda não tem artigo publicado. Dizer
          // isso é melhor que 404: a URL é da loja, pode estar no menu, e responder "não existe" em
          // uma página que existe é o tipo de sinal que tira o endereço do índice do buscador.
          <p className="rounded-[12px] border border-[var(--store-line)] bg-[var(--store-surface-2)] px-5 py-8 text-center text-[15px] text-[var(--store-ink-2)]">
            Ainda não há artigos publicados aqui.
          </p>
        ) : (
          <ul className="grid list-none grid-cols-1 gap-7 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {artigos.map((a) => (
              <CardDoArtigo key={a.id} artigo={a} colecao={handle} />
            ))}
          </ul>
        )}

        {totalDePaginas > 1 ? (
          <nav aria-label="Páginas da listagem" className="mt-10 flex flex-wrap items-center justify-center gap-3 text-[14px] font-medium">
            {pagina > 1 ? (
              <Link href={rotaDaPagina(pagina - 1)} className="rounded-full border border-[var(--store-line)] px-4 py-2 no-underline text-[var(--store-ink)] hover:border-[var(--store-ink)]">Anterior</Link>
            ) : null}
            {pagina > 2 ? (
              <Link href={rotaDaPagina(1)} className="rounded-full border border-[var(--store-line)] px-4 py-2 no-underline text-[var(--store-ink)] hover:border-[var(--store-ink)]">Primeira página</Link>
            ) : null}
            {/* "Página N de M" existe UMA vez na tela, e é aqui: junto de Anterior/Próxima, que é
                onde quem navega procura. Havia uma segunda logo abaixo do h1, dizendo o mesmo a
                poucos centímetros. Fora do editável: é estado de navegação, não copy. */}
            <span className="text-[var(--store-muted)]">Página {pagina} de {totalDePaginas}</span>
            {pagina < totalDePaginas ? (
              <Link href={rotaDaPagina(pagina + 1)} className="rounded-full border border-[var(--store-line)] px-4 py-2 no-underline text-[var(--store-ink)] hover:border-[var(--store-ink)]">Próxima</Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Um card. Título, resumo e foto saem de `values` pelo caminho do container DAQUELE artigo (é onde a
 * copy dele mora, e é isso que faz o card mudar junto com o artigo); data e assinatura saem do
 * registro. Nada aqui é primitivo: quem edita o texto é a página do artigo.
 */
function CardDoArtigo({ artigo, colecao }: { artigo: ArtigoDaLista; colecao: string }) {
  const ctx = useEditableContext();
  const base = `${artigo.id}.${SECAO_CABECALHO}`;
  const titulo = resolveValue(ctx.doc, `${base}.titulo`, "").trim() || enderecoComoTitulo(artigo.registro.handle);
  const resumo = resolveValue(ctx.doc, `${base}.resumo`, "").trim();
  const imagem = resolveValue(ctx.doc, `${base}.imagem`, SEM_IMAGEM) as ImageValue;
  const quando = dataDoArtigo(artigo.registro);
  const href = `/${colecao}/${artigo.registro.handle}`;

  return (
    <li className="group">
      <Link href={href} className="flex h-full flex-col gap-3 no-underline">
        {imagem.src ? (
          // `next/image`, A MESMA COISA QUE A PÁGINA DO ARTIGO USA (`Editable.Image`). Com `<img>`
          // puro, as duas telas obedeciam a listas de hosts DIFERENTES: a mesma foto abria no card e
          // dava 400 no artigo (o otimizador recusa host fora de `images.remotePatterns` em
          // next.config.ts), sem nada dizer por quê. Agora a foto de um host de fora falha nos dois
          // lugares, que é uma resposta só e conserta-se num lugar só. De quebra, o card deixa de
          // carregar um recurso de host arbitrário direto do navegador de quem visita.
          //
          // `width`/`height` são a PROPORÇÃO (16:10) e o tamanho de referência; quem manda no
          // desenho é o `aspect-[16/10] w-full` do CSS. Sem `priority`: a listagem inteira está
          // abaixo do cabeçalho, e `next/image` já nasce com carregamento preguiçoso.
          <Image
            src={imagem.src}
            alt={imagem.alt ?? ""}
            width={760}
            height={475}
            sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
            className="aspect-[16/10] w-full rounded-[12px] object-cover"
          />
        ) : null}
        {/* `break-words` pelo motivo escrito em casca-de-pagina.tsx: o título é do lojista, e num
            card de grade uma palavra longa empurra a coluna inteira */}
        <h2 className="font-display break-words text-[19px] font-semibold leading-[1.25] text-[var(--store-ink)] group-hover:underline">{titulo}</h2>
        {quando || artigo.registro.autor ? (
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--store-muted)]">
            {quando ? <time dateTime={quando.iso}>{quando.porExtenso}</time> : null}
            {quando && artigo.registro.autor ? <span aria-hidden="true">·</span> : null}
            {artigo.registro.autor ? <span>por {artigo.registro.autor}</span> : null}
          </p>
        ) : null}
        {resumo ? <p className="text-[14.5px] leading-[1.55] text-[var(--store-ink-2)]">{resumo}</p> : null}
      </Link>
    </li>
  );
}
