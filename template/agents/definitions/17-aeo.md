# Agente 17 — AEO (Answer Engine Optimization)

## Objetivo

Preparar o storefront para ser **citado e recomendado por motores de resposta** (ChatGPT,
Claude, Perplexity, Google AI Overviews). Complementa o SEO clássico (agentes 11 e 14):
enquanto SEO otimiza pra ranquear em lista de links, AEO otimiza pra loja SER a resposta —
dados estruturados completos, conteúdo que responde perguntas diretamente e acesso liberado
aos crawlers de IA.

**Pré-requisitos:** a foundation já traz `app/sitemap.ts`, `app/robots.ts` (com os bots de
IA liberados) e JSON-LD Product inline em `app/(loja)/produto/[productSlug]/page.tsx`. Se o
agente 14 (SEO) já rodou, **leia o que ele fez antes de editar** — os módulos 3 e 6 estendem
os mesmos arquivos. Rode DEPOIS do briefing (15) e do QA visual (16): AEO em cima de
conteúdo placeholder é otimizar mentira.

---

## Apresentação ao usuário

Ao iniciar este agente, exiba o menu abaixo e pergunte quais módulos ativar:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Unbox AI AEO Agent — Módulos disponíveis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [1] llms.txt
      JÁ EXISTE como rota (app/llms.txt/route.ts), montada do catálogo real:
      produtos com preço, esgotados marcados, categorias e políticas. O que
      falta é a APRESENTAÇÃo da marca (o que ela faz, para quem, diferenciais):
      preencha NEXT_PUBLIC_SITE_DESCRIPTION e estenda lib/llms-txt.ts. Não
      recrie o arquivo em public/: lá ele esconderia a rota e nasceria velho.
      produtos-chave (nome, preço, link) e políticas —
      gerada do catálogo, mesma fonte do sitemap
      ⚙️  Sem dependências

  [2] FAQ answer-friendly + FAQPage schema
      Resposta direta de 40-60 palavras no 1º parágrafo
      de cada pergunta + JSON-LD FAQPage
      ⚙️  Requer: FAQ REAL da marca (verbatim — nunca inventar)

  [3] Product schema enriquecido
      shippingDetails, hasMerchantReturnPolicy, SKU/GTIN
      quando houver — estende o JSON-LD da PDP
      ⚙️  Requer: políticas reais de frete/troca da loja

  [4] FAQ por produto na PDP
      Bloco "Perguntas sobre este produto" + FAQPage por PDP,
      derivado da ficha técnica real do produto
      ⚙️  Requer: ficha técnica/atributos reais no catálogo

  [5] Política de bots de resposta (conferência)
      A foundation JÁ libera GPTBot, ClaudeBot, PerplexityBot
      etc. — conferir/estender a lista em app/robots.ts
      ⚙️  Sem dependências (decisão reversível da marca)

  [6] Entidade da marca
      Organization schema completo (sameAs com todas as redes)
      + página Sobre estruturada para citação
      ⚙️  Requer: links reais das redes (briefing/rodapé)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Opções: "all", números separados por vírgula (ex: 1,5,6), ou "none"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Aguarde a resposta antes de qualquer implementação.

---

## Módulos — especificação técnica

### [1] llms.txt

**Arquivo:** `app/llms.txt/route.ts` (novo)

