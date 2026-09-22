// ═══════════════════════════════════════════════════════════════════════════
// A OFERTA NA VERSÃO DE UM PÚBLICO (foundation 18, LPs).
//
// O par de `/_publico/[publico]` (a home) para a landing `/oferta`. Ninguém chega aqui pelo endereço: o middleware
// REESCREVE `/oferta` para cá quando o visitante é de um público que TEM versão da oferta
// (lib/publicos-da-borda.ts), e acesso direto a `/_publico/…` responde 404.
//
// É a MESMA página (`PaginaDaOferta`) dentro da camada do público (`<EditablePublico>`), cortada no container da
// oferta: o navegador recebe o documento de Todos pelo layout e, por cima, só o que a versão troca nesta página.
// Em cache como `/oferta` (ISR de 300 s), revalidada junto com ela na publicação. A canônica é `/oferta`.
// ═══════════════════════════════════════════════════════════════════════════
import type { Metadata } from "next";
import { aplicarPublico, camadaDoPublico, getPublishedContent } from "@/lib/editable/server";
import { EditablePublico } from "@/lib/editable";
import { LimparPublico } from "@/lib/editable/publico";
import { METADADOS_DA_OFERTA, PaginaDaOferta } from "@/components/landing/pagina-da-oferta";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  // vazio de propósito: quais públicos existem é o documento publicado que diz, e ele muda sem build
  return [];
}

export const metadata: Metadata = METADADOS_DA_OFERTA;

export default async function OfertaDoPublico({ params }: { params: Promise<{ publico: string }> }) {
  const { publico } = await params;
  const id = decodeURIComponent(publico);
  const doc = await getPublishedContent();
  const camada = camadaDoPublico(doc, id, ["oferta"]);
  // o público não existe mais (excluído depois de a pessoa ganhar o cookie): Todos, e o cookie velho sai
  if (!doc || !camada) {
    return (
      <>
        <LimparPublico />
        <PaginaDaOferta doc={doc} />
      </>
    );
  }
  // o documento EFETIVO do público: as escolhas de produto da versão dele (o bloco de compra, as vitrines)
  return (
    <EditablePublico camada={camada}>
      <PaginaDaOferta doc={aplicarPublico(doc, id)} />
    </EditablePublico>
  );
}
