# Agent Manager: Unbox Storefront Builder

Sistema de agentes que originalmente construiu, seção por seção, o storefront headless que virou
a foundation do `create-unbox-store`. Stack: **Next.js 15 (App Router) · TypeScript · Tailwind v4 ·
shadcn/ui + Base UI · Vercel**.

> 🎉 **Se você chegou aqui via `npx create-unbox-store`, os agentes 00-11 já rodaram por você.**
> Layout, catálogo, PDP, carrinho, checkout, login, área de conta e SEO básico já estão
> implementados e funcionando (inclusive em "modo mockup", sem credenciais). Você **não precisa
> rodar 00-11 de novo**.
>
> ⚠️ **Mas isso é fundação técnica, não a loja final.** O conteúdo e o layout ainda estão em
> padrão. O **PRIMEIRO passo é personalizar**, com o agente **15 (Branding & Identidade)**, e a
> regra é **perguntar antes de mostrar**: rode o briefing e só então apresente a vitrine, já com a
> cara da marca. Não trate a base padrão como entregável nem mande o cliente "abrir a loja" antes
> do 15.
>
> Ordem recomendada dos passos manuais: **15 (Branding)** primeiro, **16 (QA Visual,
> obrigatório)** na sequência, depois os opcionais **13 (CRO)**, **14 (SEO avançado)** e
> **17 (AEO)**, e por último **12 (Deploy)**. É por isso que essa pasta `agents/` vem dentro
> do seu projeto: pra você rodar esses quando quiser.

---

## Agente 15: Branding & Identidade (rode PRIMEIRO, pós-setup)

Personaliza o storefront com a identidade real da marca do cliente. Conduz uma **entrevista**
(não um menu de módulos como 13/14): expectativa, referências, logo, cores, fotos, textos, links
e o que manter do site atual. Depois aplica logo e cores reais, menu, conteúdo real, FAQ verbatim
e dados de rodapé, e **neutraliza a prova social fabricada** da foundation base (ver aviso abaixo).

- Definição: `.claude/agents/branding-briefing.md`. **Se você abriu o Claude Code na raiz
  deste projeto, esse prompt já está carregado como system prompt da sua sessão**, não
  reabra o arquivo pra "conferir o que fazer": você já o tem inteiro, e relê-lo custa ~8k
  tokens. (`agents/definitions/15-branding.md` é só um ponteiro pra cá.)
- **Layout por receita (v0.9.0+):** o scaffold já aplica um ESTILO (essencial, promocional,
  editorial ou boutique, campo `estilo` do `marca/briefing.json`) que define a receita da home
  (`components/home/home-recipe.ts`), fontes, neutros e chrome. O agente 15 valida/refina esse
  estilo no briefing usando o repertório de `agents/PADROES.md` e os skills de design em
  `.claude/skills/` (`frontend-design`, `web-design-guidelines`).
- É o **ponto de partida do cliente**: o briefing acontece ANTES de a vitrine ser apresentada. A
  base padrão que o CLI gera é só fundação; a primeira loja que o cliente vê já sai personalizada.
- Roda **antes** de 13/14/12: não faz sentido otimizar (CRO/SEO) nem publicar (Deploy) em cima de
  conteúdo padrão. Personalize primeiro.
- **Ordem recomendada dos passos manuais:** 15 (Branding) → **16 (QA Visual, obrigatório)** →
  13 (CRO, opcional) → 14 (SEO, opcional) → 17 (AEO, opcional) → 12 (Deploy, por último).

## Agente 16: QA Visual (o gate de "pronto" do 15)

O critério de pronto não é "o agente achou que terminou": é **todo frame visto e avaliado**.
Build de produção (`npm run build` + `next start`, nunca o dev server), screenshots de home,
PDP, catálogo, carrinho e checkout em desktop (1440) e mobile (390), avaliados contra o
contrato `marca/DESIGN-<MARCA>.md`, e o gate `npm run unbox:honestidade` LIMPO, o bloqueio
é contra fabricação SILENCIOSA: o agente nunca inventa dado, mas o que o LOJISTA decidir
manter é decisão dele, registrada no allowlist. Roda após o briefing E após cada rodada de
feedback.

- Definição: `agents/definitions/16-qa-visual.md`

## Agente 17: AEO (Answer Engine Optimization, opcional)

Prepara a loja pra ser **citada e recomendada por motores de resposta** (ChatGPT, Claude,
Perplexity, AI Overviews), o complemento do SEO: em vez de ranquear em lista de links, SER
a resposta. Menu de 6 módulos: `llms.txt`, FAQ answer-friendly + FAQPage schema, Product
schema enriquecido (frete/troca/GTIN), FAQ por produto, conferência dos bots de IA no
`robots.ts` (a foundation já libera) e entidade da marca (Organization + página Sobre).
Rode DEPOIS do 15 e do 16, AEO em cima de placeholder é otimizar mentira.

- Definição: `agents/definitions/17-aeo.md`

