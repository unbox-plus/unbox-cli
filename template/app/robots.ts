import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Áreas privadas/transacionais não indexáveis (doc 10).
const DISALLOW = ["/conta", "/carrinho", "/checkout", "/pedido", "/api"];

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
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      // mesma política para os agentes de IA — público liberado, privado bloqueado
      { userAgent: AI_AGENTS, allow: ["/", "/produto/", "/categoria/", "/produtos"], disallow: DISALLOW },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
