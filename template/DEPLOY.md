# Deploy no Vercel — Lojas Unbox/Next.js

> **A primeira versão no ar NÃO precisa de git nem de GitHub.** O `vercel` faz upload direto
> da pasta local, e a conta Vercel pode ser criada com **email** (na tela de login, ignore o
> "Continue with GitHub" e use "Continue with Email"). GitHub é um passo opcional DEPOIS, só
> pra quem quiser redeploy automático a cada push — veja a última seção.

## Pré-requisitos locais

- Node.js **v22 LTS** (`nvm install 22 && nvm use 22`)
  > v26 causa startup lento no Next.js — sempre use a LTS.
- Conta Vercel (email serve) — o CLI roda via `npx vercel`, sem instalar nada global
- `.env.local` com todas as credenciais da loja (veja `.env.example`)

---

## Checklist pré-deploy (na ordem certa)

```bash
# 1. Node version correta
nvm install 22 && nvm use 22

# 2. Remover lock file global que conflita com npm
rm -f ~/package-lock.json

# 3. Instalar dependências
npm install

# 4. Verificar conexão com a API antes de subir
npm run unbox:test

# 5. Rodar local — primeira vez demora 2-4 min (compilação inicial)
npm run dev
```

---

## Setup no Vercel (via dashboard)

### Framework Preset

> Settings → Build & Development Settings

Selecionar **Next.js** no dropdown "Framework Preset".

**Nunca deixar como "Other"** — sem isso o Vercel não configura o build command correto e o deploy falha silenciosamente.

### Variáveis de ambiente

> Settings → Environment Variables

Adicionar **antes do primeiro deploy** em **Production**, **Preview** e **Development**:

| Variável | Obrigatório | Descrição |
|---|---|---|
| `UNBOX_PARTNER_API_KEY` | ✅ (recomendado) | Api key única do PARCEIRO (`da2-...`) — modelo atual |
| `UNBOX_CAPTCHA_BYPASS` | ✅ com a key de parceiro | x-captcha-verification do signIn (pedir à Unbox) |
| `UNBOX_USER` | ✅ | Usuário de acesso à API da loja |
| `UNBOX_PASS` | ✅ | Senha de acesso à API |
| `SESSION_SECRET` | ✅ | String aleatória forte (≥ 32 chars). Sem ela, em produção, a posse de pedido é RECUSADA (não é aviso: `/api/checkout` falha e o pedido não vira cookie) |
| `NEXT_PUBLIC_SITE_URL` | ✅ | URL pública da loja (ex: `https://minhaloja.com.br`) |
| `NEXT_PUBLIC_SITE_NAME` | ✅ | Nome de exibição (manifest/PWA) |
| `UNBOX_API_KEY` | — | Modelo ANTIGO (key por loja); só sem a key de parceiro |
| `UNBOX_SHOP_ID` | — | Extraído do JWT se vazio |
| `UNBOX_SHOP_SLUG` | — | Extraído do JWT se vazio |
| `UNBOX_WEBHOOK_SECRET` | — | Secret(s) dos webhooks (vírgula p/ múltiplos) |
| `REVALIDATE_SECRET` | — | Protege `/api/revalidate` |
| `CRM_WEBHOOK_URL` | — | Webhook do CRM (carrinho abandonado; ver `.env.example`) |
| `PIPEDRIVE_API_TOKEN` | — | Leads da porta de preview → Pessoa+Negócio no Pipedrive |
| `PREVIEW_PASSWORD` | — | Chave do time da porta de preview. Sem padrão: sem ela o atalho `?chave=` não existe e só o formulário abre a porta. O CLI sorteou uma por instalação, no `.env.local` |
| `UNBOX_HOSTED_CHECKOUT_URL` | — | Só no modo checkout hospedado da Unbox. **Caminho completo** (`https://sualoja.com.br/carrinho/finalizar-pedido`, nunca só o domínio) e **mesmo domínio da loja**: em hosts diferentes o cliente cai no `/login`. |
| `NEXT_PUBLIC_GA_ID` | — | GA4 measurement ID |
| `NEXT_PUBLIC_META_PIXEL_ID` | — | Meta Pixel ID |
| `META_PIXEL_ID` / `META_CAPI_TOKEN` | — | Meta Conversions API (server) |

> **Sem env vars o build falha** com `UnboxError: signin HTTP 403: Forbidden` durante o prerender.

### Via CLI (alternativa)

```bash
npx vercel env add UNBOX_API_KEY
npx vercel env add UNBOX_USER
npx vercel env add UNBOX_PASS
npx vercel env add SESSION_SECRET
npx vercel env add NEXT_PUBLIC_SITE_URL
```