> **Nota para a equipe do CLI:** pra "perguntar antes de mostrar" funcionar de verdade, a mensagem
> final do CLI deve mandar o cliente **abrir o Claude Code e iniciar o briefing (agente 15)**, e
> não "rode `npm run dev` e veja sua loja". Se o CLI convidar a olhar a loja primeiro, o cliente vê
> a versão padrão antes da personalização, que é justamente o que queremos evitar.

---

## Como executar um agente (16, 13, 14, 17 ou 12; o 15 abre sozinho no Claude Code)

Abra o arquivo de definição correspondente em `agents/definitions/` e passe o conteúdo como
system prompt para uma sessão de Claude Code com acesso a Write/Edit/Bash na raiz do seu projeto.
Os agentes 13 e 14 listam um menu de módulos e perguntam quais ativar (não precisa rodar todos de
uma vez). O agente 15 conduz uma entrevista de briefing, um bloco por vez.

Antes de abrir qualquer componente, passe pelo `CLAUDE.md` da raiz: ele diz em qual arquivo
mora cada tipo de mudança, e os dois registries (`components/home/sections/registry.ts` e
`components/chrome/registry.ts`) indexam por descrição tudo que existe de seção e de
header/rodapé. Ler os dois custa ~1,6k tokens e evita abrir ~27k em componentes.

---

## Agentes 00-11: já entregues pelo `create-unbox-store`

Referência do que cada um cobriu, caso precise entender/estender alguma parte específica depois.

| # | Agente | Arquivos principais no seu projeto |
|---|--------|----------------------|
| 00 | **Scaffold** | `package.json`, `next.config.ts`, `app/globals.css`, `lib/unbox/*`, `lib/config.ts` |
| 01 | **Layout** | `app/layout.tsx`, `components/site-header.tsx`, `site-footer.tsx`, `mobile-nav.tsx` |
| 02 | **Homepage** | `app/(loja)/page.tsx`, `components/home/*.tsx` |
| 03 | **Catalog** | `app/(loja)/produtos/page.tsx`, `app/(loja)/categoria/[tagSlug]/page.tsx`, `app/(loja)/busca/page.tsx`, `components/catalog/*.tsx` |
| 04 | **PDP** | `app/(loja)/produto/[productSlug]/page.tsx`, `components/product/pdp/*.tsx` |
| 05 | **Cart** | `app/(loja)/carrinho/page.tsx`, `components/cart/*.tsx`, `app/api/cart/**` (inclui link de recuperação `?id=&token=`) |
| 06 | **Checkout** | `app/(loja)/checkout/page.tsx`, `components/checkout/checkout-client.tsx`, `app/api/checkout/**` |
| 07 | **Auth** | `app/(loja)/conta/entrar/page.tsx`, `lib/session.ts`, `app/api/account/{otp,signin,signout}/route.ts` |
| 08 | **Customer** | `app/(loja)/conta/**`, `components/account/*.tsx`, `lib/customer-session.ts` |
| 09 | **Promotions** | `lib/enrichment/combos.ts` (kits), `components/home/combos-*.tsx`, **infra pronta, mas `COMBOS = []` por padrão**, precisa popular |
| 10 | **Feedback/UX** | `sonner` (toasts), `lib/unbox/errors.ts` (`friendlyError`, `cartEventLabel`), `app/error.tsx`, `app/not-found.tsx` |
| 11 | **SEO + Infra** | `app/sitemap.ts`, `app/robots.ts`, JSON-LD Product básico na PDP |

---

## Passos manuais (pós-setup): status real na foundation atual

| # | Passo | Módulos / escopo | Status hoje |
|---|-------|------------------|-------------|
| 15 | **Branding & Identidade** | entrevista de marca + aplicação (logo, cores, menu, conteúdo, FAQ verbatim, rodapé, prova social só com dado real) | **Novo.** Rodar `15-branding.md` como primeiro passo pós-setup. |
| 16 | **QA Visual** | build de produção + screenshots desktop/mobile avaliados contra `marca/DESIGN-<MARCA>.md` + gate `unbox:honestidade` | **Obrigatório** depois do 15 e de cada rodada de feedback. Rodar `16-qa-visual.md`. |
| 13 | **Unbox AI CRO Package** | 10 módulos: prova social, urgência de estoque, countdown flash sale, frete grátis¹, upsell pós-checkout, recently viewed, sticky CTA mobile, trust strip, kits & combos, brindes¹ | **Só frete grátis está implementado.** Os outros 9 exigem rodar o agente `13-cro.md`. |
| 14 | **Unbox AI SEO Agent** | 7 módulos: schemas JSON-LD avançados, OG images dinâmicas, breadcrumbs, templates de título/description, canonical + paginação, Core Web Vitals, Search Console setup | **Nenhum módulo completo** (só o JSON-LD básico do agente 11). Rodar `14-seo.md`. |
| 17 | **AEO** | 6 módulos: llms.txt, FAQ answer-friendly, Product schema enriquecido, FAQ por produto, bots de IA (conferência), entidade da marca | Opcional, depois do 14. Rodar `17-aeo.md`. |
| 12 | **Deploy** | build de produção, variáveis de ambiente, publicação (Vercel) | Rodar `12-deploy.md` por último. |

