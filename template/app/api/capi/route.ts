// Meta Conversions API (server-side) — recebe o evento do browser (lib/analytics.ts) com o MESMO
// event_id do Pixel → o Meta deduplica e conta 1 vez. Enriquece com fbp/fbc (cookies), IP e UA.
// Todos os campos de cliente (em, ph, fn, ln, zp, external_id) chegam JÁ hasheados do browser;
// esta rota nunca vê PII crua. O envio em si está em lib/capi.ts (compartilhado com o webhook).
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { sendCapi, capiConfigured } from "@/lib/capi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!capiConfigured()) return NextResponse.json({ ok: true, capi: false });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const { eventId, eventName, value, currency, contents, sourceUrl, orderId, em, ph, fn, ln, zp, external_id } = body ?? {};
  if (!eventName || !eventId) return NextResponse.json({ ok: false }, { status: 400 });

  const ck = await cookies();
  const hd = await headers();
  const r = await sendCapi({
    eventId, eventName, value, currency, contents, sourceUrl, orderId,
    actionSource: "website",
    userData: {
      em, ph, fn, ln, zp, external_id,
      fbp: ck.get("_fbp")?.value,
      fbc: ck.get("_fbc")?.value,
      client_ip_address: (hd.get("x-forwarded-for") || "").split(",")[0].trim() || undefined,
      client_user_agent: hd.get("user-agent") || undefined,
    },
  });
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
