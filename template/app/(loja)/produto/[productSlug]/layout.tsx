// Mesma razão do layout de categoria: o loading.tsx deste segmento abre um <Suspense>,
// o shell sai com 200, e o notFound() da página chega tarde demais para mudar o status.
// Produto inexistente ou despublicado precisa de 404 de verdade — é a rota mais
// indexada da loja, e soft-404 aqui enche o índice do Google de página vazia.
// getProductBySlug é React cache(): sem requisição extra.
import { notFound, permanentRedirect } from "next/navigation";
import { redirecionamentoDe } from "@/lib/paginas-publicadas";
import { getProductBySlug } from "@/lib/queries";
import { mockupOr } from "@/lib/mockup";

export default async function ProdutoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ productSlug: string }>;
}) {
  const { productSlug } = await params;
  // mockupOr: falha da API com credenciais RELANÇA (500 não cacheado) — nunca vira 404 cacheado.
  const wrapper = await mockupOr(getProductBySlug(decodeURIComponent(productSlug)), null, `produto/${productSlug}`);
  const p = wrapper?.product;
  if (!p || p.isVisible === false) {
    // REDIRECIONAMENTO MANUAL (foundation 17): produto que saiu do catálogo, ou que mudou de endereço, leva
    // aonde o lojista mandou antes de virar 404. O caminho é conferido cru e decodificado, porque o lojista
    // cola o endereço como o navegador mostra.
    const destino = (await redirecionamentoDe(`/produto/${productSlug}`)) ?? (await redirecionamentoDe(`/produto/${decodeURIComponent(productSlug)}`));
    if (destino) permanentRedirect(destino);
    notFound();
  }
  return <>{children}</>;
}
