// Registry do CHROME (header + rodapé) — o mapa nome→componente que a receita
// (components/chrome/chrome-recipe.ts) referencia. Mesma mecânica do registry das seções
// da home. Pra criar uma variante nova: arquivo em headers/ ou footers/ + entrada aqui +
// documentar em agents/PADROES.md.
//
// ⚠️ Sem "use client": header e rodapé são SERVER components (a casca faz o fetch). As
// variantes compõem as peças client que já existem (BrandSearch, CartButton, AccountNav...).
//
// ⚠️ A variante desenha só o MIOLO. O elemento raiz (<header>/<footer>), com as classes
// obrigatórias `store-layout site-chrome`, é da casca (site-header.tsx/site-footer.tsx) —
// é `.site-chrome` que faz o chrome sumir no checkout (app/globals.css). Assim uma variante
// nova não tem como quebrar isso.
import type { NavCategory } from "@/components/mobile-nav";
import { HeaderClassico } from "./headers/classico";
import { HeaderCompacto } from "./headers/compacto";
import { HeaderCentralizado } from "./headers/centralizado";
import { HeaderEquilibrado } from "./headers/equilibrado";
import { HeaderImersivo } from "./headers/imersivo";
import { FooterColunas } from "./footers/colunas";
import { FooterConversao } from "./footers/conversao";
import { FooterEditorial } from "./footers/editorial";
import { FooterMinimal } from "./footers/minimal";

/** Dados que a casca busca UMA vez e entrega à variante (evita fetch duplicado). */
export interface ChromeData {
  shopName: string;
  categories: NavCategory[];
}

/** Props que toda variante de header/rodapé recebe da casca. */
export interface ChromeVariantProps {
  data: ChromeData;
}

export const HEADERS = {
  classico: HeaderClassico,
  compacto: HeaderCompacto,
  centralizado: HeaderCentralizado,
  equilibrado: HeaderEquilibrado,
  imersivo: HeaderImersivo,
} as const;

export const FOOTERS = {
  colunas: FooterColunas,
  conversao: FooterConversao,
  editorial: FooterEditorial,
  minimal: FooterMinimal,
} as const;

export type HeaderName = keyof typeof HEADERS;
export type FooterName = keyof typeof FOOTERS;

/** Como a casca desenha o <header>:
 *  - "solido": sticky e opaco desde o topo (o padrão).
 *  - "sobreposto": transparente sobre um hero de imagem full-bleed, sólido ao rolar.
 *  O Record obriga o TypeScript a cobrir toda variante nova. */
export type HeaderShellMode = "solido" | "sobreposto";
export const HEADER_SHELL: Record<HeaderName, HeaderShellMode> = {
  classico: "solido",
  compacto: "solido",
  centralizado: "solido",
  equilibrado: "solido",
  imersivo: "sobreposto",
};

/** A receita do chrome: qual header e qual rodapé esta loja usa. */
export interface ChromeRecipe {
  header: HeaderName;
  footer: FooterName;
}
