// /llms.txt — apresenta a loja a modelos de IA e agentes.
//
// É uma ROTA, não um arquivo em public/, pelo mesmo motivo do resto do template: o que a loja
// afirma vem do catálogo real. Arquivo estático nasce desatualizado no dia em que um produto sai
// de linha, e o formato estático já foi ao ar com "TODO: preencher" numa loja de produção,
// servindo isso justamente aos crawlers que o robots.txt convida.
//
// O formato mora em lib/llms-txt.ts (função pura, testável). Aqui só buscamos os dados.
import { loadAllCatalogItems } from "@/lib/dataloader";
import { getTopTags } from "@/lib/queries";
import { buildTagMap, mapCatalogItems } from "@/lib/catalog-map";
import { montarLlmsTxt } from "@/lib/llms-txt";
import { FREE_SHIPPING_THRESHOLD, PIX_DISCOUNT_PCT } from "@/lib/store-config";

export const revalidate = 3600;

export async function GET() {
  // Falha de API não pode derrubar o arquivo: sem catálogo ele sai com as rotas e as políticas,
  // que continuam verdadeiras.
  const [itens, tags] = await Promise.all([
    loadAllCatalogItems().catch(() => [] as any[]),
    getTopTags().catch(() => [] as any[]),
  ]);
  const produtos = mapCatalogItems(itens as any[], buildTagMap(tags as any[]));

  const texto = montarLlmsTxt(produtos, {
    siteName: process.env.NEXT_PUBLIC_SITE_NAME || "Minha Loja",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    descricao: process.env.NEXT_PUBLIC_SITE_DESCRIPTION,
    categorias: (tags as any[])
      .filter((t) => t?.slug && t.isVisible !== false)
      .map((t) => ({ nome: t.displayTitle || t.name, slug: t.slug })),
    pixDescontoPct: PIX_DISCOUNT_PCT,
    freteGratisAcimaDe: FREE_SHIPPING_THRESHOLD,
  });

  return new Response(texto, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
