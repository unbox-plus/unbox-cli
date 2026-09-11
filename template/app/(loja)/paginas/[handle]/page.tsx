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
// ═══════════════════════════════════════════════════════════════════════════
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PREFIXO_DE_PAGINAS } from "@/lib/paginas-do-lojista";
import { lerPaginas, paginaEmProducao, pararSeALeituraFalhou, redirecionamentoDe } from "@/lib/paginas-publicadas";
import { metadadosDaPagina } from "@/lib/paginas-seo";
import { PaginaDoLojistaNaTela } from "@/components/paginas/pagina-do-lojista";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  // vazio de propósito: quais páginas existem é o documento publicado que diz, e ele muda sem build
  return [];
}

function caminhoDe(handle: string): string {
  return `${PREFIXO_DE_PAGINAS}/${handle}`;
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const caminho = caminhoDe(decodeURIComponent(handle));
  await pararSeALeituraFalhou();
  const achada = await paginaEmProducao(caminho);
  // Sem página, esta resposta é 404 ou 308 (quem decide é o componente abaixo). O `noindex` aqui é
  // para o caso de a resposta ser 404 com corpo: nada dela entra no índice.
  if (!achada) return { title: "Página não encontrada", robots: { index: false } };
  return metadadosDaPagina({ doc: await lerPaginas(), id: achada.id, registro: achada.registro, caminho, noAr: true });
}

export default async function PaginaAvulsa({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const caminho = caminhoDe(decodeURIComponent(handle));

  // A LEITURA ANTES DA DECISÃO: sem conseguir ler o publicado, esta rota não sabe se a página existe,
  // e um 404 aqui seria guardado por 300 s e tiraria a URL do índice (o porquê está em
  // `pararSeALeituraFalhou`).
  await pararSeALeituraFalhou();

  const achada = await paginaEmProducao(caminho);
  if (!achada) {
    // nada de vivo responde por este endereço: agora sim o mapa de redirecionamentos vale (308, para
    // sempre, sem cadeia). Sem entrada nenhuma, oculta, agendada ou inexistente respondem a mesma
    // coisa, e é 404 real: é o que tira a URL do índice do buscador. Fora de qualquer `Suspense`,
    // pelo motivo do cabeçalho.
    const destino = await redirecionamentoDe(caminho);
    if (destino) permanentRedirect(destino);
    notFound();
  }

  return <PaginaDoLojistaNaTela id={achada.id} registro={achada.registro} caminho={caminho} />;
}