---

## Primeiro deploy (sem git, sem GitHub)

```bash
# 1. Entrar na conta (abre o browser; login por email funciona)
npx vercel login

# 2. Criar/linkar o projeto (responda os prompts; upload direto da pasta local)
npx vercel link

# 3. Deploy de produção
npx vercel --prod
```

Pronto: o `vercel --prod` devolve a URL pública da loja. Nada de repositório envolvido.

---

## Opcional (depois): redeploy automático via GitHub

Só faz sentido quando a loja já está no ar e o time quer que todo push em `main` redeploye
sozinho. Aí sim:

```bash
git init
git add .
git commit -m "chore: initial storefront"
git remote add origin <repo-url>
git push -u origin main
```

E no dashboard do Vercel: Settings → Git → conectar o repositório. Sem isso, o redeploy é
manual (`npx vercel --prod` de novo) e funciona igual.

---

## Erros comuns e soluções

| Erro | Causa | Solução |
|---|---|---|
| `UnboxError: signin HTTP 403` | Env vars ausentes no Vercel | Adicionar em Settings → Environment Variables (todos os 3 ambientes) |
| Build falha silenciosamente | Framework Preset como "Other" | Alterar para **Next.js** em Settings → Build |
| `Project already exists` ao criar | Nome já usado na conta Vercel | Usar nome diferente (ex: `nome-loja-app`) |
| Prerender error na home `/` | API inacessível durante build | Verificar credenciais e rodar `npm run unbox:test` |
| `npm ERR! ...` no install | `~/package-lock.json` global | `rm -f ~/package-lock.json` |
| Startup > 5 min em dev | Node.js v26 instalado | `nvm use 22` |

---

## Porta de preview (prévia privada) e o LANÇAMENTO da loja

A loja nasce travada atrás da tela `/acesso` ("Prévia privada"): quem preencher
nome/marca/WhatsApp/e-mail entra (cookie de 30 dias) e vira lead — com
`PIPEDRIVE_API_TOKEN` configurado, cada lead cria Pessoa + Negócio no Pipedrive
(título `"<slug> - Nome"`, no funil de Negócios).

**A porta se escopa pelo domínio sozinha**: só existe em host de preview
(`*.vercel.app`, `*.myunbox.com.br`, + sufixos de `PREVIEW_HOSTS`). Não precisa ligar
nem desligar nada:

- **No deploy de prévia** (URL vercel.app/myunbox): porta LIGADA automaticamente.
  Configure `PIPEDRIVE_API_TOKEN` (production + preview) e, se quiser aviso em tempo
  real, `PREVIEW_WEBHOOK_URL` (Slack/Zapier).
- **No lançamento** (domínio próprio da marca apontado): porta SOME automaticamente no
  domínio próprio. A URL vercel.app continua com porta — o que é bom: ninguém indexa a
  loja pelo endereço de preview. Kill switch manual, se precisar: `PREVIEW_DISABLED=1`.
- **Time interno não preenche formulário**: qualquer URL da loja com
  `?chave=<PREVIEW_PASSWORD>` grava o cookie e segue direto — ex.:
  `https://loja.vercel.app/?chave=SUA_CHAVE`. Compartilhe ESSE link internamente; o cookie
  vale 30 dias por navegador. A chave é a que o CLI sorteou no `.env.local`; para o atalho
  valer no deploy, cadastre a MESMA `PREVIEW_PASSWORD` na Vercel. Sem a variável lá, o
  atalho é recusado e a porta continua abrindo pelo formulário, como deve.
- **Local**: localhost fica fora da porta por padrão (dev e QA não tropeçam nela). Pra
  testar a porta localmente: `PREVIEW_FORCE=1` no `.env.local`.
- ⚠️ Env var nova só vale **depois de um redeploy** — o snapshot anterior não a enxerga.
- Conferência pós-deploy (não pule): abrir a URL vercel.app numa aba anônima → deve
  cair em `/acesso`; preencher → deve entrar; nos logs, `[preview-lead-pipedrive]` com
  `ok:true` e `dealId` preenchido (a recusa do Pipedrive vem com **status 200** — não
  confie em "não deu erro"). Apague a Pessoa/Negócio de teste do CRM.

---

## Redeploy após alterar env vars

1. Vercel dashboard → Deployments → último deploy → **Redeploy**

Ou pela CLI:

```bash
npx vercel --prod
```

(Quem conectou GitHub também pode só dar `git push origin main`.)
