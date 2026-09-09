// ═══ POR QUE ESTE LAYOUT EXISTE (não é organização de código) ═══
// Ele valida a existência da categoria e chama notFound() ANTES da página. Sem isso a
// rota devolvia HTTP 200 com a tela de 404 dentro — um soft-404, que faz o Google
// indexar página vazia, valida rota quebrada em qualquer checagem por status e
// contamina destino de 301 e canonical.
//
// A causa não é óbvia: o notFound() da page.tsx SEMPRE esteve lá e não adiantava. O
// loading.tsx deste segmento envolve a página num <Suspense>; o shell fica pronto na
// hora e é enviado com 200, e quando o notFound() acontece o status já foi. O layout
// renderiza ACIMA dessa fronteira, então aqui o 404 ainda pode ser emitido.
// Medido: mesma página, só trocando a presença do loading.tsx → 404 vira 200.
//
// getTopTags é React cache(): chamar aqui e na página não duplica requisição.
import { notFound } from "next/navigation";
import { getTopTags } from "@/lib/queries";
import { mockupOr } from "@/lib/mockup";

export default async function CategoriaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tagSlug: string }>;
}) {
  const { tagSlug } = await params;
  // mockupOr: falha da API com credenciais RELANÇA — nunca vira 404 cacheado.
  const tags = await mockupOr(getTopTags(), [], `categoria/${tagSlug}`);
  const alvo = decodeURIComponent(tagSlug);
  if (!(tags as { slug?: string }[]).some((t) => t.slug === alvo)) notFound();
  return <>{children}</>;
}
