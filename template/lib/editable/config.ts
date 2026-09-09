// Identidade desta loja PARA O EDITOR. O CLI carimba o literal no scaffold; EDITOR_URL vem do
// ambiente (sem ele, o editor fica desligado).
//
// `UNBOX_EDITOR_SHOP` é variável PRÓPRIA, de propósito: não reuse `UNBOX_SHOP_SLUG`, que é o slug
// da loja NA PLATAFORMA (sai do JWT). Os dois costumam coincidir e no dia em que divergirem o
// editor deixa de achar a loja sem dizer por quê. Este nome tem de bater com o `slug` da entrada
// dela no shops.json do editor.
export const STORE_SLUG = process.env.UNBOX_EDITOR_SHOP || "__STORE_SLUG__";
export const EDITOR_URL = (process.env.EDITOR_URL || "").replace(/\/+$/, "");
/** Origem do editor vista pelo navegador (frame-ancestors + postMessage). */
export const EDITOR_ORIGIN = process.env.NEXT_PUBLIC_EDITOR_ORIGIN || "";
