"use client";

// Carrossel de produtos em destaque (combos/ofertas) com add-to-cart funcional.
// Âncora #destaques — alvo do CTA do hero.
//
// ── EDITOR: esta é a VITRINE DA HOME ────────────────────────────────────────
// `Editable.Vitrine` deixa o LOJISTA escolher o que aparece aqui (uma categoria da Unbox, uma lista
// de produtos ou uma busca). O documento guarda só a ESCOLHA; quem a transforma em produto com preço
// e estoque é a LOJA, no servidor (lib/vitrine.ts), e os produtos chegam prontos em `data.vitrines`.
//
// O CAMINHO NÃO É CONSTANTE. `path={CAMPO_VITRINE}` é RELATIVO à seção: o primitivo o resolve para
// `<container>.<id da seção>.vitrine` pelo escopo, e aqui `joinPath(ctx.scope, CAMPO_VITRINE)` deriva
// EXATAMENTE a mesma string para achar os produtos já resolvidos. Escrever o caminho completo à mão
// descola os dois lados no primeiro id renomeado, em silêncio.
//
// FALLBACK = o que o código mostra hoje (`data.combos`, a regra da página: kits, senão ofertas, senão
// destaques). Enquanto o lojista não escolher, e também quando a escolha não resolve em nada (Unbox
// fora, categoria esvaziada), esta seção renderiza o mesmo HTML de antes. Vitrine vazia lê como loja
// quebrada.
//
// O produto resolvido pela escolha traz id, título, foto, preço e estoque, mas não a VARIANTE. O card
// do catálogo já carregado (com variante, preço antigo e selo) é reaproveitado quando o produto está
// nele; fora dele, o card nasce mínimo: liga à página do produto e não tem o "+" do carrinho (regra do
// ProductGridCard: sem variantId, sem botão). Preço e nome continuam sendo dado do catálogo (§8).
//
// Na PRÉVIA os produtos vêm pelo 4º argumento do render-prop: o rascunho não passa pelo servidor da
// loja, então o primitivo pergunta à própria loja (`POST /api/unbox/vitrine`) e entrega em `previa`.
// `previa.produtos` GANHA de `data.vitrines`. Em produção `previa` é `undefined` e nada aqui muda.
import * as React from "react";
import Link from "next/link";
import { CaretLeft, CaretRight, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { useCart } from "@/components/cart/cart-provider";
import type { CatalogProductItem } from "@/components/catalog/catalog-client";
import { ProductGridCard } from "@/components/catalog/product-grid-card";
import { CAMPO_VITRINE, Editable, joinPath, useEditableContext, type VitrineProdutoResolvido, type VitrineValue } from "@/lib/editable";
import { formatBRL } from "@/lib/format";
import type { SectionComponentProps } from "./registry";

/** Quantos produtos a vitrine mostra quando a escolha do lojista não diz (o mesmo teto da página). */
const TETO_PADRAO = 10;

/** Produto resolvido pela escolha do lojista → item de card (ver o cabeçalho). */
function itemDaVitrine(p: VitrineProdutoResolvido, catalogo: CatalogProductItem[]): CatalogProductItem {
  const doCatalogo = catalogo.find((c) => c.productId === p.id || c.slug === p.slug);
  if (doCatalogo) return doCatalogo;
  return {
    slug: p.slug,
    title: p.titulo,
    weight: "",
    categories: [],
    price: p.preco ?? 0,
    // `preco: null` = produto sem variante com preço no painel; `formatBRL` devolve "—" (ausência honesta)
    displayPrice: formatBRL(p.preco),
    oldPrice: null,
    displayOld: null,
    offPct: null,
    imageUrl: p.imagem,
    productId: p.id,
    variantId: null,
    badge: null,
    soldOut: p.esgotado,
  };
}

export function CombosCarouselSection({ data }: SectionComponentProps) {
  const { add } = useCart();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const rowRef = React.useRef<HTMLDivElement | null>(null);

  // O MESMO caminho que o primitivo registra logo abaixo, derivado do escopo da seção.
  const ctx = useEditableContext();
  const doServidor = data.vitrines?.[joinPath(ctx.scope, CAMPO_VITRINE)] ?? null;
  // A escolha que o CÓDIGO representa: os produtos desta seção hoje, na ordem em que aparecem.
  // Vínculo pelo productId, não pelo slug: ver product-showcase.tsx. Slug muda no painel e o
  // produto some da seção em silêncio; o id é estável.
  const fallbackVitrine: VitrineValue = { modo: "produtos", produtos: data.combos.map((p) => p.productId || p.slug) };

  // Sem catálogo nenhum a seção não tem o que mostrar. No modo edição ela CONTINUA na tela: sumindo
  // dali, o lojista não conseguiria selecionar a vitrine para trocar a escolha.
  if (data.combos.length === 0 && !doServidor?.length && !ctx.editing) return null;

  async function quickAdd(p: CatalogProductItem) {
    if (!p.productId || !p.variantId || p.soldOut) return;
    setBusyId(p.variantId);
    await add({ productId: p.productId, variantId: p.variantId, price: p.price, quantity: 1, thumbnail: p.imageUrl ?? undefined, title: p.title });
    setBusyId(null);
  }
  const scrollRow = (dir: number) => rowRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });

  return (
    <div id="destaques" className="mx-auto max-w-[var(--container-max,1240px)] scroll-mt-24 px-4 pt-[42px] sm:px-6">
      <div className="mb-[18px] flex items-end justify-between gap-3">
        <div>
          {/* o título de partida é o que a página derivou do catálogo ("Destaques", "Ofertas em destaque") */}
          <Editable.Text as="h2" path="titulo" fallback={data.combosTitle} label="Título" className="font-display" />
          <Editable.Text as="p" path="subtitulo" fallback="Produtos em destaque para você." label="Subtítulo" className="mt-1 text-sm text-[var(--store-muted)]" />
        </div>
        <div className="hidden gap-2.5 sm:flex">
          <button type="button" onClick={() => scrollRow(-1)} aria-label="Anterior" className="flex h-[42px] w-[42px] items-center justify-center rounded-full border-[1.5px] border-[var(--store-line-2)] bg-white hover:border-[var(--store-primary,#18181B)]"><CaretLeft weight="bold" className="text-[var(--store-ink-2)]" /></button>
          <button type="button" onClick={() => scrollRow(1)} aria-label="Próximo" className="flex h-[42px] w-[42px] items-center justify-center rounded-full border-[1.5px] border-[var(--store-line-2)] bg-white hover:border-[var(--store-primary,#18181B)]"><CaretRight weight="bold" className="text-[var(--store-ink-2)]" /></button>
        </div>
      </div>
      {/* O primitivo só REGISTRA o caminho e devolve os atributos de seleção; em produção ele não
          põe nada no DOM: sem escolha do lojista, o HTML aqui é o mesmo de antes. */}
      <Editable.Vitrine path={CAMPO_VITRINE} label="Produtos desta vitrine" fallback={fallbackVitrine}>
        {(escolha, attrs, ref, previa) => {
          // No modo PRODUTOS a lista É a resposta: mostra tantos quantos o lojista escolheu. Nos
          // outros modos o limite decide o tamanho, com o teto da página como padrão.
          const teto = escolha.modo === "produtos" ? escolha.produtos.length : (escolha.limite ?? TETO_PADRAO);
          // a prévia (rascunho de agora) ganha do que o servidor resolveu (documento publicado)
          const resolvidos = previa?.produtos ?? doServidor;
          // LISTA VAZIA cai nos produtos do CÓDIGO, não numa fileira em branco: é o que a página
          // publicada faz (`resolverVitrinesDoDocumento` deixa de fora o caminho que não resolveu em
          // nada). Quem avisa o lojista é a tarja âmbar do primitivo, que só existe na prévia.
          const itens = resolvidos && resolvidos.length ? resolvidos.slice(0, teto).map((p) => itemDaVitrine(p, data.combos)) : data.combos;
          return (
            // dois refs num elemento só: o do carrossel (setas) e o do editor (seleção)
            <div ref={(el) => { rowRef.current = el; ref(el); }} {...attrs} className="flex gap-[18px] overflow-x-auto pb-3.5 [scrollbar-width:thin]">
              {itens.map((c) => (
                <div key={c.slug} className="w-[260px] flex-none">
                  <ProductGridCard p={c} busy={busyId === c.variantId} onAdd={() => quickAdd(c)} />
                </div>
              ))}
              {/* card final: ver todos os produtos (o destino é a mecânica do catálogo; as frases são copy) */}
              <Link
                href="/produtos"
                className="group flex w-[260px] flex-none flex-col items-center justify-center gap-3.5 rounded-2xl border-[1.5px] border-dashed border-[var(--store-primary-soft)] bg-white/60 p-6 text-center no-underline transition-colors hover:border-[var(--store-primary,#18181B)] hover:bg-[var(--store-primary-soft,#F1F1F3)]"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--store-primary-soft,#F1F1F3)] text-[var(--store-primary,#18181B)] transition-colors group-hover:bg-[var(--store-primary,#18181B)] group-hover:text-white">
                  <ArrowRight weight="bold" className="text-2xl" />
                </span>
                <Editable.Text path="ver-todos.titulo" fallback="Ver todos os produtos" label="Título do card de ver todos" className="font-display text-[17px] font-extrabold leading-[1.2] text-[var(--store-primary,#18181B)]" />
                <Editable.Text path="ver-todos.texto" fallback="Explore o catálogo completo" label="Texto do card de ver todos" className="text-[13px] text-[var(--store-muted)]" />
              </Link>
            </div>
          );
        }}
      </Editable.Vitrine>
    </div>
  );
}
