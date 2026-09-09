// Utilitários puros de formatação/preço — seguros no client e no server (sem segredos).

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formata um número em BRL. Use o `displayAmount` da API quando existir; isto é fallback. */
export function formatBRL(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return BRL.format(amount);
}

export interface ResolvedPrice {
  price: number | null;
  displayPrice: string;
  compareAt?: string | null; // preço "de" (riscado), se houver
}

/**
 * Resolve o preço REAL de uma variante. ⚠️ O preço vive na variante (`variant.pricing[0]`),
 * NÃO em `product.pricing` (que é só agregado min/max). Acesso defensivo a array vs objeto.
 */
export function resolveVariantPrice(variant: any): ResolvedPrice {
  const p = Array.isArray(variant?.pricing) ? variant.pricing[0] : variant?.pricing;
  return {
    price: p?.price ?? null,
    displayPrice: p?.displayPrice ?? formatBRL(p?.price),
    compareAt: p?.compareAtPrice?.displayAmount ?? null,
  };
}

/** Preço de vitrine a partir do node do catálogo (usa a 1ª variante; fallback no agregado). */
export function resolveProductPrice(product: any): ResolvedPrice {
  const v = product?.variants?.[0];
  if (v) return resolveVariantPrice(v);
  const agg = Array.isArray(product?.pricing) ? product.pricing[0] : product?.pricing;
  return { price: agg?.minPrice ?? null, displayPrice: agg?.displayPrice ?? formatBRL(agg?.minPrice), compareAt: null };
}

/** Aplica % de desconto a um valor (ex.: preview de assinatura) e devolve string BRL. */
export function applyPercentOff(amount: number, percent: number): string {
  return formatBRL(amount * (1 - percent / 100));
}

/** Máscara/normalização simples de CEP (8 dígitos). */
export function onlyDigits(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

export function maskCep(s: string): string {
  const d = onlyDigits(s).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Máscara de telefone BR — (11) 99999-9999 (celular) ou (11) 9999-9999 (fixo). */
export function maskPhone(s: string): string {
  const d = onlyDigits(s).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Máscara de CPF — 000.000.000-00. */
export function maskCpf(s: string): string {
  const d = onlyDigits(s).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Validação de CPF pelos dígitos verificadores (rejeita sequências repetidas). */
export function isValidCpf(s: string): boolean {
  const c = onlyDigits(s);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i], 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(c[10], 10);
}

/** Validação simples de formato de e-mail. */
export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s ?? "").trim());
}

// ----- Sanitização de input: bloqueia caracteres que não pertencem ao campo -----

/** Nome próprio: apenas letras (com acento), espaço, apóstrofo, ponto e hífen. */
export function sanitizeName(s: string): string {
  return (s ?? "").replace(/[^\p{L}\s'’.-]/gu, "").replace(/\s{2,}/g, " ").replace(/^\s+/, "");
}

/** E-mail: sem espaços e só caracteres válidos de e-mail. */
export function sanitizeEmail(s: string): string {
  return (s ?? "").replace(/\s+/g, "").replace(/[^a-zA-Z0-9@._%+\-]/g, "");
}

/** Texto de endereço (rua, bairro, complemento): letras, números, espaço e pontuação comum. */
export function sanitizeText(s: string): string {
  return (s ?? "").replace(/[^\p{L}\p{N}\s.,'’ºª°#/-]/gu, "").replace(/\s{2,}/g, " ").replace(/^\s+/, "");
}

/** Número do endereço: dígitos, letras e barra (ex.: 123, 123A, S/N). */
export function sanitizeHouseNumber(s: string): string {
  return (s ?? "").replace(/[^0-9A-Za-z/]/g, "");
}

/** UF: apenas letras, maiúsculas, no máximo 2. */
export function sanitizeUf(s: string): string {
  return (s ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
}

/** Número do cartão: dígitos agrupados em blocos de 4 (até 19 dígitos). */
export function maskCardNumber(s: string): string {
  const d = onlyDigits(s).slice(0, 19);
  return d.replace(/(.{4})/g, "$1 ").trim();
}

/** Converte um displayAmount BR ("R$ 1.234,56") em número. Retorna null se inválido. */
export function parseBRL(s?: string | null): number | null {
  if (!s) return null;
  const n = Number(s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}
