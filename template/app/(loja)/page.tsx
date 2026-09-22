import type { Metadata } from "next";
import { getPublishedContent } from "@/lib/editable/server";
import { metadadosDaRotaDoCodigo } from "@/lib/seo-das-rotas";
// A HOME MORA EM components/home/pagina-inicial.tsx (foundation 18): esta rota e a da versão de cada público
// renderizam o mesmo corpo, cada uma com o seu documento. Mudança na home vai lá (e na receita), não aqui.
import { PaginaInicial } from "@/components/home/pagina-inicial";

// Canonical por página: o layout raiz não declara (seria herdado por todas as rotas). Título, descrição e
// imagem de compartilhamento o lojista escreve no editor; sem edição, é só a canônica, como sempre foi.
export async function generateMetadata(): Promise<Metadata> {
  return metadadosDaRotaDoCodigo(await getPublishedContent(), "/");
}

export const revalidate = 300; // ISR — catálogo público e estável

export default async function HomePage() {
  // dataLayerReady (o gatilho de tipo de página do container central) sai de dentro de PaginaInicial
  return <PaginaInicial doc={await getPublishedContent()} />;
}
