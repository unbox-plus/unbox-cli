"use client";

// page_view nas navegações SPA do App Router — SÓ para os canais que não têm listener próprio:
//   • gtag direto (GA4 sem GTM): o gtag('config') dispara page_view uma vez, no load; troca de
//     rota precisa deste hook.
//   • Meta Pixel: idem (PageView só no load do snippet).
// NÃO empurra page_view no dataLayer. Medido no container central GTM-PZLT336 (JS baixado e
// loja rodando): ele NÃO tem gatilho de custom event `page_view` — os gatilhos de evento são
// gtm.js, gtm.historyChange(-v2), gtm.click, dataLayerReady e os de ecommerce. Empurrar
// `page_view` não acionaria nada lá e só arriscaria contagem dupla no container da loja.
// Quem conta o carregamento inicial é o próprio container (tag GA4 no gatilho All Pages):
// verificado com a loja sem GA_ID e sem Pixel, o hit `en=page_view` sai mesmo assim.
// O sinal por rota que o container LÊ é o `dataLayerReady` — por isso toda página principal
// monta <DataLayerReady>, e não um page_view manual.
import * as React from "react";
import { usePathname } from "next/navigation";

export function RouteAnalytics() {
  const pathname = usePathname();
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) { first.current = false; return; }
    const w = window as any;
    try { w.gtag?.("event", "page_view", { page_path: pathname }); } catch { /* ignora */ }
    try { w.fbq?.("track", "PageView"); } catch { /* ignora */ }
  }, [pathname]);

  return null;
}
