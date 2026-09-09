# Agente 12 — Deploy (Vercel)

## Escopo
Preparar e executar o primeiro deploy da loja no Vercel: Node version, env vars nos três
ambientes (Production / Preview / Development) e configuração do projeto.

**REGRA DE OURO DO PRIMEIRO DEPLOY: sem git, sem GitHub.** O `vercel` sobe a pasta local
direto, e a conta Vercel pode ser criada com email (na tela de login, ignorar o "Continue
with GitHub"). NUNCA peça pro lojista criar conta GitHub ou inicializar git pra ver a loja
no ar — isso é atrito desnecessário. Git/GitHub é um opcional de CI/CD pra DEPOIS da loja
publicada, e só se o cliente quiser.

## Dependências
- Todos os outros agentes concluídos
- `.env.local` preenchido com as credenciais reais da loja
- Conta Vercel (login por email serve)

## O que este agente faz

1. Garante Node 22 LTS (`nvm use 22`)
2. Remove lock file global que conflita com npm
3. Valida conexão com a API Unbox antes de subir
4. Cria projeto no Vercel e sobe as env vars
5. Configura Framework Preset como **Next.js**
6. Executa o primeiro deploy de produção (upload direto, sem repositório)
7. (Opcional, se o cliente pedir) conecta GitHub pra redeploy automático

---

## Passo a passo

### 1. Ambiente local

```bash
nvm install 22 && nvm use 22   # Node 22 LTS obrigatório (v26 causa startup lento)
rm -f ~/package-lock.json      # evita conflito com npm install
npm install
npm run unbox:test             # valida credenciais antes de qualquer coisa
```

### 2. Vercel — entrar e linkar o projeto

```bash
npx vercel login   # abre o browser; login por email funciona (não precisa GitHub)
npx vercel link    # cria novo projeto na conta (ou linka um existente)
```

Durante o `vercel link`, responder:
- **Set up and deploy?** → No (vamos configurar antes)
- **Link to existing project?** → depende (Yes se já existe, No para criar)

### 3. Env vars — CRÍTICO

Adicionar **todas** as variáveis **nos 3 ambientes** (Production + Preview + Development) antes do
primeiro build. Sem elas o build falha com `UnboxError: signin HTTP 403`.

#### Via CLI (recomendado — selecionar todos os 3 ambientes no prompt):

```bash
npx vercel env add UNBOX_PARTNER_API_KEY   # modelo recomendado (ou UNBOX_API_KEY, por loja)
npx vercel env add UNBOX_CAPTCHA_BYPASS    # obrigatório com a key de parceiro (placeOrder/OTP)
npx vercel env add UNBOX_USER
npx vercel env add UNBOX_PASS
npx vercel env add SESSION_SECRET
npx vercel env add NEXT_PUBLIC_SITE_URL
npx vercel env add NEXT_PUBLIC_SITE_NAME
# opcionais mas recomendados:
npx vercel env add UNBOX_WEBHOOK_SECRET
npx vercel env add REVALIDATE_SECRET
```

> Quando o CLI perguntar "Which environments?", escolher **Production, Preview, Development** (todos).

#### Ou via dashboard:

> Settings → Environment Variables → Add

Para cada variável, marcar os checkboxes: **Production ✅ Preview ✅ Development ✅**

| Variável | Obrigatório | Descrição |
|---|---|---|
| `UNBOX_PARTNER_API_KEY` | ✅ (recomendado) | Key única do parceiro; dispensa `UNBOX_API_KEY` |
| `UNBOX_CAPTCHA_BYPASS` | ✅ com key de parceiro | Segredo do header x-captcha-verification (sem ele: CAPTCHA_MALFORMED_ERROR no pagamento) |
| `UNBOX_API_KEY` | ✅ se não houver key de parceiro | Chave de API da loja (modelo antigo) |
| `UNBOX_USER` | ✅ | Usuário de API |
| `UNBOX_PASS` | ✅ | Senha de API |
| `SESSION_SECRET` | ✅ | String aleatória forte (≥ 32 chars) |
| `NEXT_PUBLIC_SITE_URL` | ✅ | URL pública (`https://minhaloja.com.br`) |
| `NEXT_PUBLIC_SITE_NAME` | ✅ | Nome da loja (título, OG, manifest, JSON-LD) |
| `UNBOX_SHOP_ID` | — | Extraído do JWT se vazio |
| `UNBOX_SHOP_SLUG` | — | Extraído do JWT se vazio |
| `UNBOX_WEBHOOK_SECRET` | — | Secret dos webhooks |
| `REVALIDATE_SECRET` | — | Protege `/api/revalidate` |
| `NEXT_PUBLIC_GA_ID` | — | GA4 measurement ID |
| `NEXT_PUBLIC_META_PIXEL_ID` | — | Meta Pixel ID |
| `META_CAPI_TOKEN` | — | Meta Conversions API token |

### 4. Framework Preset — CRÍTICO

> Settings → Build & Development Settings → Framework Preset → **Next.js**

**Nunca deixar como "Other"** — o Vercel não configura o build command correto e o deploy falha.

### 5. Primeiro deploy

```bash
npx vercel --prod
```

Upload direto da pasta local; a URL de produção sai no final. Sem repositório envolvido.

### 6. Opcional (só se o cliente pedir): redeploy automático via GitHub

Com a loja já no ar, quem quiser que todo push em `main` redeploye sozinho:

```bash
# .gitignore já está correto no template — não alterar
git init
git add .
git commit -m "chore: initial storefront"
git remote add origin <repo-url>
git push -u origin main
```

E no dashboard: Settings → Git → conectar o repositório.

> `git add -A` pode travar em repos grandes. O `.gitignore` já exclui `node_modules/` e `.next/`.

---

## Erros comuns

| Erro | Causa | Solução |
|---|---|---|
| `UnboxError: signin HTTP 403` | Env vars ausentes | Adicionar em todos os 3 ambientes e fazer Redeploy |
| Build falha silenciosamente | Framework Preset "Other" | Settings → Build → alterar para **Next.js** |
| `npm ERR!` no install | `~/package-lock.json` global | `rm -f ~/package-lock.json` |
| Startup lento (> 5 min) em dev | Node.js v26 | `nvm use 22` |
| `Project already exists` | Nome duplicado na conta | Usar nome diferente (ex: `minhaloja-app`) |
| Prerender error na home | API inacessível durante build | Checar credenciais + `npm run unbox:test` |

---

## Redeploy após mudar env vars

Após alterar variáveis no dashboard:

1. Deployments → último deploy → **Redeploy**

Ou pela CLI:

```bash
npx vercel --prod
```

(Quem conectou GitHub também pode só dar `git push origin main`.)

---

## QA pré-go-live

Após o deploy, rodar o checklist em `QA.md` **com credenciais reais**.

> Sem `.env.local` preenchido e `npm run unbox:test` passando, os fluxos de carrinho,
> checkout e login não funcionam — o QA só vale com a API conectada.

## Saída esperada

- Projeto no Vercel configurado e com todas as env vars
- Framework Preset = Next.js
- Primeira URL de produção retornada pelo `npx vercel --prod` (sem git/GitHub envolvidos)
- Confirmação de que a home carrega sem erros (prerender passou)
- QA.md executado e sem itens pendentes
