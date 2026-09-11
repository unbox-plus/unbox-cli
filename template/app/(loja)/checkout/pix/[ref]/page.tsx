"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { Copy, Check, Loader2, CheckCircle2, RefreshCw } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function PixPage() {
  const params = useParams<{ ref: string }>();
  const ref = params.ref;
  const [emv, setEmv] = React.useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [status, setStatus] = React.useState<{ paid: boolean; statusLabel: string } | null>(null);
  const [expired, setExpired] = React.useState(false);

  // recupera o copia-e-cola do sessionStorage (setado no checkout)
  React.useEffect(() => {
    try {
      const v = sessionStorage.getItem(`unbox_pix:${ref}`);
      if (v) {
        setEmv(v);
        QRCode.toDataURL(v, { width: 240, margin: 1 }).then(setQrDataUrl).catch(() => {});
      }
    } catch {}
  }, [ref]);

  // polling de status (doc 11): fallback à confirmação por webhook
  React.useEffect(() => {
    let stop = false;
    const start = Date.now();
    const tick = async () => {
      if (stop) return;
      try {
        const res = await fetch(`/api/order/${ref}`, { cache: "no-store" });
        const data = await res.json();
        if (res.ok && data.order) {
          setStatus({ paid: data.order.paid, statusLabel: data.order.statusLabel });
          if (data.order.paid) return; // para o polling
          if (["CANCELED", "FAILED"].includes(data.order.status)) {
            setExpired(true);
            return;
          }
        }
      } catch {}
      if (Date.now() - start > 10 * 60 * 1000) {
        setExpired(true);
        return;
      }
      if (!stop) setTimeout(tick, 5000);
    };
    const t = setTimeout(tick, 3000);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [ref]);

  const copy = async () => {
    if (!emv) return;
    await navigator.clipboard.writeText(emv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status?.paid) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <CheckCircle2 className="mx-auto size-14 text-primary" />
        <h1 className="mt-4">Pagamento confirmado!</h1>
        <p className="mt-2 text-muted-foreground">Recebemos seu Pix. Já estamos preparando seu pedido.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button nativeButton={false} render={<Link href={`/pedido/${ref}`} />}>Ver pedido</Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/produtos" />}>Continuar comprando</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-6">
      <h1>Pague com Pix</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pedido #{ref}</p>

      {expired ? (
        <Alert variant="destructive" className="mt-6">
          <AlertTitle>Pix expirado</AlertTitle>
          <AlertDescription>
            O tempo para pagamento terminou. Refaça o pedido para gerar um novo Pix.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="mt-6 rounded-xl border p-6 text-center">
          {qrDataUrl ? (
            <Image src={qrDataUrl} alt="QR Code Pix" width={240} height={240} className="mx-auto rounded-lg" unoptimized />
          ) : (
            <div className="mx-auto flex h-[240px] w-[240px] items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
              {emv ? "gerando QR..." : "Abra o app do banco e use o código abaixo"}
            </div>
          )}

          {emv && (
            <div className="mt-4">
              <p className="mb-1 text-xs text-muted-foreground">Pix copia e cola</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md bg-muted px-2 py-2 text-left text-xs">{emv}</code>
                <Button type="button" variant="outline" size="icon" onClick={copy} aria-label="Copiar código Pix">
                  {copied ? <Check /> : <Copy />}
                </Button>
              </div>
            </div>
          )}

          <p className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Aguardando confirmação do pagamento…
          </p>
          {status && <p className="mt-1 text-xs text-muted-foreground">Status atual: {status.statusLabel}</p>}
        </div>
      )}

      <div className="mt-4 flex justify-center gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/checkout" />}>
          <RefreshCw /> Gerar novo Pix
        </Button>
        <Button variant="ghost" nativeButton={false} render={<Link href={`/pedido/${ref}`} />}>Ver pedido</Button>
      </div>
    </div>
  );
}
