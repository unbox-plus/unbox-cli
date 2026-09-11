# Unbox CLI

CLI que gera um storefront Next.js completo integrado com a API Unbox, a partir da foundation
oficial (`storefront-foundation`), já com a sua marca aplicada: estilo visual (layout, fontes,
neutros), cores e nome da loja.

## Uso — sem instalar nada

> **Passo 0**: precisa do Node.js instalado (baixe em [nodejs.org](https://nodejs.org), botão
> "LTS", instalador comum de 2 minutos). É o único pré-requisito da máquina.

Navegue até a pasta onde queira criar o projeto e rode:

```bash
npx --package=@unbox-plus/cli create-unbox-store
```

O `npx` roda o CLI direto do pacote publicado no NPM, sem instalar nada global.
Ele vai perguntar:

1. Nome da pasta/projeto
2. Nome de exibição da loja
3. Cor primária (hex) — botões, preços, links
4. Cor de destaque/CTA (hex) — banners de oferta
5. Site atual da marca (opcional, Enter pra pular)
6. Instagram da marca (opcional, Enter pra pular)
7. Objetivo da loja em uma frase (opcional, Enter pra pular)
8. **Estilo visual da loja** — o CLI sugere um a partir do objetivo/site/Instagram e você
   confirma ou troca: **Essencial** (completo e equilibrado), **Promocional** (oferta em
   primeiro plano), **Editorial** (clube/assinatura, tipografia de revista) ou **Boutique**
   (minimal premium). O estilo define layout da home, fontes, neutros, chrome e raios já no
   scaffold; o agente de Branding refina depois no briefing.
9. Se você já tem as credenciais da loja Unbox (`UNBOX_PARTNER_API_KEY` ou `UNBOX_API_KEY`,
   `UNBOX_USER`, `UNBOX_PASS`)
   - **Não tem ainda?** Sem problema — responda "não" e o projeto sobe em **modo mockup**
     (layout completo, sem dados reais da loja). Preencha `.env.local` depois.
10. Checkout customizável (código no projeto) ou padrão hospedado da Unbox
11. Se quer que ele já rode `npm install`

Tudo (menos credenciais) fica registrado em `marca/briefing.json` do projeto gerado — é a
"memória" do formulário pro agente de Branding não reperguntar nada.

Ao final, o próximo passo é o **briefing de marca no Claude Code** (não `npm run dev`):

```bash
cd <nome-do-projeto>
claude
```

O Claude Code abre direto no briefing (agente 15, via `.claude/settings.json` +
`.claude/agents/branding-briefing.md` gerados no projeto) e conduz a personalização ANTES de o
cliente ver a loja padrão — regra "perguntar antes de mostrar". Encerrado o briefing, o próprio
agente remove a chave `"agent"` do `.claude/settings.json` e as sessões seguintes voltam ao
Claude normal.

### Alternativa mais universal: instalar global o pacote via NPM

Se `npx` der algum problema no ambiente da outra pessoa (versão de npm diferente), esse caminho
funciona em qualquer npm recente:

```bash
npm install -g @unbox-plus/cli
create-unbox-store
```

## Uso — sem instalar, clonando a pasta/repositório

Se você recebeu a pasta inteira (zip) ou clonou o repositório:

```bash
cd create-unbox-store
npm install
node bin/cli.js
```

## Uso não-interativo (scripts/CI)

```bash
npx --package=@unbox-plus/cli create-unbox-store minha-loja --yes --no-install
```

Gera com as cores/nome default e o estilo **essencial** — use `--estilo <nome>`
(essencial, promocional, editorial, boutique) pra escolher outro sem interação. Cores e
tokens podem ser editados depois em `app/globals.css` (bloco "CONFIGURE"); o layout da home
em `components/home/home-recipe.ts`.

## Checkout hospedado da Unbox: duas regras

Quem escolhe "Padrão da Unbox" no wizard não precisa fazer nada: o CLI monta a URL certa. Quem
preencher `UNBOX_HOSTED_CHECKOUT_URL` à mão depois precisa das duas:

1. **Caminho completo, não o domínio.** `https://sualoja.com.br/carrinho/finalizar-pedido`. A raiz
   é a home da loja e ignora os parâmetros em silêncio.
2. **Loja e checkout no mesmo domínio.** Com a loja em um host e o checkout em outro, o cliente cai
   no `/login`. Com os dois sob o mesmo domínio, funciona.

A URL carrega `?id=&token=&freq=&step=1`. O token faz parte do contrato: sem ele, o checkout não
encontra o carrinho.

## A loja já tem um GTM próprio?

Preencha `NEXT_PUBLIC_GTM_ID`. O container da marca convive com o container central da Unbox: são
dois independentes lendo o mesmo `dataLayer`. Três coisas que não são óbvias:

1. **Com o container preenchido, o Pixel do código é desligado automaticamente.** Pixel no
   container e no código conta `PageView` duas vezes, e a inflação é silenciosa.
2. **Quem configura o container precisa saber:** numa SPA, o gatilho "All Pages" só pega o
   carregamento inicial. Para contar troca de rota, a tag de pageview escuta o evento
   personalizado `dataLayerReady`, que a loja emite em toda rota principal (com `pageType` e os
   produtos em vista). O gatilho nativo "History Change" também funciona.
3. **Ligar o Pixel derruba o Best Practices do Lighthouse** de 100 para ~77
   (`third-party-cookies`). Não tem conserto no front, é como o Pixel funciona. A mitigação é a
   API de Conversões server-side, que já vem pronta em `app/api/capi/route.ts` e no webhook de
   pagamento.

## Requisitos

- Node.js ≥ 20 (recomendado: 22 LTS — veja `.nvmrc` no projeto gerado)
- Credenciais da loja Unbox (`UNBOX_API_KEY`, `UNBOX_USER`, `UNBOX_PASS`) — opcional pra rodar em
  modo mockup, obrigatório antes de ir pra produção (`npm run unbox:test` confirma a conexão)

## O que o CLI gera

Next.js 15 (App Router) + Tailwind v4 + shadcn/ui sobre Base UI, com catálogo, carrinho,
checkout, área do cliente (OTP login, pedidos, assinaturas, endereços), páginas legais, PWA e
SEO básico já implementados — ver `DEPLOY.md` e `QA.md` dentro do projeto gerado para o checklist
de deploy na Vercel.

## ⚠️ Antes de publicar a loja — decisões que ficam para quem usa

A foundation inclui alguns placeholders que **funcionam, mas precisam de uma decisão consciente**
antes de a loja ir ao ar. Nenhum deles quebra o projeto — o CLI não resolve isso automaticamente
de propósito, para não tomar essa decisão no lugar de quem está publicando.

1. **Prova social: a foundation não traz nenhuma.** Sem avaliação real em
   `lib/enrichment/products.json`, a loja não mostra nota, estrelas, contagem nem depoimento
   (o bloco some, não cai em placeholder). Antes de publicar, decida: popular com dados reais
   ou publicar sem prova social. **O agente 15 (Branding) pede esse material no briefing.**
   O `unbox:honestidade` lista qualquer número ou promessa que entrar sem lastro.
2. **Módulos de CRO — só 1 de 10 na foundation.** Dos 10 módulos do "Unbox AI CRO Package"
   (prova social, urgência de estoque, countdown, frete grátis, upsell, recently viewed, sticky
   CTA, trust strip, kits, brindes), só a **barra de frete grátis** vem pronta. Os outros nove
   são construídos pelo agente `13-cro.md`, que o briefing oferece ao terminar — o wizard não
   pergunta mais sobre isso (perguntava, gravava num arquivo que ninguém lia, e o agente 13
   perguntava de novo).
3. **SEO avançado — o básico está, os 7 módulos não.** A foundation traz JSON-LD de produto,
   Organization + WebSite/SearchAction na home, imagem Open Graph gerada e canonical por
   página. Breadcrumbs, FAQ schema, OG por produto e templates de título/description por
   página são do agente `14-seo.md`.
4. **Kits/combos vêm vazios** (`lib/enrichment/combos.ts`) — a seção só aparece na loja depois de
   alguém popular `COMBOS` com os kits reais.

### Onde continuar depois do setup

Todo projeto gerado já vem com `agents/MANAGER.md` — descreve exatamente o que cada agente
resolve e a ordem recomendada dos passos manuais: **15 (Branding) primeiro**, depois os opcionais
13 (CRO) e 14 (SEO), e por último 12 (Deploy).

## Editor da loja (a partir da 0.20.0)

A loja gerada nasce editável pelo editor da Unbox (chat e painel visual sobre um documento de conteúdo). O que o template traz, e que não pode ser removido sem desligar o editor em silêncio:

- `lib/editable/` (a foundation do editor, cópia byte a byte; correção entra por versão, nunca à mão), com o slug da loja carimbado em `config.ts` no scaffold.
- `next.config.ts` com `frame-ancestors` para `NEXT_PUBLIC_EDITOR_ORIGIN` (variável de BUILD: precisa existir antes do `next build`).
- `app/api/revalidate` aceitando o token do editor e devolvendo o recibo com `conteudo`.
- `middleware.ts` deixando passar o token de prévia e as rotas `/api/unbox/*`.
- `app/api/unbox/paginas`, `catalogo` e `vitrine`, e `lib/rotas-editaveis.ts` com as tabelas `SO_CHROME` e `CONTAINERS_POR_ROTA`: rota nova entra na tabela ou o gate reprova.
- `app/layout.tsx` com o `EditableProvider` e a linha única `<Rastreio />` (GTM, GA4, Meta Pixel, TikTok, Pinterest e WhatsApp decididos pela foundation).
- Home, cabeçalho, rodapé, catálogo e página de produto com primitivos; ids de seção são chaves de arquivo e não têm renomear.

Gate: `npm run unbox:editavel` mede toda página que a loja declara. Saída 0 = aprovado; 1 = reprovado dizendo qual página; 2 = não rodou (rota dinâmica sem exemplo, por exemplo sem catálogo), nunca aprovação.

Variáveis: `EDITOR_URL`, `NEXT_PUBLIC_EDITOR_ORIGIN`, `UNBOX_EDITOR_SHOP` (opcional: sobrepõe o slug carimbado). `META_CAPI_TOKEN` é segredo de servidor e nunca entra no documento do editor.

A loja diz quem é e onde vive (0.20.4): `/api/unbox/paginas` responde `loja: { slug, nome, url }`. É por isso que o editor acha a loja sem registro nenhum (`https://<slug>.myunbox.com.br`) e, quando `NEXT_PUBLIC_SITE_URL` é o domínio próprio (https), confirma lá e abre a loja por ele: prévia, publicação e revalidação vão para o domínio de verdade. Em produção, `NEXT_PUBLIC_SITE_URL` certo é o único cuidado; `http://localhost` (dev) não é declarado.

O lojista cria páginas, artigos e coleções (0.21.0). A loja nasce com quatro rotas que servem o que o lojista escreve no editor: `/paginas/<endereco>` (página avulsa), `/<colecao>/<endereco>` (artigo), `/<colecao>` (listagem) e `/<colecao>/pagina/N` (as seguintes), mais `/previa-do-editor`, por onde o editor abre uma página antes de ela existir na loja. A coleção que nasce com a loja é o `blog`, declarada em `lib/paginas-do-lojista.ts`; trocar o rótulo e o endereço dela é uma linha. O corpo da página é montado com as mesmas seções da home, mais uma seção de **Texto** com parágrafo, negrito, link, lista, subtítulo e citação. SEO: título, descrição, endereço canônico, Open Graph, dados estruturados (artigo, página, listagem e migalhas) e sitemap com a data de alteração verdadeira, tudo derivado do documento.

**A prévia dessas páginas exige que o editor assine com uma chave estável** (`EDITOR_PRIVATE_KEY_JWK` no ambiente do editor). Sem ela o editor gera um par novo a cada arranque, a assinatura não confere e toda prévia de página do lojista responde 404; o log da loja diz isso em uma linha.

A seção "Editor: o que não pode quebrar" do `CLAUDE.md` do template lista cada ponto com o que acontece se for tocado.
