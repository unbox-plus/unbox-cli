"use client";

// AS SEÇÕES DE UMA PÁGINA COM O CATÁLOGO DA LOJA (foundation 18).
//
// Duas peças para as páginas que aceitam o catálogo ("+ Adicionar seção") sem serem a home:
//
// 1. `useDadosDasSecoes`: os dados que as seções adicionadas de produto desenham (o catálogo, as escolhas). A
//    página publicada só os manda quando o container TEM seção adicionada (`dadosSeHouverSecoes`, lib/paginas-dados.ts):
//    sem nenhuma, o catálogo viajaria no HTML de toda visita sem ninguém ler. Na PRÉVIA do editor, o lojista
//    adiciona a primeira e ela tem de aparecer na hora, com produto: aí a página busca os dados na própria loja
//    (`GET /api/unbox/secoes`, com o token da prévia), como a vitrine busca os produtos da escolha.
// 2. `<SecoesComCatalogo>`: para quem renderiza no SERVIDOR (a oferta, a página de produto). O catálogo carrega
//    funções de desenho, e função não atravessa do servidor para o navegador: este invólucro é de CLIENTE, recebe
//    os dados (que atravessam) e monta o catálogo aqui, em volta das seções que o servidor já renderizou.
import * as React from "react";
import { Editable, useEditableContext } from "@/lib/editable";
import { catalogoDaLoja } from "@/components/home/sections/catalogo";
import type { HomeData } from "@/components/home/sections/registry";

/** sem dados (página publicada sem seção adicionada, ou a prévia ainda buscando): as seções de produto não entram */
const SEM_DADOS: HomeData = { combos: [], catalogo: [], featured: null, bundles: [], categories: [], combosTitle: "Destaques", freeShipLabel: null };

/**
 * Os dados das seções: os do servidor quando vieram; senão, na prévia, os da loja buscados aqui. `container` null =
 * esta página não aceita seção (a que só reaproveita um container), e nada é buscado.
 */
export function useDadosDasSecoes(container: string | null, doServidor: HomeData | null | undefined): HomeData {
  const { editing, previewToken, renovarToken } = useEditableContext();
  const [daPrevia, setDaPrevia] = React.useState<HomeData | null>(null);
  React.useEffect(() => {
    if (doServidor || !container || !editing || !previewToken) return;
    let vivo = true;
    void (async () => {
      try {
        const res = await fetch(`/api/unbox/secoes?container=${encodeURIComponent(container)}`, { headers: { "x-editor-token": previewToken }, cache: "no-store" });
        // token da prévia vencido (vale 15 min): pede outro ao editor; quando ele chegar, este efeito roda de novo
        if (res.status === 401) {
          renovarToken();
          return;
        }
        const dados = res.ok ? ((await res.json()) as HomeData) : null;
        if (vivo && dados && Array.isArray(dados.combos)) setDaPrevia(dados);
      } catch {
        // sem os dados, as seções de produto só não entram no "+" desta prévia: nada quebra
      }
    })();
    return () => {
      vivo = false;
    };
  }, [container, doServidor, editing, previewToken, renovarToken]);
  return doServidor ?? daPrevia ?? SEM_DADOS;
}

export function SecoesComCatalogo({
  container,
  data,
  layout,
  children,
}: {
  container: string;
  /** o que a página buscou no servidor; `null` = a página não tem seção adicionada (a prévia busca quando precisa) */
  data: HomeData | null;
  /** `false` numa página que só REAPROVEITA o container (a ordem e as seções adicionadas são da dona dele) */
  layout?: boolean;
  children: React.ReactNode;
}) {
  const dados = useDadosDasSecoes(layout === false ? null : container, data);
  return (
    <Editable.Sections container={container} layout={layout} catalogo={catalogoDaLoja(dados)}>
      {children}
    </Editable.Sections>
  );
}
