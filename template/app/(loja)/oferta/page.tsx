// Landing de OFERTA. O corpo mora em components/landing/pagina-da-oferta.tsx, porque a versão de cada público
// (app/(loja)/%5Fpublico/[publico]/oferta, foundation 18) renderiza a mesma página com a camada dele por cima.
import type { Metadata } from "next";
import { getPublishedContent } from "@/lib/editable/server";
import { METADADOS_DA_OFERTA, PaginaDaOferta } from "@/components/landing/pagina-da-oferta";

export const revalidate = 300;

export const metadata: Metadata = METADADOS_DA_OFERTA;

export default async function OfertaPage() {
  return <PaginaDaOferta doc={await getPublishedContent()} />;
}
