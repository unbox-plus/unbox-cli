"use client"

import * as React from "react"

import {
  CatalogProductCard,
  type AddedItem,
  type CatalogProduct,
} from "@/components/account/subscription-editor/catalog-product-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CaretLeft } from "@phosphor-icons/react/dist/ssr"
import { Search } from "@/lib/icons"
import { cn } from "@/lib/utils"

const TODOS = "todos"
const MIN_PRODUTOS_PARA_BUSCA = 5 // a busca só aparece com mais que isso
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

// Etapa "Adicionar produto". No mobile ocupa o lugar da lista; a partir de 1024px é um painel fixo de 400px ao lado dela.
export function AddProductPanel({
  catalog,
  subscribedKeys,
  onAdd,
  onBack,
  className,
}: {
  catalog: CatalogProduct[]
  subscribedKeys: ReadonlySet<string>
  onAdd: (item: AddedItem) => void
  onBack: () => void
  className?: string
}) {
  const [tab, setTab] = React.useState(TODOS)
  const [query, setQuery] = React.useState("")
  const searchRef = React.useRef<HTMLInputElement>(null)
  const tabsRef = React.useRef<HTMLDivElement>(null)

  // a lista de abas rola na horizontal: a aba ativa nunca pode ficar escondida (nem ao abrir o painel)
  React.useEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>('[data-active]')
    const list = tabsRef.current
    if (el && list) list.scrollLeft = Math.max(0, el.offsetLeft - list.offsetLeft - 8)
  }, [tab])

  const categories = React.useMemo(() => [...new Set(catalog.flatMap((p) => p.categories ?? []))], [catalog])
  const showTabs = categories.length > 1
  const showSearch = catalog.length > MIN_PRODUTOS_PARA_BUSCA

  const q = semAcento(query.trim())
  const visible = catalog.filter(
    (p) => (tab === TODOS || p.categories?.includes(tab)) && (!q || semAcento(p.title).includes(q)),
  )

  const list = (
    <ul className="flex flex-col gap-3">
      {visible.map((p) => (
        <li key={p.productId}>
          <CatalogProductCard product={p} subscribedKeys={subscribedKeys} onAdd={handleAdd} />
        </li>
      ))}
    </ul>
  )

  function handleAdd(item: AddedItem) {
    onAdd(item)
    // mobile volta para a lista; no desktop a lista continua ao lado e o foco vai para a busca
    if (window.matchMedia("(min-width: 1024px)").matches) searchRef.current?.focus()
    else onBack()
  }

  const busca = showSearch && (
    <label className="flex shrink-0 flex-col gap-1.5">
      <span className="text-[13px] font-bold text-[var(--store-ink-2)]">Buscar produto</span>
      <span className="relative block">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-[var(--store-muted)]" />
        <Input
          ref={searchRef}
          type="search"
          placeholder="Digite o nome do produto"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 rounded-xl border-[var(--store-line-2)] bg-white pl-11 text-[15px] focus-visible:border-[var(--store-primary)]"
        />
      </span>
    </label>
  )
  const lista = visible.length > 0 && <div className="lg:max-h-[55vh] lg:overflow-y-auto lg:pr-1">{list}</div>

  // Mobile: tela cheia com três faixas. Cabeçalho e rodapé brancos e fixos; só o miolo (abas, busca, lista), em fundo
  // diferente, rola. A partir de 1024px vira um cartão com borda ao lado da lista.
  return (
    <section
      aria-label="Adicionar produto"
      className={cn(
        "flex min-h-0 w-full min-w-0 flex-col bg-white max-lg:flex-1 lg:w-[400px] lg:shrink-0 lg:gap-4 lg:rounded-2xl lg:border lg:border-[var(--store-line)] lg:p-4",
        className,
      )}
    >
      <header className="flex shrink-0 items-start gap-2 border-b border-[var(--store-line)] px-4 py-3 pr-14 lg:border-0 lg:p-0">
        <Button type="button" variant="ghost" size="icon-sm" className="-ml-1 shrink-0 lg:hidden" aria-label="Voltar" onClick={onBack}>
          <CaretLeft aria-hidden weight="bold" />
        </Button>
        <div className="min-w-0">
          <h3 className="font-display text-[var(--store-ink)]">Adicionar produto</h3>
          <p className="mt-1 text-[13px] text-[var(--store-muted)]">Aparecem aqui só os produtos disponíveis para assinatura.</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-[var(--store-surface-2)] p-4 lg:overflow-visible lg:bg-transparent lg:p-0">
        {showTabs ? (
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="min-w-0 gap-4">
            <TabsList ref={tabsRef} className="h-auto w-full shrink-0 justify-start gap-2 overflow-x-auto bg-transparent p-1 pb-2 group-data-horizontal/tabs:h-auto [scrollbar-width:thin]">
              {[TODOS, ...categories].map((c) => (
                <TabsTrigger
                  key={c}
                  value={c}
                  className="h-9 min-w-fit flex-none rounded-full border-[var(--store-line-2)] bg-white px-4 text-[13px] font-bold text-[var(--store-ink-2)] data-active:border-[var(--store-primary)] data-active:bg-[var(--store-primary)] data-active:text-white"
                >
                  {c === TODOS ? "Todos" : c}
                </TabsTrigger>
              ))}
            </TabsList>
            {busca}
            <TabsContent value={tab}>{lista}</TabsContent>
          </Tabs>
        ) : (
          <>
            {busca}
            {lista}
          </>
        )}

        {visible.length === 0 && <p className="py-6 text-center text-sm text-[var(--store-muted)]">Nenhum produto encontrado.</p>}
      </div>

      <footer className="shrink-0 border-t border-[var(--store-line)] bg-white p-4 lg:hidden">
        <Button type="button" variant="outline" className="h-11 w-full rounded-xl font-bold" onClick={onBack}>
          Voltar para meus produtos
        </Button>
      </footer>
    </section>
  )
}
