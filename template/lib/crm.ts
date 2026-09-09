// Integração de CRM (carrinho abandonado / e-mails transacionais) — doc 10/11.
// A recuperação de carrinho é responsabilidade do storefront: ele detecta o abandono e
// dispara pelo CRM da loja (Revi/Klaviyo). Aqui fazemos um POST real para CRM_WEBHOOK_URL
// quando configurada.
import "server-only";
import { serverEnv } from "./config";

export interface CrmEvent {
  /** `checkout_started` sai na hora em que o e-mail é gravado no carrinho e SEMPRE carrega
   *  `recoveryUrl` — é ele que arma o fluxo de abandono no CRM (espere N min; se não chegar
   *  `order_created` com o mesmo cartId/email, envie o e-mail com o recoveryUrl). */
  type: "checkout_started" | "abandoned_cart" | "order_created" | "order_paid";
  email?: string;
  cartId?: string;
  orderId?: string;
  referenceId?: string;
  /** Link pronto pra restaurar o carrinho (/checkout?id=&token=&freq=&step=) — top-level pra
   *  quem consumir o webhook (Klaviyo/Revi) achar fácil, sem precisar abrir o payload. */
  recoveryUrl?: string;
  payload?: Record<string, any>;
}

/** Dispara um evento para o CRM. No-op (apenas log) se CRM_WEBHOOK_URL não estiver configurada. */
export async function dispatchCrm(event: CrmEvent): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!serverEnv.crmWebhookUrl) {
    console.info("[crm] CRM_WEBHOOK_URL não configurada — evento ignorado:", event.type);
    return { ok: true, skipped: true };
  }
  try {
    const res = await fetch(serverEnv.crmWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "unbox-storefront", ...event, at: new Date().toISOString() }),
    });
    return { ok: res.ok };
  } catch (e) {
    console.error("[crm] falha ao despachar evento", e);
    return { ok: false };
  }
}
