# Unbox Storefront Template

Template de storefront headless para a plataforma **Unbox**, baseado em Next.js 15 (App Router),
Tailwind CSS v4 e shadcn/ui.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS v4** + shadcn/ui sobre Base UI
- **SDK da Unbox**: o pacote `@unbox-plus/sdk` (atualizar a integração = bump de versão no
  `package.json`). A fiação com o ambiente desta loja fica em `lib/unbox.ts`
- Hospedagem recomendada: **Vercel**

## Setup rápido

### 1. Configurar credenciais

Projeto gerado pelo `create-unbox-store`: o CLI já criou o `.env.local` no scaffold — só
confira/complete as credenciais nele (veja `.env.example`).

(Só quem clonou a foundation crua, SEM o CLI, tem o `./bootstrap.sh` pra esse setup.)

```bash
npm install
```

O script pergunta se você tem as credenciais Unbox. Se não tiver, sobe assim mesmo em **modo mockup** — o layout abre, mas páginas que dependem da API mostram erro. Preencha `.env.local` depois e rode `npm run unbox:test` antes do QA.

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
# Editar .env.local com as credenciais da loja Unbox
```

Variáveis obrigatórias (ver `.env.example`):
```env
UNBOX_PARTNER_API_KEY=  # api key única do PARCEIRO (da2-...)
UNBOX_USER=             # usuário de API da loja
UNBOX_PASS=             # senha (com # ou $? use aspas: "#senha")
SESSION_SECRET=         # string aleatória forte
NEXT_PUBLIC_SITE_URL=https://minhaloja.com.br
```

### 3. Configurar a marca

| Arquivo | O que personalizar |
|---------|-------------------|
| `app/globals.css` | Cores (`--store-primary`, `--store-chrome-bg`, `--store-cta`) |
| `app/layout.tsx` | Fonte e título padrão (favicon: `app/icon.svg`) |
| `public/brand/logo.svg` | Logo da loja |
| `lib/store-config.ts` | Limiares de frete grátis, brinde |
| `components/chrome/footers/*` | CNPJ, endereço, tagline (a variante ativa está em `chrome/registry.ts`) |
| `components/chrome/announce-bar.tsx` | Barra de anúncio, badge de cupom |

### 4. Rodar em desenvolvimento

```bash
nvm use 22          # Node 22 LTS — não use v26 (startup lento)
rm -f ~/package-lock.json   # evita conflito com npm
npm run dev         # primeira compilação demora 2-4 min
```

## Estrutura

```
app/
├── api/           # Route Handlers (BFF — nunca expõe API key)
├── acesso/        # Porta de preview (fora do grupo da loja: sem header/rodapé)
└── (loja)/        # Route group: todas as páginas da LOJA (header/rodapé no layout do grupo)
    ├── conta/     # Área do cliente (login OTP, pedidos, assinaturas)
    ├── checkout/  # Fluxo de checkout + confirmação Pix
    └── produto/   # PDP com ISR
components/
├── cart/          # CartProvider + MiniCart + drawer
├── checkout/      # Formulários de checkout
├── product/pdp/   # Buy box, galeria, seções
└── account/       # Área logada
lib/
├── unbox/         # SDK Unbox (client, customer, webhooks)
├── queries.ts     # Funções de fetch cached (catálogo, shop, tags)
├── config.ts      # Variáveis de ambiente server-only
└── store-config.ts # Configuração comercial (limiares, descontos)
```

## Enriquecimento de produtos (opcional)

O sistema em `lib/enrichment/` permite adicionar dados não fornecidos pela Unbox
(composição, medidas, FAQ, reviews, combos) via `products.json` gerado a partir
de uma planilha de metadados.

Para usar: popule `lib/enrichment/products.json` no formato descrito em `lib/enrichment/index.ts`.

## Scripts utilitários

```bash
npm run unbox:test          # testa a conexão com a API Unbox
npm run unbox:dump          # raio-X da loja real (promoções, assinatura, catálogo) — fonte da verdade da store-config
npm run unbox:honestidade   # lista prova social/afirmação fabricada sem decisão do lojista (gate do QA)
npm run unbox:webhook:subscribe  # registra os webhooks da loja
npm run unbox:order:pix     # cria um pedido Pix de teste
npm run unbox:abandoned     # dispara evento de carrinho abandonado pro CRM (demo do cron)
```

## Deploy

Ver [DEPLOY.md](./DEPLOY.md) para checklist completo, configuração do Vercel e erros comuns.

Resumo rápido:
1. `nvm use 22` (Node 22 LTS)
2. Env vars em **Production + Preview + Development** antes do primeiro deploy
3. Framework Preset no Vercel: **Next.js** (não "Other")

## API de Parceiros (a única API que a loja usa)

Tudo passa por `partners.unbox.com.br/graphql`: vitrine, carrinho, checkout, `placeOrder`,
pedido, área do cliente, assinaturas, cupons, webhooks e inventário.

Três cabeçalhos, e cada um responde uma pergunta:

| Header | Responde | Vai em |
|---|---|---|
| `x-api-key` | qual PARCEIRO | toda chamada |
| `Authorization` | qual LOJA (o shopId sai deste JWT) | toda chamada |
| `x-customer-token` | qual CLIENTE final | só a área do cliente |

Por isso **nenhuma chamada manda shopId**. As duas exceções são campos que o próprio schema
declara: o `shopId` de cada `fulfillmentGroup` no `placeOrder` e o de `createCartByTemplate`.

**A loja não guarda segredo de captcha.** As operações protegidas por reCAPTCHA (`signIn`,
`customerOTPRequest`, `customerPasswordlessSignIn`, `placeOrder`, `placePaymentLinkOrder` e os
dois `setup*3DSTransaction`) recebem o token injetado na borda do gateway. O que protege OTP e
checkout de abuso do lado da loja é o rate-limit do BFF (`lib/ratelimit.ts`).

Uma coisa que a API de parceiros não publica, e como a loja resolve:

| Não existe lá | O que a loja faz |
|---|---|
| `catalogItemProductById` | `catalogItems(productIdsOrERPCodes:[id], first:1)`, que devolve o mesmo `CatalogItemProduct` |

`npm run unbox:test` roda o SDK inteiro contra a loja real.

## MCP da Unbox (Claude Code)

A Unbox tem um servidor MCP que dá ao Claude Code acesso ao conhecimento e à execução de
chamadas da API de parceiros (leituras diretas; escritas com confirmação em duas etapas).

Se você informou o token do MCP no setup do CLI, o `.mcp.json` já saiu pronto — pule pro
passo 3. Senão:

1. Copie `.mcp.json.example` para `.mcp.json` (já está no `.gitignore` — ele carrega
   credenciais, **nunca** o commite; o example tem só placeholders).
2. Preencha o `x-unbox-mcp-token` (peça à Unbox), sua `UNBOX_PARTNER_API_KEY` e o
   login/senha da loja.
3. Abra o Claude Code na pasta — as tools `unbox_*` ficam disponíveis (comece por
   `unbox_get_started`).

## Regras de segurança

- `UNBOX_PARTNER_API_KEY` nunca vai ao browser — apenas Route Handlers/Server Actions/RSC
- Token de cliente (OTP) fica em cookie `httpOnly`
- `placeOrder` protegido contra duplo envio (`lib/checkout-lock.ts`)
- Rate-limit nas rotas de OTP e checkout (`lib/ratelimit.ts`)