> ¹ Módulos **frete grátis** e **brindes** exigem configuração no painel Unbox antes do lançamento.


## Regras de ouro (todos os agentes herdam)

1. **`UNBOX_API_KEY` é server-only**, nunca `NEXT_PUBLIC_`, nunca client component
2. **Dois tokens distintos**: token de loja (catálogo/checkout) ≠ token do cliente (área `/conta`)
3. **`placeOrder` não é idempotente**, lock por `cartId` no BFF; nunca retentar cegamente
4. **`customerOTPRequest` manda e-mail real**, jamais em testes/loops/CI
5. **Preço e estoque são do servidor**, nunca computar preço no cliente
6. **Menu: use `tags`** (navigation tree falha com token de loja)
7. **`displayStatus(language)` está quebrado**, use `status` + `orderStatusLabel()` do SDK
8. **shadcn/ui usa Base UI** (`@base-ui/react`), prop `render`, não `asChild`
9. **Tailwind v4**, use utilitários/tokens do tema; evite CSS ad-hoc. Cor de marca é sempre
   `bg-[var(--store-primary,#fallback)]`, nunca hex literal, senão a customização do CLI não
   se propaga (achamos e corrigimos 304 ocorrências disso na foundation base)
10. **Erros GraphQL chegam em HTTP 200**, sempre cheque `errors[]` antes de consumir `data`
11. **`getTags()`/`getTopTags()` nunca filtra por `isTopLevel`**, forçar `true` esconde
    categorias reais marcadas `false` no admin, mesmo aparecendo normalmente na vitrine padrão da
    Unbox. Deixe o parâmetro opcional e omitido.
12. **GTM central da Unbox (`GTM-PZLT336`) e o selo "Powered by Unbox" no rodapé são
    obrigatórios e intocáveis**, contrato da plataforma. O `prebuild`
    (`scripts/check-unbox-brand.mjs`) BLOQUEIA build/deploy sem os dois. Tags da marca vão
    nos campos próprios (GA4/Pixel/GTM adicional), nunca substituindo o central.
13. **Qualquer `useEffect`/handler que termina em `refresh()` do carrinho precisa esperar
    `loading` (do `useCart()`) ficar `false` antes de rodar.** Achamos essa mesma classe de bug
    em 4 pontos independentes do checkout (recálculo de frete por item, por CEP, troca de método
    de frete, "continuar"), todos causavam "removo um item e ele volta" se disparassem enquanto
    outra mutação de carrinho estava em voo. `cart-provider.tsx` também tem um contador de
    sequência (`mutationSeq`) como proteção de segunda camada, mas o guard de `loading` evita o
    problema na origem.

---

## Contratos entre módulos (referência real, não a genérica de quando isso foi escrito pra "fase 2")

```
lib/unbox/store.ts        → withStoreClient() / getShopContext(), client de LOJA, cache de token em memória
lib/customer-session.ts   → getCustomerClient() / requireCustomerClient(), client do CLIENTE (token separado)
lib/session.ts            → cookies httpOnly: unbox_cart, unbox_customer, unbox_order_<ref>
lib/unbox/errors.ts       → friendlyError(), cartEventLabel()
components/cart/          → CartProvider (useCart hook) + MiniCart, usado pelo Layout inteiro
components/home/combos-* → consome lib/enrichment/combos.ts (Agente 09)
```

---

## Variáveis de ambiente necessárias

Nomes reais (confira sempre contra `.env.example` do projeto, já houve doc desatualizada com
`UNBOX_USERNAME`/`UNBOX_PASSWORD`, que não existem):

```env
# .env.local (server-only: nunca NEXT_PUBLIC_)
UNBOX_PARTNER_API_KEY=    # NOVA API pública de parceiros: key única do parceiro (todas as lojas).
                          # Preenchida → signIn + leituras compatíveis roteiam pra partners.unbox.com.br
UNBOX_CAPTCHA_BYPASS=     # obrigatória com a key de parceiro: x-captcha-verification do signIn (pedir à Unbox)
UNBOX_API_KEY=            # chave da loja (modelo antigo; opcional se a de parceiro está preenchida)
UNBOX_USER=               # usuário de API da loja (ex.: api_minhaloja)
UNBOX_PASS=               # senha do usuário de API
UNBOX_SHOP_ID=            # opcional: extraído do JWT se vazio
UNBOX_SHOP_SLUG=          # opcional: extraído do JWT se vazio
UNBOX_WEBHOOK_SECRET=     # secret(s) do subscribeToWebhook, separados por vírgula se houver mais de um

# App
SESSION_SECRET=
REVALIDATE_SECRET=
NEXT_PUBLIC_SITE_URL=
```
