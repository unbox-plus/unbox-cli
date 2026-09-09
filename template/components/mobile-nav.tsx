"use client";

import * as React from "react";
import Link from "next/link";
import { List, Storefront, Tag, Package, User, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export interface NavCategory { id: string; name: string; slug: string }

export function MobileNav({
  categories,
  shopName,
  /** Classes do BOTÃO que abre o menu. O default é o comportamento histórico (só mobile);
   *  variantes de header que usam drawer também no desktop passam o seu (ver
   *  components/chrome/headers/). O painel em si é igual em qualquer largura. */
  triggerClassName = "text-[var(--store-ink)] md:hidden",
}: {
  categories: NavCategory[];
  shopName: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button type="button" aria-label="Abrir menu" className={`flex h-10 w-10 items-center justify-center rounded-xl ${triggerClassName}`}>
            <List weight="bold" className="text-[24px]" />
          </button>
        }
      />
      <SheetContent side="left" showCloseButton className="store-layout w-[86vw] max-w-[340px] gap-0 bg-white p-0 text-[var(--store-ink)]">
        <SheetHeader className="border-b border-[var(--store-surface-2)] px-5 py-4">
          <SheetTitle className="text-left">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo do chrome: SVG de poucos KB. O next/image marcaria lazy num elemento que aparece em toda página (o preload scanner perde o recurso) e o reencode come o traço fino do lettering. Otimizar poucos KB não paga essas duas contas. */}
            <img src="/brand/logo.svg" alt={shopName} className="h-9 w-auto" />
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-1 overflow-y-auto p-3">
          <Row href="/produtos" icon={Storefront} label="Todos os produtos" onClick={close} />

          <div className="mt-2 px-3 pb-1 text-[11px] font-extrabold uppercase tracking-[1px] text-[var(--store-faint)]">Categorias</div>
          {categories.map((c) => (
            <Row key={c.id} href={`/categoria/${encodeURIComponent(c.slug)}`} icon={Tag} label={c.name} onClick={close} />
          ))}

          <div className="my-2 border-t border-[var(--store-surface-2)]" />
          <Row href="/conta/entrar" icon={Package} label="Acompanhar pedido" onClick={close} />
          <Row href="/conta" icon={User} label="Minha conta" onClick={close} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ href, icon: Icon, label, onClick }: { href: string; icon: React.ComponentType<any>; label: string; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold text-[var(--store-ink-2)] no-underline transition-colors hover:bg-[var(--store-primary-soft,#F1F1F3)] hover:text-[var(--store-primary,#18181B)]"
    >
      <Icon weight="bold" className="text-[19px] text-[var(--store-primary,#18181B)]" />
      <span className="flex-1">{label}</span>
      <CaretRight weight="bold" className="text-[12px] text-[var(--store-faint)]" />
    </Link>
  );
}
