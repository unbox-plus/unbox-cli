"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, ArrowsClockwise, Alarm, Check, CheckCircle, Copy, CreditCard,
  Gift, Lightning, LockSimple, MapPin, Package, Plus, QrCode, SealCheck, ShieldCheck,
  Spinner, Trash, Truck, Warning, CaretUp,
} from "@phosphor-icons/react/dist/ssr";
import QRCode from "qrcode";
import { useCart } from "@/components/cart/cart-provider";
import { emptyAddress, type AddressValue } from "@/components/address-fields";
import { PaymentChips } from "@/components/product/pdp/payment-chips";
import {
  formatBRL, maskCep, maskCpf, maskPhone, maskCardNumber, onlyDigits, isValidCpf, isValidEmail, parseBRL,
  sanitizeName, sanitizeEmail, sanitizeText, sanitizeHouseNumber, sanitizeUf,
} from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD, GIFT_THRESHOLD, PIX_DISCOUNT_PCT } from "@/lib/store-config";
import { trackBeginCheckout, trackAddPaymentInfo, trackAddShippingInfo, trackPurchase, type TrackItem, type TrackUser } from "@/lib/analytics";

const FREE_SHIP_THRESHOLD = FREE_SHIPPING_THRESHOLD;

/** Itens do UiCart (sem brindes) → itens de tracking GA4/Meta. */
// Itens no formato de tracking. O desconto do carrinho (cupom/promoção) é rateado por item
// proporcionalmente ao subtotal de cada um, para que `discount` seja preenchido e a soma dos
// itens feche com o valor pago — o GA4 e a Meta esperam isso, e um relatório de cliente mostrou
// o custo de não fazer: `discount: 0` com preço de tabela numa venda com cupom de 100%.
function cartToTrackItems(items: any[] = [], discountTotal?: number): TrackItem[] {
  const real = items.filter((it) => !it.isBonus);
  const subtotal = real.reduce((s, it) => s + (it.unitPrice ?? 0) * (it.quantity ?? 1), 0);
  const disc = discountTotal && discountTotal > 0 && subtotal > 0 ? Math.min(discountTotal, subtotal) : 0;
  return real.map((it) => {
    const line = (it.unitPrice ?? 0) * (it.quantity ?? 1);
    const unitDiscount = disc ? (disc * (line / subtotal)) / (it.quantity ?? 1) : 0;
    return { id: it.productId, name: it.title, variant: it.variantTitle, price: it.unitPrice, discount: unitDiscount || undefined, quantity: it.quantity };
  });
}

interface Method { name: string; displayName: string; isEnabled: boolean }
interface ShipOption { methodId: string; displayName: string; price?: string; discountPrice?: string; days?: number }
interface Group { groupId: string; options: ShipOption[] }

export interface UpsellOffer {
  productId: string;
  variantId: string;
  name: string;
  weight: string;
  desc: string;
  imageUrl?: string | null;
  price: number;
  displayPrice: string;
  oldPrice: number | null;
}

const inputCls =
  "mt-[7px] h-[50px] w-full rounded-md border-[1.5px] border-[var(--store-line-2)] bg-white px-4 text-[15px] text-[var(--store-ink)] outline-none focus:border-[var(--store-primary,#18181B)]";
const lockedCls =
  "mt-[7px] h-[50px] w-full rounded-md border-[1.5px] border-[var(--store-line-2)] bg-[var(--store-surface)] px-4 text-[15px] text-[var(--store-ink-2)] outline-none";

