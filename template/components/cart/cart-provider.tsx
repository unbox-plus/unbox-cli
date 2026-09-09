"use client";

// Estado de carrinho no client. Conversa SÓ com o BFF (/api/cart*), nunca com a Unbox.
// Hidrata via GET /api/cart no mount; cada mutação atualiza o estado com o cart normalizado
// devolvido pelo BFF e exibe toasts para cartEvents (brinde/cupom) e avisos de quantidade.
import * as React from "react";
import { toast } from "sonner";
import type { UiCart } from "@/lib/cart-normalize";
import { cartEventLabel } from "@/lib/unbox/errors";
import { formatBRL } from "@/lib/format";
import { trackAddToCart, trackRemoveFromCart, trackViewCart } from "@/lib/analytics";

export interface AddItemArgs {
  productId: string;
  variantId: string;
  price: number;
  quantity?: number;
  thumbnail?: string;
  isRecurring?: boolean;
  recurringItemsFrequencyId?: string;
  title?: string;
}

export interface AppliedCoupon { code: string; discountId: string | null }

interface CartCtx {
  cart: UiCart | null;
  count: number;
  loading: boolean;
  /** true enquanto monta/restaura o carrinho a partir de um link (?produtos=/?cupom= ou ?id=&token=) */
  linkBuilding: boolean;
  /**
   * Incrementa a cada restauração bem-sucedida via ?id=&token= (link de recuperação de
   * carrinho). O checkout usa isso pra saber quando o e-mail/endereço do `cart` deve
   * SOBRESCREVER o que está no localStorage do dispositivo — "quem tem o link, manda".
   */
  linkRestoredAt: number;
  open: boolean;
  appliedCoupon: AppliedCoupon | null;
  setOpen: (v: boolean) => void;
  add: (item: AddItemArgs, opts?: { silent?: boolean }) => Promise<boolean>;
  updateQty: (cartItemId: string, quantity: number) => Promise<void>;
  remove: (cartItemId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => Promise<void>;
}

const Ctx = React.createContext<CartCtx | null>(null);

function showEvents(cart: UiCart | null) {
  for (const ev of cart?.cartEvents ?? []) toast.info(cartEventLabel(ev.type));
}

// Recalcula o resumo na hora (preço unitário × qtd) p/ subtotal/total atualizarem instantâneo ao
// mexer na quantidade/remover. Não estima o "total" quando há cupom (mantém o do servidor até reconciliar).
function estimateSummary(c: UiCart, items: UiCart["items"]): UiCart["summary"] {
  const amt = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  const hasDiscount = (c.discounts?.length ?? 0) > 0 || !!c.summary.discountTotal;
  return { ...c.summary, totalAmount: amt, itemTotal: formatBRL(amt), ...(hasDiscount ? {} : { total: formatBRL(amt) }) };
}

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Erro inesperado.");
  return data;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = React.useState<UiCart | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [appliedCoupon, setAppliedCoupon] = React.useState<AppliedCoupon | null>(null);
  // Espelho do carrinho para os handlers lerem o item ANTES da atualização otimista removê-lo
  // (remove_from_cart precisa do nome/preço do que saiu).
  const cartRef = React.useRef<UiCart | null>(null);
  cartRef.current = cart;

