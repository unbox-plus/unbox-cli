// ═══════════════════════════════════════════════════════════════════════════
// A PÁGINA AVULSA NA VERSÃO DE UM PÚBLICO (foundation 18, LPs).
//
// O par de `/paginas/[handle]`. Ninguém chega aqui pelo endereço: o middleware REESCREVE `/paginas/<endereço>`
// para cá quando o visitante é de um público que TEM versão desta página (lib/publicos-da-borda.ts), e acesso
// direto a `/_publico/…` responde 404.
//
// A mesma página, com o documento EFETIVO do público (`PaginaDoLojistaNaTela publico=`): o texto, as fotos, a
// ordem e as seções ocultas da versão chegam pela fatia dele, e as vitrines saem da escolha dele. A mesma régua
// de resposta da rota de Todos (components/paginas/pagina-avulsa.tsx), os mesmos metadados e a mesma canônica.
// Sem `loading.tsx` aqui, pelo motivo do cabeçalho de app/(loja)/paginas/[handle]/page.tsx: o 404 tem de ser 404.
// ═══════════════════════════════════════════════════════════════════════════
import type { Metadata } from "next";
import { metadadosDaPaginaAvulsa, respostaDaPaginaAvulsa } from "@/components/paginas/pagina-avulsa";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  // vazio de propósito: quais páginas e quais públicos existem é o documento publicado que diz
  return [];
}

type Parametros = { params: Promise<{ publico: string; handle: string }> };

export async function generateMetadata({ params }: Parametros): Promise<Metadata> {
  const { handle } = await params;
  return metadadosDaPaginaAvulsa(handle);
}

export default async function PaginaAvulsaDoPublico({ params }: Parametros) {
  const { publico, handle } = await params;
  return respostaDaPaginaAvulsa(handle, decodeURIComponent(publico));
}
