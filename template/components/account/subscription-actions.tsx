"use client";

import * as React from "react";
import { Calendar, Plus } from "@/lib/icons";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Pause,
  Play,
  SkipForward,
  XCircle,
  MapPin,
  CreditCard,
  CircleNotch,
  ListChecks,
} from "@phosphor-icons/react/dist/ssr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  AddressFields,
  emptyAddress,
  type AddressValue,
} from "@/components/address-fields";
import { InlineAlert } from "@/components/account/subscription-editor/inline-alert";
import { AddProductPanel } from "@/components/account/subscription-editor/add-product-panel";
import type { CatalogProduct } from "@/components/account/subscription-editor/catalog-product-card";
import { VariantSwitcher, variantName } from "@/components/account/subscription-editor/variant-switcher";
import { SubscriptionEditorItem } from "@/components/account/subscription-editor/subscription-editor-item";
import { cn } from "@/lib/utils";
import { nameKey } from "@/lib/subscription-items";

const BTN_PRIMARY =
  "font-display inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--store-primary,#18181B)] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[var(--store-primary-dark,#09090B)] disabled:opacity-60";
const BTN_OUTLINE =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-[1.5px] border-[var(--store-line-2)] bg-white px-4 text-[14px] font-bold text-[var(--store-ink-2)] transition-colors hover:border-[var(--store-primary,#18181B)] hover:text-[var(--store-primary,#18181B)]";
const CHIP =
  "inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-[var(--store-line-2)] bg-white px-3.5 text-[13.5px] font-bold text-[var(--store-ink-2)] transition-colors hover:border-[var(--store-primary,#18181B)] hover:text-[var(--store-primary,#18181B)] disabled:opacity-60";
const CHIP_DANGER =
  "inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-[var(--store-sale-soft)] bg-white px-3.5 text-[13.5px] font-bold text-[var(--store-sale)] transition-colors hover:border-[var(--store-sale)] hover:bg-[var(--store-sale-soft)]";
const INPUT =
  "h-11 w-full rounded-xl border-[1.5px] border-[var(--store-line-2)] bg-white px-3.5 text-[14px] font-medium text-[var(--store-ink)] outline-none transition-colors focus:border-[var(--store-primary,#18181B)]";

interface Actions {
  canPause?: boolean;
  canSkipCycle?: boolean;
  canChangeAddress?: boolean;
  canChangeProductQuantity?: boolean;
  canAddProducts?: boolean;
  canRemoveProducts?: boolean;
}
export interface ItemDetalhe {
  titulo: string;
  variacao: string | null;
  foto?: string;
  unit: number | null;
  riscado: number | null;
  variantes?: { id: string; label: string; esgotado?: boolean }[];
}
interface Item {
  productId: string;
  variantId: string;
  quantity: number;
}

export function SubscriptionActions({
  recurringOrderId,
  status,
  actions,
  items,
  detalhes = {},
  catalogo = [],
  proximaEntrega,
}: {
  recurringOrderId: string;
  status: string;
  actions: Actions;
  items: Item[];
  detalhes?: Record<string, ItemDetalhe>;
  catalogo?: CatalogProduct[];
  proximaEntrega?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [addrOpen, setAddrOpen] = React.useState(false);
  const [cardOpen, setCardOpen] = React.useState(false);
  const [itemsOpen, setItemsOpen] = React.useState(false);
  const [etapa, setEtapa] = React.useState<"lista" | "adicionar">("lista"); // no mobile o painel de adicionar ocupa o lugar da lista
  const [removidos, setRemovidos] = React.useState<Set<number>>(new Set()); // índices marcados; só saem ao salvar

  const [addr, setAddr] = React.useState<AddressValue>(emptyAddress);
  const [card, setCard] = React.useState({
    cardHolder: "",
    cardNumber: "",
    expirationMonth: "",
    expirationYear: "",
    securityCode: "",
  });
  const [editItems, setEditItems] = React.useState<Item[]>(items);

  const temVariantes = Object.values(detalhes).some((d) => d.variantes && d.variantes.length > 1); // trocar variante vale mesmo sem nenhuma flag
  const podeAdicionar = !!actions.canAddProducts && catalogo.length > 0;
  const canceled = status === "CANCELED";
  const paused = status === "PAUSED";

  async function run(
    action: string,
    payload: Record<string, any> = {},
    label = "Pronto",
  ) {
    setBusy(action);
    try {
      const res = await fetch(`/api/subscriptions/${recurringOrderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Erro inesperado.");
      toast.success(label);
      router.refresh();
      return true;
    } catch (e: any) {
      toast.error(e.message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  if (canceled) {
    return (
      <p className="mt-4 text-sm text-[var(--store-muted)]">
        Esta assinatura está cancelada.
      </p>
    );
  }

  return (
    <div className="mt-6">
      <h4 className="font-display mb-3 text-[var(--store-ink)]">
        Gerenciar assinatura
      </h4>
      <div className="flex flex-wrap gap-2">
        {actions.canPause && (
          <button
            type="button"
            className={CHIP}
            disabled={!!busy}
            onClick={() =>
              run(
                "pause",
                {},
                paused ? "Assinatura retomada." : "Assinatura pausada.",
              )
            }
          >
            {busy === "pause" ? (
              <CircleNotch className="animate-spin" />
            ) : paused ? (
              <Play weight="fill" />
            ) : (
              <Pause weight="bold" />
            )}{" "}
            {paused ? "Retomar" : "Pausar"}
          </button>
        )}
        {actions.canSkipCycle && (
          <button
            type="button"
            className={CHIP}
            disabled={!!busy}
            onClick={() => run("skip", {}, "Próximo ciclo adiado.")}
          >
            {busy === "skip" ? (
              <CircleNotch className="animate-spin" />
            ) : (
              <SkipForward weight="bold" />
            )}{" "}
            Pular próximo ciclo
          </button>
        )}
        {actions.canChangeAddress && (
          <button
            type="button"
            className={CHIP}
            onClick={() => setAddrOpen(true)}
          >
            <MapPin weight="bold" /> Trocar endereço
          </button>
        )}
        <button
          type="button"
          className={CHIP}
          onClick={() => setCardOpen(true)}
        >
          <CreditCard weight="bold" /> Trocar cartão
        </button>
        {(actions.canChangeProductQuantity ||
          actions.canAddProducts ||
          actions.canRemoveProducts ||
          temVariantes) && (
          <button
            type="button"
            className={CHIP}
            onClick={() => {
              setEditItems(items);
              setRemovidos(new Set());
              setEtapa("lista");
              setItemsOpen(true);
            }}
          >
            <ListChecks weight="bold" /> Alterar itens
          </button>
        )}
        <button
          type="button"
          className={CHIP_DANGER}
          onClick={() => setCancelOpen(true)}
        >
          <XCircle weight="bold" /> Cancelar
        </button>
      </div>

      {/* Cancelar */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
            <AlertDialogDescription>
              Você deixará de receber os próximos ciclos. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={BTN_OUTLINE}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              className="font-display inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--store-sale)] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[var(--store-sale)]"
              onClick={() =>
                run("cancel", {}, "Assinatura cancelada.").then(
                  (ok) => ok && setCancelOpen(false),
                )
              }
            >
              Cancelar assinatura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Endereço */}
      <Dialog open={addrOpen} onOpenChange={setAddrOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Trocar endereço de entrega</DialogTitle>
            <DialogDescription>
              O novo endereço valerá para os próximos ciclos.
            </DialogDescription>
          </DialogHeader>
          <AddressFields value={addr} onChange={setAddr} />
          <DialogFooter>
            <button
              type="button"
              className={BTN_OUTLINE}
              onClick={() => setAddrOpen(false)}
            >
              Voltar
            </button>
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={busy === "address"}
              onClick={() =>
                run("address", { address: addr }, "Endereço atualizado.").then(
                  (ok) => ok && setAddrOpen(false),
                )
              }
            >
              {busy === "address" ? (
                <CircleNotch className="animate-spin" />
              ) : null}{" "}
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cartão */}
      <Dialog open={cardOpen} onOpenChange={setCardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trocar cartão</DialogTitle>
            <DialogDescription>
              O novo cartão será usado nas próximas cobranças.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field
              id="s-ch"
              label="Nome no cartão"
              value={card.cardHolder}
              onChange={(v) => setCard({ ...card, cardHolder: v })}
            />
            <Field
              id="s-cn"
              label="Número"
              inputMode="numeric"
              value={card.cardNumber}
              onChange={(v) => setCard({ ...card, cardNumber: v })}
            />
            <div className="grid grid-cols-3 gap-2">
              <Field
                id="s-mm"
                label="Mês"
                inputMode="numeric"
                value={card.expirationMonth}
                onChange={(v) => setCard({ ...card, expirationMonth: v })}
              />
              <Field
                id="s-yy"
                label="Ano"
                inputMode="numeric"
                value={card.expirationYear}
                onChange={(v) => setCard({ ...card, expirationYear: v })}
              />
              <Field
                id="s-cvv"
                label="CVV"
                inputMode="numeric"
                value={card.securityCode}
                onChange={(v) => setCard({ ...card, securityCode: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              className={BTN_OUTLINE}
              onClick={() => setCardOpen(false)}
            >
              Voltar
            </button>
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={busy === "card"}
              onClick={() =>
                run("card", { card }, "Cartão atualizado.").then(
                  (ok) => ok && setCardOpen(false),
                )
              }
            >
              {busy === "card" ? (
                <CircleNotch className="animate-spin" />
              ) : null}{" "}
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Itens */}
      <Dialog open={itemsOpen} onOpenChange={setItemsOpen}>
        <DialogContent
          className={cn(
            "grid-cols-[minmax(0,1fr)] sm:max-w-2xl",
            // desktop: o modal nunca passa da tela; só o miolo rola, então Salvar e fechar ficam sempre visíveis
            "lg:max-h-[calc(100dvh-2rem)] lg:grid-rows-[auto_minmax(0,1fr)_auto]",
            podeAdicionar && "lg:max-w-4xl",
            // mobile: tela cheia nas duas etapas, então abrir, fechar e trocar de etapa não muda o tamanho do modal.
            // Sem animação de zoom (em tela cheia ela só pisca); o cabeçalho, o miolo e o rodapé são faixas.
            "max-lg:top-0 max-lg:left-0 max-lg:flex max-lg:h-dvh max-lg:max-w-none! max-lg:translate-x-0 max-lg:translate-y-0 max-lg:flex-col max-lg:gap-0 max-lg:rounded-none max-lg:p-0 max-lg:data-open:animate-none max-lg:data-closed:animate-none",
          )}
        >
          <DialogHeader
            className={cn(
              etapa === "lista" ? "max-lg:shrink-0 max-lg:border-b max-lg:p-4 max-lg:pr-14" : "sr-only lg:not-sr-only",
            )}
          >
            <DialogTitle>Alterar itens</DialogTitle>
            <DialogDescription>
              Ajuste as quantidades dos próximos ciclos.
            </DialogDescription>
          </DialogHeader>
          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-col gap-6 max-lg:flex-1 lg:flex-row lg:overflow-y-auto",
              etapa === "lista" ? "max-lg:overflow-y-auto max-lg:p-4" : "max-lg:overflow-hidden",
            )}
          >
            <div className={cn("flex min-w-0 flex-1 flex-col gap-4", etapa === "adicionar" && "hidden lg:flex")}>
          <InlineAlert variant="info" icon={Calendar} title={`As mudanças valem a partir da próxima entrega${proximaEntrega ? `, em ${proximaEntrega}` : ""}.`}>
            A entrega que já está a caminho não muda.
          </InlineAlert>
          <ul className="flex flex-col divide-y divide-[var(--store-surface-2)]">
            {editItems.map((it, i) => {
              const d = detalhes[nameKey(it)];
              const titulo = d?.titulo ?? it.productId;
              const before = items.find((x) => nameKey(x) === nameKey(it))?.quantity;
              const removido = removidos.has(i);
              return (
                <li key={`${it.productId}:${i}`} className="py-3.5 first:pt-0">
                  <VariantSwitcher
                    name={d?.variacao ? variantName(d.variacao) : ""}
                    value={it.variantId}
                    options={(d?.variantes ?? []).map((o) => {
                      const jaTem = editItems.some((x, j) => j !== i && x.productId === it.productId && x.variantId === o.id);
                      return {
                        id: o.id,
                        label: o.label,
                        disabled: jaTem || o.esgotado,
                        disabledReason: jaTem ? "Já está na sua assinatura" : o.esgotado ? "Esgotado" : undefined,
                      };
                    })}
                    onSwap={(v) => setEditItems((arr) => arr.map((x, j) => (j === i ? { ...x, variantId: v } : x)))}
                  >
                    {({ link, panel }) => (
                      <SubscriptionEditorItem
                        item={{
                          name: titulo,
                          image: d?.foto,
                          variant: d?.variacao,
                          quantity: it.quantity,
                          price: d?.unit,
                          compareAtPrice: d?.riscado,
                          previousQuantity: before,
                          status: d?.variantes?.find((v) => v.id === it.variantId)?.esgotado ? "outOfStock" : undefined,
                        }}
                        canChangeQuantity={actions.canChangeProductQuantity}
                        canRemove={actions.canRemoveProducts}
                        isLastActiveItem={editItems.length - removidos.size <= 1 && !removido}
                        isNew={i >= items.length}
                        isRemoved={removido}
                        variantAction={link}
                        onQuantityChange={(q) => setEditItems((arr) => arr.map((x, j) => (j === i ? { ...x, quantity: q } : x)))}
                        onRemove={() => setRemovidos((s) => new Set(s).add(i))}
                        onUndo={() =>
                          setRemovidos((s) => {
                            const n = new Set(s);
                            n.delete(i);
                            return n;
                          })
                        }
                      >
                        {panel}
                      </SubscriptionEditorItem>
                    )}
                  </VariantSwitcher>
                </li>
              );
            })}
          </ul>
              {podeAdicionar && (
                <button type="button" className={cn(BTN_OUTLINE, "lg:hidden")} onClick={() => setEtapa("adicionar")}>
                  <Plus aria-hidden weight="bold" /> Adicionar produto
                </button>
              )}
            </div>
            {podeAdicionar && (
              <AddProductPanel
                className={cn(etapa === "lista" && "hidden lg:flex", "lg:border-l lg:border-[var(--store-surface-2)] lg:pl-6")}
                catalog={catalogo}
                subscribedKeys={new Set(editItems.map(nameKey))}
                onAdd={(novo) => setEditItems((arr) => [...arr, novo])}
                onBack={() => setEtapa("lista")}
              />
            )}
          </div>
          <DialogFooter className={cn("max-lg:mx-0 max-lg:mb-0 max-lg:shrink-0 max-lg:rounded-none max-lg:bg-white max-lg:pb-[max(1rem,env(safe-area-inset-bottom))]", etapa === "adicionar" && "hidden lg:flex")}>
            <button
              type="button"
              className={BTN_OUTLINE}
              onClick={() => setItemsOpen(false)}
            >
              Voltar
            </button>
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={busy === "items"}
              onClick={() =>
                run("items", { items: editItems.filter((_, j) => !removidos.has(j)) }, "Itens atualizados.").then(
                  (ok) => ok && setItemsOpen(false),
                )
              }
            >
              {busy === "items" ? (
                <CircleNotch className="animate-spin" />
              ) : null}{" "}
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  ...rest
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "id"
>) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold text-[var(--store-ink-2)]">
        {label}
      </span>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT}
        {...rest}
      />
    </label>
  );
}
