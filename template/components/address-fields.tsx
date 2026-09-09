"use client";

import * as React from "react";
import { Loader2 } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskCep, onlyDigits } from "@/lib/format";

export interface AddressValue {
  fullName: string;
  taxPayerId: string;
  postal: string;
  address1: string;
  number: string;
  address2?: string;
  neighborhood: string;
  city: string;
  region: string;
  phone: string;
}

export const emptyAddress: AddressValue = {
  fullName: "", taxPayerId: "", postal: "", address1: "", number: "",
  address2: "", neighborhood: "", city: "", region: "", phone: "",
};

// Campos de endereço com autofill por CEP (/api/cep/[code]). a11y: cada input tem <Label> + autocomplete.
export function AddressFields({
  value,
  onChange,
}: {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
}) {
  const [cepLoading, setCepLoading] = React.useState(false);
  const set = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch });

  const onCepBlur = async () => {
    const cep = onlyDigits(value.postal);
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`/api/cep/${cep}`);
      const data = await res.json();
      if (res.ok && data.address) {
        set({
          address1: data.address.address1 || value.address1,
          neighborhood: data.address.neighborhood || value.neighborhood,
          city: data.address.city || value.city,
          region: data.address.region || value.region,
        });
      }
    } finally {
      setCepLoading(false);
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field className="sm:col-span-2" id="fullName" label="Nome completo" autoComplete="name"
        value={value.fullName} onChange={(v) => set({ fullName: v })} />
      <Field id="taxPayerId" label="CPF" inputMode="numeric" autoComplete="off"
        value={value.taxPayerId} onChange={(v) => set({ taxPayerId: v })} />
      <Field id="phone" label="Telefone (com DDD)" inputMode="tel" autoComplete="tel"
        value={value.phone} onChange={(v) => set({ phone: v })} />

      <div className="grid gap-1.5">
        <Label htmlFor="postal">CEP</Label>
        <div className="relative">
          <Input id="postal" inputMode="numeric" autoComplete="postal-code" value={value.postal}
            onChange={(e) => set({ postal: maskCep(e.target.value) })} onBlur={onCepBlur} />
          {cepLoading && <Loader2 className="absolute right-2 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
      </div>
      <Field id="region" label="UF" autoComplete="address-level1" maxLength={2}
        value={value.region} onChange={(v) => set({ region: v.toUpperCase().slice(0, 2) })} />

      <Field className="sm:col-span-2" id="address1" label="Endereço" autoComplete="address-line1"
        value={value.address1} onChange={(v) => set({ address1: v })} />
      <Field id="number" label="Número" autoComplete="off" value={value.number} onChange={(v) => set({ number: v })} />
      <Field id="address2" label="Complemento (opcional)" autoComplete="address-line2"
        value={value.address2 ?? ""} onChange={(v) => set({ address2: v })} />
      <Field id="neighborhood" label="Bairro" autoComplete="address-level3"
        value={value.neighborhood} onChange={(v) => set({ neighborhood: v })} />
      <Field id="city" label="Cidade" autoComplete="address-level2"
        value={value.city} onChange={(v) => set({ city: v })} />
    </div>
  );
}

function Field({
  id, label, value, onChange, className, ...rest
}: {
  id: string; label: string; value: string; onChange: (v: string) => void; className?: string;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "id">) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}
