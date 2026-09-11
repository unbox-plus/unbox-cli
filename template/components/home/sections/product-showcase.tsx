"use client";

// Vitrine de produtos com fundo colorido por card (portado da vitrine de uma loja real em produção).
// Diferença importante: aqui os produtos e PREÇOS vêm do CATÁLOGO REAL (data.combos),
// não de constante hardcoded. A receita pode customizar título, cores de fundo e CTA.
//
// ── EDITOR: esta é a vitrine que o lojista ADICIONA pelo "+" ────────────────
// `Editable.Vitrine` deixa o LOJISTA escolher o que aparece aqui (uma categoria da Unbox, uma
// lista de produtos, ou uma busca). O documento guarda só a ESCOLHA; quem a transforma em produto
// com preço e estoque é a LOJA, no servidor (lib/vitrine.ts), e os produtos chegam prontos em
// `data.vitrines`.
//
// O CAMINHO NÃO É CONSTANTE. `path={CAMPO_VITRINE}` é RELATIVO à seção: o primitivo o resolve para
// `<container>.<id da seção>.vitrine` pelo escopo, e aqui embaixo `joinPath(ctx.scope, CAMPO_VITRINE)`
// deriva EXATAMENTE a mesma string para achar os produtos já resolvidos. Escrever o caminho
// completo à mão descolaria os dois lados no primeiro id renomeado, e aqui nem teria como
// funcionar: esta seção é um TIPO ADICIONÁVEL (sections/catalogo.ts), então o id só existe em
// tempo de execução (`novo-vitrine-de-produtos-2`, sorteado quando o lojista clica no "+").
//
// Duas vitrines na mesma página = dois ids = dois caminhos = DUAS ESCOLHAS INDEPENDENTES.
//
// FALLBACK = o que o código mostra hoje (`data.combos`). Enquanto o lojista não escolher, e
// também quando a escolha não resolve em nada (Unbox fora, categoria esvaziada, produto apagado),
// esta seção renderiza o mesmo HTML de antes. Vitrine vazia lê como loja quebrada.
//
// ── NA PRÉVIA, os produtos vêm pelo 4º argumento ──────────────────────────────────────────────
// O rascunho do editor não passa pelo servidor da loja: ele chega ao iframe por postMessage. Então,
// em modo edição, é o PRIMITIVO que pergunta à loja (`POST /api/unbox/vitrine`) o que a escolha do
// rascunho vira, e entrega em `previa`. `previa.produtos` GANHA de `data.vitrines` quando existe.
// Em produção `previa` é `undefined` e nada aqui muda.
import Link from "next/link";
import type * as React from "react";
import { CAMPO_VITRINE, Editable, useEditableContext, joinPath, type VitrineProdutoResolvido, type VitrineValue } from "@/lib/editable";
import { formatBRL } from "@/lib/format";
import type { SectionComponentProps } from "./registry";
import { Foto } from "@/components/ui/foto";

const DEFAULT_BGS = [
  "var(--store-primary-soft, #F1F1F3)",
  "var(--store-cta-soft, #FDF0DC)",
  "var(--store-surface-2)",
  "var(--store-sale-soft, #FBE7E7)",
];

/**
 * A TARJA DO "ESTA SEÇÃO NÃO VAI PARA O SITE": só na prévia.
 *
 * `style` inline, como as tarjas do primitivo: em produção ela não existe, e uma classe do CSS da
 * loja faria o aviso depender de estilo que outra loja pode não ter.
 */
const AVISO_SEM_PRODUTO: React.CSSProperties = {
  margin: "0 0 12px",
  padding: "8px 12px",
  borderRadius: 8,
  background: "#FEF3C7",
  color: "#7C2D12",
  font: "500 13px/1.4 system-ui, sans-serif",
};

/** O mínimo que um card precisa, venha ele do catálogo do código ou da escolha do lojista. */
interface CardDeVitrine {
  chave: string;
  slug: string;
  titulo: string;
  imagem: string | null;
  preco: string;
  esgotado: boolean;
}

