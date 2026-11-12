// BFF do carrinho. O browser NUNCA fala com a Unbox direto — só com estas rotas same-origin.
import { withStoreClient } from "@/lib/unbox";
import { UnboxError, type CartItemInput } from "@unbox-plus/sdk";
import { getCartRef, setCartRef, clearCartRef } from "@/lib/session";
import {
  saveCartFrequency, syncCartFrequency, hasRecurringItem, takePendingFrequency, restorePendingFrequency,
  validFrequency, defaultFrequency, type PendingFrequency,
} from "@/lib/cart-frequency";
import { cartResponse } from "@/lib/cart-response";
import { comImagemDoCatalogo } from "@/lib/cart-thumbnail";
import { ok, fail, failFrom } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/cart → reidrata o carrinho do cookie ({cartId, cartToken})
export async function GET() {
  try {
    const ref = await getCartRef();
    if (!ref) return ok({ cart: null });
    const cart = await withStoreClient((c) => c.getCart(ref.cartId, ref.cartToken));
    if (!cart) {
      // A query respondeu OK mas sem carrinho → o cartId/cartToken realmente não existe mais.
      await clearCartRef();
      return ok({ cart: null });
    }
    // Leva ao carrinho uma frequência que ficou pendente no cookie (gravação que falhou, ou
    // carrinho de versão que guardava a frequência só no cookie). Este GET roda em todo
    // carregamento de página, então é aqui que o pendente se resolve. Nunca lança.
    await syncCartFrequency(ref, cart);
    return ok({ cart: await cartResponse(cart) });
  } catch (e) {
    // Só limpa o cookie quando o erro CONFIRMA que o carrinho/token é inválido — nunca em
    // falha transitória (timeout, rede, 5xx da Unbox). Limpar nesses casos apagava carrinhos
    // válidos por uma simples intermitência de rede, forçando o cliente a montar tudo de novo.
    if (isCartGone(e)) await clearCartRef();
    return ok({ cart: null });
  }
}

// Só considera o carrinho "morto" (cookie deve ser limpo) quando o erro da Unbox indica
// explicitamente que o cartId/cartToken não é mais válido. Qualquer outra falha (timeout,
// rede, 5xx, GraphQL genérico) é tratada como transitória — mantém o cookie pra tentar de novo.
function isCartGone(e: unknown): boolean {
  if (e instanceof UnboxError) {
    const msg = (e.errors?.[0]?.message ?? e.message ?? "").toUpperCase();
    // SÓ códigos do CARRINHO. UNAUTHENTICATED/ACCESS_DENIED são o token da LOJA expirado ou a
    // Unbox Auth instável — transitório. Tratá-los como "carrinho morto" apagava o cookie de
    // TODOS os visitantes numa rotação de senha ou numa oscilação da API.
    return /NOT_FOUND|INVALID_TOKEN|INVALID_CART|CART_EXPIRED/.test(msg);
  }
  return false;
}

