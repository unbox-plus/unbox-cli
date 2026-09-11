import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Áreas privadas/transacionais não indexáveis (doc 10).
// EXPORTADA de propósito: é a MESMA lista que decide quais páginas o editor da Unbox oferece ao
// lojista (ver lib/rotas-editaveis.ts). Uma lista só, mantida por quem cuida de SEO: bloquear uma
// área aqui a tira do editor junto, e não existe segunda lista para alguém esquecer.
// `/previa-do-editor` (foundation 13): a casca das páginas do lojista em modo edição. Ela mostra
// conteúdo NÃO PUBLICADO (é para isso que existe), então nenhuma dessas URLs pode ser indexada. Estar
// aqui também a tira da lista de páginas editáveis, que é derivada desta mesma lista.
export const DISALLOW = ["/conta", "/carrinho", "/checkout", "/pedido", "/api", "/previa-do-editor"];

/**
 * A MESMA LISTA, na gramática do robots.txt. O arquivo casa por PREFIXO DE TEXTO (RFC 9309):
 * `Disallow: /conta` bloqueia `/contato`, `/contatos`, `/contabilidade`. Já `bloqueadaPeloRobots()`
 * (lib/rotas-editaveis.ts) casa por SEGMENTO, e está certo: é assim que o Next roteia. As duas
 * semânticas divergindo é o que deixava o lojista criar a coleção `contato` (endereço que a loja
 * aceita, responde 200 e publica no sitemap) e o próprio robots.txt da loja mandar o buscador não
 * visitá-la. `pedidos`, `apis` e `contatos` são nomes igualmente plausíveis de coleção.
 *
 * TRÊS linhas por área, e não uma nem duas: `/conta$` fecha a página exata (o `$` é entendido pelos
 * buscadores), `/conta/` fecha tudo o que está dentro dela e `/conta?` fecha a MESMA página com
 * query. As três juntas dão o bloqueio por SEGMENTO, que é o que a loja quis dizer desde sempre.
 *
 * A terceira linha não é enfeite: `$` ancora no FIM DA URL, e o casamento do robots.txt inclui a
 * QUERY. Com só `/checkout$` + `/checkout/`, `/checkout?id=…&token=…` deixava de ser bloqueado — e
 * essa é a única forma em que o checkout existe, porque `middleware.ts` garante que a URL sempre
 * carregue `?id=&token=` (o contrato do carrinho abandonado). O `?` não é curinga no robots.txt (só
 * `*` e `$` são), então `/conta?` casa literalmente com "/conta" seguido de "?" e continua deixando
 * `/contato`, `/contatos` e `/contabilidade` livres, que era o objetivo desta mudança.
 */
export const DISALLOW_NO_ROBOTS = DISALLOW.flatMap((d) => [`${d}$`, `${d}/`, `${d}?`]);

// Agentes de IA explicitamente bem-vindos (descoberta de agentes): conteúdo público —
// catálogo (/produto/, /categoria/, /produtos) — liberado para indexação e respostas.
const AI_AGENTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-Web", "anthropic-ai",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended",
  "Amazonbot", "meta-externalagent", "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW_NO_ROBOTS },
      // mesma política para os agentes de IA: público liberado, privado bloqueado
      { userAgent: AI_AGENTS, allow: ["/", "/produto/", "/categoria/", "/produtos"], disallow: DISALLOW_NO_ROBOTS },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
