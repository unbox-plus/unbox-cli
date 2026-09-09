"use client";

// Catálogo: hero + coleções + sidebar de filtros + grid, tudo client-side sobre o catálogo
// real (filtra/ordena/pagina em memória). Header/footer/carrinho são globais (layout).
import * as React from "react";
import { trackViewItemList, trackSelectItem, type TrackItem } from "@/lib/analytics";
import Link from "next/link";
import Image from "next/image";
import {
  Sparkle, SlidersHorizontal, Check, Tag, Plus,
  CaretRight, Spinner, X, FunnelSimple,
  SquaresFour, Rows, Truck, Lightning, LockSimple, SealCheck,
} from "@phosphor-icons/react/dist/ssr";
import { useCart } from "@/components/cart/cart-provider";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/store-config";
import { ProductGridCard } from "@/components/catalog/product-grid-card";
import { ComboCardCompact } from "@/components/home/combo-card-compact";
import type { ResolvedCombo } from "@/lib/enrichment/combos";
// EDITOR: a copy de marca desta página (nome no caminho, título da lista, aviso de lista vazia,
// cabeçalho dos kits, faixa de confiança, newsletter) mora no container "catalogo", que /produtos e
// /categoria/[tagSlug] declaram DE PROPÓSITO: é a mesma copy nas duas, e o painel diz "estas seções
// também aparecem em…". Só /produtos manda na ordem (`layout`); a categoria reaproveita com
// layout={false}. O que é catálogo (card, preço, filtro, ordenação, contador, paginação) não vira
// primitivo (README §8); esses blocos levam `data-editor-ignore`, que é o atributo que o gate respeita
// para não cobrar o que ficou fora por decisão.
import { Editable } from "@/lib/editable";

export interface CatalogProductItem {
  slug: string;
  title: string;
  weight: string;
  categories: string[];
  price: number;
  displayPrice: string;
  oldPrice: number | null;
  displayOld: string | null;
  offPct: number | null;
  imageUrl: string | null;
  productId: string;
  variantId: string | null;
  badge: { label: string; bg: string; fg: string } | null;
  soldOut: boolean;
}

/** Item do catálogo → item de tracking (GA4). `index` é a posição na lista exibida. */
function toTrackItem(p: CatalogProductItem, index?: number): TrackItem {
  const disc = p.oldPrice != null && p.oldPrice > p.price ? p.oldPrice - p.price : undefined;
  return { id: p.productId, name: p.title, price: p.price, discount: disc, category: p.categories?.[0], index };
}
export interface CatalogCategory { name: string; slug: string }

const PRICE_RANGES = [
  { key: "p1", label: "Até R$ 25", min: 0, max: 25 },
  { key: "p2", label: "R$ 25 – R$ 40", min: 25, max: 40 },
  { key: "p3", label: "R$ 40 – R$ 80", min: 40, max: 80 },
  { key: "p4", label: "Acima de R$ 80", min: 80, max: Infinity },
];


// Imagem própria para cada pill de categoria do catálogo.
// TODO: adicione os padrões de nome das categorias da sua loja aqui.
// As imagens ficam em /public/brand/coll/. Exemplo:
//   if (/nome-da-categoria/.test(n)) return "/brand/coll/nome-da-categoria.webp";
export function collImageSrc(name: string): string {
  const n = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  // Só o default existe na foundation. Adicione as suas imagens em public/brand/coll/ e
  // mapeie aqui — apontar pra arquivo que não existe mostra imagem quebrada na pill.
  void n;
  return "/brand/coll/default.png";
}

const PAGE = 12;
const STEP = 8;

// classes de cada selo da faixa de confiança (a lista é editável, item a item)
const SELO = "flex items-center gap-3.5 px-[26px] py-6";
const SELO_ICONE = "shrink-0 text-[28px] text-[var(--store-cta,#D97706)]";
const SELO_TEXTO = "text-[13px] font-medium leading-[1.4] text-[var(--store-chrome-muted)]";