// POST /api/cart → adiciona itens (cria o carrinho se ainda não existir)
//
// ═══ ASSINATURA (item recorrente) — leia antes de montar o payload ═══
// `isRecurring: true` no item SOZINHO não assina nada: sem `recurringItemsFrequencyId` o
// pedido é aceito e registrado como compra avulsa, sem erro. Os dois sempre juntos:
//   1. item com `isRecurring: true`  +  2. `recurringItemsFrequencyId` (id vindo de
//   shop.recurringOrdersPolicy.allowedFrequencies) no body.
// O desconto de assinante REAL é shop.recurringOrdersPolicy.pricingPolicy
// ({ type: "PERCENTAGE_OFF", value: N }) — nunca invente o percentual no front.
// Implementação de referência: components/landing/product-picker.tsx (monta os dois campos).
export async function POST(req: Request) {
  let pendenteAntes: PendingFrequency | null = null;
  try {
    const body = await req.json();
    let items: CartItemInput[] = body.items ?? [];
    if (!items.length) return fail("Nenhum item informado.");
    // A foto da linha é sempre a do catálogo, decidida aqui; o `thumbnail` do corpo é ignorado.
    items = await comImagemDoCatalogo(items);
    // A frequência não entra no createCart/addCartItems (o input não aceita): ela é gravada no
    // carrinho logo depois, com setCartRecurringFrequency. É de lá que os dois checkouts a leem.
    // Trimada e conferida contra `allowedFrequencies`: id vazio ou que a loja não oferece conta como
    // "sem frequência no corpo" e cai na ordem abaixo.
    const recurringItemsFrequencyId = await validFrequency(body.recurringItemsFrequencyId);
    // O pendente (cookie) sai ANTES de qualquer outra coisa: um GET em paralelo não pode levá-lo
    // ao carrinho por cima da frequência que este POST vai gravar. O valor fica em memória e entra
    // abaixo, antes do padrão da loja; se a rota falhar, ele volta para o cookie.
    pendenteAntes = await takePendingFrequency();
    let ref = await getCartRef();
    // Sem carrinho no cookie, o pendente não é de carrinho nenhum: descarta.
    if (!ref) pendenteAntes = null;

    const result = await withStoreClient(async (c) => {
      if (!ref) {
        const created = await c.createCart(items);
        ref = { cartId: created.cartId, cartToken: created.cartToken };
        return { quantityFailures: failuresOf(created) };
      }
      const added = await c.addCartItems(ref.cartId, ref.cartToken, items);
      return { quantityFailures: failuresOf(added) };
    });

    if (ref) await setCartRef(ref);
    // Item recorrente SEM frequência vira "Frequência: Não selecionada" no checkout, em vermelho,
    // com o preço já descontado (caso real em produção). As telas que adicionam ao carrinho
    // decidem `isRecurring` e a frequência em expressões separadas, então basta a fonte da
    // frequência estar vazia num instante para sair uma sem a outra, e o sintoma só aparece no
    // fim. Quando dois campos só fazem sentido juntos, quem garante o par é o servidor: ele
    // sempre sabe a política da loja.
    //
    // A ordem é: a frequência do corpo (escolha do cliente agora), uma escolha anterior que não
    // chegou ao carrinho, a que o carrinho já tem, um pendente comum e só então o padrão da loja.
    // Um add sem frequência no corpo nunca troca a frequência que o carrinho já tem. A gravação não vira erro: os itens já entraram, e um erro
    // aqui faria o cliente adicionar de novo (quantidade dobrada). Em falha, o valor fica pendente
    // no cookie e o próximo GET tenta de novo.
    let falhou = false;
    if (items.some((it) => it.isRecurring) && recurringItemsFrequencyId) {
      falhou = !(await saveCartFrequency(ref!, recurringItemsFrequencyId));
      pendenteAntes = null; // a escolha de agora substitui qualquer pendente
    }
    const full = await withStoreClient((c) => c.getCart(ref!.cartId, ref!.cartToken));
    if (!falhou && full && hasRecurringItem(full)) {
      const escolhaAnterior = pendenteAntes?.escolha ? await validFrequency(pendenteAntes.valor) : null;
      let freq: string | null = null;
      if (escolhaAnterior && escolhaAnterior !== full.recurringItemsFrequencyId) freq = escolhaAnterior;
      else if (!full.recurringItemsFrequencyId) {
        freq = (pendenteAntes ? await validFrequency(pendenteAntes.valor) : null) ?? (await defaultFrequency());
      }
      // Só a escolha do cliente volta ao cookie como escolha (vence o carrinho); pendente comum e
      // padrão da loja voltam como pendente comum (só preenchem carrinho vazio).
      if (freq && (await saveCartFrequency(ref!, freq, { escolha: freq === escolhaAnterior }))) {
        full.recurringItemsFrequencyId = freq;
      }
      pendenteAntes = null;
    } else if (pendenteAntes && full && !hasRecurringItem(full)) {
      pendenteAntes = null; // sem item de assinatura, o pendente não serve para nada
    } else if (pendenteAntes) {
      await restorePendingFrequency(pendenteAntes);
      pendenteAntes = null;
    }
    return ok({ cart: await cartResponse(full), warnings: result.quantityFailures });
  } catch (e) {
    if (pendenteAntes) await restorePendingFrequency(pendenteAntes);
    return failFrom(e);
  }
}

// DELETE /api/cart → esvazia o carrinho (limpa o cookie)
export async function DELETE() {
  await clearCartRef();
  return ok({ cart: null });
}

function failuresOf(r: any): string[] {
  const out: string[] = [];
  for (const f of r?.minOrderQuantityFailures ?? []) out.push(`Quantidade mínima: ${f.minOrderQuantity}.`);
  for (const f of r?.maxOrderQuantityFailures ?? []) out.push(`Quantidade máxima: ${f.maxOrderQuantity}.`);
  return out;
}
