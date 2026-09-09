"use client";

import * as React from "react";
import { toast } from "sonner";

export function PreferencesForm({
  initial,
}: {
  initial: { receiveNewOrderEmail: boolean; reuseDataBetweenShops: boolean };
}) {
  const [state, setState] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);

  async function update(patch: Partial<typeof state>) {
    const prev = state;
    const next = { ...state, ...patch };
    setState(next);
    setSaving(true);
    try {
      const res = await fetch("/api/account/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Erro ao salvar.");
      toast.success("Preferências atualizadas.");
    } catch (e: any) {
      toast.error(e.message);
      setState(prev); // reverte
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col divide-y divide-[var(--store-surface-2)] rounded-xl border border-[var(--store-line)] bg-white px-5">
      <Row
        label="Receber e-mail a cada novo pedido"
        desc="Avisamos quando um pedido é criado."
        checked={state.receiveNewOrderEmail}
        disabled={saving}
        onChange={(v) => update({ receiveNewOrderEmail: v })}
      />
      <Row
        label="Reutilizar meus dados entre lojas Unbox"
        desc="Agiliza o checkout em outras lojas da rede."
        checked={state.reuseDataBetweenShops}
        disabled={saving}
        onChange={(v) => update({ reuseDataBetweenShops: v })}
      />
    </div>
  );
}

function Row({ label, desc, checked, onChange, disabled }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <div className="text-[14.5px] font-bold text-[var(--store-ink)]">{label}</div>
        <div className="mt-0.5 text-[13px] text-[var(--store-muted)]">{desc}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative h-[26px] w-[46px] shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-60"
        style={{ background: checked ? "var(--store-primary,#18181B)" : "var(--store-line-2)" }}
      >
        <span className="absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-all" style={{ left: checked ? 23 : 3 }} />
      </button>
    </div>
  );
}
