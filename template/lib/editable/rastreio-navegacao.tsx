"use client";

// PAGE_VIEW POR ROTA (foundation 12): a parte de CLIENTE do rastreio. Quem monta os scripts é o
// `<Rastreio>` de rastreio.tsx (servidor); este hook só avisa cada provedor que a página mudou.
//
// Dispara o page_view de cada NAVEGAÇÃO do App Router para quem NÃO conta a navegação sozinho: Meta
// Pixel (fbq), TikTok Pixel (ttq) e Pinterest Tag (pintrk). O snippet de cada um só conta o
// carregamento inicial; a navegação SPA não recarrega a página, e sem este hook a segunda página não
// existe para nenhum deles.
//
// UM DONO DO PAGE_VIEW POR PROVEDOR. O GA4 fica DE FORA deste hook, de propósito: o gtag.js, com a
// medição otimizada ligada (é o padrão de todo fluxo de dados do GA4), já manda um page_view a cada
// mudança de histórico do navegador, que é exatamente o que a navegação do App Router faz (pushState).
// Mandar outro daqui contava DUAS visualizações por navegação (Astra, B3). `send_page_view: false` não
// resolveria: ele desliga só o page_view do carregamento, não a medição de mudanças de histórico.
// Referência: https://developers.google.com/analytics/devguides/collection/ga4/views (page_view em
// aplicações de página única). Meta, TikTok e Pinterest não acompanham o histórico: cada um precisa do
// aviso, e é daqui que ele sai.
//
// QUEM ESTÁ NA PÁGINA é decidido no servidor (`rastreioEmVigor`): o que o lojista publicou no painel
// vence o ambiente, e cada provedor é injetado UMA vez. Um provedor que não entrou não existe em
// `window`, e este hook não o chama. É assim que ele nunca dispara o mesmo provedor duas vezes: um
// script por provedor na página, uma chamada por provedor por navegação.
//
// CARREGAMENTO INICIAL: quem já conta sozinho (gtag 'config', fbq PageView, ttq.page, pintrk page) é
// pulado. Quando NENHUM deles está na página, o page_view de entrada vai direto no dataLayer, que é de
// onde os contêineres de GTM leem (o central da Unbox e o próprio da marca). Sem isso, uma loja só com
// GTM ficava sem o evento de entrada.
import * as React from "react";
import { usePathname } from "next/navigation";

type Rastreadores = {
  gtag?: (...a: unknown[]) => void;
  fbq?: (...a: unknown[]) => void;
  ttq?: { page?: () => void };
  pintrk?: (...a: unknown[]) => void;
  dataLayer?: unknown[];
};

export function PageViewPorRota() {
  const pathname = usePathname();
  const first = React.useRef(true);

  React.useEffect(() => {
    const w = window as unknown as Rastreadores;
    const primeiro = first.current;
    first.current = false;

    const contadoPorOutro = typeof w.gtag === "function" || typeof w.fbq === "function" || typeof w.ttq?.page === "function" || typeof w.pintrk === "function";
    if (primeiro && contadoPorOutro) return;

    // o GA4 (gtag) não está aqui de propósito: ele conta a navegação sozinho (ver o topo do arquivo)
    try { w.fbq?.("track", "PageView"); } catch { /* ignora */ }
    try { w.ttq?.page?.(); } catch { /* ignora */ }
    try { w.pintrk?.("page"); } catch { /* ignora */ }
    // sem gtag, o page_view vai direto no dataLayer: é dele que todos os contêineres de GTM leem
    try {
      if (typeof w.gtag !== "function" && Array.isArray(w.dataLayer)) {
        w.dataLayer.push({ event: "page_view", page_path: pathname });
      }
    } catch { /* ignora */ }
  }, [pathname]);

  return null;
}
