import type { Metadata } from "next";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { getCatalog, getTopTags } from "@/lib/queries";
import { PAGE_SIZE } from "@/lib/catalog";
import { buildTagMap, mapCatalogItems } from "@/lib/catalog-map";
import { ProductGrid } from "@/components/catalog/product-grid";
import { Pager } from "@/components/catalog/pager";
import { EmptyState } from "@/components/empty-state";
import { SearchBox } from "@/components/search-box";
import { mockupOr } from "@/lib/mockup";
import { DataLayerReady } from "@/components/analytics/data-layer-ready";

export const metadata: Metadata = { title: "Busca", robots: { index: false } };

type SP = { q?: string; page?: string };

export default async function BuscaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [catalog, tags] = await Promise.all([
    q
      ? mockupOr(getCatalog({ first: PAGE_SIZE, offset, searchText: q }), ({ nodes: [], totalCount: 0 } as any), "busca/getCatalog")
      : Promise.resolve({ nodes: [], totalCount: 0 } as any),
    mockupOr(getTopTags(), [], "busca/getTopTags"),
  ]);

  const items = mapCatalogItems(catalog.nodes ?? [], buildTagMap(tags as any[]));
  const total = catalog.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hrefForPage = (p: number) => `/busca?q=${encodeURIComponent(q)}${p > 1 ? `&page=${p}` : ""}`;

  return (
    <div className="store-layout full-bleed bg-white text-[var(--store-ink)]">
      <DataLayerReady pageType="search" />
      <div className="mx-auto max-w-[1240px] px-4 py-7 sm:px-6">
        {/* breadcrumb */}
        <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--store-muted)]">
          <Link href="/" className="no-underline hover:text-[var(--store-ink)]">Início</Link>
          <CaretRight className="text-[11px]" />
          <span className="font-semibold text-[var(--store-ink)]">Busca</span>
        </div>

        <h1 className="font-display mt-4">Buscar produtos</h1>
        <SearchBox defaultValue={q} className="mt-4 max-w-xl" />

        <div className="mt-7">
          {!q ? (
            <EmptyState title="Digite o que procura" description="Busque pelo nome do produto ou categoria." />
          ) : items.length === 0 ? (
            <EmptyState title={`Nada encontrado para “${q}”`} description="Tente outros termos ou explore o catálogo completo.">
              <Link href="/produtos" className="font-display inline-flex h-11 items-center rounded-xl bg-[var(--store-primary,#18181B)] px-5 text-[14px] font-bold text-white no-underline transition-colors hover:bg-[var(--store-primary-dark,#09090B)]">
                Ver todos os produtos
              </Link>
            </EmptyState>
          ) : (
            <>
              <p className="mb-4 text-sm text-[var(--store-muted)]">
                <b className="text-[var(--store-ink)]">{total}</b> resultado(s) para “{q}”
              </p>
              <ProductGrid items={items} />
              <Pager page={page} totalPages={totalPages} hrefForPage={hrefForPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