export function CatalogClient({
  items,
  categories,
  bundles = [],
  initialCategory,
  // Nível do título dos resultados. Em /produtos e /categoria este é o ÚNICO título da
  // página, então precisa ser h1 (as duas estavam sem nenhum). Existe como prop para que
  // uma página futura que já tenha o seu próprio h1 possa pedir h2 — duas h1 numa página
  // é tão ruim quanto nenhuma.
  titleAs: TituloTag = "h1",
  layout = true,
}: {
  items: CatalogProductItem[];
  categories: CatalogCategory[];
  bundles?: ResolvedCombo[];
  initialCategory?: string;
  titleAs?: "h1" | "h2";
  /**
   * EDITOR: se esta página MANDA na ordem do container "catalogo" (README §3, `Editable.Sections`).
   * /produtos manda; /categoria/[tagSlug] reaproveita com `layout={false}`: a copy editada vale nas
   * duas, mas ordem, ocultas e cópias de seção se editam só em /produtos (o manifesto da categoria
   * sai com `semLayout`).
   */
  layout?: boolean;
}) {
  const { add } = useCart();
  const [cats, setCats] = React.useState<Set<string>>(new Set(initialCategory ? [initialCategory] : []));
  const [prices, setPrices] = React.useState<Set<string>>(new Set());
  const [deals, setDeals] = React.useState(false);
  const [sort, setSort] = React.useState("destaque");
  const [visible, setVisible] = React.useState(PAGE);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = React.useState(false);
  const [view, setView] = React.useState<"grid" | "list">("grid");

  const reset = React.useCallback(() => setVisible(PAGE), []);

  // produtos filtrados, ignorando categoria (para contadores dinâmicos por categoria)
  const baseForCounts = React.useMemo(() => {
    return items.filter((p) => {
      if (prices.size && !PRICE_RANGES.some((r) => prices.has(r.key) && p.price >= r.min && p.price < r.max)) return false;
      if (deals && !(p.oldPrice != null && p.oldPrice > p.price)) return false;
      return true;
    });
  }, [items, prices, deals]);

  const filtered = React.useMemo(() => {
    return baseForCounts.filter((p) => {
      if (cats.size && !p.categories.some((c) => cats.has(c))) return false;
      return true;
    });
  }, [baseForCounts, cats]);

  const sorted = React.useMemo(() => {
    const list = [...filtered];
    if (sort === "menor") list.sort((a, b) => a.price - b.price);
    else if (sort === "maior") list.sort((a, b) => b.price - a.price);
    // "destaque" mantém a ordem do catálogo (relevância do backend)
    return list;
  }, [filtered, sort]);

  const shown = sorted.slice(0, visible);

  const hasMore = visible < sorted.length;
  const allLoaded = sorted.length > PAGE && visible >= sorted.length;

  // infinite scroll
  const sentinel = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!hasMore) return;
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      if (es[0]?.isIntersecting) setVisible((v) => Math.min(v + STEP, sorted.length));
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, sorted.length]);

  const hasFilters = cats.size > 0 || prices.size > 0 || deals;
  function clearFilters() { setCats(new Set()); setPrices(new Set()); setDeals(false); reset(); }
  function toggleCat(c: string) { setCats((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n; }); reset(); }
  function onlyCat(c: string) { setCats(new Set([c])); reset(); }
  function togglePrice(k: string) { setPrices((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; }); reset(); }

  async function quickAdd(p: CatalogProductItem) {
    if (!p.productId || !p.variantId || p.soldOut) return;
    setBusyId(p.variantId);
    await add({ productId: p.productId, variantId: p.variantId, price: p.price, quantity: 1, thumbnail: p.imageUrl ?? undefined, title: p.title });
    setBusyId(null);
  }

  const resultTitle = cats.size === 1 ? [...cats][0] : deals ? "Ofertas" : "Todos os produtos";
  // view_item_list — a cada lista exibida (filtro/ordenação/paginação mudam a lista). Dedupe por
  // assinatura para não repetir o mesmo conjunto em re-render.
  const listSigRef = React.useRef("");
  React.useEffect(() => {
    if (!shown.length) return;
    const sig = resultTitle + "|" + shown.map((p) => p.productId).join(",");
    if (sig === listSigRef.current) return;
    listSigRef.current = sig;
    trackViewItemList(shown.map((p, i) => toTrackItem(p, i)), resultTitle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown.map((p) => p.productId).join(","), resultTitle]);

  const catCount = (name: string) => baseForCounts.filter((p) => p.categories.includes(name)).length;
  const freeShipLabel = FREE_SHIPPING_THRESHOLD != null ? `R$${FREE_SHIPPING_THRESHOLD}` : null;

  const chips = [
    ...[...cats].map((c) => ({ label: c, onRemove: () => toggleCat(c) })),
    ...PRICE_RANGES.filter((r) => prices.has(r.key)).map((r) => ({ label: r.label, onRemove: () => togglePrice(r.key) })),
    ...(deals ? [{ label: "Em promoção", onRemove: () => { setDeals(false); reset(); } }] : []),
  ];

  // filtro é mecânica do catálogo, não copy da marca (README §8): fora do editor e fora da conta do gate
  const Filters = (
    <div data-editor-ignore className="flex flex-col gap-[18px]">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[15px] font-extrabold text-[var(--store-ink)]"><SlidersHorizontal weight="bold" className="text-[var(--store-primary,#18181B)]" />Filtros</span>
        {hasFilters && <button type="button" onClick={clearFilters} className="text-[12.5px] font-bold text-[var(--store-sale)]">Limpar tudo</button>}
      </div>

      <div className="rounded-lg border border-[var(--store-line)] bg-[var(--store-surface)] px-[18px] py-4">
        <div className="mb-3 text-[13.5px] font-extrabold text-[var(--store-ink)]">Categoria</div>
        <div className="flex flex-col gap-2.5">
          {categories.map((c) => {
            const on = cats.has(c.name);
            return (
              <label key={c.slug} onClick={() => toggleCat(c.name)} className="flex cursor-pointer items-center gap-2.5 text-[13.5px]">
                <span className="flex h-[19px] w-[19px] items-center justify-center rounded-[6px] border-[1.5px]" style={{ borderColor: on ? "var(--store-primary,#18181B)" : "var(--store-faint)", background: on ? "var(--store-primary,#18181B)" : "var(--store-surface)" }}>
                  <Check weight="bold" className="text-[11px] text-white" style={{ opacity: on ? 1 : 0 }} />
                </span>
                <span className="flex-1" style={{ fontWeight: on ? 700 : 500, color: on ? "var(--store-primary,#18181B)" : "var(--store-ink-2)" }}>{c.name}</span>
                <span className="text-xs text-[var(--store-faint)]">{catCount(c.name)}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--store-line)] bg-[var(--store-surface)] px-[18px] py-4">
        <div className="mb-3 text-[13.5px] font-extrabold text-[var(--store-ink)]">Faixa de preço</div>
        <div className="flex flex-col gap-2.5">
          {PRICE_RANGES.map((r) => {
            const on = prices.has(r.key);
            return (
              <label key={r.key} onClick={() => togglePrice(r.key)} className="flex cursor-pointer items-center gap-2.5 text-[13.5px]">
                <span className="flex h-[19px] w-[19px] items-center justify-center rounded-[6px] border-[1.5px]" style={{ borderColor: on ? "var(--store-primary,#18181B)" : "var(--store-faint)", background: on ? "var(--store-primary,#18181B)" : "var(--store-surface)" }}>
                  <Check weight="bold" className="text-[11px] text-white" style={{ opacity: on ? 1 : 0 }} />
                </span>
                <span style={{ fontWeight: on ? 700 : 500, color: on ? "var(--store-primary,#18181B)" : "var(--store-ink-2)" }}>{r.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--store-line)] bg-[var(--store-surface)] px-[18px] py-4">
        <label onClick={() => { setDeals((d) => !d); reset(); }} className="flex cursor-pointer items-center justify-between gap-2.5">
          <span className="flex items-center gap-2 text-[13.5px] font-bold text-[var(--store-ink-2)]"><Tag weight="fill" className="text-[var(--store-sale)]" />Apenas em promoção</span>
          <span className="relative h-[23px] w-10 rounded-full transition-colors" style={{ background: deals ? "var(--store-primary,#18181B)" : "var(--store-line-2)" }}>
            <span className="absolute top-[2px] h-[19px] w-[19px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-all" style={{ left: deals ? 19 : 2 }} />
          </span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="store-layout full-bleed bg-white text-[var(--store-ink)]">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <Editable.Sections container="catalogo" layout={layout}>
          {/* A lista é a espinha da página: `fixed` = a copy edita, a posição e a visibilidade não. O aviso
              de lista vazia vive AQUI, dentro da coluna da grade, e não numa seção própria: uma Section solta
              com container= próprio entraria no "catalogo" sem `ordemNoCodigo` e travaria a reordenação das
              outras seções (`recusaDeOrdem`). */}
          <Editable.Section id="lista" kind="vitrine-de-produtos" label="Lista de produtos" fixed>
            {/* breadcrumb: "Início" é navegação; o nome desta página é copy */}
            <div className="flex items-center gap-2 pt-[18px] text-[13px] font-medium text-[var(--store-muted)]">
              <Link href="/" className="no-underline hover:text-[var(--store-ink)]" data-editor-ignore="">Início</Link>
              <CaretRight className="text-[11px]" />
              <Editable.Text path="pagina" fallback="Catálogo" label="Nome da página no caminho" className="font-semibold text-[var(--store-ink)]" />
            </div>

            {/* coleções em pills (estilo do modelo: thumb 48px + label): nomes de categoria vêm do catálogo */}
            {categories.length > 0 && (
              <div data-editor-ignore className="mt-[34px] flex gap-3 overflow-x-auto pb-4 [scrollbar-width:thin]">
                {categories.map((c) => {
                  const on = cats.has(c.name) && cats.size === 1 && !deals;
                  return (
                    <button key={c.slug} type="button" onClick={() => onlyCat(c.name)}
                      className="flex flex-none cursor-pointer items-center gap-[11px] rounded-full border-[1.5px] bg-white py-[7px] pl-2 pr-5 transition-all hover:border-[var(--store-primary,#18181B)] hover:shadow-[var(--store-shadow-soft)]"
                      style={{ borderColor: on ? "var(--store-primary,#18181B)" : "var(--store-line)" }}>
                      <Image src={collImageSrc(c.name)} alt="" width={48} height={48} className="h-12 w-12 flex-none object-contain" />
                      <span className="font-display whitespace-nowrap text-[14.5px] font-semibold text-[var(--store-ink)]">{c.name}</span>
                    </button>
                  );
                })}
                <button type="button" onClick={() => { setDeals((d) => !d); setCats(new Set()); reset(); }}
                  className="flex flex-none cursor-pointer items-center gap-[11px] rounded-full border-[1.5px] bg-white py-[7px] pl-2 pr-5 transition-all hover:border-[var(--store-primary,#18181B)] hover:shadow-[var(--store-shadow-soft)]"
                  style={{ borderColor: deals ? "var(--store-primary,#18181B)" : "var(--store-line)" }}>
                  <Image src={collImageSrc("ofertas")} alt="" width={48} height={48} className="h-12 w-12 flex-none object-contain" />
                  <span className="font-display whitespace-nowrap text-[14.5px] font-semibold text-[var(--store-ink)]">Ofertas</span>
                </button>
              </div>
            )}

            {/* main layout */}
            <div className="mt-7 grid grid-cols-1 items-start gap-8 lg:grid-cols-[264px_1fr]">
              {/* sidebar desktop */}
              <aside className="sticky top-6 hidden lg:block">{Filters}</aside>

              {/* coluna grid */}
              <div>
                {/* toolbar */}
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    {/* o título só é copy quando é o da lista completa; com filtro ele é o nome da categoria (catálogo) ou o rótulo do filtro */}
                    {cats.size === 1 ? (
                      <TituloTag className="font-display text-xl font-extrabold" data-editor-ignore="">{[...cats][0]}</TituloTag>
                    ) : deals ? (
                      <TituloTag className="font-display text-xl font-extrabold" data-editor-ignore="">Ofertas</TituloTag>
                    ) : (
                      <Editable.Text path="titulo" fallback="Todos os produtos" label="Título da lista completa" as={TituloTag} className="font-display text-xl font-extrabold" />
                    )}
                    {/* contador vem de dados */}
                    <p data-editor-ignore className="text-[13px] text-[var(--store-muted)]">{sorted.length} produtos encontrados</p>
                  </div>
                  {/* ordenação, grade/lista e o botão de filtros são interface */}
                  <div data-editor-ignore className="flex items-center gap-2.5">
                    <button type="button" onClick={() => setShowMobileFilters(true)} className="flex h-[46px] items-center gap-2 rounded-md border-[1.5px] border-[var(--store-line-2)] bg-white px-4 text-sm font-bold text-[var(--store-ink-2)] lg:hidden">
                      <FunnelSimple weight="bold" />Filtros{hasFilters ? ` (${chips.length})` : ""}
                    </button>
                    {/* view toggle grade/lista */}
                    <div className="hidden h-[46px] items-center rounded-md border-[1.5px] border-[var(--store-line-2)] bg-white p-1 sm:flex">
                      <button type="button" onClick={() => setView("grid")} aria-label="Grade" className="flex h-full w-9 items-center justify-center rounded-sm" style={{ background: view === "grid" ? "var(--store-primary-soft,#F1F1F3)" : "transparent", color: view === "grid" ? "var(--store-primary,#18181B)" : "var(--store-faint)" }}><SquaresFour weight="fill" /></button>
                      <button type="button" onClick={() => setView("list")} aria-label="Lista" className="flex h-full w-9 items-center justify-center rounded-sm" style={{ background: view === "list" ? "var(--store-primary-soft,#F1F1F3)" : "transparent", color: view === "list" ? "var(--store-primary,#18181B)" : "var(--store-faint)" }}><Rows weight="fill" /></button>
                    </div>
                    <div className="flex h-[46px] items-center gap-2 rounded-md border-[1.5px] border-[var(--store-line-2)] bg-white px-3.5">
                      <span className="hidden text-[13px] text-[var(--store-muted)] sm:inline">Ordenar:</span>
                      <select value={sort} onChange={(e) => { setSort(e.target.value); reset(); }} className="cursor-pointer bg-transparent text-sm font-bold text-[var(--store-ink)] outline-none">
                        <option value="destaque">Em destaque</option>
                        <option value="menor">Menor preço</option>
                        <option value="maior">Maior preço</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* chips: estado do filtro */}
                {chips.length > 0 && (
                  <div data-editor-ignore className="mt-3.5 flex flex-wrap gap-2">
                    {chips.map((c, i) => (
                      <button key={i} type="button" onClick={c.onRemove} className="flex items-center gap-1.5 rounded-full border border-[var(--store-primary-soft)] bg-[var(--store-primary-soft,#F1F1F3)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--store-primary,#18181B)]">
                        {c.label}<X weight="bold" className="text-[11px]" />
                      </button>
                    ))}
                  </div>
                )}

                {/* grid: o aviso de lista vazia é copy; os cards são catálogo */}
                {shown.length === 0 ? (
                  <div className="mt-5 rounded-xl border border-dashed border-[var(--store-line-2)] bg-[var(--store-surface)] px-5 py-[70px] text-center">
                    {/* o preflight faz `svg { display:block }`; o invólucro inline-flex do Icon criaria uma caixa de
                        linha (+6px medidos), então o ícone vai num flex centralizado, que devolve os 46px de antes */}
                    <div className="flex justify-center">
                      <Editable.Icon path="vazio.icone" label="Ícone da lista vazia" size={46} className="text-[46px] text-[var(--store-faint)]"><Sparkle /></Editable.Icon>
                    </div>
                    <Editable.Text path="vazio.titulo" fallback="Nenhum produto encontrado" label="Título da lista vazia" as="div" className="font-display mt-3 text-[17px] font-bold text-[var(--store-ink-2)]" />
                    <Editable.Text path="vazio.texto" fallback="Tente ajustar ou limpar os filtros aplicados." label="Texto da lista vazia" as="p" className="mt-1 text-sm text-[var(--store-muted)]" />
                    <button data-editor-ignore type="button" onClick={clearFilters} className="font-display mt-5 cursor-pointer rounded-md bg-[var(--store-primary,#18181B)] px-5 py-2.5 text-sm font-bold text-white">Limpar filtros</button>
                  </div>
                ) : (
                  <div data-editor-ignore className={view === "list" ? "mt-4 flex flex-col gap-3" : "mt-4 grid grid-cols-2 gap-[18px] sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4"}>
                    {shown.map((p) => (
                      <Card listName={resultTitle} key={p.slug} p={p} list={view === "list"} onAdd={() => quickAdd(p)} busy={busyId === p.variantId} />
                    ))}
                  </div>
                )}

                {/* load more: paginação */}
                {hasMore && (
                  <div ref={sentinel} data-editor-ignore className="flex flex-col items-center gap-3 py-9">
                    <span className="h-[34px] w-[34px] animate-spin rounded-full border-[3px] border-[var(--store-line-2)] border-t-[var(--store-primary,#18181B)]" />
                    <button type="button" onClick={() => setVisible((v) => Math.min(v + STEP, sorted.length))} className="rounded-md border-[1.5px] border-[var(--store-line-2)] bg-white px-[26px] py-2.5 text-sm font-bold text-[var(--store-primary,#18181B)]">Carregar mais</button>
                  </div>
                )}
                {allLoaded && <div data-editor-ignore className="py-9 text-center text-sm text-[var(--store-faint)]">Você viu todos os {sorted.length} produtos ✦</div>}
              </div>
            </div>
          </Editable.Section>

          {/* Kits e combos com desconto: combos do enrichment, versão compacta. A seção se registra sempre
              (como a KitsSection da home); o bloco só aparece quando há kit resolvido. */}
          <Editable.Section id="kits" kind="vitrine-de-produtos" label="Kits e combos">
            {bundles.length > 0 && (
              <div className="mt-12 rounded-xl border border-[var(--store-line)] bg-[var(--store-bg)] p-6 sm:p-7">
                <div className="mb-5">
                  <Editable.Text path="titulo" fallback="Kits & Combos com desconto" label="Título dos kits" as="h2" className="font-display text-[22px] font-extrabold" />
                  <Editable.Text path="subtitulo" fallback="Mais itens, mais economia: já com desconto." label="Subtítulo dos kits" as="p" className="mt-1 text-sm text-[var(--store-muted)]" />
                </div>
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
                  {bundles.map((c) => (
                    <ComboCardCompact key={c.id} combo={c} />
                  ))}
                </div>
              </div>
            )}
          </Editable.Section>

          {/* faixa de confiança (escura): lista editável de selos. O selo de frete grátis só existe com regra
              real configurada, e o id de cada selo é o PAPEL dele, não a posição: o selo condicional não
              desliza os outros (README §6, ids de item). A copy de fallback é só o que a foundation PODE
              afirmar: SSL, o prazo do CDC e a cobertura de envio. Prazo de entrega e garantia são promessas
              do lojista: ele as escreve aqui, no editor, com lastro. */}
          <Editable.Section id="confianca" kind="beneficios" label="Faixa de confiança">
            <div className={`mt-10 grid grid-cols-1 rounded-xl bg-[var(--store-chrome-bg)] sm:grid-cols-2 ${freeShipLabel ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
              <Editable.Sections nested>
                {freeShipLabel ? (
                  <Editable.Section item id="frete" label="Frete grátis">
                    <div className={SELO}>
                      <Editable.Icon path="icone" label="Ícone do frete grátis" size={28} className={SELO_ICONE}><Truck weight="fill" /></Editable.Icon>
                      {/* o valor vem da configuração da loja (FREE_SHIPPING_THRESHOLD): a frase é da marca, o número não */}
                      <Editable.Slot path="texto" type="text" fallback="Frete grátis acima de" label="Frase do frete grátis, sem o valor">
                        {(v, attrs, ref, estilo) => (
                          <div ref={ref} {...attrs} className={SELO_TEXTO} style={estilo}>{v} {freeShipLabel}</div>
                        )}
                      </Editable.Slot>
                    </div>
                  </Editable.Section>
                ) : null}
                <Editable.Section item id="entrega" label="Entrega">
                  <div className={SELO}>
                    <Editable.Icon path="icone" label="Ícone da entrega" size={28} className={SELO_ICONE}><Lightning weight="fill" /></Editable.Icon>
                    <Editable.Text path="texto" fallback="Entrega para todo o Brasil" label="Frase da entrega" as="div" className={SELO_TEXTO} />
                  </div>
                </Editable.Section>
                <Editable.Section item id="seguranca" label="Compra segura">
                  <div className={SELO}>
                    <Editable.Icon path="icone" label="Ícone da compra segura" size={28} className={SELO_ICONE}><LockSimple weight="fill" /></Editable.Icon>
                    <Editable.Text path="texto" fallback="Compra segura (SSL)" label="Frase da compra segura" as="div" className={SELO_TEXTO} />
                  </div>
                </Editable.Section>
                <Editable.Section item id="garantia" label="Garantia">
                  <div className={SELO}>
                    <Editable.Icon path="icone" label="Ícone da garantia" size={28} className={SELO_ICONE}><SealCheck weight="fill" /></Editable.Icon>
                    <Editable.Text path="texto" fallback="Troca em 7 dias · CDC" label="Frase da garantia" as="div" className={SELO_TEXTO} />
                  </div>
                </Editable.Section>
              </Editable.Sections>
            </div>
          </Editable.Section>

          {/* Sem seção de depoimentos no catálogo: a foundation trazia depoimentos fabricados com selo de
              verificação e uma nota fixa, e isso foi ao ar. Depoimento real entra pela seção reviews da home. */}

          {/* newsletter: a chamada é copy (em três partes, para manter o trecho sublinhado); campo e
              placeholder são interface do formulário e ficam fora (README §8) */}
          <Editable.Section id="newsletter" kind="newsletter" label="Newsletter">
            <div className="mt-12 flex min-h-[120px] flex-wrap items-center gap-7 overflow-hidden rounded-xl bg-[var(--store-cta,#D97706)] px-8 py-7">
              {/* TODO: personalize a oferta de boas-vindas */}
              <div className="font-display flex-1 text-[20px] font-extrabold leading-tight text-[var(--store-cta-fg,#1C1207)] sm:text-[23px]">
                <Editable.Text path="chamada.1" fallback="Cadastre-se e receba" label="Chamada (início)" />{" "}
                <Editable.Text path="chamada.destaque" fallback="ofertas exclusivas" label="Chamada (trecho sublinhado)" className="underline decoration-2 underline-offset-2" />{" "}
                <Editable.Text path="chamada.2" fallback="e novidades!" label="Chamada (fim)" />
              </div>
              <form className="flex w-full max-w-[480px] items-center gap-1.5 rounded-full bg-white p-1.5" onSubmit={(e) => e.preventDefault()}>
                <input type="email" placeholder="Seu melhor e-mail" className="h-11 min-w-0 flex-1 rounded-full bg-transparent px-4 text-sm outline-none" />
                {/* Slot, não Text: o <button> é filho direto de um flex e precisa manter type="submit" */}
                <Editable.Slot path="botao" type="text" fallback="EU QUERO!" label="Texto do botão">
                  {(v, attrs, ref, estilo) => (
                    <button ref={ref} {...attrs} type="submit" className="font-display h-11 shrink-0 rounded-full bg-[var(--store-primary,#18181B)] px-5 text-[15px] font-extrabold tracking-[0.5px] text-white" style={estilo}>{v}</button>
                  )}
                </Editable.Slot>
              </form>
            </div>
          </Editable.Section>
        </Editable.Sections>
        <div className="h-12" />
      </div>

      {/* mobile filters drawer: mecânica do filtro, fora do editor */}
      {showMobileFilters && (
        <div data-editor-ignore className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileFilters(false)} />
          <div className="absolute inset-y-0 left-0 w-[88vw] max-w-[340px] overflow-y-auto bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-lg font-extrabold">Filtros</span>
              <button type="button" onClick={() => setShowMobileFilters(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--store-line)]"><X weight="bold" /></button>
            </div>
            {Filters}
            <button type="button" onClick={() => setShowMobileFilters(false)} className="font-display mt-5 w-full rounded-xl bg-[var(--store-primary,#18181B)] py-3.5 text-sm font-bold text-white">Ver {sorted.length} produtos</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ p, list, onAdd, busy, listName }: {
  p: CatalogProductItem; list?: boolean; onAdd: () => void; busy: boolean; listName?: string;
}) {
  const canAdd = !!p.variantId && p.price > 0 && !p.soldOut;
  const addBtn = canAdd && (
    <button type="button" onClick={onAdd} disabled={busy} aria-label="Adicionar ao carrinho" className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[var(--store-primary,#18181B)] text-white shadow-[var(--store-shadow-cta-sm)] transition-colors hover:bg-[var(--store-primary-dark,#09090B)] disabled:opacity-60">
      {busy ? <Spinner className="animate-spin text-lg" /> : <Plus weight="bold" className="text-lg" />}
    </button>
  );
  const priceBlock = (
    <div>
      {p.displayOld && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--store-faint)] line-through">{p.displayOld}</span>
          {p.offPct != null && <span className="rounded bg-[var(--store-sale-soft)] px-1.5 py-0.5 text-[10px] font-extrabold text-[var(--store-sale)]">-{p.offPct}%</span>}
        </div>
      )}
      <div className="font-display text-[19px] font-extrabold leading-[1.1] text-[var(--store-primary,#18181B)]">{p.displayPrice}</div>
    </div>
  );

  // ----- modo LISTA (horizontal) -----
  if (list) {
    return (
      <div className="group flex items-center gap-4 overflow-hidden rounded-2xl border border-[var(--store-line)] bg-white p-3 transition-shadow duration-200 hover:shadow-[var(--store-shadow-hover)]">
        <Link href={`/produto/${encodeURIComponent(p.slug)}`} className="relative h-[96px] w-[96px] shrink-0 overflow-hidden rounded-xl bg-[var(--store-surface)]">
          {p.imageUrl ? <Image src={p.imageUrl} alt={p.title} fill sizes="96px" className="object-contain p-2" /> : <span className="flex h-full items-center justify-center text-xs text-[var(--store-faint)]">sem foto</span>}
        </Link>
        <div className="min-w-0 flex-1">
          {p.badge && <span className="mb-1 inline-block rounded-md px-2 py-0.5 text-[10px] font-extrabold tracking-[0.3px]" style={{ background: p.badge.bg, color: p.badge.fg }}>{p.badge.label}</span>}
          <Link href={`/produto/${encodeURIComponent(p.slug)}`} className="block text-sm font-bold leading-[1.25] text-[var(--store-ink)] no-underline line-clamp-2">{p.title}</Link>
          {p.weight && <div className="mt-0.5 text-xs text-[var(--store-muted)]">{p.weight}</div>}
        </div>
        <div className="flex flex-col items-end gap-2">{priceBlock}{addBtn}</div>
      </div>
    );
  }

  // ----- modo GRADE (vertical): card compartilhado (catálogo + home) -----
  return <ProductGridCard p={p} onAdd={onAdd} busy={busy} onSelect={() => trackSelectItem(toTrackItem(p), listName ?? "Catálogo")} />;
}
