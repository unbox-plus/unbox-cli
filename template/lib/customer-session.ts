// Factory do UnboxCustomerClient a partir do cookie httpOnly do cliente (área "minha conta").
// Lança 401 implícito devolvendo null quando não há token.
import "server-only";
import type { UnboxCustomerClient } from "@unbox-plus/sdk";
import { getCustomerToken } from "./session";
import { getCustomerClientFor } from "./unbox";

/**
 * Retorna um UnboxCustomerClient autenticado, ou null se o cliente não estiver logado.
 *
 * O que é DESTA loja é só a leitura do cookie httpOnly. O resto é do SDK: TOKEN VENCIDO VALE COMO
 * DESLOGADO (o cookie dura o mesmo que o JWT, mas relógio e renovação não são garantia — sem essa
 * conta, o app se achava logado, toda consulta quebrava com erro opaco do backend e a conta virava
 * beco sem saída), e as DUAS IDENTIDADES da requisição, o cliente no `x-customer-token` e a loja
 * no `Authorization`, que é de onde o gateway tira o shopId.
 */
export async function getCustomerClient(): Promise<UnboxCustomerClient | null> {
  return getCustomerClientFor(await getCustomerToken());
}

/** Igual ao acima, mas lança um Error 401-like se não logado (para Route Handlers). */
export async function requireCustomerClient(): Promise<UnboxCustomerClient> {
  const c = await getCustomerClient();
  if (!c) throw new Error("UNAUTHENTICATED");
  return c;
}

/**
 * LEITURA DA CONTA QUE NÃO ENGOLE A FALHA. `.catch(() => ({ nodes: [] }))` transformava "a consulta
 * quebrou" em "você ainda não tem pedidos", sem uma linha de log: foi assim que a lista de pedidos
 * sumiu da conta de quem tinha comprado e ninguém teve o que investigar até um cliente reclamar.
 *
 * Aqui a falha é registrada e devolvida como tal (`ok: false`), e cada página decide o estado dela,
 * que nunca é o mesmo de "conta sem nada".
 */
export async function lerDaConta<T>(rotulo: string, leitura: Promise<T>): Promise<{ ok: true; valor: T } | { ok: false }> {
  try {
    return { ok: true, valor: await leitura };
  } catch (e) {
    console.error(JSON.stringify({
      tag: "[api-erro]",
      rota: rotulo,
      erro: (e instanceof Error ? e.message : String(e)).slice(0, 500),
      quando: new Date().toISOString(),
    }));
    return { ok: false };
  }
}
