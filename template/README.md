# Unbox Storefront Template

Template de storefront headless para a plataforma **Unbox**, baseado em Next.js 15 (App Router),
Tailwind CSS v4 e shadcn/ui.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS v4** + shadcn/ui sobre Base UI
- **Unbox SDK** em `lib/unbox/`
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

Variáveis obrigatórias (modelo RECOMENDADO — api key de parceiro; ver `.env.example`):
```env
UNBOX_PARTNER_API_KEY=  # api key única do PARCEIRO (recomendada; da2-...)
UNBOX_CAPTCHA_BYPASS=   # obrigatória com a key de parceiro (pedir à Unbox)
UNBOX_USER=             # usuário de API da loja
UNBOX_PASS=             # senha (com # ou $? use aspas: "#senha")
SESSION_SECRET=         # string aleatória forte
NEXT_PUBLIC_SITE_URL=https://minhaloja.com.br
# Modelo antigo (key por loja), ainda suportado: UNBOX_API_KEY=
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

## API de Parceiros (nova API pública da Unbox)

O projeto suporta os dois modelos de credencial:

- **Novo (recomendado):** `UNBOX_PARTNER_API_KEY` — api key **única do parceiro**, vale para
  todas as lojas dele. A loja específica é autenticada pelo `UNBOX_USER`/`UNBOX_PASS` no
  signIn (o shopId sai do JWT — pode deixar `UNBOX_SHOP_ID` vazio). Preenchida, o SDK roteia
  automaticamente para `partners.unbox.com.br`: signIn, **vitrine completa** (catálogo,
  busca, PDP por slug/id, dados da loja), categorias (tags), cupons, pedido por referenceId,
  parcelas, inventário (`getSimpleInventory`), webhooks e cart templates.
- **Antigo:** `UNBOX_API_KEY` (key por loja) — segue funcionando; sem a key de parceiro nada
  muda. Carrinho/checkout/área do cliente seguem no core em qualquer modo (com o MESMO token
  do signIn de parceiros), até a Unbox publicar essas escritas na API de parceiros.

`npm run unbox:test` mostra qual rota está ativa na primeira linha.

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

- `UNBOX_API_KEY` / `UNBOX_PARTNER_API_KEY` nunca vão ao browser — apenas Route
  Handlers/Server Actions/RSC
- Token de cliente (OTP) fica em cookie `httpOnly`
- `placeOrder` protegido contra duplo envio (`lib/checkout-lock.ts`)
- Rate-limit nas rotas de OTP e checkout (`lib/ratelimit.ts`)
