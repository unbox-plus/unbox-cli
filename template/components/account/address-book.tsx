"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, PencilSimple, Trash, CircleNotch } from "@phosphor-icons/react/dist/ssr";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { AddressFields, emptyAddress, type AddressValue } from "@/components/address-fields";
import { EmptyState } from "@/components/empty-state";

const BTN_PRIMARY = "font-display inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--store-primary,#18181B)] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[var(--store-primary-dark,#09090B)] disabled:opacity-60";
const BTN_OUTLINE = "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-[1.5px] border-[var(--store-line-2)] bg-white px-4 text-[14px] font-bold text-[var(--store-ink-2)] transition-colors hover:border-[var(--store-primary,#18181B)] hover:text-[var(--store-primary,#18181B)]";

interface AddressBookItem {
  _id: string;
  alias?: string;
  fullName?: string;
  postal?: string;
  address1?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  region?: string;
  isShippingDefault?: boolean;
  isBillingDefault?: boolean;
}

export function AddressBook({ initial }: { initial: AddressBookItem[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | undefined>();
  const [value, setValue] = React.useState<AddressValue>(emptyAddress);
  const [busy, setBusy] = React.useState(false);

  const openNew = () => {
    setEditingId(undefined);
    setValue(emptyAddress);
    setOpen(true);
  };
  const openEdit = (a: AddressBookItem) => {
    setEditingId(a._id);
    setValue({
      ...emptyAddress,
      fullName: a.fullName ?? "",
      postal: a.postal ?? "",
      address1: a.address1 ?? "",
      number: a.number ?? "",
      neighborhood: a.neighborhood ?? "",
      city: a.city ?? "",
      region: a.region ?? "",
    });
    setOpen(true);
  };

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: { ...value, _id: editingId } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Erro ao salvar.");
      toast.success("Endereço salvo.");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch("/api/account/addresses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Erro ao remover.");
      toast.success("Endereço removido.");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={openNew} className={BTN_PRIMARY}><Plus weight="bold" /> Novo endereço</button>
      </div>

      {initial.length === 0 ? (
        <EmptyState title="Nenhum endereço salvo" description="Adicione um endereço para agilizar suas compras." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {initial.map((a) => (
            <li key={a._id} className="flex flex-col rounded-lg border border-[var(--store-line)] bg-white p-4">
              <div className="text-sm">
                <p className="font-display text-[15px] font-bold text-[var(--store-ink)]">{a.alias || a.fullName}</p>
                <p className="mt-0.5 text-[var(--store-ink-2)]">{a.address1}, {a.number} · {a.neighborhood}</p>
                <p className="text-[var(--store-muted)]">{a.city}/{a.region} · {a.postal}</p>
                {(a.isShippingDefault || a.isBillingDefault) && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {a.isShippingDefault && <Tag>Entrega padrão</Tag>}
                    {a.isBillingDefault && <Tag>Cobrança padrão</Tag>}
                  </div>
                )}
              </div>
              <div className="mt-3.5 flex gap-2 border-t border-[var(--store-surface-2)] pt-3">
                <button type="button" onClick={() => openEdit(a)} className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-bold text-[var(--store-primary,#18181B)]"><PencilSimple weight="bold" /> Editar</button>
                <button type="button" onClick={() => remove(a._id)} className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-bold text-[var(--store-muted)] transition-colors hover:text-[var(--store-sale)]"><Trash weight="bold" /> Remover</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar endereço" : "Novo endereço"}</DialogTitle>
            <DialogDescription>Preencha os dados de entrega.</DialogDescription>
          </DialogHeader>
          <AddressFields value={value} onChange={setValue} />
          <DialogFooter>
            <button type="button" onClick={() => setOpen(false)} className={BTN_OUTLINE}>Cancelar</button>
            <button type="button" onClick={save} disabled={busy} className={BTN_PRIMARY}>
              {busy ? <CircleNotch className="animate-spin" /> : null} Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--store-primary-soft)] bg-[var(--store-primary-soft,#F1F1F3)] px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--store-primary,#18181B)]">{children}</span>
  );
}
