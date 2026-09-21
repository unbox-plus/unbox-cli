// A FIAÇÃO desta loja com o SDK da Unbox. Uma linha por decisão que é DESTA loja, e nada mais.
//
// Toda chamada à API de parceiros (catálogo, carrinho, checkout, placeOrder, pedido, área do
// cliente, assinaturas, cupons, CEP, OTP, inventário) mora em `@unbox-plus/sdk`, versionado no
// package.json. O que mora AQUI é só o que o pacote não pode saber: de onde saem as credenciais
// (`lib/config.ts`, que lê o ambiente desta instalação) e o fato de que isto não pode chegar ao
// navegador.
//
// É por isso que este arquivo existe em vez de a loja chamar o SDK direto de cada rota:
// **atualizar a integração com a Unbox é um bump de versão no package.json**, sem tocar em
// arquivo nenhum da loja. Antes, a mesma correção exigia substituir `lib/unbox/*.ts` em cada
// loja no ar, uma por uma.
//
// ⚠️ `import "server-only"` na primeira linha, e ele é o ponto inteiro do arquivo: a api key do
// PARCEIRO vale para todas as lojas dele, e o token da loja abre qualquer pedido dela. Um import
// deste módulo num componente de cliente tem que quebrar o build, não vazar as duas.
import "server-only";
import { createUnboxStore, type UnboxClient, type UnboxCustomerClient } from "@unbox-plus/sdk";
import { serverEnv } from "./config";

/**
 * A loja: um signIn, o token em cache no módulo, re-signin quando vence.
 *
 * As credenciais entram como FUNÇÃO para serem lidas no primeiro uso e não no import — o
 * `next build` importa este módulo sem ambiente, e ler ali dentro congelaria valores vazios.
 *
 * PROD (várias lambdas): passe `{ tokenStore }` com Vercel KV / Edge Config e o signIn passa a
 * ser um por LOJA em vez de um por lambda fria. É o único ponto que muda.
 */
export const unbox = createUnboxStore(() => ({
  partnerApiKey: serverEnv.partnerApiKey,
  partnerGqlUrl: serverEnv.partnerGqlUrl,
  user: serverEnv.user,
  pass: serverEnv.pass,
  shopId: serverEnv.shopId,
  shopSlug: serverEnv.shopSlug,
}));

/** shopId/shopSlug resolvidos (o `.env` ganha; senão saem do claim do token). */
export function getShopContext(): Promise<{ shopId: string; shopSlug: string }> {
  return unbox.getShopContext();
}

/** UnboxClient de loja já autenticado. Prefira `withStoreClient`, que renova token vencido. */
export function getStoreClient(): Promise<UnboxClient> {
  return unbox.getStoreClient();
}

/** Executa a operação com o client de loja, renovando o token UMA vez se ele tiver vencido. */
export function withStoreClient<T>(fn: (client: UnboxClient) => Promise<T>): Promise<T> {
  return unbox.withStoreClient(fn);
}

/** Client da área do cliente a partir do token dele. `null` = deslogado (ausente ou vencido). */
export function getCustomerClientFor(customerToken: string | null | undefined): Promise<UnboxCustomerClient | null> {
  return unbox.getCustomerClient(customerToken);
}

/** Catálogo INTEIRO, paginado por offset (sitemap e llms.txt). */
export function loadAllCatalogItems(opts: { tagIds?: string[]; searchText?: string } = {}): Promise<any[]> {
  return unbox.loadAllCatalogItems(opts);
}