export function ProductShowcaseSection({ data, sectionProps = {} }: SectionComponentProps) {
  const {
    title = "Escolha o seu",
    subtitle = "Os favoritos da loja, direto do catálogo.",
    ctaHref = "",
  } = sectionProps as Record<string, string>;
  const bgs = (sectionProps.backgrounds as string[] | undefined) ?? DEFAULT_BGS;
  const max = (sectionProps.max as number | undefined) ?? 4;

  // O MESMO caminho que o primitivo registra logo abaixo: derivado do escopo da seção,
  // nunca escrito à mão (ver o cabeçalho).
  const ctx = useEditableContext();
  const caminho = joinPath(ctx.scope, CAMPO_VITRINE);
  const doServidor = data.vitrines?.[caminho] ?? null;

  const doCodigo = data.combos.slice(0, max);
  // A escolha que o CÓDIGO representa: os produtos que esta seção lista hoje, na ordem em que
  // aparecem. É o que o painel mostra como estado atual antes do primeiro clique do lojista.
  // Vínculo pelo productId, não pelo slug: slug é editável no painel da Unbox (renomear produto,
  // ajuste de SEO) e, quando muda, o vínculo por slug para de resolver e o produto SOME da seção
  // sem erro nenhum. O id é estável. `resolverVitrine` aceita os dois, então o slug fica de reserva
  // para catálogo que não devolva id.
  const fallbackVitrine: VitrineValue = { modo: "produtos", produtos: doCodigo.map((p) => p.productId || p.slug) };

  // Produtos resolvidos (pelo servidor em produção, pela prévia no editor) → cards.
  const cardsDe = (lista: VitrineProdutoResolvido[], teto: number): CardDeVitrine[] =>
    lista.slice(0, teto).map((p) => ({
      chave: p.id,
      slug: p.slug,
      titulo: p.titulo,
      imagem: p.imagem,
      // `preco: null` = produto sem variante com preço no painel; `formatBRL` devolve "—".
      // Ausência honesta, nunca "R$ 0,00".
      preco: formatBRL(p.preco),
      esgotado: p.esgotado,
    }));

  const cardsDoCodigo: CardDeVitrine[] = doCodigo.map((p) => ({
    chave: p.slug,
    slug: p.slug,
    titulo: p.title,
    imagem: p.imageUrl,
    preco: p.displayPrice,
    esgotado: p.soldOut,
  }));

  // Sem catálogo nenhum a seção não tem o que mostrar. No modo edição ela CONTINUA na tela (com a
  // moldura vazia): sumindo dali, o lojista não conseguiria selecionar a vitrine para trocar a
  // escolha, que é justamente o que ele precisa fazer quando ela está vazia.
  if ((doServidor?.length ? cardsDe(doServidor, max) : cardsDoCodigo).length === 0 && !ctx.editing) return null;

  return (
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[var(--section-gap,52px)] sm:px-6">
      <div className="mx-auto mb-7 max-w-[560px] text-center">
        <Editable.Text as="h2" path="titulo" fallback={title} label="Título da vitrine" className="font-display" />
        <Editable.Text as="p" path="subtitulo" fallback={subtitle} label="Subtítulo da vitrine" className="mt-1.5 text-[15px] text-[var(--store-muted)]" />
      </div>
      {/* O primitivo só REGISTRA o caminho e devolve os atributos de seleção; em produção ele não
          põe nada no DOM: sem escolha do lojista, o HTML aqui é o mesmo de antes. */}
      <Editable.Vitrine path={CAMPO_VITRINE} label="Produtos desta vitrine" fallback={fallbackVitrine}>
        {(escolha, attrs, ref, previa) => {
          // No modo PRODUTOS a lista É a resposta: mostra tantos quantos o lojista escolheu, e o
          // `limite` gravado é ignorado. Nos outros modos o limite decide o tamanho, com o `max`
          // da receita como padrão.
          const teto = escolha.modo === "produtos" ? escolha.produtos.length : (escolha.limite ?? max);
          // a prévia (rascunho de agora) ganha do que o servidor resolveu (documento publicado)
          const resolvidos = previa?.produtos ?? doServidor;
          // LISTA VAZIA cai nos produtos do CÓDIGO, não numa grade em branco. É o que a página
          // publicada faz (`resolverVitrinesDoDocumento` deixa de fora o caminho que não resolveu em
          // nada), e a prévia tem de mostrar o que publicar vai dar. Quem avisa o lojista de que a
          // escolha dele não trouxe produto é a tarja âmbar do primitivo, que só existe na prévia.
          const cards = resolvidos && resolvidos.length ? cardsDe(resolvidos, teto) : cardsDoCodigo;
          // A PRÉVIA DESENHA A SEÇÃO; A PÁGINA PUBLICADA NÃO. Sem nenhum produto (nem da escolha do
          // lojista, nem do código), a seção devolve `null` no site (a linha lá em cima). No editor
          // ela CONTINUA na tela, para ele conseguir clicar e trocar a escolha, e a frase avisa que o
          // site não vai mostrá-la assim. Só sai quando dá para AFIRMAR: com a prévia carregando ou
          // em erro, não se sabe.
          const foraDoSite = ctx.editing && cards.length === 0 && !previa?.carregando && !previa?.erro;
          return (
            <>
              {foraDoSite ? <p style={AVISO_SEM_PRODUTO}>Sem nenhum produto para mostrar, esta seção não aparece no site. Escolha os produtos dela para ela ir ao ar.</p> : null}
              <div ref={ref as React.Ref<HTMLDivElement>} {...attrs} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {cards.map((p, i) => (
                  <Link key={p.chave} href={ctaHref || `/produto/${encodeURIComponent(p.slug)}`} className="group flex flex-col overflow-hidden rounded-2xl no-underline transition-transform hover:scale-[1.015]" style={{ background: bgs[i % bgs.length] }}>
                    <div className="flex aspect-square items-center justify-center p-6">
                      {p.imagem
                        ? <Foto src={p.imagem} alt={p.titulo} width={560} height={560} sizes="(min-width: 1024px) 280px, 45vw" className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105" />
                        : <span className="font-display text-[42px] font-extrabold text-[var(--store-primary,#18181B)]/30">{p.titulo.charAt(0)}</span>}
                    </div>
                    <div className="px-5 pb-5 text-center">
                      <div className="font-display text-[16px] font-extrabold leading-[1.25] text-[var(--store-ink)]">{p.titulo}</div>
                      <div className="mt-1.5 text-[14.5px] font-bold text-[var(--store-primary,#18181B)]">{p.preco}</div>
                      <span className="font-display mt-3 inline-block rounded-full bg-[var(--store-primary,#18181B)] px-5 py-2 text-[13px] font-extrabold text-white transition-colors group-hover:bg-[var(--store-primary-dark,#09090B)]">
                        {p.esgotado ? "esgotado" : "comprar"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          );
        }}
      </Editable.Vitrine>
    </div>
  );
}
