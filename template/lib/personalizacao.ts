// PERSONALIZAÇÃO POR PÚBLICO (foundation 18): os containers que ESTA loja renderiza por público. É o
// INTERRUPTOR dos públicos no editor (vai no manifesto pelo `EditableProvider`), e só vale porque as peças
// existem: a decisão na borda (middleware.ts + lib/publicos-da-borda.ts, que também só reescreve o que está
// aqui), a página do público de cada container e o corpo de cada uma recebendo o documento. Tirar uma delas sem
// tirar o container daqui faria o editor oferecer versões que ninguém veria (o gate, scripts/check-editable.mjs,
// reprova a loja que declara um container sem a página do público dele).
//
// - `home` (fase 1): app/(loja)/%5Fpublico/[publico]/page.tsx, com `PaginaInicial`;
// - `oferta` (fase 2, LPs): app/(loja)/%5Fpublico/[publico]/oferta/page.tsx, com `PaginaDaOferta`;
// - `pagina-*` (fase 2, LPs): toda página avulsa do lojista, app/(loja)/%5Fpublico/[publico]/paginas/[handle],
//   com `PaginaDoLojistaNaTela publico=`. É curinga, como em lib/rotas-editaveis.ts: o container de cada página
//   nasce no documento. Com ele o editor também oferece "Duplicar para um público" na ficha da página.
//
// Cabeçalho, rodapé e faixa moram no layout, acima da rota, e são de Todos. Artigos e coleções também.
import type { ManifestPersonalizacao } from "@/lib/editable/document";

export const DECLARACAO_DA_PERSONALIZACAO: ManifestPersonalizacao = { foundation: 18, containers: ["home", "oferta", "pagina-*"] };