  // view_cart — toda vez que o mini-carrinho abre com item dentro.
  React.useEffect(() => {
    if (!open || !cart?.items?.length) return;
    trackViewCart(
      cart.items.filter((i) => !i.isBonus).map((i) => ({ id: i.productId, name: i.title, variant: i.variantTitle, price: i.unitPrice, quantity: i.quantity })),
      cart.summary.totalAmount,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // add/updateQty/remove/applyCoupon/removeCoupon/refresh cada um faz sua própria atualização
  // otimista + chamada de rede + setCart(d.cart), sem coordenação entre eles. Se duas mutações
  // se sobrepõem (remover um item enquanto ajusta a quantidade de outro, duplo-clique em
  // remover), a resposta que chega POR ÚLTIMO vencia mesmo tendo sido emitida antes e já
  // desatualizada — o item removido "voltava". mutationSeq resolve na raiz: cada mutação só
  // aplica sua resposta (ou o refresh() de recuperação de erro) se ainda for a mais recente em
  // curso; senão descarta em silêncio, confiando que a mutação mais nova reconcilia sozinha.
  const mutationSeq = React.useRef(0);

  const refresh = React.useCallback(async () => {
    const seq = ++mutationSeq.current;
    try {
      const d = await call("/api/cart");
      if (seq === mutationSeq.current) setCart(d.cart);
    } catch {
      /* silencioso na hidratação */
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  // Link de carrinho: ?produtos=SKU:qtd&cupom=CODE em QUALQUER URL (inclui /checkout, que fica
  // compartilhável). Monta o carrinho via API, MANTÉM os parâmetros na URL e abre o drawer (exceto
  // no checkout). Constrói uma vez por assinatura/sessão para não sobrescrever edições ao recarregar.
  const [linkBuilding, setLinkBuilding] = React.useState(false);
  const cartLinkRef = React.useRef(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || cartLinkRef.current) return;
    const u = new URL(window.location.href);
    const produtos = u.searchParams.get("produtos");
    const cupom = u.searchParams.get("cupom");
    if (!produtos && !cupom) return;
    cartLinkRef.current = true;
    const sig = `${produtos ?? ""}|${cupom ?? ""}`;
    try { if (sessionStorage.getItem("cartlink") === sig) return; } catch { /* ignora */ }
    setLinkBuilding(true);
    (async () => {
      try {
        await call("/api/cart/link?" + u.searchParams.toString(), { method: "POST" });
        try { sessionStorage.setItem("cartlink", sig); } catch { /* ignora */ }
        await refresh();
        if (!u.pathname.startsWith("/checkout")) setOpen(true);
      } catch { /* ignora — não trava a navegação */ } finally {
        setLinkBuilding(false);
      }
    })();
  }, [refresh]);

  // Link de RECUPERAÇÃO de carrinho: ?id=<cartId>&token=<cartToken> em QUALQUER URL (o checkout
  // é o destino típico, mas o provider roda em toda página). Valida no BFF antes de gravar o
  // cookie (rota recusa e não mexe no carrinho atual se o par for inválido/expirado — doc 12).
  const [linkRestoredAt, setLinkRestoredAt] = React.useState(0);
  const cartRestoreRef = React.useRef(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || cartRestoreRef.current) return;
    const u = new URL(window.location.href);
    const id = u.searchParams.get("id");
    const token = u.searchParams.get("token");
    const freq = u.searchParams.get("freq");
    if (!id || !token) return;
    cartRestoreRef.current = true;
    const sig = `${id}|${token}`;
    try { if (sessionStorage.getItem("cartlink-restore") === sig) return; } catch { /* ignora */ }
    setLinkBuilding(true);
    const seq = ++mutationSeq.current;
    (async () => {
      try {
        let linkUrl = `/api/cart/link?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`;
        if (freq) linkUrl += `&freq=${encodeURIComponent(freq)}`;
        const d = await call(linkUrl, { method: "POST" });
        if (seq === mutationSeq.current) {
          setCart(d.cart);
          setLinkRestoredAt(Date.now());
          if (!u.pathname.startsWith("/checkout")) setOpen(true);
        }
        try { sessionStorage.setItem("cartlink-restore", sig); } catch { /* ignora */ }
      } catch { /* link inválido/expirado — mantém o carrinho atual, sem toast alarmante */ } finally {
        if (seq === mutationSeq.current) setLinkBuilding(false);
      }
    })();
  }, []);

  const add = React.useCallback(async (item: AddItemArgs, opts?: { silent?: boolean }) => {
    const qty = item.quantity ?? 1;
    // OTIMISTA: reflete no carrinho imediatamente (badge + drawer), sem esperar o back.
    const tmpItem = {
      id: `tmp-${item.variantId}-${item.price}`,
      productId: item.productId, variantId: item.variantId,
      title: item.title ?? "Produto", quantity: qty,
      unitPrice: item.price, displayUnitPrice: formatBRL(item.price),
      thumbnail: item.thumbnail, isRecurring: item.isRecurring, isBonus: false,
    };
    setCart((c) => {
      // Primeiro item (carrinho ainda não carregado): cria um carrinho otimista p/ aparecer na hora.
      if (!c) {
        const amt = item.price * qty;
        return {
          cartId: "tmp", totalItemQuantity: qty, hasRecurring: !!item.isRecurring,
          items: [tmpItem], discounts: [], fulfillmentGroupIds: [], cartEvents: [],
          summary: { totalAmount: amt, itemTotal: formatBRL(amt), total: formatBRL(amt) },
        };
      }
      const items = [...c.items];
      const i = items.findIndex((it) => it.variantId === item.variantId && !it.isBonus && !it.isRecurring === !item.isRecurring);
      if (i >= 0) items[i] = { ...items[i], quantity: items[i].quantity + qty };
      else items.push(tmpItem);
      return { ...c, items, totalItemQuantity: (c.totalItemQuantity ?? 0) + qty };
    });
    if (!opts?.silent) setOpen(true); // abre o drawer na hora
    setLoading(true);
    const seq = ++mutationSeq.current;
    try {
      const d = await call("/api/cart", {
        method: "POST",
        body: JSON.stringify({
          items: [
            {
              productId: item.productId,
              productVariantId: item.variantId,
              price: item.price,
              quantity: qty,
              thumbnail: item.thumbnail,
              isRecurring: item.isRecurring,
            },
          ],
          recurringItemsFrequencyId: item.recurringItemsFrequencyId,
        }),
      });
      if (seq === mutationSeq.current) {
        setCart(d.cart); // reconcilia com o servidor (autoritativo) — só se ainda for a mais recente
        showEvents(d.cart);
        for (const w of d.warnings ?? []) toast.warning(w);
      }
      toast.success(item.title ? `“${item.title}” adicionado ao carrinho` : "Adicionado ao carrinho"); // confirma
      trackAddToCart({ id: item.productId, name: item.title ?? "Produto", price: item.price, quantity: qty });
      return true;
    } catch (e: any) {
      toast.error(e.message);
      if (seq === mutationSeq.current) await refresh(); // reverte ao estado real do servidor
      return false;
    } finally {
      if (seq === mutationSeq.current) setLoading(false);
    }
  }, [refresh]);

  const updateQty = React.useCallback(async (cartItemId: string, quantity: number) => {
    const cur = cartRef.current?.items.find((i) => i.id === cartItemId);
    if (cur && !cur.isBonus && quantity !== cur.quantity) {
      const delta = quantity - cur.quantity;
      const it = { id: cur.productId, name: cur.title, variant: cur.variantTitle, price: cur.unitPrice, quantity: Math.abs(delta) };
      if (delta > 0) trackAddToCart(it); else trackRemoveFromCart(it);
    }
    // OTIMISTA: atualiza quantidade E subtotal/total na hora; o servidor reconcilia em seguida.
    setCart((c) => {
      if (!c) return c;
      const items = c.items.map((it) => it.id === cartItemId ? { ...it, quantity } : it);
      return { ...c, items, totalItemQuantity: items.reduce((s, it) => s + it.quantity, 0), summary: estimateSummary(c, items) };
    });
    setLoading(true);
    const seq = ++mutationSeq.current;
    try {
      const d = await call("/api/cart/items", { method: "PATCH", body: JSON.stringify({ cartItemId, quantity }) });
      if (seq === mutationSeq.current) { setCart(d.cart); showEvents(d.cart); }
    } catch (e: any) {
      toast.error(e.message);
      if (seq === mutationSeq.current) await refresh();
    } finally {
      if (seq === mutationSeq.current) setLoading(false);
    }
  }, [refresh]);

  const remove = React.useCallback(async (cartItemId: string) => {
    const gone = cartRef.current?.items.find((i) => i.id === cartItemId);
    if (gone && !gone.isBonus) trackRemoveFromCart({ id: gone.productId, name: gone.title, variant: gone.variantTitle, price: gone.unitPrice, quantity: gone.quantity });
    // OTIMISTA: remove o item E atualiza subtotal/total na hora; o servidor reconcilia depois.
    setCart((c) => {
      if (!c) return c;
      const items = c.items.filter((it) => it.id !== cartItemId);
      return { ...c, items, totalItemQuantity: items.reduce((s, it) => s + it.quantity, 0), summary: estimateSummary(c, items) };
    });
    setLoading(true);
    const seq = ++mutationSeq.current;
    try {
      const d = await call("/api/cart/items", { method: "DELETE", body: JSON.stringify({ cartItemIds: [cartItemId] }) });
      if (seq === mutationSeq.current) { setCart(d.cart); showEvents(d.cart); }
    } catch (e: any) {
      toast.error(e.message);
      if (seq === mutationSeq.current) await refresh();
    } finally {
      if (seq === mutationSeq.current) setLoading(false);
    }
  }, [refresh]);

  const applyCoupon = React.useCallback(async (code: string) => {
    setLoading(true);
    const seq = ++mutationSeq.current;
    try {
      const d = await call("/api/cart/coupon", { method: "POST", body: JSON.stringify({ code }) });
      if (seq === mutationSeq.current) {
        setCart(d.cart);
        if (d.coupon) setAppliedCoupon(d.coupon);
        showEvents(d.cart);
      }
      toast.success("Cupom aplicado.");
      return true;
    } catch (e: any) {
      toast.error(e.message);
      return false;
    } finally {
      if (seq === mutationSeq.current) setLoading(false);
    }
  }, []);

  const removeCoupon = React.useCallback(async () => {
    if (!appliedCoupon?.discountId) {
      toast.error("Não foi possível identificar o cupom para remover.");
      return;
    }
    setLoading(true);
    const seq = ++mutationSeq.current;
    try {
      const d = await call("/api/cart/coupon", { method: "DELETE", body: JSON.stringify({ discountId: appliedCoupon.discountId }) });
      if (seq === mutationSeq.current) { setCart(d.cart); setAppliedCoupon(null); }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      if (seq === mutationSeq.current) setLoading(false);
    }
  }, [appliedCoupon]);

  const clear = React.useCallback(async () => {
    ++mutationSeq.current; // invalida qualquer mutação em voo — não pode "reviver" item após o clear
    await call("/api/cart", { method: "DELETE" });
    setCart(null);
    setAppliedCoupon(null);
  }, []);

  const count = cart?.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;

  const value: CartCtx = { cart, count, loading, linkBuilding, linkRestoredAt, open, appliedCoupon, setOpen, add, updateQty, remove, applyCoupon, removeCoupon, refresh, clear };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useCart deve ser usado dentro de <CartProvider>");
  return c;
}