export function CheckoutClient({
  methods,
  maxInstallments,
  acceptsCard,
  upsells,
  shopName,
}: {
  methods: Method[];
  maxInstallments: number;
  acceptsCard: boolean;
  upsells: UpsellOffer[];
  shopName: string;
}) {
  const router = useRouter();
  const { cart, refresh, add, remove, appliedCoupon, applyCoupon, removeCoupon, loading, linkBuilding, linkRestoredAt } = useCart();

  // Link do checkout segue o padrão real da Unbox (ex.: finalizar-pedido?id=&token=&step=1) —
  // permite reabrir direto numa etapa específica, não só sempre na 1.
  const initialStep = React.useMemo(() => {
    if (typeof window === "undefined") return 1;
    const n = Number(new URLSearchParams(window.location.search).get("step"));
    return n >= 1 && n <= 3 ? n : 1;
  }, []);
  const [step, setStep] = React.useState(initialStep);
  const [maxStep, setMaxStep] = React.useState(initialStep);
  const [email, setEmail] = React.useState("");
  const [address, setAddress] = React.useState<AddressValue>(emptyAddress);
  const [lockedByCep, setLockedByCep] = React.useState<{ address1: boolean; city: boolean; region: boolean }>({
    address1: false, city: false, region: false,
  });
  const [cepLoading, setCepLoading] = React.useState(false);

  const [groups, setGroups] = React.useState<Group[]>([]);
  const [selections, setSelections] = React.useState<Record<string, string>>({});
  const selectionsRef = React.useRef(selections);
  selectionsRef.current = selections;
  const [shipLoading, setShipLoading] = React.useState(false);
  // COTAR e SALVAR a escolha são coisas diferentes: cotar esconde a lista (não há o que mostrar),
  // escolher não (a opção já está marcada). Um estado só para os dois trocava a lista inteira por
  // "Calculando opções de frete..." a cada clique, e parecia recarregar tudo para marcar uma linha.
  const [shipSaving, setShipSaving] = React.useState(false);
  const [shipError, setShipError] = React.useState<string | null>(null);
  // Assinatura dos itens para a qual o frete foi efetivamente cotado. Se o carrinho muda (ex.: cai
  // abaixo do frete grátis) e ainda não recotou, o frete exibido fica "—" em vez de um valor velho.
  const [shippingSig, setShippingSig] = React.useState("");
  const [cpfError, setCpfError] = React.useState(false);
  // Endereço (e frete) só aparecem depois de buscar o CEP.
  const [addressRevealed, setAddressRevealed] = React.useState(false);

  const [payType, setPayType] = React.useState<"pix" | "card">("pix");
  const [card, setCard] = React.useState({ cardHolder: "", cardNumber: "", expiry: "", securityCode: "" });
  const [installments, setInstallments] = React.useState(1);
  // Parcelas reais da Unbox (getInstallments) por valor — só p/ cartão e fora de assinatura.
  const [installmentOptions, setInstallmentOptions] = React.useState<{ installment: number; amount: number }[]>([]);
  const [couponCode, setCouponCode] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = React.useState(false); // resumo expandido no mobile

  // Pix exibido na própria página: loader enquanto gera + QR inline + polling de confirmação.
  const [generatingPix, setGeneratingPix] = React.useState(false);
  const [processingCard, setProcessingCard] = React.useState(false);
  const [pixResult, setPixResult] = React.useState<{ ref: string; emv: string | null; total: string } | null>(null);
  const [pixQr, setPixQr] = React.useState<string | null>(null);
  const [pixStatus, setPixStatus] = React.useState<{ paid: boolean; label: string } | null>(null);
  const [pixExpired, setPixExpired] = React.useState(false);
  // Timeout no placeOrder: NÃO sabemos se o pedido nasceu. O botão de pagar fica travado e a
  // pessoa é mandada conferir em Meus pedidos antes de qualquer nova tentativa.
  const [paymentUnknown, setPaymentUnknown] = React.useState(false);
  const [pixCopied, setPixCopied] = React.useState(false);

  // gera o QR a partir do copia-e-cola (EMV) retornado pelo placeOrder
  React.useEffect(() => {
    if (!pixResult?.emv) return;
    QRCode.toDataURL(pixResult.emv, { width: 220, margin: 1 }).then(setPixQr).catch(() => {});
  }, [pixResult?.emv]);

  // polling de confirmação do pagamento (fallback ao webhook), até 10 min
  React.useEffect(() => {
    if (!pixResult?.ref) return;
    let stop = false;
    const start = Date.now();
    const tick = async () => {
      if (stop) return;
      try {
        const res = await fetch(`/api/order/${pixResult.ref}`, { cache: "no-store" });
        const data = await res.json();
        if (res.ok && data.order) {
          setPixStatus({ paid: data.order.paid, label: data.order.statusLabel });
          if (data.order.paid) return;
          if (["CANCELED", "FAILED"].includes(data.order.status)) { setPixExpired(true); return; }
        }
      } catch {}
      const elapsed = Date.now() - start;
      // Quem expira o Pix é a Unbox (status CANCELED/FAILED acima). Aqui só paramos de
      // consultar depois de 1h pra não ficar batendo na API pra sempre.
      if (elapsed > 60 * 60 * 1000) return;
      // 1s nos 2 primeiros minutos (confirma quase em tempo real) e 5s depois (poupa requisições).
      if (!stop) setTimeout(tick, elapsed < 120_000 ? 1000 : 5000);
    };
    const t = setTimeout(tick, 1000);
    return () => { stop = true; clearTimeout(t); };
  }, [pixResult?.ref]);

  const [offerTime, setOfferTime] = React.useState(179);
  React.useEffect(() => {
    const t = setInterval(() => setOfferTime((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const hasRecurring = cart?.hasRecurring;
  const pixAllowed = methods.some((m) => m.name === "unboxpay_pix" && m.isEnabled) && !hasRecurring;
  const cardAllowed = acceptsCard && methods.some((m) => m.name === "unboxpay_credit" && m.isEnabled);

  React.useEffect(() => {
    if (hasRecurring) { setPayType("card"); setInstallments(1); }
    else if (!pixAllowed && cardAllowed) setPayType("card");
  }, [hasRecurring, pixAllowed, cardAllowed]);

  // Parcelas reais por valor (getInstallments). Só p/ cartão e fora de assinatura.
  const lastInstAmount = React.useRef(0);
  React.useEffect(() => {
    if (payType !== "card" || hasRecurring) return;
    const amt = parseBRL(cart?.summary.total);
    if (!amt || amt <= 0 || amt === lastInstAmount.current) return;
    lastInstAmount.current = amt;
    let alive = true;
    fetch(`/api/checkout/installments?amount=${amt}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && Array.isArray(d?.installments)) setInstallmentOptions(d.installments); })
      .catch(() => {});
    return () => { alive = false; };
  }, [payType, hasRecurring, cart?.summary.total]);

  // Contato/endereço salvos no dispositivo (localStorage — não vai pro servidor, evita expor CPF
  // em cookie). Repõe no retorno para o cliente não digitar tudo de novo.
  const persistKey = "store_checkout_v1";
  React.useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(persistKey) || "null");
      if (!s) return;
      if (s.email) setEmail(s.email);
      if (s.address) setAddress((a) => ({ ...a, ...s.address }));
      if (s.address?.postal && onlyDigits(s.address.postal).length === 8 && s.address.city?.trim()) {
        setAddressRevealed(true);
      }
    } catch { /* ignora */ }
  }, []);
  React.useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(persistKey, JSON.stringify({ email, address })); } catch { /* quota */ }
    }, 400);
    return () => clearTimeout(t);
  }, [email, address]);

  // Link de recuperação (?id=&token=): "quem tem o link, manda" — o e-mail/endereço do carrinho
  // restaurado SOBRESCREVE o que veio do localStorage do dispositivo (doc 12, §12.3). Roda depois
  // do restore local (acima) porque linkRestoredAt só muda depois que a restauração via API termina.
  React.useEffect(() => {
    if (!linkRestoredAt || !cart) return;
    if (cart.email) setEmail(cart.email);
    const a = cart.shippingAddress;
    if (a) {
      setAddress((cur) => ({ ...cur, ...a }));
      // Destrava o CEP: o endereço veio do link, não da busca por CEP nesta sessão — se ficar
      // travado (readOnly) sem o campo ter sido preenchido por lookupCep, o cliente não consegue editar.
      setLockedByCep({ address1: false, city: false, region: false });
      if (onlyDigits(a.postal).length === 8 && a.city.trim()) setAddressRevealed(true);
    }
  }, [linkRestoredAt, cart]);

  // Grava o e-mail no carrinho assim que válido (habilita CARRINHO ABANDONADO no Unbox/CRM, antes
  // do placeOrder). Debounce + uma vez por e-mail distinto. Best-effort: nunca trava o checkout.
  const emailSavedRef = React.useRef("");
  React.useEffect(() => {
    const e = email.trim().toLowerCase();
    if (!isValidEmail(email) || !cart?.items?.length || emailSavedRef.current === e) return;
    const t = setTimeout(() => {
      emailSavedRef.current = e;
      fetch("/api/checkout/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e }),
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [email, cart?.items?.length]);

  // Dados de correspondência (Meta CAPI: em, ph, fn, ln, zp, external_id). Saem HASHEADOS da
  // camada de tracking; aqui é só a leitura do que a pessoa digitou.
  const trackUser = (): TrackUser => {
    const parts = (address.fullName ?? "").trim().split(/\s+/).filter(Boolean);
    return { email, phone: address.phone, firstName: parts[0], lastName: parts.slice(1).join(" ") || undefined, zip: address.postal };
  };
  const cartDiscount = () => parseBRL(cart?.summary.discountTotal) ?? undefined;

  // begin_checkout / InitiateCheckout — uma vez, quando o carrinho com itens é exibido no checkout.
  const beganCheckout = React.useRef(false);
  React.useEffect(() => {
    if (beganCheckout.current || !cart?.items?.length) return;
    beganCheckout.current = true;
    trackBeginCheckout(cartToTrackItems(cart.items, cartDiscount()), parseBRL(cart.summary.total) ?? undefined, appliedCoupon?.code, trackUser());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.items?.length]);

  // purchase / Purchase do Pix — dispara quando o pagamento confirma (inline). Dedupe por referenceId.
  React.useEffect(() => {
    if (!pixStatus?.paid || !pixResult?.ref) return;
    trackPurchase({
      transactionId: pixResult.ref,
      items: cartToTrackItems(cart?.items, cartDiscount()),
      value: parseBRL(pixResult.total) ?? parseBRL(cart?.summary.total) ?? undefined,
      coupon: appliedCoupon?.code,
      shipping: parseBRL(cart?.summary.shippingTotal) ?? undefined,
      tax: parseBRL(cart?.summary.taxTotal) ?? undefined,
      user: trackUser(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixStatus?.paid, pixResult?.ref]);

  // Subtotal de PRODUTOS (itemTotal) — base das réguas de frete grátis e brinde. Não usar o
  // total (totalAmount) pois ele inclui frete após a seleção, inflando o progresso.
  const subtotalAmount = parseBRL(cart?.summary.itemTotal) ?? cart?.summary.totalAmount ?? 0;

  // ---------- CEP ----------
  function setAddr(patch: Partial<AddressValue>) {
    setAddress((a) => ({ ...a, ...patch }));
  }

  const cepFetched = React.useRef("");
  async function lookupCep(rawPostal: string, force = false) {
    const cep = onlyDigits(rawPostal);
    if (cep.length !== 8) return;
    setAddressRevealed(true); // CEP válido → revela endereço + frete (mesmo se a busca falhar)
    if (!force && cepFetched.current === cep) return; // evita buscar o mesmo CEP 2x
    cepFetched.current = cep;
    setCepLoading(true);
    try {
      const res = await fetch(`/api/cep/${cep}`);
      const data = await res.json();
      if (res.ok && data.address) {
        const a = data.address;
        setAddress((cur) => ({
          ...cur,
          address1: a.address1 || cur.address1,
          neighborhood: a.neighborhood || cur.neighborhood,
          city: a.city || cur.city,
          region: a.region || cur.region,
        }));
        // trava os campos que o CEP preencheu (rua, cidade, estado)
        setLockedByCep({
          address1: !!a.address1,
          city: !!a.city,
          region: !!a.region,
        });
      }
    } finally {
      setCepLoading(false);
    }
  }

  // Fallback p/ autofill: quando o CEP fica completo (mesmo sem disparar onChange/blur) e cidade/UF
  // ainda vazias, busca o endereço — garante que o frete cote após o preenchimento automático.
  React.useEffect(() => {
    if (onlyDigits(address.postal).length === 8 && (!address.city.trim() || !address.region.trim())) {
      void lookupCep(address.postal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address.postal]);

  // ---------- Frete: depende do CEP (postal) ----------
  // Dispara assim que o CEP está completo e cidade/UF preenchidas (pelo CEP ou autofill), SEM
  // exigir nome/CPF/número — esses vão no pedido, não afetam a cotação (que é por CEP/região).
  // O frete é cotado por CEP/cidade/UF (não depende da rua) — assim o frete aparece logo após o CEP,
  // antes do cliente digitar o logradouro.
  const canQuote =
    onlyDigits(address.postal).length === 8 &&
    address.city.trim() !== "" &&
    address.region.trim() !== "";

  // Endereço com placeholders nos campos ainda vazios — só para COTAR (o pedido usa o real).
  const quoteAddress = () => ({
    ...address,
    fullName: address.fullName.trim() || "Cotação",
    taxPayerId: address.taxPayerId.trim() || "",
    address1: address.address1.trim() || "(cotação)",
    number: address.number.trim() || "0",
    neighborhood: address.neighborhood.trim() || "(cotação)",
    phone: address.phone.trim() || "00000000000",
  });

  const quoteKey = canQuote
    ? JSON.stringify([address.postal, address.city, address.region])
    : "";
  const lastQuoted = React.useRef<string>("");

  React.useEffect(() => {
    // Mesma proteção do efeito de itemsSig abaixo: espera qualquer mutação de carrinho em curso
    // (add/updateQty/remove) terminar antes de cotar — quoteShipping() termina em applySelections()
    // → refresh(), que sem essa espera podia chegar depois de um remove() e trazer o item de volta.
    if (loading || !quoteKey || quoteKey === lastQuoted.current) return;
    const handle = setTimeout(() => { void quoteShipping(); }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey, loading]);

  // Recalcula o frete SEMPRE que os itens do carrinho mudam após a cotação (ofertas, "remover"
  // no resumo, etc.). A cotação roda sobre o carrinho completo no servidor (todos os produtos).
  const itemsSig = (cart?.items ?? []).map((it) => `${it.variantId}:${it.quantity}`).join("|");
  const lastItemsSig = React.useRef(itemsSig);
  React.useEffect(() => {
    // Espera qualquer mutação em curso (add/updateQty/remove) terminar antes de recotar — senão
    // o refresh() do recálculo pode chegar DEPOIS da reconciliação do remove e sobrescrever o
    // estado com um carrinho ainda desatualizado, trazendo o item removido de volta.
    if (loading || itemsSig === lastItemsSig.current) return;
    lastItemsSig.current = itemsSig;
    if (groups.length > 0 && canQuote) void recalcShipping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsSig, loading]);

  // Mantém o método escolhido se ainda existir; senão cai na 1ª opção. O frete grátis/promo do
  // backend vem como discountPrice — a opção mais barata (efetiva) é pré-selecionada.
  function pickSelections(gs: Group[], prev: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const g of gs) {
      const keep = prev[g.groupId] && g.options.some((o) => o.methodId === prev[g.groupId]);
      out[g.groupId] = keep ? prev[g.groupId] : g.options[0]?.methodId;
    }
    return out;
  }

  // Aplica a seleção de frete no servidor (PUT) e relê o carrinho — assim o resumo (frete/total)
  // reflete a regra de frete grátis na hora, sem esperar o "Continuar".
  async function applySelections(sel: Record<string, string>) {
    const entries = Object.entries(sel).filter(([, m]) => m);
    if (!entries.length) return;
    await api("/api/checkout/shipping", { selections: entries.map(([groupId, methodId]) => ({ groupId, methodId })) }, "PUT");
    await refresh();
  }

  async function quoteShipping() {
    // Cotação inicial/reativa: cota, pré-seleciona a opção efetiva e JÁ aplica (PUT) p/ o resumo bater.
    setShipError(null);
    setShipLoading(true);
    try {
      await api("/api/checkout/address", { address: quoteAddress() });
      const data = await api("/api/checkout/shipping", undefined, "POST");
      lastQuoted.current = quoteKey;
      const next: Group[] = data.groups ?? [];
      const sel = pickSelections(next, selectionsRef.current);
      setGroups(next);
      setSelections(sel);
      await applySelections(sel);
      setShippingSig(itemsSig);
    } catch (e: any) {
      setShipError(e.message);
      setGroups([]);
    } finally {
      setShipLoading(false);
    }
  }

  // Troca da opção de frete pelo usuário: aplica no servidor na hora p/ o resumo atualizar.
  // Mesmo guard dos efeitos de quoteKey/itemsSig: applySelections() termina em refresh(), que
  // sem essa espera podia chegar depois de um remove() em curso e trazer o item de volta.
  async function chooseShipping(groupId: string, methodId: string) {
    if (loading) return;
    const sel = { ...selectionsRef.current, [groupId]: methodId };
    setSelections(sel);
    setShipSaving(true);
    try {
      await applySelections(sel);
      // add_shipping_info — etapa de frete do funil GA4 (faltava; o checkout tinha a etapa e não marcava)
      const tier = groups.find((g) => g.groupId === groupId)?.options.find((o) => o.methodId === methodId)?.displayName ?? methodId;
      trackAddShippingInfo(cartToTrackItems(cart?.items, cartDiscount()), parseBRL(cart?.summary.total) ?? undefined, tier, appliedCoupon?.code);
    } catch (e: any) {
      setShipError(e.message);
    } finally {
      setShipSaving(false);
    }
  }

  // Recota o frete após mudança de itens (ex.: upsell) — preços/regra de frete grátis dependem do
  // conteúdo do carrinho. Cota, mantém a seleção, faz o PUT e relê o carrinho (total autoritativo).
  async function recalcShipping() {
    if (!canQuote || groups.length === 0) return;
    setShipError(null);
    setShipLoading(true);
    try {
      await api("/api/checkout/address", { address: quoteAddress() });
      const data = await api("/api/checkout/shipping", undefined, "POST");
      const next: Group[] = data.groups ?? [];
      const sel = pickSelections(next, selectionsRef.current);
      setGroups(next);
      setSelections(sel);
      await applySelections(sel);
      setShippingSig(itemsSig);
    } catch (e: any) {
      setShipError(e.message);
    } finally {
      setShipLoading(false);
    }
  }

  async function api(url: string, body?: any, method = "POST") {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(data?.error || "Erro inesperado.");
      err.code = data?.code; // ex.: PLACE_ORDER_TIMEOUT (ver app/api/checkout/route.ts)
      throw err;
    }
    return data;
  }

  function go(n: number) {
    setStep(n);
    setMaxStep((m) => Math.max(m, n));
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Atualiza ?step= na URL em tempo real — só quando ela já tem id&token (senão não há
    // carrinho pra restaurar, não há o que compartilhar ainda).
    const u = new URL(window.location.href);
    if (u.searchParams.get("id") && u.searchParams.get("token")) {
      u.searchParams.set("step", String(n));
      window.history.replaceState(null, "", `${u.pathname}?${u.searchParams.toString()}`);
    }
  }

  // ---------- Navegação dos passos ----------
  async function continueFromStep1() {
    if (loading) return; // mesmo guard — este handler também termina em refresh()
    setError(null);
    // valida em ordem e foca o primeiro campo que precisa preencher
    const fail = (msg: string, id: string) => {
      setError(msg);
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); (el as HTMLElement).focus({ preventScroll: true }); }
      });
      return false;
    };
    if (!isValidEmail(email)) return fail("Informe um e-mail válido.", "co-email");
    if (address.fullName.trim().length < 2) return fail("Informe seu nome completo.", "co-name");
    if (onlyDigits(address.phone).length < 10) return fail("Informe um celular válido com DDD.", "co-phone");
    if (!isValidCpf(address.taxPayerId)) { setCpfError(true); return fail("CPF inválido. Confira os números digitados.", "co-cpf"); }
    if (onlyDigits(address.postal).length !== 8) return fail("Informe o CEP.", "co-cep");
    if (!address.address1.trim()) return fail("Informe o endereço.", "co-address1");
    if (!address.number.trim()) return fail("Informe o número.", "co-number");
    if (!address.neighborhood.trim()) return fail("Informe o bairro.", "co-neighborhood");
    if (!address.city.trim()) return fail("Informe a cidade.", "co-city");
    if (!address.region.trim()) return fail("Informe a UF.", "co-region");
    const sel = Object.entries(selections);
    if (groups.length === 0 || sel.length < groups.length) {
      setError("Selecione uma forma de envio.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/checkout/shipping", { selections: sel.map(([groupId, methodId]) => ({ groupId, methodId })) }, "PUT");
      await refresh();
      go(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // ---------- Upsell ----------
  function isAdded(u: UpsellOffer) {
    return (cart?.items ?? []).some((it) => it.variantId === u.variantId);
  }
  // Só mostra ofertas que NÃO estão no carrinho (em estoque já é filtrado no servidor).
  const availableUpsells = upsells.filter((u) => !isAdded(u));
  // Adiciona a oferta (silent: não reabre o drawer). O item some da lista de ofertas (já está no
  // carrinho) e o frete é recalculado pelo efeito de mudança de itens.
  async function addUpsell(u: UpsellOffer) {
    await add({ productId: u.productId, variantId: u.variantId, price: u.price, quantity: 1, thumbnail: u.imageUrl ?? undefined, title: u.name }, { silent: true });
  }

  // ---------- Pagamento ----------
  // device (antifraude/3DS Unbox) — 8 campos coletados do navegador real do comprador.
  // Vai no corpo do POST /api/checkout; o BFF repassa ao placeOrder no ROOT do PlaceOrderInput.
  // timezoneOffset em MINUTOS (BRT → 180) — se a Unbox confirmar que espera HORAS, dividir
  // por 60 aqui (um lugar só). Ver lib/unbox/types.ts.
  function collectDevice() {
    try {
      return {
        type: "BROWSER" as const,
        colorDepth: screen.colorDepth,
        javaEnabled: typeof navigator.javaEnabled === "function" ? navigator.javaEnabled() : false,
        userAgent: navigator.userAgent,
        language: navigator.language,
        screenHeight: screen.height,
        screenWidth: screen.width,
        timezoneOffset: new Date().getTimezoneOffset(),
      };
    } catch {
      // best-effort: sem device o servidor cai no fallback { type: "API" } — nunca trava o checkout.
      return undefined;
    }
  }

  async function pay() {
    setError(null);
    setBusy(true);
    if (payType === "pix") setGeneratingPix(true);
    else setProcessingCard(true);
    try {
      let payment: any;
      if (payType === "pix") {
        payment = { type: "pix" as const };
      } else {
        const exp = onlyDigits(card.expiry);
        const mm = exp.slice(0, 2);
        const yy = exp.slice(2, 4);
        payment = {
          type: "card" as const,
          card: {
            cardHolder: card.cardHolder,
            cardNumber: onlyDigits(card.cardNumber),
            expirationMonth: mm,
            expirationYear: yy ? `20${yy}` : "",
            securityCode: card.securityCode,
            installments,
          },
        };
      }
      trackAddPaymentInfo(cartToTrackItems(cart?.items, cartDiscount()), parseBRL(cart?.summary.total) ?? undefined, payType, appliedCoupon?.code, trackUser());
      const data = await api("/api/checkout", {
        email,
        address,
        payment,
        recurringItemsFrequencyId: hasRecurring ? cart?.recurringItemsFrequencyId ?? undefined : undefined,
        device: collectDevice(),
      });
      if (data.paymentType === "pix" && data.referenceId) {
        // Exibe o Pix na própria página (QR + copia-e-cola + polling). NÃO damos refresh() aqui
        // porque o pedido já invalidou o carrinho no servidor — manter o estado em memória.
        // Total: o do PEDIDO criado (servidor). A estimativa local só entra se a API não devolver.
        const tNow = parseBRL(cart?.summary.total) ?? 0;
        const subNow = parseBRL(cart?.summary.itemTotal) ?? tNow;
        const pixTotal = (typeof data.total === "string" && data.total) || formatBRL(Math.max(0, tNow - Math.round(subNow * PIX_DISCOUNT_PCT) / 100));
        const emv: string | null = data.pix?.qrCode ?? null;
        setPixResult({ ref: data.referenceId, emv, total: pixTotal });
        // Persistir o copia-e-cola: reload/fechar aba perdia o Pix (o carrinho já foi consumido
        // e o pedido não devolve o EMV). /checkout/pix/[ref] lê daqui.
        try { if (emv) sessionStorage.setItem(`unbox_pix:${data.referenceId}`, emv); } catch {}
        setGeneratingPix(false);
        setBusy(false);
      } else if (data.referenceId) {
        await refresh();
        router.push(`/pedido/${data.referenceId}`);
      }
    } catch (e: any) {
      // NÃO retentar — o pedido pode já ter sido criado (cobrança real).
      setError(e.message);
      setGeneratingPix(false);
      setProcessingCard(false);
      if (e?.code === "PLACE_ORDER_TIMEOUT") {
        // Estado desconhecido: mantém `busy` (botão travado) até a pessoa conferir o pedido.
        setPaymentUnknown(true);
        return;
      }
      setBusy(false);
    }
  }

  async function copyPix() {
    if (!pixResult?.emv) return;
    try { await navigator.clipboard.writeText(pixResult.emv); setPixCopied(true); setTimeout(() => setPixCopied(false), 2000); } catch {}
  }

  // ---------- Loader processando pagamento no cartão (inclui assinatura) ----------
  if (processingCard) {
    return (
      <div className="checkout-root store-layout min-h-screen bg-white">
        <CheckoutHeader shopName={shopName} />
        <div className="mx-auto flex max-w-[680px] flex-col items-center px-6 py-24 text-center">
          <span className="h-14 w-14 animate-spin rounded-full border-[4px] border-[var(--store-line-2)] border-t-[var(--store-primary,#18181B)]" />
          <h1 className="font-display mt-6">{hasRecurring ? "Confirmando sua assinatura…" : "Processando seu pagamento…"}</h1>
          <p className="mt-2 text-[15px] text-[var(--store-muted)]">Estamos autorizando seu cartão. Não feche nem atualize esta página.</p>
        </div>
      </div>
    );
  }

  // (Pix: gerado/QR/confirmação são exibidos INLINE no passo de pagamento — ver abaixo.)

  // ---------- Montando carrinho a partir do link (?produtos=/?cupom=) ----------
  if ((!cart || cart.items.length === 0) && (linkBuilding || loading)) {
    return (
      <div className="checkout-root store-layout min-h-screen bg-white">
        <CheckoutHeader shopName={shopName} />
        <div className="mx-auto flex max-w-[680px] flex-col items-center px-6 py-24 text-center">
          <Spinner className="animate-spin text-[34px] text-[var(--store-primary,#18181B)]" />
          <h1 className="font-display mt-4">{linkBuilding ? "Montando seu carrinho…" : "Carregando…"}</h1>
          {linkBuilding && <p className="mt-1.5 text-[14px] text-[var(--store-muted)]">Só um instante enquanto preparamos seu pedido.</p>}
        </div>
      </div>
    );
  }

  // ---------- Carrinho vazio ----------
  if (!cart || cart.items.length === 0) {
    return (
      <div className="checkout-root store-layout min-h-screen bg-white">
        <CheckoutHeader shopName={shopName} />
        <div className="mx-auto max-w-[680px] px-6 py-24 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-[var(--store-faint)]">
            <Package className="text-4xl" />
          </span>
          <h1 className="font-display mt-5">Seu carrinho está vazio</h1>
          <p className="mt-2 text-[15px] text-[var(--store-muted)]">Adicione produtos antes de finalizar a compra.</p>
          <Link href="/produtos" className="font-display mt-6 inline-flex h-[52px] items-center justify-center gap-2 rounded-xl bg-[var(--store-primary,#18181B)] px-7 text-[15px] font-bold text-white no-underline">
            Ver produtos <ArrowRight weight="bold" />
          </Link>
        </div>
      </div>
    );
  }

  const offerTimer = `${String(Math.floor(offerTime / 60)).padStart(2, "0")}:${String(offerTime % 60).padStart(2, "0")}`;
  const offerExpiring = offerTime > 0 && offerTime <= 30;
  // null = promoção não configurada → os blocos correspondentes não renderizam (store-config)
  const remainingForGift = GIFT_THRESHOLD != null ? Math.max(0, GIFT_THRESHOLD - subtotalAmount) : 0;
  const remainingForFreeShip = FREE_SHIP_THRESHOLD != null ? Math.max(0, FREE_SHIP_THRESHOLD - subtotalAmount) : 0;
  const freeShipPct = FREE_SHIP_THRESHOLD != null ? Math.min(100, Math.round((subtotalAmount / FREE_SHIP_THRESHOLD) * 100)) : 0;
  const installmentTotal = parseBRL(cart.summary.total) ?? subtotalAmount;
  // "Continuar para ofertas" só habilita com o CEP buscado e uma forma de envio escolhida.
  const shippingChosen = addressRevealed && groups.length > 0 && groups.every((g) => !!selections[g.groupId]);
  // Só libera o endereço de entrega quando a Identificação está completa (todos os campos válidos).
  const identityComplete =
    isValidEmail(email) &&
    address.fullName.trim().length >= 2 &&
    onlyDigits(address.phone).length >= 10 &&
    isValidCpf(address.taxPayerId);

  // Frete exibido = fulfillmentTotal do servidor (autoritativo, compõe o total cobrado), não o
  // preço cru da opção. Mostra "Grátis" quando o backend zera o frete (regra de frete grátis).
  const shippingSelected = !!cart.selectedShipping;
  const shippingAmount = parseBRL(cart.summary.shippingTotal);
  // Só consideramos o frete "pronto" quando foi cotado para o carrinho ATUAL e não está recotando.
  // Assim, ao remover itens (ex.: cair abaixo do frete grátis), o valor velho some até atualizar.
  const shippingReady = shippingSelected && shippingSig === itemsSig && !shipLoading;
  const freteLabel = !shippingReady
    ? "—"
    : shippingAmount === 0
      ? "Grátis"
      : cart.summary.shippingTotal ?? cart.selectedShipping?.displayAmount ?? "—";

  // Desconto Pix: regra REAL do backend (shopSale "5% no Pix"). O cart.summary não inclui esse
  // desconto (é por método de pagamento, aplicado no placeOrder), então estimamos sobre o subtotal
  // de produtos — consistente com a PDP. O valor cobrado continua sendo o do servidor.
  const isPix = payType === "pix";
  const totalNum = parseBRL(cart.summary.total) ?? subtotalAmount;
  const pixDiscount = isPix ? Math.round(subtotalAmount * PIX_DISCOUNT_PCT) / 100 : 0;
  const grandTotalNum = Math.max(0, totalNum - pixDiscount);
  const grandTotalLabel = isPix ? formatBRL(grandTotalNum) : (cart.summary.total ?? "—");

  // Conteúdo do resumo do pedido — reutilizado no sidebar (desktop) e na folha inferior (mobile).
  const summaryContent = (
    <>
      <div className="font-display border-b border-[var(--store-surface-2)] px-[22px] pb-3.5 pt-5 text-[17px] font-extrabold">Resumo do pedido</div>

      <div className="flex max-h-[320px] flex-col gap-3.5 overflow-y-auto px-[22px] py-4">
        {cart.items.map((it) => (
          <div key={it.id} className="flex items-center gap-3">
            <span className="relative flex h-14 w-[46px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--store-surface)]">
              {it.thumbnail && <Image src={it.thumbnail} alt={it.title} fill sizes="46px" className="object-contain p-0.5" />}
              <span className="absolute -right-[7px] -top-[7px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[var(--store-chrome-bg)] text-[11px] font-extrabold text-white">{it.quantity}</span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold leading-[1.2] text-[var(--store-ink)]">{it.title}</div>
              {it.variantTitle && <div className="text-[11.5px] text-[var(--store-muted)]">{it.variantTitle}</div>}
              <div className="mt-0.5 text-[11.5px] font-semibold text-[var(--store-primary,#18181B)]">
                Qtd: {it.quantity}{it.quantity > 1 && !it.isBonus ? ` · ${it.displayUnitPrice} cada` : ""}
              </div>
            </div>
            <div className="flex flex-col items-end gap-[3px]">
              <span className="whitespace-nowrap text-[13.5px] font-extrabold text-[var(--store-ink)]">{it.isBonus ? "GRÁTIS" : formatBRL(it.unitPrice * it.quantity)}</span>
              {!it.isBonus && (
                <button type="button" disabled={loading} onClick={() => remove(it.id)} className="border-none bg-transparent p-0 text-[10.5px] font-bold text-[var(--store-muted)] disabled:cursor-not-allowed disabled:opacity-50">remover</button>
              )}
            </div>
          </div>
        ))}

        {remainingForGift > 0 && (
          <div className="flex items-center gap-2.5 rounded-md border border-dashed border-[var(--store-line-2)] bg-[var(--store-surface)] px-3 py-2.5">
            <Gift className="shrink-0 text-[19px] text-[var(--store-faint)]" />
            <span className="text-[12px] text-[var(--store-muted)]">Faltam <b className="text-[var(--store-sale)]">{formatBRL(remainingForGift)}</b> para ganhar um <b>brinde grátis</b></span>
          </div>
        )}
      </div>

      {/* cupom */}
      <div className="border-t border-[var(--store-surface-2)] px-[22px] py-3.5">
        {appliedCoupon ? (
          <div className="flex items-center justify-between gap-2.5 rounded-md border border-[var(--store-primary-soft)] bg-[var(--store-primary-soft,#F1F1F3)] px-3.5 py-2.5">
            <span className="flex min-w-0 items-center gap-2"><SealCheck weight="fill" className="shrink-0 text-[17px] text-[var(--store-primary,#18181B)]" /><span className="text-[13px] font-extrabold leading-[1.25] text-[var(--store-primary,#18181B)]">Cupom {appliedCoupon.code?.toUpperCase()} aplicado</span></span>
            <button type="button" onClick={() => removeCoupon()} className="flex shrink-0 items-center gap-1 border-none bg-transparent text-xs font-bold text-[var(--store-sale)]"><Trash className="text-sm" />Remover</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Cupom de desconto"
              className="h-11 min-w-0 flex-1 rounded-md border-[1.5px] border-[var(--store-line-2)] bg-white px-3.5 text-sm outline-none focus:border-[var(--store-primary,#18181B)]" />
            <button type="button" disabled={loading || !couponCode.trim()} onClick={() => applyCoupon(couponCode.trim())}
              className="font-display h-11 shrink-0 rounded-md bg-[var(--store-chrome-bg)] px-[18px] text-[13.5px] font-bold text-white disabled:opacity-60">Aplicar</button>
          </div>
        )}
      </div>

      {/* totals */}
      <div className="flex flex-col gap-2.5 border-t border-[var(--store-surface-2)] px-[22px] py-3.5 text-[13.5px] text-[var(--store-ink-2)]">
        <div className="flex justify-between"><span>Subtotal</span><span className="font-semibold text-[var(--store-ink)]">{cart.summary.itemTotal ?? "—"}</span></div>
        {cart.summary.discountTotal && cart.summary.discountTotal !== "R$0,00" && (
          <div className="flex justify-between"><span>Desconto</span><span className="font-bold text-[var(--store-primary,#18181B)]">- {cart.summary.discountTotal}</span></div>
        )}
        {isPix && pixDiscount > 0 && (
          <div className="flex justify-between"><span>Desconto Pix ({PIX_DISCOUNT_PCT}%)</span><span className="font-bold text-[var(--store-primary,#18181B)]">- {formatBRL(pixDiscount)}</span></div>
        )}
        <div className="flex justify-between"><span>Frete</span><span className="font-bold" style={{ color: !shippingReady ? "var(--store-muted)" : freteLabel === "Grátis" ? "var(--store-primary,#18181B)" : "var(--store-ink)" }}>{freteLabel}</span></div>
        {/* régua de frete grátis — só com FREE_SHIPPING_THRESHOLD real (senão promete frete que não existe) */}
        {FREE_SHIP_THRESHOLD != null && (remainingForFreeShip > 0 ? (
          <div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--store-surface-2)]"><div className="h-full rounded-full bg-gradient-to-r from-[var(--store-primary,#18181B)] to-[var(--store-primary)] transition-all" style={{ width: `${freeShipPct}%` }} /></div>
            <div className="mt-1.5 text-[11.5px] text-[var(--store-muted)]">Faltam {formatBRL(remainingForFreeShip)} para Frete Grátis</div>
          </div>
        ) : (!shippingSelected || freteLabel === "Grátis") ? (
          <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--store-primary,#18181B)]"><Truck weight="fill" className="text-[13px]" />Você ganhou Frete Grátis!</div>
        ) : null)}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--store-surface-2)] bg-[var(--store-surface)] px-[22px] py-4">
        <span className="font-display text-[17px] font-extrabold">Total</span>
        <div className="text-right">
          <div className="font-display text-[22px] font-extrabold leading-none text-[var(--store-primary,#18181B)]">{grandTotalLabel}</div>
          {isPix && pixDiscount > 0 && <div className="text-[11px] font-semibold text-[var(--store-muted)]">no Pix · economia de {formatBRL(pixDiscount)}</div>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--store-surface-2)] px-[22px] py-3.5">
        <span className="text-[11px] font-semibold text-[var(--store-muted)]">Pague com:</span>
        <PaymentChips />
      </div>
    </>
  );

  return (
    <div className="checkout-root store-layout min-h-screen bg-white text-[var(--store-ink)]">
      <CheckoutHeader shopName={shopName} />

      {/* step indicator */}
      <div className="border-b border-[var(--store-line)] bg-white">
        <div className="mx-auto max-w-[680px] px-6 pb-[22px] pt-5">
          <StepBar step={step} maxStep={maxStep} onGo={go} />
        </div>
      </div>

      {/* main */}
      <div className="mx-auto grid max-w-[1080px] grid-cols-1 items-start gap-7 px-6 pb-[120px] pt-8 lg:grid-cols-[1.5fr_1fr] lg:pb-16">
        {/* LEFT */}
        <div>
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-md border border-[var(--store-sale-soft)] bg-[var(--store-sale-soft)] px-4 py-3 text-sm font-semibold text-[var(--store-sale)]" role="alert">
              <Warning weight="fill" className="mt-0.5 shrink-0 text-base" />{error}
            </div>
          )}
          {paymentUnknown && (
            <p className="-mt-2 mb-4 text-sm text-[var(--store-ink-2)]">
              Confira se o pedido foi criado em <Link href="/conta/pedidos" className="font-bold underline">Meus pedidos</Link> antes de tentar de novo.
            </p>
          )}

          {/* ===== STEP 1 ===== */}
          {step === 1 && (
            <div className="flex flex-col gap-[18px]">
              <Card>
                <CardHead n="1" title="Identificação" />
                <div className="flex flex-col gap-3.5">
                  <Labeled label="E-mail">
                    <input id="co-email" type="email" inputMode="email" autoComplete="email" placeholder="seu@email.com" className={inputCls}
                      value={email} onChange={(e) => setEmail(sanitizeEmail(e.target.value))} />
                  </Labeled>
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <Labeled label="Nome completo">
                      <input id="co-name" autoComplete="name" placeholder="Como no documento" className={inputCls}
                        value={address.fullName} onChange={(e) => setAddr({ fullName: sanitizeName(e.target.value) })} />
                    </Labeled>
                    <Labeled label="Celular / WhatsApp">
                      <input id="co-phone" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" className={inputCls}
                        value={address.phone} onChange={(e) => setAddr({ phone: maskPhone(e.target.value) })} />
                    </Labeled>
                  </div>
                  <Labeled label="CPF">
                    <input id="co-cpf" inputMode="numeric" placeholder="000.000.000-00" maxLength={14}
                      className={cpfError ? `${inputCls} border-[var(--store-sale)] focus:border-[var(--store-sale)]` : inputCls}
                      value={address.taxPayerId}
                      onChange={(e) => { setAddr({ taxPayerId: maskCpf(e.target.value) }); if (cpfError) setCpfError(false); }}
                      onBlur={(e) => setCpfError(onlyDigits(e.target.value).length === 11 && !isValidCpf(e.target.value))} />
                    {cpfError && <span className="mt-1 block text-[11.5px] font-semibold text-[var(--store-sale)]">CPF inválido</span>}
                  </Labeled>
                </div>
              </Card>

              <Card>
                <div className="mb-[18px] flex items-center gap-2.5">
                  <MapPin weight="bold" className="text-[21px] text-[var(--store-primary,#18181B)]" />
                  <h4 className="font-display m-0">Endereço de entrega</h4>
                </div>
                <div className="flex flex-col gap-3.5">
                  {!identityComplete && (
                    <p className="rounded-md border border-dashed border-[var(--store-line-2)] bg-[var(--store-surface)] px-4 py-3 text-[13px] text-[var(--store-muted)]">
                      Preencha seus dados acima (e-mail, nome, celular e CPF) para informar o endereço de entrega.
                    </p>
                  )}
                  {/* CEP + Buscar — só após a identificação; os demais campos só após buscar o CEP */}
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[1fr_auto]">
                    <Labeled label="CEP">
                      <div className="relative">
                        <input id="co-cep" inputMode="numeric" autoComplete="postal-code" disabled={!identityComplete}
                          className={`${inputCls} disabled:cursor-not-allowed disabled:bg-[var(--store-surface)] disabled:opacity-60`} placeholder="00000-000"
                          value={address.postal}
                          onChange={(e) => {
                            const v = maskCep(e.target.value);
                            setAddr({ postal: v });
                            setLockedByCep({ address1: false, city: false, region: false });
                            if (onlyDigits(v).length === 8) lookupCep(v); // busca automática ao completar
                          }}
                          onBlur={(e) => lookupCep(e.target.value)} />
                        {cepLoading && <Spinner className="absolute right-3.5 top-[calc(50%+3px)] -translate-y-1/2 animate-spin text-[var(--store-muted)]" />}
                      </div>
                    </Labeled>
                    <div className="flex items-end">
                      <button type="button" onClick={() => lookupCep(address.postal, true)} disabled={!identityComplete || onlyDigits(address.postal).length !== 8 || cepLoading}
                        className="font-display mt-[7px] flex h-[50px] items-center gap-2 rounded-md bg-[var(--store-chrome-bg)] px-6 text-sm font-bold text-white transition-opacity disabled:opacity-50">
                        {cepLoading ? <Spinner className="animate-spin" /> : <MapPin weight="bold" />}Buscar
                      </button>
                    </div>
                  </div>

                  {addressRevealed ? (
                    <>
                      <Labeled label="Endereço" locked={lockedByCep.address1}>
                        <input id="co-address1" autoComplete="address-line1" placeholder="Rua, avenida..." readOnly={lockedByCep.address1}
                          className={lockedByCep.address1 ? lockedCls : inputCls}
                          value={address.address1} onChange={(e) => setAddr({ address1: sanitizeText(e.target.value) })} />
                      </Labeled>
                      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[120px_1fr_1fr]">
                        <Labeled label="Número">
                          <input id="co-number" inputMode="numeric" placeholder="123" className={inputCls} maxLength={10}
                            value={address.number} onChange={(e) => setAddr({ number: sanitizeHouseNumber(e.target.value) })} />
                        </Labeled>
                        <Labeled label="Bairro">
                          <input id="co-neighborhood" placeholder="Bairro" className={inputCls}
                            value={address.neighborhood} onChange={(e) => setAddr({ neighborhood: sanitizeText(e.target.value) })} />
                        </Labeled>
                        <Labeled label="Complemento">
                          <input autoComplete="address-line2" placeholder="Apto, bloco (opcional)" className={inputCls}
                            value={address.address2 ?? ""} onChange={(e) => setAddr({ address2: sanitizeText(e.target.value) })} />
                        </Labeled>
                      </div>
                      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[1fr_120px]">
                        <Labeled label="Cidade" locked={lockedByCep.city}>
                          <input id="co-city" autoComplete="address-level2" placeholder="Cidade" readOnly={lockedByCep.city}
                            className={lockedByCep.city ? lockedCls : inputCls}
                            value={address.city} onChange={(e) => setAddr({ city: sanitizeText(e.target.value) })} />
                        </Labeled>
                        <Labeled label="UF" locked={lockedByCep.region}>
                          <input id="co-region" autoComplete="address-level1" maxLength={2} placeholder="UF" readOnly={lockedByCep.region}
                            className={lockedByCep.region ? lockedCls : inputCls}
                            value={address.region} onChange={(e) => setAddr({ region: sanitizeUf(e.target.value) })} />
                        </Labeled>
                      </div>
                    </>
                  ) : (
                    <p className="text-[13px] text-[var(--store-muted)]">Digite o CEP para preencher o endereço de entrega.</p>
                  )}
                </div>

                {/* forma de envio — só após buscar o CEP */}
                {addressRevealed && (<>
                <div className="mb-2.5 mt-5 flex items-center gap-2 text-sm font-bold text-[var(--store-ink-2)]">
                  Forma de envio
                  {shipSaving && (
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--store-muted)]">
                      <Spinner className="animate-spin text-[13px]" /> atualizando o frete
                    </span>
                  )}
                </div>
                {shipLoading ? (
                  <div className="flex items-center gap-2.5 rounded-md border border-[var(--store-line-2)] bg-[var(--store-surface)] px-4 py-3.5 text-sm font-semibold text-[var(--store-muted)]">
                    <Spinner className="animate-spin text-base" /> Calculando opções de frete...
                  </div>
                ) : groups.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[var(--store-line-2)] bg-[var(--store-surface)] px-4 py-3.5 text-[13px] text-[var(--store-muted)]">
                    {shipError ?? "Preencha o endereço completo para ver as opções de frete."}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {groups.map((g) => g.options.map((o) => {
                      const on = selections[g.groupId] === o.methodId;
                      // discountPrice só é desconto REAL quando > 0 e menor que o preço.
                      // "R$ 0,00" significa SEM desconto (não "grátis") — não há regra de frete grátis no backend.
                      const priceN = parseBRL(o.price);
                      const discN = parseBRL(o.discountPrice);
                      const hasDiscount = discN != null && discN > 0 && priceN != null && discN < priceN;
                      const effN = hasDiscount ? discN : priceN;
                      const isFree = effN === 0; // grátis só se o preço do método é realmente 0
                      return (
                        <button key={`${g.groupId}-${o.methodId}`} type="button"
                          disabled={loading}
                          onClick={() => chooseShipping(g.groupId, o.methodId)}
                          className="flex w-full items-center justify-between gap-3 rounded-md border-[1.5px] px-4 py-3.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ background: on ? "var(--store-primary-soft,#F1F1F3)" : "var(--store-surface)", borderColor: on ? "var(--store-primary,#18181B)" : "var(--store-line-2)" }}>
                          <span className="flex items-center gap-3">
                            <Radio on={on} />
                            <span className="flex flex-col items-start">
                              <span className="flex items-center gap-1.5 text-sm font-bold">
                                <Lightning weight="bold" className="text-[17px] text-[var(--store-primary,#18181B)]" />{o.displayName}
                              </span>
                              {o.days != null && <span className="mt-0.5 text-xs text-[var(--store-muted)]">Receba em {o.days} dia(s)</span>}
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            {hasDiscount && !isFree && <span className="text-xs text-[var(--store-faint)] line-through">{o.price}</span>}
                            <span className="text-sm font-extrabold" style={{ color: isFree || on ? "var(--store-primary,#18181B)" : "var(--store-ink)" }}>
                              {isFree ? "Grátis" : (hasDiscount ? o.discountPrice : o.price)}
                            </span>
                          </span>
                        </button>
                      );
                    }))}
                  </div>
                )}
                </>)}
              </Card>

              <PrimaryButton onClick={continueFromStep1} disabled={busy || loading || !shippingChosen}>
                {busy ? <Spinner className="animate-spin" /> : null} Continuar para ofertas <ArrowRight weight="bold" />
              </PrimaryButton>
            </div>
          )}

          {/* ===== STEP 2 — Ofertas ===== */}
          {step === 2 && (
            <div className="flex flex-col gap-[18px]">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--store-chrome-bg)] to-[var(--store-primary,#18181B)] px-6 py-[22px] text-white">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--store-cta,#D97706)] px-2.5 py-[5px] text-[11px] font-extrabold tracking-[0.5px] text-[var(--store-cta-fg,#1C1207)]">
                  <Lightning weight="fill" />OFERTA EXCLUSIVA DESTE PEDIDO
                </span>
                <h3 className="font-display mb-1 mt-3">Leve mais por bem menos</h3>
                <p className="mb-[15px] text-sm text-[var(--store-primary-soft)]">Desconto exclusivo só nesta etapa, antes de pagar. <b className="text-[var(--store-cta,#D97706)]">Depois disso o preço volta ao normal.</b></p>
                <div className="flex flex-wrap items-center gap-3.5">
                  <div className="inline-flex items-center gap-3 rounded-xl bg-[var(--store-sale)] px-[18px] py-[11px]">
                    <Alarm weight="fill" className="text-2xl text-white" />
                    <span className="text-[12px] font-extrabold uppercase leading-[1.1] tracking-[1px] text-[var(--store-sale-soft)]">Oferta some<br />em</span>
                    <span className={`font-display text-[30px] font-extrabold tabular-nums text-white ${offerExpiring ? "animate-store-pulse" : ""}`}>{offerTimer}</span>
                  </div>
                  {offerExpiring && (
                    <span className="flex animate-store-pulse items-center gap-1.5 text-[13px] font-extrabold text-[var(--store-cta,#D97706)]"><Warning weight="fill" />Últimos segundos!</span>
                  )}
                </div>
              </div>

              {availableUpsells.length === 0 ? (
                <Card><div className="text-sm text-[var(--store-muted)]">Nenhuma oferta disponível agora.</div></Card>
              ) : (
                <div className="flex flex-col gap-3">
                  {availableUpsells.map((u) => {
                    const off = u.oldPrice ? Math.round((1 - u.price / u.oldPrice) * 100) : null;
                    return (
                      <div key={u.variantId} className="flex items-center gap-4 rounded-lg border-[1.5px] border-[var(--store-line)] bg-white p-4">
                        <div className="relative flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--store-surface)]">
                          {u.imageUrl && <Image src={u.imageUrl} alt={u.name} fill sizes="64px" className="object-contain p-1" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[15px] font-bold text-[var(--store-ink)]">{u.name}</span>
                            {off != null && off > 0 && <span className="rounded-[5px] bg-[var(--store-sale-soft)] px-2 py-[3px] text-[10px] font-extrabold text-[var(--store-sale)]">{off}% OFF</span>}
                          </div>
                          <div className="mt-0.5 text-[12.5px] text-[var(--store-muted)] line-clamp-1">{u.desc}</div>
                          <div className="mt-[7px] flex items-center gap-2">
                            {u.oldPrice && <span className="text-[12.5px] text-[var(--store-faint)] line-through">{formatBRL(u.oldPrice)}</span>}
                            <span className="font-display text-[17px] font-extrabold text-[var(--store-primary,#18181B)]">{u.displayPrice}</span>
                          </div>
                        </div>
                        <button type="button" onClick={() => addUpsell(u)} disabled={loading}
                          className="font-display flex h-[42px] shrink-0 items-center gap-1.5 rounded-md border-[1.5px] border-[var(--store-primary,#18181B)] bg-white px-4 text-[13px] font-bold text-[var(--store-primary,#18181B)] disabled:opacity-60">
                          <Plus weight="bold" />Adicionar
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-stretch gap-3">
                <SecondaryButton onClick={() => go(1)}><ArrowLeft weight="bold" />Voltar</SecondaryButton>
                <button type="button" onClick={() => go(3)} className="h-[56px] shrink-0 cursor-pointer border-none bg-transparent px-4 text-sm font-bold text-[var(--store-muted)] underline">Pular ofertas</button>
                <PrimaryButton onClick={() => go(3)} className="flex-1">Ir para pagamento <ArrowRight weight="bold" /></PrimaryButton>
              </div>
            </div>
          )}

          {/* ===== STEP 3 — Pagamento ===== */}
          {step === 3 && (
            <div className="flex flex-col gap-[18px]">
              <Card>
                <CardHead n="3" title="Forma de pagamento" />
                {hasRecurring && (
                  <div className="mb-4 rounded-md border border-[var(--store-primary-soft)] bg-[var(--store-primary-soft,#F1F1F3)] px-4 py-3 text-[13px] font-semibold text-[var(--store-primary,#18181B)]">
                    Assinaturas exigem pagamento com cartão de crédito.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {pixAllowed && (
                    <button type="button" onClick={() => setPayType("pix")}
                      className="flex items-center justify-between gap-2 rounded-md border-[1.5px] px-4 py-3.5"
                      style={{ background: payType === "pix" ? "var(--store-primary-soft,#F1F1F3)" : "var(--store-surface)", borderColor: payType === "pix" ? "var(--store-primary,#18181B)" : "var(--store-line-2)" }}>
                      <span className="flex items-center gap-2.5"><Radio on={payType === "pix"} /><QrCode weight="fill" className="text-[22px] text-[var(--store-primary,#18181B)]" /><span className="text-[15px] font-bold">Pix</span></span>
                      {PIX_DISCOUNT_PCT > 0 && <span className="rounded-md bg-[var(--store-primary-soft,#F1F1F3)] px-2 py-1 text-[11px] font-extrabold text-[var(--store-primary,#18181B)]">{PIX_DISCOUNT_PCT}% OFF</span>}
                    </button>
                  )}
                  {cardAllowed && (
                    <button type="button" onClick={() => setPayType("card")}
                      className="flex items-center justify-between gap-2 rounded-md border-[1.5px] px-4 py-3.5"
                      style={{ background: payType === "card" ? "var(--store-primary-soft,#F1F1F3)" : "var(--store-surface)", borderColor: payType === "card" ? "var(--store-primary,#18181B)" : "var(--store-line-2)" }}>
                      <span className="flex items-center gap-2.5"><Radio on={payType === "card"} /><CreditCard weight="fill" className="text-[22px] text-[var(--store-primary,#18181B)]" /><span className="text-[15px] font-bold">Cartão</span></span>
                      <span className="text-[11px] font-bold text-[var(--store-muted)]">até {maxInstallments}x</span>
                    </button>
                  )}
                </div>

                {payType === "pix" && (
                  <div className="mt-5">
                    {pixStatus?.paid ? (
                      <div className="rounded-2xl border border-[var(--store-primary-soft)] bg-[var(--store-primary-soft,#F1F1F3)] p-6 text-center">
                        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white"><CheckCircle weight="fill" className="text-4xl text-[var(--store-primary,#18181B)]" /></span>
                        <h4 className="font-display mt-3">Pagamento confirmado!</h4>
                        <p className="mt-1 text-sm text-[var(--store-ink-2)]">Recebemos seu Pix de <b>{pixResult?.total}</b>. Já estamos preparando seu pedido.</p>
                        <Link href={`/pedido/${pixResult?.ref}`} className="font-display mt-4 inline-flex rounded-xl bg-[var(--store-primary,#18181B)] px-5 py-2.5 text-sm font-bold text-white no-underline">Ver pedido</Link>
                      </div>
                    ) : pixResult ? (
                      pixExpired ? (
                        <div className="rounded-2xl border border-[var(--store-sale-soft)] bg-[var(--store-sale-soft)] p-5 text-sm font-semibold text-[var(--store-sale)]">
                          O tempo para pagamento terminou. <Link href="/checkout" className="underline">Refaça o pedido</Link> para gerar um novo Pix.
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-[var(--store-line)] bg-white p-6 text-center">
                          <div className="text-sm text-[var(--store-muted)]">Valor no Pix</div>
                          <div className="font-display text-[24px] font-extrabold text-[var(--store-primary,#18181B)]">{pixResult.total}</div>
                          <div className="mx-auto mt-4 flex h-[200px] w-[200px] items-center justify-center rounded-lg border border-[var(--store-line-2)] bg-[var(--store-surface)]">
                            {pixQr ? (
                              <Image src={pixQr} alt="QR Code Pix" width={200} height={200} unoptimized className="rounded-md" />
                            ) : pixResult.emv ? (
                              <Spinner className="animate-spin text-3xl text-[var(--store-muted)]" />
                            ) : (
                              <span className="px-4 text-sm text-[var(--store-muted)]">Use o copia-e-cola abaixo</span>
                            )}
                          </div>
                          {pixResult.emv && (
                            <div className="mt-4 text-left">
                              <div className="mb-1.5 text-xs font-semibold text-[var(--store-muted)]">Pix copia e cola</div>
                              <div className="flex gap-2">
                                <code className="min-w-0 flex-1 truncate rounded-md border border-[var(--store-line-2)] bg-[var(--store-surface)] px-3 py-2.5 text-xs text-[var(--store-ink-2)]">{pixResult.emv}</code>
                                <button type="button" onClick={copyPix} className="font-display flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--store-chrome-bg)] px-4 text-[13px] font-bold text-white">
                                  {pixCopied ? <Check weight="bold" /> : <Copy weight="bold" />}{pixCopied ? "Copiado" : "Copiar"}
                                </button>
                              </div>
                            </div>
                          )}
                          <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-[var(--store-ink-2)]"><Spinner className="animate-spin" /> Aguardando confirmação do pagamento…</div>
                          {pixStatus && <div className="mt-1 text-xs text-[var(--store-muted)]">Status: {pixStatus.label}</div>}
                          <Link href={`/pedido/${pixResult.ref}`} className="mt-3 inline-block text-sm font-bold text-[var(--store-primary,#18181B)] no-underline">Acompanhar pedido</Link>
                        </div>
                      )
                    ) : generatingPix ? (
                      <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-[var(--store-line)] bg-[var(--store-surface)] px-5 py-7 text-sm font-semibold text-[var(--store-ink-2)]">
                        <Spinner className="animate-spin text-base" /> Gerando seu Pix…
                      </div>
                    ) : (
                      <div>
                        <div className="font-display text-[19px] font-extrabold text-[var(--store-primary,#18181B)]">{grandTotalLabel} <span className="text-[13px] font-bold text-[var(--store-muted)]">no Pix</span></div>
                        <p className="mt-1.5 text-[13px] leading-[1.5] text-[var(--store-ink-2)]">Ao confirmar, geramos seu <b>QR Code Pix</b> aqui mesmo. A aprovação é <b>imediata</b> e o pedido é liberado na hora.</p>
                        {PIX_DISCOUNT_PCT > 0 && <p className="mt-2 text-[12px] text-[var(--store-primary,#18181B)]">Desconto de {PIX_DISCOUNT_PCT}% no Pix aplicado automaticamente.</p>}
                      </div>
                    )}
                  </div>
                )}

                {payType === "card" && (
                  <div className="mt-5 flex flex-col gap-3.5">
                    <Labeled label="Número do cartão">
                      <div className="relative">
                        <input inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" className={`${inputCls} pr-12`}
                          value={card.cardNumber} onChange={(e) => setCard({ ...card, cardNumber: maskCardNumber(e.target.value) })} />
                        <CreditCard weight="fill" className="absolute right-4 top-[calc(50%+3px)] -translate-y-1/2 text-xl text-[var(--store-faint)]" />
                      </div>
                    </Labeled>
                    <Labeled label="Nome impresso no cartão">
                      <input autoComplete="cc-name" placeholder="Como está no cartão" className={inputCls}
                        value={card.cardHolder} onChange={(e) => setCard({ ...card, cardHolder: sanitizeName(e.target.value) })} />
                    </Labeled>
                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[1fr_1fr_1.3fr]">
                      <Labeled label="Validade">
                        <input inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" className={inputCls}
                          value={card.expiry} onChange={(e) => setCard({ ...card, expiry: maskExpiry(e.target.value) })} />
                      </Labeled>
                      <Labeled label="CVV">
                        <input inputMode="numeric" autoComplete="cc-csc" placeholder="123" className={inputCls}
                          value={card.securityCode} onChange={(e) => setCard({ ...card, securityCode: onlyDigits(e.target.value).slice(0, 4) })} />
                      </Labeled>
                      {!hasRecurring && (
                        <Labeled label="Parcelas">
                          <select value={String(installments)} onChange={(e) => setInstallments(Number(e.target.value) || 1)}
                            className="mt-[7px] h-[50px] w-full cursor-pointer rounded-md border-[1.5px] border-[var(--store-line-2)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--store-primary,#18181B)]">
                            {(installmentOptions.length
                              ? installmentOptions.map((o) => ({ n: o.installment, amt: o.amount }))
                              // Sem resposta de /api/checkout/installments só existe "à vista": a
                              // tabela de parcelas (e se tem juros) é da adquirente, não se inventa.
                              : [{ n: 1, amt: installmentTotal }]
                            ).map(({ n, amt }) => (
                              <option key={n} value={n}>{n}x de {formatBRL(amt)}{n === 1 ? " à vista" : Math.abs(amt * n - installmentTotal) < 0.05 ? " sem juros" : ""}</option>
                            ))}
                          </select>
                        </Labeled>
                      )}
                    </div>
                  </div>
                )}
              </Card>

              {/* Esconde o botão de pagar depois que o Pix foi gerado (já está aguardando pagamento). */}
              {!pixResult && (
                <div className="flex items-stretch gap-3">
                  <SecondaryButton onClick={() => go(2)}><ArrowLeft weight="bold" />Voltar</SecondaryButton>
                  <button type="button" onClick={pay} disabled={busy}
                    className="font-display flex h-[56px] flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-lg bg-[var(--store-cta,#D97706)] text-base font-extrabold tracking-[0.4px] text-[var(--store-cta-fg,#1C1207)] transition-colors hover:bg-[var(--store-cta-dark,#B45309)] disabled:opacity-60">
                    {busy ? <Spinner className="animate-spin text-lg" /> : <LockSimple weight="fill" className="text-lg" />}
                    {isPix ? `Pagar ${grandTotalLabel} no Pix` : `Pagar ${cart.summary.total ?? ""}`}
                  </button>
                </div>
              )}
              <div className="flex flex-wrap justify-center gap-5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--store-ink-2)]"><ShieldCheck className="text-base text-[var(--store-primary,#18181B)]" />Pagamento criptografado</span>
                <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--store-ink-2)]"><ArrowsClockwise className="text-base text-[var(--store-primary,#18181B)]" />troca em 7 dias (CDC)</span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — resumo (desktop) */}
        <aside className="hidden overflow-hidden rounded-2xl border border-[var(--store-line)] bg-white lg:sticky lg:top-6 lg:block">
          {summaryContent}
        </aside>
      </div>
      {/* resumo do pedido — colapsado/fixo no bottom (mobile) */}
      <div className="lg:hidden">
        {summaryOpen && <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setSummaryOpen(false)} />}
        <div className="fixed inset-x-0 bottom-0 z-[61] border-t border-[var(--store-line)] bg-white shadow-[0_-6px_24px_rgba(0,0,0,.12)]">
          {summaryOpen && <div className="max-h-[60vh] overflow-y-auto border-b border-[var(--store-surface-2)]">{summaryContent}</div>}
          <button type="button" onClick={() => setSummaryOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-3.5 pb-[max(14px,env(safe-area-inset-bottom))]">
            <span className="flex items-center gap-2 text-sm font-bold text-[var(--store-ink)]"><CaretUp weight="bold" className={summaryOpen ? "rotate-180 transition-transform" : "transition-transform"} />{summaryOpen ? "Ocultar resumo" : "Resumo do pedido"}</span>
            <span className="font-display text-lg font-extrabold text-[var(--store-primary,#18181B)]">{grandTotalLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- helpers ----------
function maskExpiry(s: string): string {
  const d = onlyDigits(s).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

function CheckoutHeader({ shopName }: { shopName: string }) {
  return (
    <div className="border-b border-[var(--store-line)] bg-white">
      <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-4 px-6 py-3.5">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5 text-[13px] font-semibold text-[var(--store-muted)] no-underline">
          <ArrowLeft weight="bold" className="text-base" /><span className="truncate">Voltar à loja</span>
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo do chrome: SVG de poucos KB. O next/image marcaria lazy num elemento que aparece em toda página (o preload scanner perde o recurso) e o reencode come o traço fino do lettering. Otimizar poucos KB não paga essas duas contas. */}
        <img src="/brand/logo.svg" alt={shopName} className="h-[42px] w-auto shrink-0" />
        <div className="flex flex-1 justify-end">
          <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--store-primary,#18181B)]"><LockSimple weight="fill" className="text-base" />Ambiente 100% seguro</span>
        </div>
      </div>
    </div>
  );
}

function StepBar({ step, maxStep, onGo }: { step: number; maxStep: number; onGo: (n: number) => void }) {
  const labels = ["Identificação", "Ofertas", "Pagamento"];
  return (
    <div className="flex items-center">
      {labels.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        const reachable = n <= maxStep;
        return (
          <React.Fragment key={label}>
            <div onClick={() => reachable && onGo(n)} className="flex w-[108px] shrink-0 flex-col items-center gap-2" style={{ cursor: reachable ? "pointer" : "default" }}>
              <span className="font-display flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
                style={active ? { background: "var(--store-primary,#18181B)", color: "var(--store-surface)", boxShadow: "0 0 0 4px var(--store-primary-soft)" } : done ? { background: "var(--store-primary,#18181B)", color: "var(--store-surface)" } : { background: "var(--store-surface-2)", color: "var(--store-faint)" }}>
                {done ? <Check weight="bold" className="text-[17px]" /> : n}
              </span>
              <span className="whitespace-nowrap text-[12.5px]" style={{ fontWeight: active || done ? 700 : 500, color: active ? "var(--store-primary,#18181B)" : done ? "var(--store-ink-2)" : "var(--store-faint)" }}>{label}</span>
            </div>
            {n < 3 && <div className="mb-[26px] h-[2.5px] flex-1 rounded-full" style={{ background: step > n ? "var(--store-primary,#18181B)" : "var(--store-line)", margin: "0 -10px 26px" }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[var(--store-line)] bg-white p-6">{children}</div>;
}

function CardHead({ n, title }: { n: string; title: string }) {
  return (
    <div className="mb-[18px] flex items-center gap-2.5">
      <span className="font-display flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--store-primary-soft,#F1F1F3)] text-sm font-extrabold text-[var(--store-primary,#18181B)]">{n}</span>
      <h4 className="font-display m-0">{title}</h4>
    </div>
  );
}

function Labeled({ label, locked, children }: { label: string; locked?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-[13px] font-bold text-[var(--store-ink-2)]">
      <span className="flex items-center gap-1.5">{label}{locked && <LockSimple weight="fill" className="text-[11px] text-[var(--store-muted)]" />}</span>
      {children}
    </label>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <span className="inline-block h-5 w-5 shrink-0 rounded-full border-2" style={{ borderColor: on ? "var(--store-primary,#18181B)" : "var(--store-faint)", background: on ? "radial-gradient(var(--store-primary,#18181B) 0 40%, var(--store-surface) 44%)" : "var(--store-surface)" }} />
  );
}

function PrimaryButton({ children, onClick, disabled, className }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`font-display flex h-[56px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg bg-[var(--store-primary,#18181B)] text-[15px] font-bold tracking-[0.4px] text-white shadow-[var(--store-shadow-cta)] transition-colors hover:bg-[var(--store-primary-dark,#09090B)] disabled:opacity-60 ${className ?? ""}`}>
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex h-[56px] shrink-0 cursor-pointer items-center gap-2 rounded-lg border-[1.5px] border-[var(--store-line-2)] bg-white px-[22px] text-sm font-bold text-[var(--store-ink-2)]">
      {children}
    </button>
  );
}
