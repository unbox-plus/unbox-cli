"use client";

// TRUST BAR clara — selos de confiança logo abaixo do hero. Os itens vêm da RECEITA
// (props.items: [{ icon?, text }]); o selo de frete grátis entra sozinho quando a loja tem a
// regra real (store-config). Sem itens e sem frete grátis, a seção não renderiza: "Entrega
// rápida para todo o Brasil" e "Satisfação garantida" são promessas do lojista, não da foundation.
//
// EDITOR: os selos são uma LISTA editável (ícone e texto por item; o lojista reordena, oculta e
// duplica). O selo de frete tem id de PAPEL (`frete`) porque só existe quando a configuração
// existe; os da receita são posicionais (`selo-N`). O VALOR do frete (R$X) fica fora do primitivo:
// é configuração da loja, não copy (README do editor, §8). O invólucro do item é display:contents,
// então quem continua sendo a célula do grid é o próprio <div> do selo.
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Truck, Lightning, LockSimple, SealCheck, Package, Heart, Clock, Shield, CreditCard, ChatCircle } from "@phosphor-icons/react/dist/ssr";
import { Editable } from "@/lib/editable";
import type { SectionComponentProps } from "./registry";

export const TRUST_ICONS: Record<string, PhosphorIcon> = {
  truck: Truck, lightning: Lightning, lock: LockSimple, seal: SealCheck, package: Package,
  heart: Heart, clock: Clock, shield: Shield, card: CreditCard, chat: ChatCircle,
};
export type TrustItem = { icon?: string; text: string };

type Selo = { id: string; label: string; icon: PhosphorIcon; text: string; /** o selo de frete: o valor vem da configuração e fica fora do texto editável */ frete?: boolean };

export function TrustBarSection({ data, sectionProps = {} }: SectionComponentProps) {
  const custom = (sectionProps.items as TrustItem[] | undefined) ?? [];
  const items: Selo[] = [
    ...(data.freeShipLabel ? [{ id: "frete", label: "Selo de frete grátis", icon: Truck, text: "Frete Grátis acima de", frete: true }] : []),
    ...custom.filter((t) => t?.text).map((t, i) => ({ id: `selo-${i + 1}`, label: `Selo ${i + 1}`, icon: (t.icon && TRUST_ICONS[t.icon]) || SealCheck, text: t.text })),
  ];
  if (items.length === 0) return null;
  const cols = items.length >= 4 ? "md:grid-cols-4" : items.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";
  return (
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[18px] sm:px-6">
      <div className={`grid grid-cols-2 store-card rounded-2xl ${cols}`}>
        <Editable.Sections nested>
          {items.map((t, i) => (
            <Editable.Section key={t.id} item id={t.id} label={t.label}>
              <div className="flex items-center gap-3 px-[22px] py-[18px]" style={{ borderRight: i < items.length - 1 ? "1px solid var(--store-surface-2)" : "none" }}>
                {/* a className era do ícone; vai para o invólucro do Icon para não descolar da linha */}
                <Editable.Icon path="icone" label="Ícone do selo" size={25} className="shrink-0 text-[25px] text-[var(--store-primary,#18181B)]">
                  <t.icon weight="fill" />
                </Editable.Icon>
                <div className="text-[13px] font-semibold leading-[1.35] text-[var(--store-ink-2)]">
                  <Editable.Text path="texto" fallback={t.text} label="Texto do selo" />
                  {t.frete ? <> {data.freeShipLabel}</> : null}
                </div>
              </div>
            </Editable.Section>
          ))}
        </Editable.Sections>
      </div>
    </div>
  );
}
