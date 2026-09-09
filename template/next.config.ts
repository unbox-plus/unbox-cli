import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "unbox-customer-images-production.s3.amazonaws.com" },
      { protocol: "https", hostname: "**.s3.amazonaws.com" },
      { protocol: "https", hostname: "**.unbox.com.br" },
    ],
  },
  // URLs antigas (/p/, /c/) → novas (/produto/, /categoria/), preservando SEO/links.
  //
  // statusCode: 301, não permanent: true. `permanent: true` emite 308, e 308 preserva o
  // método HTTP — tecnicamente mais correto e passa PageRank igual. Mas os critérios de
  // aceitação dos briefings pedem "301 slug a slug" ao pé da letra, e auditoria que lê o
  // status literal já reprovou duas lojas por isso. Um redirect de GET não ganha nada com
  // 308: não vale discutir com o auditor.
  async redirects() {
    return [
      { source: "/p/:slug", destination: "/produto/:slug", statusCode: 301 },
      { source: "/c/:slug", destination: "/categoria/:slug", statusCode: 301 },
    ];
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // HSTS: força HTTPS por 1 ano; Vercel já faz isso mas deixar explícito é boa prática.
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      // doc 09/10: não vazar cartToken/PII via header Referer em carrinho/checkout
      { source: "/carrinho/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/checkout/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/conta/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      // Assets da marca: sem isto o Next serve `max-age=0, must-revalidate` e o navegador
      // revalida a pasta inteira a cada visita (uma loja media 25 MB em /brand).
      // 30 dias e SEM `immutable`, de propósito: estes arquivos são trocados à mão, mantendo o
      // mesmo nome (diferente de /_next/static, cujo nome muda a cada build). Com `immutable`,
      // trocar uma foto deixaria a antiga presa no navegador de quem já visitou.
      { source: "/brand/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }] },
      { source: "/unbox/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }] },
    ];
  },
};

export default nextConfig;
