// PERSONALIZAÇÃO POR PÚBLICO (foundation 18): os containers que ESTA loja renderiza por público. É o
// INTERRUPTOR dos públicos no editor (vai no manifesto pelo `EditableProvider`), e só vale porque as três peças
// existem: a decisão na borda (middleware.ts + lib/publicos-da-borda.ts), a página do público
// (app/(loja)/%5Fpublico/[publico]) e a home em `PaginaInicial` (components/home/pagina-inicial.tsx). Tirar
// uma delas sem tirar esta declaração faria o editor oferecer versões que ninguém veria.
//
// Fase 1: a home. Cabeçalho, rodapé e faixa moram no layout, acima da rota, e são de Todos.
import type { ManifestPersonalizacao } from "@/lib/editable/document";

export const DECLARACAO_DA_PERSONALIZACAO: ManifestPersonalizacao = { foundation: 18, containers: ["home"] };
