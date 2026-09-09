"use client";

// Dispara purchase / Purchase quando o pedido está PAGO (página /pedido/[ref]). Dedupe por
// transactionId (localStorage) em trackPurchase → não conta duas vezes se o cliente também viu
// a confirmação inline do Pix. Pix pendente NUNCA dispara: `paid` decide. Não renderiza nada.
import * as React from "react";
import { trackPurchase, type TrackItem, type TrackUser } from "@/lib/analytics";

export function PurchaseTracker({
  transactionId,
  paid,
  value,
  items,
  shipping,
  coupon,
  user,
}: {
  transactionId: string;
  paid: boolean;
  value?: number;
  items: TrackItem[];
  shipping?: number;
  coupon?: string;
  user?: TrackUser;
}) {
  React.useEffect(() => {
    if (!paid || !transactionId) return;
    trackPurchase({ transactionId, value, items, shipping, coupon, user });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paid, transactionId]);
  return null;
}
