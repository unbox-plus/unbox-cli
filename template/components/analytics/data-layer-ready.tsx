"use client";

// Emite `dataLayerReady { pageType, products[] }` uma vez por carregamento. É o evento que o
// container central da Unbox usa para tipo de página e remarketing do Google Ads; sem ele, a
// loja gerada pelo CLI é invisível para esses gatilhos. Não renderiza nada.
import * as React from "react";
import { trackPageType, type PageType, type TrackItem } from "@/lib/analytics";

export function DataLayerReady({ pageType, products = [] }: { pageType: PageType; products?: TrackItem[] }) {
  const key = pageType + "|" + products.map((p) => p.id).join(",");
  React.useEffect(() => {
    trackPageType(pageType, products);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
