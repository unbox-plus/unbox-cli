"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { CatalogProduct } from "@/components/account/subscription-editor/catalog-product-card";
import {
  SubscriptionItemsEditor,
  type EditorPermissions,
  type ItemDetalhe,
} from "@/components/account/subscription-editor/subscription-items-editor";
import type { SavedItem } from "@/lib/subscription-draft";
import { nameKey } from "@/lib/subscription-items";

export type { ItemDetalhe };

export const CANCEL_EVENT = "subscription:cancel";
export const EDIT_ITEMS_EVENT = "subscription:edit-items"; // o botão "Alterar itens" (SubscriptionActions) pede para abrir o modal
export const EDIT_ITEMS_BUTTON_ID = "alterar-itens";
const LINK = "cursor-pointer border-none bg-transparent p-0 text-[13px] font-bold text-[var(--store-ink)] underline underline-offset-3";

// Uma lista ordenada de "produto:variante=quantidade", para comparar duas listas de itens.
const signature = (l: SavedItem[]) => l.map((i) => `${nameKey(i)}=${i.quantity}`).sort().join("|");

class SaveBlocked extends Error {
  constructor(message: string, readonly reload = false) {
    super(message);
  }
}

async function post(recurringOrderId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/subscriptions/${recurringOrderId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Erro inesperado.");
  return data;
}

// Seção "Itens" da assinatura: cabeçalho com a entrada para editar, a lista (children) e o modal. Dona do salvar:
// o backend não protege contra conflito nem contra envio duplicado, então é aqui que a página se protege.
export function SubscriptionItemsSection({
  recurringOrderId,
  status,
  actions,
  savedItems,
  details,
  catalog,
  nextDeliveryDate,
  children,
}: {
  recurringOrderId: string;
  status: string;
  actions: EditorPermissions;
  savedItems: SavedItem[];
  details: Record<string, ItemDetalhe>;
  catalog: CatalogProduct[];
  nextDeliveryDate?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const savingRef = React.useRef(false); // trava síncrona: o clique duplo chega antes do estado atualizar
  const basis = React.useRef(savedItems); // a lista que o cliente viu quando abriu o modal

  // Trocar a variante vale mesmo com as 3 flags desligadas; por isso ela também abre o modal.
  const canSwap = Object.values(details).some((d) => d.variantes && d.variantes.length > 1);
  const canEdit = !!(actions.canChangeProductQuantity || actions.canRemoveProducts || (actions.canAddProducts && catalog.length > 0) || canSwap);
  const onlyAdd = !!actions.canAddProducts && !actions.canChangeProductQuantity && !actions.canRemoveProducts;

  const focusEditButton = () => requestAnimationFrame(() => document.getElementById(EDIT_ITEMS_BUTTON_ID)?.focus());

  const active = status === "ACTIVE" && canEdit;
  React.useEffect(() => {
    if (!active) return;
    const openModal = () => {
      basis.current = savedItems;
      setSaveError(null);
      setOpen(true);
    };
    window.addEventListener(EDIT_ITEMS_EVENT, openModal);
    return () => window.removeEventListener(EDIT_ITEMS_EVENT, openModal);
  }, [active, savedItems]);

  async function save(payload: SavedItem[]) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const fresh = await post(recurringOrderId, { action: "get" });
      if (fresh.status !== "ACTIVE") throw new SaveBlocked("Esta assinatura não está mais ativa.", true);
      if (signature(fresh.items ?? []) !== signature(basis.current)) {
        throw new SaveBlocked("Os itens desta assinatura mudaram desde que você abriu a edição. Recarregamos a página para você ver a versão atual.", true);
      }
      await post(recurringOrderId, { action: "items", items: payload });
      toast.success("Itens atualizados.");
      setOpen(false);
      router.refresh(); // só depois da resposta 200: nada muda na página antes disso
      focusEditButton();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erro inesperado.");
      if (e instanceof SaveBlocked && e.reload) router.refresh();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  // Pausada: o modal não abre; o link leva ao botão de retomar
  const entry =
    canEdit && status === "PAUSED" ? (
      <a href="#gerenciar" className={LINK}>
        Reative a assinatura
      </a>
    ) : null;

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[13px] font-bold text-[var(--store-ink-2)]">Itens</p>
        {entry}
      </div>
      {children}
      <SubscriptionItemsEditor
        open={open}
        savedItems={savedItems}
        details={details}
        catalog={catalog}
        permissions={actions}
        initialStep={onlyAdd ? "add" : "list"}
        nextDeliveryDate={nextDeliveryDate}
        saving={saving}
        saveError={saveError}
        onSave={save}
        onClose={() => {
          setOpen(false);
          focusEditButton();
        }}
        onCancelSubscription={() => {
          setOpen(false);
          window.dispatchEvent(new Event(CANCEL_EVENT)); // quem abre a confirmação de cancelamento é SubscriptionActions
        }}
      />
    </>
  );
}