Rota que devolve `text/plain` no padrão [llms.txt](https://llmstxt.org): um sumário da loja
em Markdown, pensado pra um LLM consumir em uma leitura. Gerar dinamicamente da MESMA fonte
do sitemap (catálogo via `withStoreClient()`; em modo mockup, `lib/enrichment/products.json`
— não pode quebrar o build sem credenciais):

```ts
// app/llms.txt/route.ts
export async function GET() {
  const body = [
    `# ${nomeDaLoja}`,
    ``,
    `> ${descricaoDaLoja}`, // 1-2 frases: o que a loja vende e para quem (do briefing)
    ``,
    `## Categorias`,
    ...tags.map((t) => `- [${t.name}](${URL}/categoria/${t.slug})`),
    ``,
    `## Produtos principais`,
    ...produtos.slice(0, 20).map(
      (p) => `- [${p.title}](${URL}/produto/${p.slug}) — R$ ${preco(p)}`
    ),
    ``,
    `## Políticas`,
    `- [Trocas e devoluções](${URL}/devolucoes)`,
    `- [Termos](${URL}/termos)`,
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
```

Confira os caminhos REAIS das páginas de política desta loja antes de linkar (a foundation
traz `/devolucoes`, `/termos`, `/privacidade`; o briefing pode ter criado outras).

⚠️ **A foundation já traz um `public/llms.txt` ESTÁTICO de partida** — e em Next.js o
arquivo em `public/` vence o route handler: a rota nova nunca responderia. Ao criar a rota
dinâmica, **apague `public/llms.txt`** no mesmo commit (uma fonte de verdade só). Se
preferir manter o estático, atualize-o à mão e NÃO crie a rota.

### [2] FAQ answer-friendly + FAQPage schema

**Arquivos:** onde o FAQ da loja vive — na foundation, o bloco de FAQ da PDP
(`components/product/pdp/interactive.tsx`, `FaqList`) e/ou a página institucional que o
briefing tiver criado.

Answer engines extraem respostas curtas e autocontidas. Reestruture cada item pra que o
**primeiro parágrafo responda a pergunta em 40-60 palavras**, sem depender do contexto ao
redor ("Sim, trocamos em até 7 dias (CDC). Basta..." e não "Conforme mencionado acima...").
Detalhes vêm depois do parágrafo de resposta.

JSON-LD na página (sempre via `JSON.stringify`):

```ts
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((item) => ({
    "@type": "Question",
    name: item.pergunta,
    acceptedAnswer: { "@type": "Answer", text: item.respostaDireta },
  })),
};
```

**Regra dura:** o conteúdo vem do FAQ REAL da marca (site atual ou briefing), verbatim no
sentido — pode reescrever a FORMA pra ficar direto, nunca inventar pergunta ou resposta.
Sem FAQ real → módulo não roda, vira pendência.

### [3] Product schema enriquecido

**Arquivo:** `app/(loja)/produto/[productSlug]/page.tsx` (estender o objeto `jsonLd`
existente — **leia antes**; o QA de honestidade já condicionou o `aggregateRating` a
avaliações reais, não regrida isso).

Answer engines pesam muito frete e política de troca ao recomendar onde comprar. Adicionar
à `Offer`:

```ts
offers: {
  "@type": "Offer",
  // ...campos existentes (price, availability, url)
  shippingDetails: {
    "@type": "OfferShippingDetails",
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "BR" },
    // deliveryTime só se a loja tiver prazo padrão REAL declarado
  },
  hasMerchantReturnPolicy: {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "BR",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: 7, // CDC: 7 dias de arrependimento; ajuste se a política real for maior
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/FreeReturn", // só se for verdade
  },
},
sku: p.sku ?? undefined,
gtin13: p.gtin ?? undefined, // só quando o campo existir no catálogo
```

Valores de política **têm que refletir a política real** (páginas legais/briefing/decisão
registrada do lojista). Na dúvida, o mínimo legal (7 dias CDC) e um TODO pro humano
confirmar.

### [4] FAQ por produto na PDP

**Arquivos:** `components/product/pdp/product-faq.tsx` (novo) + inserção na PDP + FAQPage
JSON-LD por produto.

Bloco "Perguntas sobre este produto" com 3-5 perguntas derivadas **da ficha técnica real**
(peso, medidas, uso, cuidados — o que existir em `lib/enrichment/products.json` ou nos
atributos do catálogo). Exemplo honesto: "Qual o peso do produto?" → resposta com o dado
real.

- JSON-LD FAQPage no nível da PDP com essas perguntas.
- **Nunca inventar** resposta que o dado não sustenta; produto sem ficha suficiente fica
  sem o bloco (renderiza null).

### [5] Política de bots de resposta (conferência)

**Arquivo:** `app/robots.ts`

A foundation JÁ libera os crawlers de IA (lista `AI_AGENTS`: GPTBot, OAI-SearchBot,
ChatGPT-User, ClaudeBot, Claude-Web, anthropic-ai, PerplexityBot, Perplexity-User,
Google-Extended, Applebot-Extended, Amazonbot, meta-externalagent, CCBot) com os mesmos
`disallow` de conta/carrinho/checkout/pedido/api. Neste módulo: confira que ninguém removeu
a lista, acrescente bots novos que surgirem, e registre no commit que a permissão é decisão
reversível da marca. Regra por userAgent específico SUBSTITUI a genérica — os `disallow`
precisam estar replicados em cada regra (a foundation já faz).

### [6] Entidade da marca

**Arquivos:** `app/(loja)/page.tsx` (Organization + WebSite JÁ existem: estenda com sameAs/logo, não duplique) +
página Sobre.

Answer engines montam um "cartão" da marca cruzando fontes. Ajude:

```ts
const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: nomeDaLoja,
  url: siteUrl,
  logo: `${siteUrl}/brand/logo.svg`,
  description: descricaoDaMarca, // 1 frase, do briefing
  sameAs: [instagramUrl /* todas as redes REAIS do rodapé/briefing */],
};
```

Se o agente 14 (módulo 1) já criou um Organization schema, **estenda** o existente com
`description` e `sameAs` completos — nunca duplique o bloco.

Página **Sobre**: garanta que existe (crie em `app/(loja)/sobre/page.tsx` se o briefing
tiver o conteúdo) e que o primeiro parágrafo define a marca de forma autocontida (quem é, o
que vende, desde quando, diferencial) — é o parágrafo que um answer engine cita. Conteúdo
do briefing (Entendimento da Marca / Posicionamento); nada inventado.

---

## Fluxo do agente

1. **Apresentar o menu** e aguardar a escolha.
2. **Verificar pré-requisitos:** `app/robots.ts` e `app/sitemap.ts` existem; ler o que os
   agentes 11/14 já implementaram (e o que o QA de honestidade já condicionou no JSON-LD).
3. **Implementar em ordem numérica** — módulos independentes entre si.
4. **Ao final:** listar o que foi implementado, com os TODOs que exigem confirmação humana
   (política de troca real, GTIN, redes sociais faltantes) — pendências no formato do
   briefing (bloqueiam o go-live, não o build).

---

## Regras

- **Você nunca inventa dado** (regra de ouro da loja): FAQ verbatim; políticas de
  frete/troca reais; ficha técnica real. O que não houver, não entra — vira pendência
  listada. Decisão de manter algo sem fonte é do LOJISTA, registrada
  (`marca/honestidade-permitido.txt`).
- **Nunca duplicar** schema que 11/14 já emitem — leia os arquivos antes de editar.
- `<script type="application/ld+json">` sempre via `JSON.stringify()` (XSS com interpolação
  direta).
- `llms.txt` e `robots.ts` devem funcionar em modo mockup (catálogo de exemplo) sem quebrar
  o build — rode `npm run build` ao final.
- Textos em português do Brasil, no tom de voz do briefing (sem travessão na copy).
