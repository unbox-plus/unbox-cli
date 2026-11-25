// Identidade desta loja PARA O EDITOR. O CLI carimba o literal no scaffold; EDITOR_URL vem do
// ambiente (sem ele, o editor fica desligado).
//
// Na hospedagem da Unbox, `UNBOX_EDITOR_SHOP` é gravada pela própria Unbox com o slug da loja NA
// PLATAFORMA (o do claim do token e o de <slug>.myunbox.com.br), e o editor acha a loja por ele. O
// literal abaixo vale onde a variável não existe, o `next dev`, e tem de ser o mesmo: o `unbox
// provision` troca o literal pelo da plataforma quando eles diferem.
export const STORE_SLUG = process.env.UNBOX_EDITOR_SHOP || "__STORE_SLUG__";
export const EDITOR_URL = (process.env.EDITOR_URL || "").replace(/\/+$/, "");
/** Origem do editor vista pelo navegador (frame-ancestors + postMessage). */
export const EDITOR_ORIGIN = process.env.NEXT_PUBLIC_EDITOR_ORIGIN || "";
