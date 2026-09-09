// Meta Conversions API — remetente compartilhado. Usado pela rota /api/capi (eventos vindos do
// browser, já hasheados) e pelo webhook de pagamento (compra confirmada fora do navegador).
// NO-OP sem META_PIXEL_ID / META_CAPI_TOKEN. Nunca recebe PII crua: quem chama já hasheou.
import "server-only";
import crypto from "node:crypto";

const GRAPH = "https://graph.facebook.com/v19.0";

export interface CapiUserData {
  em?: string; ph?: string; fn?: string; ln?: string; zp?: string; external_id?: string;
  fbp?: string; fbc?: string; client_ip_address?: string; client_user_agent?: string;
}

export interface CapiEvent {
  eventId: string;
  eventName: string;
  value?: number;
  currency?: string;
  orderId?: string;
  contents?: { id: string; quantity: number; item_price?: number }[];
  sourceUrl?: string;
  /** "website" para evento do browser; "system_generated" para o webhook de pagamento */
  actionSource?: "website" | "system_generated";
  userData: CapiUserData;
}

/** SHA-256 hex de um valor normalizado (minúsculo, sem espaço nas pontas). */
export function sha256(value?: string): string | undefined {
  const v = (value ?? "").trim().toLowerCase();
  return v ? crypto.createHash("sha256").update(v).digest("hex") : undefined;
}

/** Configurada de verdade: pixel NUMÉRICO e token sem cara de comentário. Presença truthy não
 *  basta — uma frase copiada do .env passava no guard antigo e virava 502 em todo evento. */
export function capiConfigured() {
  const pixel = process.env.META_PIXEL_ID ?? "";
  const token = process.env.META_CAPI_TOKEN ?? "";
  return /^\d{5,}$/.test(pixel) && token.length > 20 && !/[\s#]/.test(token);
}

export async function sendCapi(ev: CapiEvent): Promise<{ ok: boolean; capi: boolean }> {
  if (!capiConfigured()) return { ok: true, capi: false };
  const pixelId = process.env.META_PIXEL_ID!;
  const token = process.env.META_CAPI_TOKEN!;

  // O Meta exige ao menos um identificador de cliente; sem nenhum, rejeita o evento.
  const ud = Object.fromEntries(Object.entries(ev.userData).filter(([, v]) => v));
  if (!Object.keys(ud).length) return { ok: false, capi: false };
  // em/ph/fn/ln/zp/external_id vão como ARRAY de hashes, por spec
  for (const k of ["em", "ph", "fn", "ln", "zp", "external_id"]) if (ud[k]) ud[k] = [ud[k]];

  const customData: Record<string, any> = { currency: ev.currency || "BRL", value: ev.value };
  if (ev.orderId) customData.order_id = ev.orderId;
  if (ev.contents?.length) {
    customData.contents = ev.contents;
    customData.content_type = "product";
    customData.content_ids = ev.contents.map((c) => c.id);
  }

  const payload = {
    data: [{
      event_name: ev.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: ev.eventId,
      action_source: ev.actionSource ?? "website",
      ...(ev.sourceUrl ? { event_source_url: ev.sourceUrl } : {}),
      user_data: ud,
      custom_data: customData,
    }],
  };

  try {
    const res = await fetch(`${GRAPH}/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("[capi] meta rejeitou", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return { ok: false, capi: true };
    }
    return { ok: true, capi: true };
  } catch (e) {
    console.error("[capi] falha de rede", e);
    return { ok: false, capi: true };
  }
}
