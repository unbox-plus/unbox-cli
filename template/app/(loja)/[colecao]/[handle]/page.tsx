// ═══════════════════════════════════════════════════════════════════════════
// ARTIGO DE UMA COLEÇÃO: `/<coleção>/<endereço>`
//
// Uma URL por artigo, sem prefixo de plataforma: a coleção É o namespace. Não existe segunda URL
// para o mesmo artigo (as tags dele não têm página), e por isso não existe canônica cruzada.
//
// O padrão da rota (ISR de 300 s, `generateStaticParams` vazio, `dynamicParams`, sem `loading.tsx`,
// sem `searchParams`, redirecionamento antes do 404) é o mesmo de `/paginas/[handle]`, e pelos
// mesmos motivos, que estão escritos lá.
//
// A rota estática ganha da dinâmica: `/produto/x` continua sendo a PDP porque `produto` é uma pasta
// do código. É por isso que uma coleção nunca pode se chamar como um primeiro segmento de rota, e é
// por isso que a loja calcula essa lista (lib/reservados.ts) e a manda ao editor.
// ═══════════════════════════════════════════════════════════════════════════
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { tituloDaColecao } from "@/components/paginas/titulos";
import { lerPaginas, paginaEmProducao, pararSeALeituraFalhou, redirecionamentoDe } from "@/lib/paginas-publicadas";
import { metadadosDaPagina } from "@/lib/paginas-seo";
import { PaginaDoLojistaNaTela } from "@/components/paginas/pagina-do-lojista";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

function caminhoDe(colecao: string, handle: string): string {
  return `/${colecao}/${handle}`;
}

export async function generateMetadata({ params }: { params: Promise<{ colecao: string; handle: string }> }): Promise<Metadata> {
  const { colecao, handle } = await params;
  const caminho = caminhoDe(decodeURIComponent(colecao), decodeURIComponent(handle));
  await pararSeALeituraFalhou();
  const achada = await paginaEmProducao(caminho);
  if (!achada) return { title: "Página não encontrada", robots: { index: false } };
  const doc = await lerPaginas();
  return metadadosDaPagina({
    doc,
    id: achada.id,
    registro: achada.registro,
    caminho,
    colecao: achada.registro.colecao ? tituloDaColecao(doc, achada.registro.colecao) : undefined,
    noAr: true,
  });
}

export default async function Artigo({ params }: { params: Promise<{ colecao: string; handle: string }> }) {
  const { colecao, handle } = await params;
  const caminho = caminhoDe(decodeURIComponent(colecao), decodeURIComponent(handle));

  // A LEITURA ANTES DA DECISÃO: sem conseguir ler o publicado, esta rota não sabe se a página existe,
  // e um 404 aqui seria guardado por 300 s e tiraria a URL do índice (o porquê está em
  // `pararSeALeituraFalhou`).
  await pararSeALeituraFalhou();

  const achada = await paginaEmProducao(caminho);
  if (!achada) {
    // o artigo VIVO vence a entrada antiga do mapa; o redirecionamento só quando nada responde
    // (o porquê está em `/paginas/[handle]`)
    const destino = await redirecionamentoDe(caminho);
    if (destino) permanentRedirect(destino);
    notFound();
  }

  return <PaginaDoLojistaNaTela id={achada.id} registro={achada.registro} caminho={caminho} />;
}
