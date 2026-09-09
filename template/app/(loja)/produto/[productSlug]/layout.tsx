// Mesma razão do layout de categoria: o loading.tsx deste segmento abre um <Suspense>,
// o shell sai com 200, e o notFound() da página chega tarde demais para mudar o status.
// Produto inexistente ou despublicado precisa de 404 de verdade — é a rota mais
// indexada da loja, e soft-404 aqui enche o índice do Google de página vazia.
// getProductBySlug é React cache(): sem requisição extra.
import { notFound } from "next/navigation";
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
  if (!p || p.isVisible === false) notFound();
  return <>{children}</>;
}
