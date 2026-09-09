// Montagem do /llms.txt. Separado da rota de propósito: aqui é função pura (dado → texto), o que
// deixa o formato testável sem subir servidor nem bater na API.
//
// Formato: seções em LISTA DE LINKS markdown, como pede a especificação do llms.txt. Arquivo sem
// link nenhum reprova na auditoria Agent Accessibility do PageSpeed, e um agente que não consegue
// navegar a partir daqui simplesmente não usa o arquivo.
import type { CatalogProductItem } from "@/components/catalog/catalog-client";

export interface OpcoesLlms {
  siteName: string;
  /** Base absoluta (NEXT_PUBLIC_SITE_URL). Vazio = links relativos. */
  siteUrl?: string;
  descricao?: string;
  categorias: { nome: string; slug: string }[];
  pixDescontoPct?: number;
  freteGratisAcimaDe?: number | null;
  /** O arquivo é para leitura, não é o catálogo: acima disso, o agente segue o link de /produtos. */
  maxProdutos?: number;
}

export function montarLlmsTxt(produtos: CatalogProductItem[], o: OpcoesLlms): string {
  const base = (o.siteUrl ?? "").replace(/\/+$/, "");
  const link = (caminho: string) => `${base}${caminho}`;
  const max = o.maxProdutos ?? 60;
  const linhas: string[] = [`# ${o.siteName}`, ""];

  if (o.descricao?.trim()) linhas.push(`> ${o.descricao.trim()}`, "");

  const categoriasDosProdutos = [...new Set(produtos.flatMap((p) => p.categories))].slice(0, 12);
  if (categoriasDosProdutos.length) linhas.push(`Categorias: ${categoriasDosProdutos.join(", ")}.`, "");

  if (produtos.length) {
    linhas.push("## Produtos", "");
    for (const p of produtos.slice(0, max)) {
      // Preço e disponibilidade saem do MESMO mapeamento que desenha a vitrine: o esgotado do
      // painel aparece aqui sozinho, sem ninguém manter uma segunda lista.
      const detalhe = [p.displayPrice, p.soldOut ? "esgotado" : null, p.weight || null].filter(Boolean).join(" · ");
      linhas.push(`- [${p.title}](${link(`/produto/${encodeURIComponent(p.slug)}`)})${detalhe ? `: ${detalhe}` : ""}`);
    }
    if (produtos.length > max) {
      linhas.push(`- [Ver o catálogo completo](${link("/produtos")}): mais ${produtos.length - max} produtos`);
    }
    linhas.push("");
  }

  if (o.categorias.length) {
    linhas.push("## Categorias", "");
    for (const c of o.categorias.slice(0, 30)) {
      linhas.push(`- [${c.nome}](${link(`/categoria/${encodeURIComponent(c.slug)}`)})`);
    }
    linhas.push("");
  }

  linhas.push(
    "## Páginas", "",
    `- [Início](${link("/")}): destaques e produtos em evidência`,
    `- [Catálogo](${link("/produtos")}): todos os produtos, com filtros por categoria e preço`,
    `- [Busca](${link("/busca")}): busca por nome de produto`,
    `- [Minha conta](${link("/conta")}): acompanhamento de pedidos e assinaturas`,
    "",
    "## Políticas", "",
    `- [Trocas e devoluções](${link("/devolucoes")}): direito de arrependimento de 7 dias (CDC, art. 49)`,
    `- [Termos de uso](${link("/termos")}): condições de compra`,
    `- [Política de privacidade](${link("/privacidade")}): tratamento de dados pessoais (LGPD)`,
    "",
    "## Como comprar", "",
    `- Pagamento: Pix${(o.pixDescontoPct ?? 0) > 0 ? ` (${o.pixDescontoPct}% de desconto)` : ""} e cartão de crédito`,
    "- Entrega: frete calculado por CEP no checkout, para todo o Brasil",
  );
  // Só afirma o que a loja tem configurado de fato (mesma regra do resto do template).
  if (o.freteGratisAcimaDe != null) linhas.push(`- Frete grátis a partir de R$ ${o.freteGratisAcimaDe}`);
  linhas.push("");

  return linhas.join("\n");
}
