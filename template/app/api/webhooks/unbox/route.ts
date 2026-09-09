// Receptor de webhooks da Unbox (doc 07/11):
//  - lê o corpo CRU (req.text()) — NUNCA req.json() antes da verificação
//  - valida HMAC-SHA256 (X-Unbox-Signature) com timingSafeEqual → 401 se inválido
//  - PING → 200 imediato (handshake)
//  - idempotência por event._id
//  - responde 200 rápido; processamento pesado deve ir para fila (aqui: inline + revalidação)
import { parseUnboxWebhook } from "@/lib/unbox/webhooks";
import { serverEnv } from "@/lib/config";
import { markIfNew } from "@/lib/webhook-store";
import { dispatchCrm } from "@/lib/crm";
import { revalidatePath } from "next/cache";
import { withStoreClient } from "@/lib/unbox/store";
import { sendCapi, sha256, capiConfigured } from "@/lib/capi";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Cada assinatura de webhook tem o seu secret (ORDER_CREATED e ORDER_STATUS_UPDATE diferem).
  // UNBOX_WEBHOOK_SECRET aceita uma LISTA separada por vírgula.
  const secrets = serverEnv.webhookSecret.split(",").map((s) => s.trim()).filter(Boolean);
  if (!secrets.length) {
    // sem secret configurado não há como validar — recusa (configure via npm run unbox:webhook:subscribe)
    return new Response("webhook secret not configured", { status: 503 });
  }

  let evt;
  try {
    evt = await parseUnboxWebhook(req, secrets);
  } catch {
    return new Response("invalid signature", { status: 401 });
  }

  if (evt.type === "PING") return new Response("ok");

  // idempotência
  if (!markIfNew(evt._id)) return new Response("duplicate ignored");

  try {
    const data = evt.data as any;
    if (evt.type === "ORDER_CREATED") {
      await dispatchCrm({ type: "order_created", orderId: data.orderId, referenceId: data.orderId, payload: data });
    }
    if (evt.type === "ORDER_STATUS_UPDATE") {
      // Pix pago: paymentStatus PAID + orderStatus PROCESSING (não existe orderStatus PAID)
      if (data.paymentStatus === "PAID") {
        await dispatchCrm({ type: "order_paid", orderId: data.orderId, referenceId: data.orderId, payload: data });
        // Compra confirmada FORA do navegador (Pix/boleto pagos depois de fechar a página):
        // manda o Purchase pra Meta por CAPI, server-to-server, com o MESMO event_id que o
        // browser usaria ("purchase-<ref>"). Se a pessoa ainda estava na página e o browser
        // também disparou, o Meta deduplica. Pix gerado e abandonado NUNCA chega aqui —
        // é o webhook de pagamento, não de criação do pedido.
        await purchaseParaMeta(data).catch((e) => console.error("[webhook] capi purchase", e));
      }
      // revalida páginas de catálogo (estoque pode ter mudado)
      revalidatePath("/");
      revalidatePath("/produtos");
    }
  } catch (e) {
    // não derruba o 200 — webhook deve ser idempotente e tolerante; loga para investigação
    console.error("[webhook] erro ao processar", e);
  }

  return new Response("ok");
}

/**
 * Purchase server-side na Meta. Busca o pedido com credenciais da LOJA (o webhook não traz itens
 * nem e-mail) e envia hasheado. Sem META_PIXEL_ID/META_CAPI_TOKEN é no-op.
 */
async function purchaseParaMeta(data: any) {
  if (!capiConfigured() || !data?.orderId) return;
  const order = await withStoreClient((c) => c.getOrder(data.orderId)).catch(() => null);
  if (!order) return;

  const nodes: any[] = (order.fulfillmentGroups ?? []).flatMap((g: any) => g?.items?.nodes ?? []);
  const addr = (order.fulfillmentGroups ?? []).map((g: any) => g?.data?.shippingAddress).find(Boolean);
  const partes = String(addr?.fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const semAcento = (s?: string) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const value = Number(data.paymentSummary?.orderTotal ?? order.summary?.total?.amount ?? 0);

  await sendCapi({
    eventId: `purchase-${order.referenceId}`,
    eventName: "Purchase",
    value,
    currency: "BRL",
    orderId: order.referenceId,
    actionSource: "system_generated",
    contents: nodes.map((n) => ({ id: n.productConfiguration?.productId ?? n._id, quantity: n.quantity ?? 1, item_price: n.price?.amount })),
    userData: {
      em: sha256(order.email),
      fn: sha256(semAcento(partes[0])),
      ln: sha256(semAcento(partes.slice(1).join(" "))),
      zp: sha256(String(addr?.postal ?? "").replace(/\D/g, "")),
      external_id: sha256(order.email),
    },
  });
}
