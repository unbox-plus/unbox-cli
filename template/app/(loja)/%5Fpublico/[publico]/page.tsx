// ═══════════════════════════════════════════════════════════════════════════
// A HOME NA VERSÃO DE UM PÚBLICO (foundation 18).
//
// Ninguém chega aqui pelo endereço: o middleware REESCREVE `/` para `/_publico/<id>` quando decide que o
// visitante é daquele público (lib/publicos-da-borda.ts), e acesso direto a `/_publico/…` responde 404. A
// pasta chama `%5Fpublico` porque pasta que começa com `_` é privada no App Router; o `_` também não cabe num
// endereço de coleção do lojista, então a rota não colide com nada que ele crie.
//
// É a MESMA home (`PaginaInicial`), com o documento EFETIVO do público (`aplicarPublico`): textos, imagens,
// vitrines, ordem e seções ocultas da versão. O navegador recebe o documento de Todos pelo layout e, por cima,
// só a camada deste público (`<EditablePublico>`): o HTML da versão é o de Todos mais a camada.
//
// Cada versão é uma página pronta em cache, como a home (ISR de 300 s, revalidada junto com `/` na
// publicação). A canônica é `/`: a versão não é outra página para o buscador. As LPs têm as rotas delas aqui
// dentro (`oferta/` e `paginas/[handle]/`, fase 2).
// ═══════════════════════════════════════════════════════════════════════════
import type { Metadata } from "next";
import { aplicarPublico, camadaDoPublico, getPublishedContent } from "@/lib/editable/server";
import { EditablePublico } from "@/lib/editable";
import { LimparPublico } from "@/lib/editable/publico";
import { metadadosDaRotaDoCodigo } from "@/lib/seo-das-rotas";
import { PaginaInicial } from "@/components/home/pagina-inicial";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  // vazio de propósito: quais públicos existem é o documento publicado que diz, e ele muda sem build
  return [];
}

// os mesmos metadados da home, com a canônica dela
export async function generateMetadata(): Promise<Metadata> {
  return metadadosDaRotaDoCodigo(await getPublishedContent(), "/");
}

export default async function HomeDoPublico({ params }: { params: Promise<{ publico: string }> }) {
  const { publico } = await params;
  const doc = await getPublishedContent();
  // só a camada da HOME: a das LPs vai nas páginas delas
  const camada = camadaDoPublico(doc, decodeURIComponent(publico), ["home"]);
  // o público não existe mais (excluído depois de a pessoa ganhar o cookie): Todos, e o cookie velho sai
  if (!doc || !camada) {
    return (
      <>
        <LimparPublico />
        <PaginaInicial doc={doc} />
      </>
    );
  }
  return (
    <EditablePublico camada={camada}>
      <PaginaInicial doc={aplicarPublico(doc, decodeURIComponent(publico))} />
    </EditablePublico>
  );
}
