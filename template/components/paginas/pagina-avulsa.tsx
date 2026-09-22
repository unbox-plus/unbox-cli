// A PÁGINA AVULSA PELO ENDEREÇO: os metadados e a resposta que as duas rotas dela dividem, `/paginas/[handle]` e a
// versão de um público (`/_publico/[publico]/paginas/[handle]`, foundation 18). A ordem (página viva, senão
// redirecionamento, senão 404) e o porquê dela estão no cabeçalho de app/(loja)/paginas/[handle]/page.tsx.
//
// A versão do público segue a MESMA ordem: a borda reescreve para ela com a lista que tem em memória, que pode
// estar um minuto atrasada (a página pode ter sido ocultada ou renomeada nesse meio tempo), e a resposta tem de
// ser a que `/paginas/<endereço>` daria. Funções chamadas DE DENTRO da rota, e não componentes: o `notFound()` e o
// `permanentRedirect()` acontecem no corpo da página, fora de qualquer `Suspense`, como antes.
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PREFIXO_DE_PAGINAS } from "@/lib/paginas-do-lojista";
import { lerPaginas, paginaEmProducao, pararSeALeituraFalhou, redirecionamentoDe } from "@/lib/paginas-publicadas";
import { metadadosDaPagina } from "@/lib/paginas-seo";
import { LimparPublico } from "@/lib/editable/publico";
import { PaginaDoLojistaNaTela } from "@/components/paginas/pagina-do-lojista";

/** o caminho da página avulsa pelo segmento da rota (que chega codificado) */
export function caminhoDaPaginaAvulsa(handle: string): string {
  return `${PREFIXO_DE_PAGINAS}/${decodeURIComponent(handle)}`;
}

/** os metadados: os da página, iguais em todas as versões (o SEO vale para todos, e a canônica é o endereço dela) */
export async function metadadosDaPaginaAvulsa(handle: string): Promise<Metadata> {
  const caminho = caminhoDaPaginaAvulsa(handle);
  await pararSeALeituraFalhou();
  const achada = await paginaEmProducao(caminho);
  // Sem página, esta resposta é 404 ou 308 (quem decide é `respostaDaPaginaAvulsa`). O `noindex` aqui é para o
  // caso de a resposta ser 404 com corpo: nada dela entra no índice.
  if (!achada) return { title: "Página não encontrada", robots: { index: false } };
  return metadadosDaPagina({ doc: await lerPaginas(), id: achada.id, registro: achada.registro, caminho, noAr: true });
}

/** a página no ar, ou o 308 do endereço antigo, ou o 404; com `publico`, a versão dele */
export async function respostaDaPaginaAvulsa(handle: string, publico?: string) {
  const caminho = caminhoDaPaginaAvulsa(handle);

  // A LEITURA ANTES DA DECISÃO: sem conseguir ler o publicado, esta rota não sabe se a página existe,
  // e um 404 aqui seria guardado por 300 s e tiraria a URL do índice (o porquê está em
  // `pararSeALeituraFalhou`).
  await pararSeALeituraFalhou();

  const achada = await paginaEmProducao(caminho);
  if (!achada) {
    // nada de vivo responde por este endereço: agora sim o mapa de redirecionamentos vale (308, para
    // sempre, sem cadeia). Sem entrada nenhuma, oculta, agendada ou inexistente respondem a mesma
    // coisa, e é 404 real: é o que tira a URL do índice do buscador.
    const destino = await redirecionamentoDe(caminho);
    if (destino) permanentRedirect(destino);
    notFound();
  }

  if (publico === undefined) return <PaginaDoLojistaNaTela id={achada.id} registro={achada.registro} caminho={caminho} />;
  // o público não existe mais (excluído depois de a pessoa ganhar o cookie): Todos, e o cookie velho sai
  const existe = Boolean((await lerPaginas())?.publicos?.[publico]);
  return (
    <>
      {existe ? null : <LimparPublico />}
      <PaginaDoLojistaNaTela id={achada.id} registro={achada.registro} caminho={caminho} publico={publico} />
    </>
  );
}
