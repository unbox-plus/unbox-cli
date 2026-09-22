// ═══════════════════════════════════════════════════════════════════════════
// PÁGINA AVULSA DO LOJISTA: `/paginas/<endereço>`
//
// Um MOLDE, como a PDP: uma rota serve todas as páginas que o lojista criar. O prefixo `/paginas` é
// fixo (lib/paginas-do-lojista.ts) e por isso nenhuma página avulsa disputa endereço com uma rota do
// código.
//
// ── O PADRÃO DESTA ROTA (o mesmo da PDP, e ele tem motivo) ────────────────────
// `revalidate = 300` + `generateStaticParams` vazio + `dynamicParams = true`: as páginas nascem sob
// demanda, com ISR de 5 minutos. A lista de endereços vive no documento publicado, que muda sem
// build; pré-gerar aqui congelaria a lista do dia do build.
//
// SEM `loading.tsx` NESTE SEGMENTO. Com um, o Next responde 200 e o `notFound()` vira conteúdo
// dentro de um streaming já iniciado: um endereço que não existe passaria a responder 200 com
// noindex (soft 404) em vez de 404, e o buscador continuaria visitando a URL para sempre.
//
// SEM `searchParams` E SEM `headers()`: qualquer um dos dois torna a rota dinâmica e mata o ISR.
//
// A ORDEM: a PÁGINA VIVA primeiro, o redirecionamento só quando nada responde, o 404 por último. É a
// regra das plataformas de loja (o redirecionamento dispara em 404), e ela existe porque o mapa de
// redirecionamentos é histórico e a página é o presente: com a consulta na frente, uma entrada antiga
// apontando para este endereço escondia a página VIVA que ele publicou agora (308 para outro lugar),
// e o sitemap continuava prometendo 200 na URL que redirecionava. O editor de hoje não produz esse
// estado (ele reaponta as entradas ao renomear), mas quem RE-CONFERE o publicado é a loja.
//
// A URL antiga continua valendo para sempre e sem cadeia: nada de vivo responde por ela, então a
// consulta acontece e o 308 sai igual.
//
// O CORPO mora em components/paginas/pagina-avulsa.tsx, porque a versão de cada público
// (app/(loja)/%5Fpublico/[publico]/paginas/[handle], foundation 18) responde pela mesma régua.
// ═══════════════════════════════════════════════════════════════════════════
import type { Metadata } from "next";
import { metadadosDaPaginaAvulsa, respostaDaPaginaAvulsa } from "@/components/paginas/pagina-avulsa";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  // vazio de propósito: quais páginas existem é o documento publicado que diz, e ele muda sem build
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  return metadadosDaPaginaAvulsa(handle);
}

export default async function PaginaAvulsa({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return respostaDaPaginaAvulsa(handle);
}
