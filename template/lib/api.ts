// Helpers de resposta para Route Handlers (BFF). Centraliza o tratamento de erro:
// nunca vaza segredo, traduz erro da Unbox em mensagem amigável.
import "server-only";
import { NextResponse } from "next/server";
import { friendlyError } from "./unbox/errors";
import { UnboxError } from "./unbox/client";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as any, init);
}

export function fail(message: string, status = 400, extra?: Record<string, any>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Nome técnico do campo de endereço, do jeito que a pessoa vê no formulário. */
const CAMPO_ENDERECO: Record<string, string> = {
  fullName: "nome completo", address1: "endereço", number: "número", neighborhood: "bairro",
  city: "cidade", region: "estado (UF)", postal: "CEP", phone: "telefone",
  taxPayerId: "CPF/CNPJ", country: "país", address2: "complemento",
};

/** A Unbox diz QUAL campo do endereço recusou, em `invalidAddressFields`. Sem ler isso, a
 *  pessoa lê "endereço inválido", não sabe o que corrigir e desiste (caso real em produção). */
function erroDeEndereco(e: unknown): string | null {
  if (!(e instanceof UnboxError)) return null;
  for (const err of e.errors ?? []) {
    const campos = (err as any)?.extensions?.invalidAddressFields ?? (err as any)?.invalidAddressFields;
    const nomes = Object.keys(campos ?? {}).map((k) => CAMPO_ENDERECO[k] ?? k);
    if (!nomes.length) continue;
    const lista = nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
    return `Confira ${nomes.length === 1 ? "o campo" : "os campos"} ${lista} e tente de novo.`;
  }
  return null;
}

/** Converte qualquer erro numa resposta JSON amigável (sem vazar stack/segredos).
 *
 *  SEMPRE loga no servidor, em QUALQUER status: o `code` da resposta morre no navegador de quem
 *  tentou, e sem este log o painel mostra só "POST /api/checkout 400". Em uma semana de loja no ar,
 *  três erros diferentes chegaram ao cliente como "Algo deu errado" sem deixar rastro (o DDD do
 *  telefone num pagamento, o código do login e a consulta do pedido) e os três eram 4xx, que o log
 *  antigo não cobria. Registra só o código e os erros do GraphQL: nunca o corpo da requisição,
 *  que carrega dado de cliente. Passe `context` com o que identifica a operação (cartId,
 *  referenceId...), nunca com segredo. */
export function failFrom(e: unknown, status = 400, context?: Record<string, unknown>) {
  const raw = e instanceof UnboxError ? e.errors?.[0]?.message ?? e.message : e instanceof Error ? e.message : String(e);
  console.error(JSON.stringify({
    tag: "[api-erro]",
    status,
    erro: String(raw).slice(0, 500),
    detalhes: e instanceof UnboxError ? e.errors ?? null : null, // erros do GraphQL: a causa real costuma estar aqui
    ...context,
    quando: new Date().toISOString(),
  }));
  if (raw === "UNAUTHENTICATED") return fail("Sessão expirada. Entre novamente.", 401);
  const endereco = erroDeEndereco(e);
  if (endereco) return fail(endereco, status, { code: raw });
  return fail(friendlyError(e), status, { code: raw });
}
