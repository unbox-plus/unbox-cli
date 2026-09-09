# create-unbox-store

CLI que gera um storefront Next.js completo integrado com a API Unbox, a partir da foundation
oficial (`storefront-foundation`), já com a sua marca aplicada: estilo visual (layout, fontes,
neutros), cores e nome da loja.

## Uso — sem instalar nada

> **Passo 0**: precisa do Node.js instalado (baixe em [nodejs.org](https://nodejs.org), botão
> "LTS", instalador comum de 2 minutos). É o único pré-requisito da máquina.

Se você recebeu o arquivo `create-unbox-store.tgz` (o nome é sempre esse, sem versão — a versão
fica dentro do pacote), coloque-o na pasta onde quer criar o projeto e rode:

```bash
npx --package=./create-unbox-store.tgz create-unbox-store
```

> ⚠️ `npx ./create-unbox-store.tgz` (sem `--package=`) dá erro de permissão em algumas
> versões do npm — use sempre a forma com `--package=` acima.
> Se o seu arquivo veio com versão no nome (zips antigos), ajuste o nome no comando pro
> nome exato do arquivo que está na pasta.

O `npx` roda o CLI direto do tarball, sem instalar nada global nem publicar em lugar nenhum.
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

### Alternativa mais universal: instalar global a partir do tarball

Se `npx --package=` der algum problema no ambiente da outra pessoa (versão de npm diferente),
esse caminho funciona em qualquer npm recente:

```bash
npm install -g ./create-unbox-store-<versão>.tgz
create-unbox-store
```

## Uso — sem instalar, sem tarball (clonando a pasta)

Se você recebeu a pasta inteira (zip):

```bash
cd create-unbox-store
npm install
node bin/cli.js
```

## Uso não-interativo (scripts/CI)

```bash
npx --package=./create-unbox-store.tgz create-unbox-store minha-loja --yes --no-install
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

- Node.js ≥ 18 (recomendado: 22 LTS — veja `.nvmrc` no projeto gerado)
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

## Changelog

### v0.20.1 — o changelog volta a descrever o que foi entregue

Correção de release, sem mudança de comportamento na loja.

As versões 0.19.0 e 0.20.0 saíram **sem entrada de changelog**: o cabeçalho da 0.18.2 tinha sido
renomeado para "v0.20.0" no README do zip (dentro do tarball ele ainda dizia 0.18.2), então o
changelog anunciava como novidade o gate de placeholder, que era de duas versões antes, e não
dizia uma palavra sobre o editor, que é o maior item já entregue nesta linha. As duas entradas
estão escritas abaixo, a partir do diff dos pacotes, e o rótulo da 0.18.2 voltou ao lugar.

**`tools/` passa a viajar no pacote.** O `files` listava só `bin`, `src` e `template`, mas o
`prepack` do próprio `package.json` chama `tools/check-template-neutro.mjs`: o pacote publicado
referenciava um arquivo que não publicava, e `npm pack` a partir dele quebrava. Agora o pacote é
consistente consigo mesmo.

**Para quem quer o código-fonte** (e não o artefato de uso), passou a sair um segundo zip,
`CLI - Unbox v0.20.1 (fonte).zip`, com a pasta inteira: `bin/`, `src/`, `template/`, `tools/`,
`package.json`, `package-lock.json` e o README. O tarball continua sendo o artefato de uso.

Arquivo: `CLI - Unbox v0.20.1.zip`.

### v0.20.0 — a loja nasce editável pelo editor da Unbox

O maior acréscimo desta linha, e o que estava sem registro. A loja gerada passa a ser editável
pelo editor da Unbox (chat e painel visual sobre um documento de conteúdo), em vez de só pelo
código.

- **`lib/editable/`**: provider, primitivos, tokens, documento, verificação e servidor. É cópia
  byte a byte da foundation do editor, com o slug da loja carimbado em `config.ts` no scaffold;
  correção entra por versão, nunca à mão.
- **`app/api/unbox/paginas`, `catalogo` e `vitrine`**: a loja passa a declarar quais páginas tem,
  e a servir catálogo e vitrine para o seletor do editor.
- **`lib/rotas-editaveis.ts`** com as tabelas `SO_CHROME` e `CONTAINERS_POR_ROTA`: rota nova entra
  na tabela, senão o gate acusa.
- **Home, chrome, catálogo e PDP reescritos com primitivos**; ids de seção viram chave de arquivo
  e por isso não se renomeiam. Entraram `bloco-html`, `catalogo` como seção, `oferta-sections`,
  `pdp-view` e `faq-modelo`.
- **Rastreio consolidado numa linha só.** `components/analytics/route-analytics.tsx` saiu; GTM,
  GA4, Meta Pixel, TikTok, Pinterest, page_view por rota e o botão de WhatsApp passam a ser
  decididos pela foundation em `lib/editable/rastreio.tsx`, montado por `<Rastreio />`.
- **Infra do editor**: `frame-ancestors` com `NEXT_PUBLIC_EDITOR_ORIGIN` (variável de BUILD),
  `/api/revalidate` aceitando o token do editor, e o middleware deixando passar `/api/unbox/*`.
- **Gate novo, `npm run unbox:editavel`**: mede, em TODA página que a loja declara, quanto do que
  aparece na tela o lojista consegue editar. Lista o que ficou de fora dizendo em que página, e
  separa as rotas que são só cabeçalho e rodapé por regra (texto legal, rótulo de formulário,
  mecânica de compra) para não reprovar para sempre o que é assim por desenho. Mantém a saída 2
  para "não rodou".

Variáveis novas: `EDITOR_URL`, `NEXT_PUBLIC_EDITOR_ORIGIN`, `UNBOX_EDITOR_SHOP`. Sem `EDITOR_URL`
a camada editável fica desligada e a loja renderiza só o que está no código.

Arquivo: `CLI - Unbox v0.20.0.zip`.

### v0.19.0 — a loja gerada voltava a não compilar: corrigido

Regressão introduzida na v0.18.0 e presente também na 0.18.1 e na 0.18.2.

A função `idValido()` (a que recusa placeholder em ID de analytics) tinha sido escrita **dentro do
bloco `UNBOX-FONTS`** do `app/layout.tsx`. Esse bloco é reescrito pelo `create-unbox-store` com o
par tipográfico do preset, então tudo que estava lá dentro sumia na loja gerada: o arquivo nascia
com **três chamadas** de uma função que não existia mais, e o `tsc` quebrava na primeira delas.

Medido agora, para não ficar em suposição: loja gerada com a 0.18.2 tem 0 definições de
`idValido` e 3 usos. Loja gerada com a 0.20.1 passa em `typecheck` e `build`.

A recusa de ID placeholder que a 0.18.0 tinha introduzido não se perdeu no caminho: na 0.20 ela
mora em `lib/editable/document.ts`, com régua por provedor e motivo legível ("isso parece um
exemplo, não um ID de verdade"). Conferido rodando: `x` e `G-XXXXXXX` são recusados, `G-ABC1234567`
e um Pixel de 15 dígitos passam.

**Quem gerou loja com 0.18.0, 0.18.1 ou 0.18.2 precisa regerar** ou mover a função para fora dos
marcadores. A verificação da época não pegou porque o template cru era sincronizado por cima do
scaffold antes de testar, o que restaurava a função e escondia justamente o efeito do CLI.

Arquivo: `CLI - Unbox v0.19.0.zip`.

### v0.18.2 — gate de placeholder, rodando no HTML servido

O item 3 do documento da esteira. `npm run unbox:placeholder` varre o **HTML que o servidor
entrega**, não o código-fonte, porque a varredura de fonte erra dos dois lados: acusa `TODO` em
comentário de componente que nem está na receita, e não encontra o texto que vaza sem existir como
string, como um logotipo com o nome errado dentro de um arquivo.

**Achou defeito no primeiro uso, numa loja real.** Rodado contra a Oddie Supply servindo local:
`[NOME DA LOJA]` e `[CNPJ]` em `/termos` e `/privacidade`, as duas com `robots: index, follow`.
É o mesmo caso que o documento relata da Punch, e estava lá, indexável.

**E achou um defeito no próprio gate, também no primeiro uso.** A primeira versão usava
`localhost:3000` como padrão e mediu **outro projeto** que estava de pé naquela porta: teria
aprovado a loja errada com a mesma confiança. Agora, sem base explícita, ele sobe o próprio
servidor a partir do `.next` e mede a si mesmo; a base medida aparece na primeira linha do
relatório; e os arquivos de marca varridos são sempre os do projeto local, o que está dito quando
a base é externa.

Varre 10 rotas fixas (home, catálogo, busca, carrinho, checkout, as três legais, login, llms.txt)
mais uma PDP e uma categoria descobertas no `sitemap.xml`, e os SVGs de `public/brand`. Reprova
com `[NOME DA LOJA]`, `[CNPJ]`, colchete em caixa alta, `TODO:`, "preencher este arquivo", lorem
ipsum, "Minha Loja", "sua marca" e depoimento "Cliente A/B/C". Mantém o código de saída **2 para
"não rodou"** (sem build, base que não respondeu, nenhuma rota respondida).

**Não está no `prebuild`, de propósito:** scaffold recém-criado reprova, porque as páginas legais
nascem com os colchetes para o lojista preencher. É gate de publicação, não de build, e entrou no
`QA.md` nessa posição. Imagem raster não é varrida por texto, e o script avisa quando existe
alguma: logotipo errado dentro de um PNG só aparece olhando.

Arquivo: `CLI - Unbox v0.18.2.zip`.

### v0.18.1 — hex fora de token: de 20 para 2, e a ferramenta de contraste entra

Primeira rodada em cima do que os medidores da v0.18.0 acusaram, no eixo que dava para atacar
inteiro.

**Hex fora de token na foundation: 20 → 2.** Nenhuma cor nova foi escolhida: cada hex solto virou
o token que já existia com aquele papel (`#B45309` era literalmente o valor de `--store-cta-dark`,
`#FAFAFA` era o `--store-bg`). Dois achados no caminho: o bege `#EFE4C8` e o verde `#DCEADF` eram
**resíduo da paleta antiga** que a varredura da v0.14.1 não pegou porque viviam dentro de
`border-[#...]` no className, e o mesmo valia para quatro cores de selo em `lib/catalog-map.ts`.
Os 2 que restam são o `app/opengraph-image.tsx`, onde o hex é obrigatório: o satori não lê
variável de CSS. Está declarado no comentário do arquivo.

**Bug encontrado por causa disso:** o CLI reescrevia a cor do `manifest.ts` mas **não** a do
`opengraph-image.tsx`, apesar do comentário dizer que sim. Toda loja compartilhava no WhatsApp com
o tom default da foundation, mesmo depois do briefing aplicar a paleta. Agora as duas recebem a
cor da marca no scaffold.

**`scripts/contraste.js`**, para colar no console: `contraste()` varre o texto visível e lista o
que reprova; `classificar("HEX")` diz se a cor pode receber texto (superfície) ou só serve para
contorno e ícone (acento). Os três erros que a ferramenta cometeu em produção estão tratados e
comentados no ponto onde importam, e **um deles foi medido aqui e estava descrito ao contrário**:
o ImageData do canvas 2D é NÃO pré-multiplicado, então "desfazer a pré-multiplicação" dividindo
por alpha é o erro — numa cor fora do sRGB isso estourava a faixa (um `oklch` deu R=404). Validada
contra o caso conhecido: a cereja `F20A64` dá 4,22 contra tinta e 4,20 contra branco, e sai
classificada como acento.

**Composição da home:** sem teto de seções. Entrou uma recomendação em `agents/PADROES.md`, com a
pergunta que importa (*o que esta seção faz que a anterior não fez?*) e os sinais de que sobrou
seção. A receita default tem 16 porque é biblioteca, não recomendação.

**O header passa a ser escolha da marca**, não do preset: tabela em `PADROES.md` ligando o tipo de
marca ao header que costuma servir, e o briefing passa a cobrar a decisão. O header aparece em
toda página e é o que mais faz uma loja parecer com a outra.

Arquivo: `CLI - Unbox v0.18.1.zip`.

### v0.18.0 — medidores de sistema visual entram, em modo relatório

Dois medidores vindos da esteira do `bap-taste`, destilados de ~1.500 ajustes em 7 marcas geradas
por este CLI: `scripts/sistema.py` conta o que faz uma loja ter "cara de template" (tamanhos de
tipo, raios, hex fora de token, larguras de container) e `scripts/vocabulario.py` mede se o
vocabulário gráfico da marca foi distribuído ou vive numa seção só.

**Entram como relatório, não como gate**, e a medição explica por quê. Rodados contra cinco lojas
geradas e contra um scaffold recém-criado:

| | tipos | raios | hex | containers |
|---|---:|---:|---:|---:|
| foundation (scaffold novo) | 55 | 16 | 20 | 2 |
| Moderação | 49 | 15 | 22 | 2 |
| Oddie Supply | 84 | 29 | 51 | 4 |
| Zé Tona | 84 | 24 | 18 | 5 |
| noway | 88 | 23 | 56 | 4 |
| Mata Sede | 116 | 41 | 135 | 4 |
| *teto que veio no script* | *8* | *5* | *0* | *1* |

**A foundation já estoura todos os tetos antes de qualquer briefing.** Ligar como gate hoje
reprovaria o build de um projeto que ninguém tocou, então a régua fica para depois. O relatório
roda no `prebuild`, imprime e sai 0, e serve para duas coisas: acumular distribuição para escolher
os tetos, e mostrar ao agente de branding o custo do que ele acrescenta enquanto trabalha.

Os medidores preservam o código de saída **2 para "não rodou"** (caminho errado, zero arquivo
varrido, nenhum vocabulário encontrado), e o wrapper imprime isso em destaque: medidor que varre o
vazio e diz "limpo" aprova sem ter olhado. Sem `python3` na máquina, são pulados com aviso, nunca
derrubam build.

Comandos: `npm run unbox:medir` (os dois), `unbox:sistema` e `unbox:vocabulario` (separados).

Arquivo: `CLI - Unbox v0.18.0.zip`.

### v0.17.2 — a barra de navegação inferior sai da foundation

A tab bar flutuante do mobile (Início · Categorias · Ofertas · Conta) vinha montada em toda loja
gerada, então toda loja nascia com a mesma assinatura visual na primeira tela do celular. É
exatamente o tipo de elemento que deveria ser decisão da marca, não default do template.

Saiu inteira: o componente, a montagem no layout da loja e os 84px de `padding-bottom` que o
`<body>` reservava para ela no mobile (sem tirar os dois últimos, a loja ficaria com uma faixa
vazia no fim de toda página). Os dois documentos do agente de layout que a citavam foram
corrigidos junto.

Um dos itens dela também não se sustentava: "Ofertas" apontava para `/produtos`, igual a
"Categorias", e nunca marcava estado ativo.

Verificado em 375px: nenhum `nav` remanescente, `padding-bottom` do body zerado, rodapé encostando
no fim da tela sem faixa sobrando e sem rolagem horizontal.

Arquivo: `CLI - Unbox v0.17.2.zip`.

### v0.17.1 — o /llms.txt passa a ser gerado do catálogo real

Na v0.17.0 o arquivo deixou de ir ao ar com `TODO`, mas continuava estático em `public/`: o nome
da loja era substituído no scaffold e o resto era texto fixo. Arquivo estático nasce
desatualizado no dia em que um produto sai de linha, e é o mesmo problema que fez a versão
anterior publicar placeholder para os crawlers.

Agora é **rota** (`app/llms.txt/route.ts`), montada da mesma fonte que desenha a vitrine:

- **produtos com nome, link, preço e "esgotado"** vindos do mapeamento do catálogo, então o
  esgotado do painel aparece aqui sozinho, sem ninguém manter uma segunda lista;
- **categorias reais** do painel, com link;
- páginas e políticas, sempre em lista de links markdown (arquivo sem link reprova na auditoria
  Agent Accessibility do PageSpeed);
- Pix com desconto e frete grátis **só quando configurados** em `lib/store-config.ts`;
- teto de 60 produtos, com link para o catálogo completo depois disso;
- cache de 1 h com `stale-while-revalidate`, e falha de API não derruba o arquivo: sem catálogo
  ele sai com as rotas e as políticas, que continuam verdadeiras.

A formatação mora em `lib/llms-txt.ts` como função pura (dado → texto), o que a deixa testável sem
subir servidor nem bater na API. Testado com catálogo cheio (preço, esgotado, limite) e vazio.

**O gate de marca protege os dois lados:** reprova se a rota sumir e reprova se alguém criar
`public/llms.txt`, porque arquivo estático tem precedência sobre rota de mesmo caminho e deixaria
a rota morta sem ninguém perceber. Testado com o arquivo plantado.

Arquivo: `CLI - Unbox v0.17.1.zip`.

### v0.17.0 — rodada 3 do case Oddie: PageSpeed, AEO, imagem e rastreamento

Terceiro relatório da mesma loja, agora de um dia inteiro em PageSpeed, SEO/AEO, acessibilidade e
tracking. Oito dos onze itens eram do template. Dois não se aplicavam (a foundation já emitia
`Organization`/`WebSite`/`Product`, e não tem `role` sobrescrevendo semântica de lista) e um é
metodológico.

**A loja rodou 31 dias sem rastreamento nenhum, parecendo que tinha.** `NEXT_PUBLIC_GA_ID` estava
com o placeholder `"x"`. O template renderiza o script quando a variável é truthy, e `"x"` é
truthy: os scripts carregavam, inicializavam com lixo, não reportavam para conta nenhuma e ainda
custavam ~106 KB. O painel mostrava a variável preenchida e o DevTools mostrava o Pixel carregado.
Agora todo ID passa por `idValido()`, que exige o formato (`G-`/`AW-`/`UA-`, `GTM-`, pixel
numérico) e recusa `x`, `todo`, `seu-id`, `G-XXXX`. Testado com os casos do relatório.

**Suporte a GTM próprio da loja** (`NEXT_PUBLIC_GTM_ID`), que é o que marca com agência usa. Com
ele preenchido, **o Pixel do código é desligado**: nos dois lugares, `PageView` conta em dobro e a
inflação é silenciosa. O container da marca convive com o central da Unbox. O README explica o que
dizer a quem configura o container: numa SPA o gatilho "All Pages" só pega o load inicial, e a tag
de pageview precisa escutar o `dataLayerReady` que a loja emite em toda rota (ou o History Change
nativo). Não empurramos um `page_view` manual: medido no container central, ele não tem gatilho
para esse evento, e o push arriscaria contagem dupla em quem usa History Change.

**Imagem: o `<Foto>` entra, e sabe quando não otimizar.** As fotos de seção (cards sociais, mídia,
estatística, benefícios, história, citação, vitrine e a imagem de LCP do hero de compra) passam
pelo otimizador com o `sizes` do tamanho REAL de exibição. O componente cai em `<img>` quando o
`src` da receita aponta para um host que o `next.config.ts` não autoriza: `next/image` direto
LANÇA nesse caso e derruba a página inteira, e foto fora do host esperado não pode tirar a home do
ar. Logo do chrome, bandeira de pagamento e o hero em `<picture>` continuam `<img>` cru **com o
motivo escrito ao lado de cada `eslint-disable`** — sem o motivo, o próximo "conserta" o lint e
regride (o logo em header sticky perde o preload scanner e o lettering fino no reencode).

**`<img>` abaixo da dobra nasce `loading="lazy"`.** O React 19 emite `<link rel="preload">` sozinho
para `<img>` eager renderizado no servidor: as cinco bandeiras do RODAPÉ estavam disputando
conexão com a primeira dobra. Não é sobre bytes, é sobre prioridade de rede.

**Art direction do hero:** cada `<source>` ganhou a SUA dimensão e o SEU `sizes`. Sem dimensão, o
navegador reserva a proporção do `<img>` (desktop) e a página pula quando a arte mobile chega
(CLS de 0,525 no caso medido). Sem `sizes` no source que casou, a arte chega numa variante pequena
e borrada.

**`/brand` e `/unbox` com `Cache-Control` de 30 dias**, e **sem `immutable`** de propósito: são
arquivos trocados à mão, mantendo o nome. Com `immutable`, trocar uma foto deixaria a antiga presa
no navegador de quem já visitou.

**`llms.txt` não vai mais ao ar com `TODO`.** Ele estava público, HTTP 200, servindo
"`# [NOME DA LOJA]` / TODO: preencher" para os crawlers que o `robots.txt` convida. Agora nasce
com o nome real da loja (o CLI substitui) e **em listas de links markdown**, como pede a
especificação: sem link nenhum, a auditoria Agent Accessibility do PageSpeed reprova. Só afirma o
que é verdade sem briefing: as rotas que existem, as políticas e as formas de pagamento.

**Dado estruturado:** entrou `FAQPage` na PDP, montado a partir da MESMA lista que o accordion
renderiza (some da tela, some do schema). E toda serialização passa por `ldJson()`, que escapa
`<`: uma string de catálogo com `</script>` fecharia a tag e derrubaria o resto da página.

**A description nasce vazia.** "Produtos de qualidade entregues na sua casa" parece preenchido e
ninguém revisa, que é a mesma doença do `"x"` no GA_ID. Vazio, o build avisa e o Google gera a
partir do conteúdo. `NEXT_PUBLIC_SITE_DESCRIPTION` existe para o briefing preencher.

Arquivo: `CLI - Unbox v0.17.0.zip`.

### v0.16.6 — o endereço do pedido volta, com repetição segura em vez de aposta

Fui olhar como o front nativo da Unbox trata a união `OrderFulfillmentGroupData` (o que eu devia
ter feito antes de escrever o report do backend) e a resposta mudou o diagnóstico.

**Medido** em `vivabhava.com.br` e `sunrize.com.br` (mesmo `buildId`, mesmo app multi-tenant, é o
front nativo): a página de pedido da conta lê `fulfillmentGroups[0].data.shippingAddress` e mostra
o endereço normalmente. **A união resolve no contexto do cliente logado.** O erro que derrubou a
página em produção foi em `orderByReferenceId`, a consulta por referência (visitante e API de
parceiros), não em `customerOrderByReferenceId`.

Ou seja, a v0.16.5 tirou o endereço de "Meus pedidos" por precaução, num caminho onde ele
provavelmente funcionava. Corrigido sem trocar uma aposta por outra: as quatro consultas de
pedido passam pelo `comEnderecoDoGrupo`, que **pede o endereço e repete a consulta sem ele apenas
quando o servidor responde que não conseguiu resolver o tipo**. Assim:

- o endereço aparece onde a API entrega, sem esperar release do backend;
- a página do pedido nunca deixa de abrir, mesmo onde a união falha;
- quando o resolvedor for corrigido, o endereço volta sozinho, sem nova versão do CLI;
- qualquer outro erro continua propagando (não vira repetição silenciosa) e a repetição deixa
  aviso no log do servidor.

Testado com servidor falso nos três cenários: união quebrada (duas tentativas, devolve sem
endereço), união funcionando (uma tentativa, com endereço) e erro não relacionado (propaga).

O report para o backend foi reescrito com a pergunta certa: não é "implementem o `__resolveType`",
é **por que a mesma união resolve em `customerOrderByReferenceId` e falha em `orderByReferenceId`**.

Arquivo: `CLI - Unbox v0.16.6.zip`.

### v0.16.5 — a mesma união quebrava "Meus pedidos" do cliente logado

Correção do que eu deixei passar na v0.16.4. Ao conferir se os defeitos da página de pedido eram
exclusivos do checkout customizável (não são), apareceu que a união `OrderFulfillmentGroupData`
era selecionada em **mais dois lugares**: as consultas do cliente logado em `lib/unbox/customer.ts`
(`orders()` e `order()`), que alimentam a lista e o detalhe de "Meus pedidos". Na v0.16.4 eu tinha
corrigido só o `client.ts`, então quem entrava na conta continuava com a consulta morrendo
inteira. As quatro seleções da união estão fora agora, e a varredura
(`grep ShippingOrderFulfillmentGroupData`) volta limpa.

**Sobre o alcance destes defeitos:** o modo de checkout não muda nada. O CLI remove só
`app/(loja)/checkout`, `components/checkout` e `app/api/checkout` no modo hospedado; a página de
acompanhamento (`/pedido/[referenceId]`), a área de conta, a rota de status do pedido, o
rastreamento e o webhook que dispara o `Purchase` para a Meta continuam no projeto e usam as
mesmas consultas. Loja com checkout hospedado tinha a mesma página quebrada e o mesmo evento de
compra perdido.

Arquivo: `CLI - Unbox v0.16.5.zip`.

### v0.16.4 — rodada 2 do case Oddie: o backend dizia o que estava errado e o front jogava fora

Oito itens de uma loja em produção entre 21/08 e 01/09, sete deles em código compartilhado do
template. Seis têm a mesma forma: **a Unbox informou a causa e o front descartou a informação.**

**A página do pedido não abria, e culpava o cliente.** Quem acabava de pagar via "entre na sua
conta para ver este pedido". Não era permissão: a consulta pedia `imageURLs` sem subcampos e a
Unbox recusava a consulta inteira (`imageURLs` é um objeto de tamanhos, não uma lista, e a
normalização logo abaixo também tratava como lista). Corrigido nos dois lugares. O agravante era o
catch mudo, que já tinha saído na v0.16.0 com o `mockupOr`.

**`fulfillmentGroups.data` saiu da seleção.** A união `OrderFulfillmentGroupData` não resolve o
tipo concreto em runtime e derruba a consulta inteira, não só o campo: um campo opcional impedia o
cliente de ver o pedido pago. A página perde o endereço e mantém o resto (a formatação já tratava
ausência), com a linha comentada na consulta para devolver quando o backend implementar o
`__resolveType`. **Este é o único item sem correção possível no front.**

**`failFrom` passou a registrar todo erro, não só os 5xx.** Em uma semana, três erros chegaram ao
cliente como "Algo deu errado" sem deixar rastro no painel, e os três eram 4xx: o DDD do telefone
num pagamento, o código do login e a consulta do pedido. O log cobre as ~28 rotas de uma vez e
registra só o código e os erros do GraphQL, nunca o corpo da requisição.

**O campo do endereço que a Unbox recusou agora aparece na mensagem.** `invalidAddressFields`
chegava e era descartado; a pessoa lia o genérico, não sabia o que corrigir e desistia. Agora lê
"Confira o campo telefone e tente de novo", com os nomes técnicos traduzidos para os nomes que
aparecem no formulário.

**O DDD é validado.** O schema conferia só o comprimento (10 a 11 dígitos), e a Unbox recusa o
pedido por DDD inexistente. O zero à esquerda passou a ser removido antes de validar, porque é o
que a pessoa quis dizer ("011 99360-3233" vira 11993603233, "019 8765-4321" vira DDD 19), e o DDD
é conferido contra a lista da Anatel. Testado com as duas formas do relatório e com DDDs falsos.

**O erro do login por código deixou de cair no genérico.** O login sem senha responde em formato
OAuth (`invalid_grant`, `error_description`), que não casa com nenhum código do dicionário. Quem
digitava um código expirado lia "Algo deu errado", redigitava o mesmo código e desistia. Entrou um
dicionário separado para esse formato.

**Assinatura não nasce mais sem frequência.** A frequência só era guardada se o cliente a
mandasse, e as três telas que adicionam ao carrinho decidem `isRecurring` e a frequência em
expressões separadas: bastava uma sair sem a outra para o checkout mostrar "Frequência: Não
selecionada" em vermelho, com o preço já descontado. Agora o servidor completa a partir da
política da loja. Quando dois campos só fazem sentido juntos, quem garante o par é o servidor.

**Escolher o frete não pisca mais a lista.** Um estado só servia para cotar e para salvar a
escolha; cotar precisa esconder a lista, escolher não. Separado: a opção marca na hora e o aviso
de atualização foi para o rótulo da seção.

**Checkout hospedado, o que faltava na documentação** (`.env.example`, `DEPLOY.md` e README):
a variável quer o **caminho completo**, não o domínio (a raiz é a home e ignora os parâmetros em
silêncio), e **loja e checkout precisam estar no mesmo domínio**, senão o cliente cai no `/login`.
E um gate novo reprova `/checkout` literal fora do `checkout-nav`: com o destino hospedado
configurado, uma tela que navega no braço manda metade dos botões para o lugar errado.

Arquivo: `CLI - Unbox v0.16.4.zip`.

### v0.16.3 — travessão: a regra virou gate, e o exemplo parou de contradizer a regra

"Nada de travessão na copy" existia desde a v0.14, em um lugar só: o prompt do briefing. E não se
sustentava, porque a foundation entregava travessão em título de aba, política de privacidade,
termos, catálogo, carrinho, endereço da conta e tela de login, e o wizard do CLI perguntava com
travessão. Instrução perde para exemplo, toda vez.

**A copy da loja foi limpa** (13 ocorrências). O separador da casa passa a ser `·`, que já era
usado em outros selos: título de aba, linha de endereço na conta e no livro de endereços. O resto
virou vírgula, dois-pontos ou ponto. O `—` sozinho como marcador de valor vazio numa tabela
(`?? "—"`) continua: é uso tipográfico, não prosa.

**O texto que o CLI imprime foi limpo** (14 ocorrências): as perguntas do wizard, o aviso do
checkout customizável, o `--help` e as mensagens de conclusão, mais os cabeçalhos que o CLI
escreve dentro do projeto gerado (`home-recipe.ts`, `chrome-recipe.ts`, marcadores de fonte).

**Dois gates, um de cada lado.** O de marca (prebuild) reprova travessão na copy de `app/` e
`components/`; o de neutralidade (prepack) reprova no texto que o wizard imprime. Os dois usam o
mesmo scanner, que separa comentário de copy sem se enganar com `//` dentro de string (URL) nem
com aspas dentro de comentário. Testados com travessão plantado nos dois lados: reprovam, e
ignoram o comentário, como projetado.

**Os documentos que o agente lê como exemplo de estilo foram limpos**: `CLAUDE.md`,
`CONSTRUCAO.md`, `PADROES.md`, `MANAGER.md` e o prompt do briefing (104 ocorrências). Sobra uma,
de propósito: a linha da regra, que precisa mostrar qual é o caractere.

**O que NÃO foi varrido, e por quê:** 309 linhas de comentário no código do template e ~293 linhas
nos docs dos agentes opcionais (13-cro, 14-seo, 12-deploy e afins). São notas de engenharia, não
copy, e reescrevê-las em massa arrisca a clareza técnica sem melhorar o que o cliente lê. O texto
que sai para o lojista e para o comprador está coberto por gate; se quiser a varredura completa
depois, é mecânica.

Arquivo: `CLI - Unbox v0.16.3.zip`.

### v0.16.2 — restrição da plataforma se descreve, não se julga

Um agente explicou ao lojista que a frequência de assinatura era "pior do que parece", "limitação
da plataforma" que "não dá pra resolver no front" — e levou esse enquadramento para a interface da
loja. O cliente comprou a Unbox e recebe tudo isso: a conversa, o código-fonte e a tela.

A regra nova, em `CLAUDE.md` ("Como falar da plataforma"), no `CONSTRUCAO.md` e no prompt do
briefing: **diga a regra, o efeito na loja e a decisão; sem juízo de valor.** Não é eufemismo — o
fato inteiro continua dito, o julgamento é que sai. E o comprador nunca lê explicação de
plataforma: ele lê a regra da loja. O caso que originou a regra está lá como exemplo, nas quatro
versões (certa e errada, para o lojista e para o comprador).

**O gate de marca passou a reprovar o julgamento** em qualquer arquivo do projeto: "limitação da
plataforma", "pior do que parece", "não dá pra resolver", "infelizmente", "a Unbox não
deixa/aceita/suporta", "culpa/problema/falha da Unbox", "por limitação do sistema". Testado com as
quatro frases do caso real: reprova as quatro, e o template segue verde.

**Os comentários do código foram para o mesmo padrão.** "A Unbox NÃO tem recuperação de carrinho
nativa" virou "a recuperação de carrinho fica com o storefront"; "o servidor da Unbox IGNORA o
preço" virou "o preço final é sempre o do catálogo, o servidor recalcula a partir dele"; "a Unbox
não reclama" virou "o pedido é aceito e registrado como compra avulsa, sem erro". Mesma informação
técnica, sem o veredito — e comentário ensina o agente a escrever igual, que foi como isso começou.

**A frequência ganhou a copy neutra que faltava.** Onde o comprador escolhe entre mais de uma
frequência (PDP e página de oferta), a loja agora diz: "a frequência vale para todos os itens
assinados deste pedido". É a regra do pedido, dita antes da escolha, sem mencionar sistema nenhum.

Arquivo: `CLI - Unbox v0.16.2.zip`.

### v0.16.1 — o tipo de página que o GTM central lê, em todas as rotas

Segunda leitura do relatório da loja Uncle Jay, agora com o item de tracking (§4: "o pageview de
entrada nunca é disparado"). O resto do relatório já tinha saído nas 0.15.3, 0.15.6 e 0.16.0.

**Medi o container central antes de mexer, e a medição corrigiu o diagnóstico.** Baixei o JS do
`GTM-PZLT336` e enumerei os gatilhos de evento dele: `gtm.js`, `gtm.historyChange(-v2)`,
`gtm.click`, `dataLayerReady` e os de ecommerce. **Não existe gatilho de custom event
`page_view`** — empurrar `page_view` no dataLayer não acionaria nada lá. Depois rodei a loja
gerada, sem `NEXT_PUBLIC_GA_ID` e sem Pixel:

- **O pageview de ENTRADA é contado**, ao contrário do que o relatório supõe: o hit
  `en=page_view` sai para o `G-RVTH4D73PL` no carregamento, disparado pela tag GA4 do próprio
  container no gatilho All Pages.
- **A navegação SPA é que não vira pageview**: quatro `gtm.historyChange` no dataLayer e o
  contador de hits parado em 1. Isso é configuração do container (falta uma tag GA4 no gatilho
  History Change) e só a Unbox pode resolver — está fora do que o CLI controla.
- **O buraco que era nosso:** `dataLayerReady`, o único gatilho de tipo de página que o container
  tem, só era emitido em PDP, carrinho, checkout e confirmação. Home, catálogo, categoria e busca
  não emitiam nada — exatamente onde cai o tráfego de campanha. Agora as quatro emitem, com
  `pageType`, `ecomm_pagetype` e os `ecomm_prodid` da vitrine; e como o evento é remontado a cada
  rota, o container passa a receber sinal em toda navegação. Verificado no navegador: `home` no
  load e `category` depois do clique.

O gate de marca ganhou a checagem: página principal que parar de emitir `dataLayerReady` derruba
o build. E o comentário do `route-analytics.tsx` agora carrega a medição, para a decisão de não
empurrar `page_view` não ser reaberta uma terceira vez.

Arquivo: `CLI - Unbox v0.16.1.zip`.

### v0.16.0 — revisão completa por seis agentes: segurança, dinheiro, produção, SEO, CLI e docs

Seis revisores independentes (segurança, produção/ISR, checkout e dinheiro, SEO/a11y/perf, o
próprio CLI, e agentes/docs) leram a foundation inteira. Cada achado foi confirmado no código
antes de entrar aqui. Nenhum foi corrigido "por precaução": o que está abaixo tinha caminho real
até uma loja em produção.

**Segurança**
- **Qualquer pessoa abria qualquer pedido pelo `referenceId`.** A página do pedido só testava se
  o cookie de posse EXISTIA (o valor não era conferido) e, no modo parceiro, a Unbox nem recebe o
  token. Um `referenceId` curto + um cookie com qualquer conteúdo entregava e-mail, endereço,
  itens e bandeira do cartão. Agora o cookie carrega `token.HMAC(SESSION_SECRET)` e é verificado
  com comparação em tempo constante; o CLI gera `SESSION_SECRET` e `REVALIDATE_SECRET` no
  `.env.local`, e o boot em produção avisa se faltarem.
- `/api/payment-link` aceitava qualquer chamada quando `REVALIDATE_SECRET` estava vazio (era
  fail-open). Agora sem segredo = 401.
- O `env-check` imprimia o VALOR das variáveis malformadas no log de build. Só a chave agora.

**Dinheiro**
- **Timeout de 15 s no `placeOrder` + botão "Pagar" reaberto = cobrança dupla.** Abortar no
  cliente não aborta no servidor: o pedido nascia depois que a loja desistiu e a tela convidava a
  pagar de novo. `placeOrder` tem timeout próprio (90 s) e erro próprio (`PLACE_ORDER_TIMEOUT`,
  504); com ele o checkout trava o botão e manda conferir em Meus pedidos.
- Kits e combos anunciavam "de R$ X por R$ Y" com um desconto calculado no front que o servidor
  ignora (o carrinho cobra o preço do catálogo). O preço do kit é o do catálogo; risco e "-N%" só
  aparecem quando há economia real.
- Assinatura prometia "-10%" inventado quando a política de preço não dizia nada. Sem política,
  sem desconto e sem selo.
- Copia-e-cola do Pix morria no reload (nunca era gravado; a página `/checkout/pix/[ref]` lia um
  `sessionStorage` que ninguém escrevia). Agora é persistido; o total exibido é o do pedido
  criado, não uma estimativa local; e quem expira o Pix é a Unbox, não um timer de 1 h no navegador.
- Cotação de frete mandava `address1: "—"` (1 caractere) pra um schema que exige 2. Parcelas sem
  resposta da API viravam uma tabela inventada "sem juros": agora só "à vista".
- Erro de autenticação (`UNAUTHENTICATED`/`ACCESS_DENIED`) apagava o carrinho como se tivesse
  expirado. Só `NOT_FOUND`/`INVALID_*`/`CART_EXPIRED` apagam.

**Produção**
- **`.catch(() => [])` em toda página tratava "Unbox fora do ar" igual a "sem credenciais".**
  Com credenciais, uma oscilação produzia home e catálogo VAZIOS com HTTP 200 que o ISR cacheava
  por 5 minutos no lugar da versão boa; nos layouts de produto e categoria virava um 404
  CACHEADO na rota mais indexada da loja. Novo `mockupOr()`: sem credenciais devolve o fallback
  (modo mockup); com credenciais loga e relança, e o ISR mantém a página anterior.

**SEO** (dois itens eram regressões da v0.15.6)
- `canonical: "/"` no layout raiz era herdado por catálogo, categorias e páginas legais: todas
  declaravam a home como canônica e saíam do índice. Canonical agora é por página; a PDP usa o
  caminho próprio (o `publishedUrl` do painel pode ser outro domínio).
- `/brand/coll/ofertas.png` não existia: imagem quebrada em todo catálogo.
- `NEXT_PUBLIC_SITE_URL` em localhost passava em produção (sitemap, OG, JSON-LD e link de
  recuperação apontando pra localhost). O boot em produção agora reclama.
- h1: o título do hero é o h1 da home; `/oferta` e checkout ganharam h1; sem hero na receita, um
  h1 invisível com o nome da loja.

**CLI**
- **Checkout hospedado com domínio em branco apagava o checkout do projeto** e a loja ficava sem
  nenhum (404 no "finalizar"). O domínio é validado; inválido ou vazio, o checkout customizável
  fica e o CLI avisa.
- **`.env.local` sem aspas**: senha com `#` era truncada, `$X` era expandido e sumia, e o signIn
  falhava sem pista. Medido com o `@next/env` real: aspas simples NÃO impedem a expansão de `$1`
  e aspas duplas não desfazem `\"`. O único formato que devolveu 9 de 9 valores adversos intactos
  é crase com `$` escapado (`` UNBOX_PASS=`#senha\$1 "x"` ``), e é assim que o CLI grava agora.
- `.mcp.json` era montado por `replace` de string: token com `$&` corrompia o arquivo. Agora é
  JSON de verdade. Nome de loja com `$&` ou aspas também corrompia os TSX: substituição por função.
- Ctrl+C no meio das perguntas gerava um projeto com defaults ("undefined"). Agora cancela.
- `UNBOX_CAPTCHA_BYPASS` é perguntado quando a key de parceiro é informada (sem ele o cliente vê
  `CAPTCHA_MALFORMED_ERROR` no pagamento). Link de recuperação e de compartilhamento do carrinho
  respeitam o checkout hospedado. `engines.node >= 20.11`.

**Foundation: o que restava com default plausível**
- `purchase-hero` pintava 5 estrelas sem avaliação e prometia "envio com rastreio"; `trust-bar`
  dizia "Entrega rápida para todo o Brasil" e "Satisfação garantida"; `spec-table` afirmava
  "Origem: Brasil"; `founder-story` trazia uma história inventada assinada "Time da loja";
  `comparison`, `attributes-marquee` e `video-wall` (molduras sem vídeo) tinham conteúdo default;
  reviews pintavam 5 estrelas ignorando a nota. Tudo isso agora vem SÓ da receita e some sem dado.
  O `unbox:honestidade` ganhou 7 padrões (contador de compras, "frete grátis acima de R$N",
  "entrega rápida", "satisfação garantida", prazo de troca diferente do CDC).

**Docs dos agentes**
- O módulo CRO mandava fabricar "47 pessoas compraram nas últimas 24h" com "valor mockup" e usar
  um `productStock` que não existe; o módulo SEO colocava "Frete grátis acima de R$149" e "Entrega
  rápida" em meta description, chamava `getUnboxClient()` (não existe) e mandava criar um
  Organization schema que a foundation já emite. Corrigidos, junto com MANAGER/CONSTRUCAO
  (mandavam neutralizar prova social que já não existe), 12-deploy (faltavam as envs do modelo
  recomendado), README (apontava pra arquivos que o CLAUDE.md proíbe editar), o orçamento do QA
  visual (agora bate com o script; `QA_PDP=/produto/<slug>` captura a PDP) e a abertura do
  briefing (lê o `briefing.json` antes de perguntar o nome).

**O que a revisão apontou e NÃO entrou nesta versão (decisão consciente)**
- Lock de checkout, dedupe de webhook e rate limit vivem em memória do processo: em serverless
  cada instância tem a sua. Resolver exige um KV (Redis/Upstash) e é decisão de infraestrutura por
  loja; está documentado como limitação, não escondido.
- Paginação do catálogo é no cliente (`PAGE = 12` sobre 100 itens) e os filtros são `<label
  onClick>`: funcional, mas não é a11y ideal nem escala pra catálogos grandes. Fica pro roadmap.
- Presets ainda listam `video-wall` e `newsletter` na receita; as duas seções agora não renderizam
  sem dado, então o efeito é nulo, mas a limpeza das receitas é da próxima rodada.

Arquivo: `CLI - Unbox v0.16.0.zip`.

### v0.15.6 — dado que a loja não tem, o bloco não renderiza

Relatório de uma loja gerada pelo CLI e levada a produção (Uncle Jay). A maior parte dos itens
tinha a mesma raiz: **a foundation preenchia vazio com conteúdo plausível**, e o lojista não tinha
como saber o que era dele e o que era do template. Parte disso foi ao ar como fato — e parte é
violação de política do Google, de norma da ANVISA ou do CDC. Vários itens do relatório já tinham
saído nas versões 0.15.1 a 0.15.3 (JSON-LD condicional, "Sem glúten" default, modo de uso de
tempero, FAQ inventado, zoom bloqueado). O que restava:

**Afirmações falsas, removidas — sem default, o bloco some:**
- Nota "4,9 · 25.347 avaliações" e estrelas fixas na buy box, no card de avaliações e no catálogo.
  Agora só com avaliação real do enriquecimento; a distribuição por estrela é calculada delas.
- "793 vendidos esta semana": fora.
- **Estoque que descia sozinho** ("Apenas N unidades", um timer que decrementava enquanto a pessoa
  lia a página, sem ler estoque nenhum): fora. Dark pattern.
- Depoimentos "Cliente A/B/C" com selo **"Compra verificada"** no catálogo e nas seções de home:
  fora. As seções de review renderizam só com reviews da receita; "compra verificada" só se o
  review estiver marcado como tal.
- Selo "MAIS VENDIDO" fixo na galeria: fora (o de desconto fica, vem do preço real).
- Selos de confiança: "expressa em 1–2 dias" (inventado) e "devolução em 30 dias" (contradizia a
  página de devoluções, que informa os 7 dias do CDC) viraram "Troca em 7 dias · CDC".
- Card "Qualidade que você sente" com copy genérica, um TODO e um placeholder de imagem de 200px
  que nunca recebia foto: fora.
- FAQ: além das perguntas reais do enriquecimento, entram só as que o template CONSEGUE afirmar
  (o prazo de arrependimento do CDC e a regra de frete grátis, se configurada).

**Incidente de produção — `.env` com comentário na mesma linha do valor.** O `.env.example`
trazia `META_PIXEL_ID=   # opcional: ...`. Ao copiar para a Vercel, o comentário virou valor; o
guard "se tem valor" passou; a Meta rejeitou; cada page view virou 502 (54 falhas em 5 minutos).
Três correções: **comentário sempre em linha própria** (24 linhas reescritas); `lib/env-check.ts`
avisa no boot se algum valor parece prosa; e a CAPI valida **forma**, não presença (pixel numérico,
token sem espaço nem `#`). Vale o mesmo para `UNBOX_WEBHOOK_SECRET`: com lixo, nenhum webhook
legítimo passava, em silêncio.

**Identidade e SEO por padrão:**
- `app/favicon.ico` era o triângulo da Vercel (25 KB, do create-next-app) e vencia o `icon.svg` da
  marca na aba. Apagado.
- `alternates.canonical`, `twitter.card: summary_large_image`, e uma **imagem Open Graph gerada**
  (`app/opengraph-image.tsx`, nome da loja sobre a cor primária): nenhum compartilhamento sai sem
  imagem. A description continua provisória de propósito, e o build avisa até o briefing escrever
  uma frase com o que a loja vende.
- Home com JSON-LD `Organization` + `WebSite` com `SearchAction`.

**Layout com catálogo pequeno:** os três blocos de recomendação fatiavam o mesmo array em
posições fixas (0-3, 3-6, 6-9); com 3 SKUs sobravam dois blocos vazios e um rombo. Agora
distribuem o que existe e só aparecem com ≥2 itens. A grade avaliações/FAQ se adapta ao que
renderiza. O marquee ganhou 4 cópias (abria um vão a partir de ~1400px) com a duração dobrada
para a velocidade não mudar. Rodapé encosta no fim da tela em página curta.

**O gate de honestidade mudou de papel:** num scaffold novo ele sai **verde**. Existe para pegar
o que o briefing ou alguém adicionar depois sem lastro.

**Fora do escopo do CLI:** `store-template.json` (magenta no H1, "Loja Exemplo") e o sticky
footer por `#__next` são da loja nativa da Unbox, não da foundation.

### v0.15.5 — dataLayer: uma camada, um contrato, e o que o GTM central da Unbox lê

Vem de duas fontes: a auditoria do tracking da foundation e o relatório de um cliente (She
Talks) sobre a loja nativa da Unbox, com sete defeitos reproduzíveis. Medi o container central
`GTM-PZLT336` e duas lojas nativas para saber o que ele espera; a foundation agora entrega isso
e evita cada um dos sete.

**O defeito estrutural.** `lib/analytics.ts` priorizava o `gtag` e só usava o dataLayer na
ausência dele. Bastava a loja preencher `NEXT_PUBLIC_GA_ID` para o GTM central ficar cego a
todo o e-commerce. E mesmo sem GA_ID, a compra chegava vazia lá: o container lê a compra em
`ecommerce.purchase.*` (formato Universal Analytics) e a foundation emitia só o GA4 plano.

**O que mudou em `lib/analytics.ts` (reescrito):**
- **dataLayer sempre, em objeto**, com o formato GA4 (`ecommerce.items`, `item_id`) e, na compra,
  também `ecommerce.purchase.*` e `transactionId`/`transactionTotal`, que são o que o container
  central lê. Um push, todos os leitores.
- **`gtag` deixa de ter prioridade**: é chamado em paralelo, só se existir.
- **Os cinco eventos que faltavam**: `view_item_list` e `select_item` no catálogo,
  `remove_from_cart`, `view_cart` (mini-carrinho e página) e `add_shipping_info` no checkout.
  Dez de dez.
- **`dataLayerReady { pageType, products[] }`** em produto, carrinho, checkout e confirmação — é o
  que alimenta remarketing do Google Ads no container central. Na confirmação, `pageType:
  "purchase"` só com pedido PAGO: Pix pendente não vira conversão de Ads.
- **`discount` por item** rateado do desconto do carrinho, para a soma dos itens fechar com o
  valor pago. `shipping` e `tax` na compra. `item_brand`, `item_list_name`, `index`.
- **Dados de correspondência da Meta**: `em`, `ph`, `fn`, `ln`, `zp`, `external_id`, todos
  **hasheados no browser** antes de entrar no dataLayer, no Pixel e na CAPI. Texto aberto não
  entra no dataLayer, porque qualquer tag de qualquer container o lê.
- **Sem `page_view` manual no dataLayer**: os containers têm listener de History Change e
  contavam em dobro. Fica só no `gtag` direto e no Pixel, que não têm.
- `lib/unbox/datalayer.ts` **apagado**: era uma segunda implementação, mais completa que a ativa,
  que ninguém importava. Duas "camadas únicas" era o convite ao erro.

**Compra confirmada fora do navegador.** O webhook `ORDER_STATUS_UPDATE` com pagamento `PAID`
agora manda o `Purchase` pra Meta por CAPI, server-to-server, buscando o pedido com credenciais
da loja e com o **mesmo `event_id`** que o browser usaria: se os dois dispararem, a Meta conta
um. Pix pago horas depois, com a página fechada, passa a contar — e Pix gerado e abandonado
nunca conta, porque este é o webhook de pagamento, não de criação. `lib/capi.ts` é o remetente
compartilhado com `/api/capi`.

**O que a foundation NÃO resolve (e por quê):**
- **Compra server-side no GA4** (Measurement Protocol). Exige o `client_id` do `_ga` capturado no
  checkout e guardado até o webhook; a foundation não tem banco. Fica como próximo passo, com a
  decisão de onde persistir.
- **Pixel carregado duas vezes.** Se a loja puser o mesmo Pixel no `.env` e no container GTM
  dela, ele carrega em dobro. Não dá para impedir do lado da loja: o `.env.example` avisa para
  escolher um lugar só.

**Para não voltar:** o `check-unbox-brand.mjs` bloqueia o build se `lib/analytics.ts` perder
`ecommerce.purchase`, as chaves clássicas, o `dataLayerReady`, a limpeza `ecommerce: null`, ou
voltar a priorizar o `gtag`.

### v0.15.4 — o wizard para de perguntar o que não entrega

A pergunta "Unbox AI CRO Package — módulos (ex: 1,4,7 / all)" saiu do wizard. Três motivos:

- Pedia números sem mostrar o que cada número era: impossível responder com critério.
- Gravava a resposta em `.cro-modules`, **um arquivo que nenhum código nem agente lia**. A
  escolha do cliente ia para o nada.
- O agente 13 tem menu próprio e perguntava de novo — no momento certo, depois do briefing,
  quando já conhece a marca. Decidir CRO antes de existir loja é chute.

O que entrou no lugar: o fim da fase de construção (`agents/CONSTRUCAO.md`) oferece os
opcionais 13 (CRO), 14 (SEO avançado) e 17 (AEO) explicitamente, com o que cada um entrega, para
o cliente decidir vendo a loja pronta. O wizard fica com 11 perguntas.

**Toasts nos tokens da marca.** O "adicionado ao carrinho" aparecia verde escuro com texto
verde em toda loja, de qualquer paleta — e sobreviveu à descaracterização porque não era hex no
nosso código: era o `richColors` do Sonner, que pinta sucesso/erro/aviso com as cores DELE. Saiu
o `richColors`; o toast agora é um cartão claro em `--store-surface` com borda `--store-line`,
texto `--store-ink` e sombra `--store-shadow-card`, e o estado é dito só pelo ícone (primária,
CTA, sale, muted). Quando o briefing aplicar a paleta da marca, o toast acompanha sozinho. Tema
fixo em claro: a loja não tem tema escuro, e o toast trocava de cara conforme o SO do visitante.
`next-themes` saiu das dependências — só o toast usava, e para isso.

### v0.15.3 — a foundation deixa de ser uma loja de tempero

Lojas de outros ramos estavam sendo entregues com "Polvilhe sobre o alimento antes ou durante o
preparo" na página de produto. A varredura da 0.14.1 declarou "zero resíduo" — e estava certa
sobre o que olhou: cor e nome de cliente. O que vazava era **vocabulário e modelo de domínio**:
a PDP inteira tinha sido desenhada para um produto de alimentação, e isso não aparece num grep
de hex.

**O que saía em toda loja, de qualquer ramo, sem nenhum dado:**

- "Modo de uso" com três passos de tempero cravados no código.
- Aba **Informação nutricional** com "Valor energético —, Sódio —, Carboidratos —" (traços).
- Ficha técnica com "Glúten —", "Vegano —", "Ingredientes —".
- Selos **"Sem MSG · Sem glúten · Ingredientes naturais"** como default quando não havia
  enriquecimento — afirmação de alimento em loja de cosmético, e inventada mesmo em alimento.
- FAQ inventado: validade de 24 meses, devolução em 30 dias, entrega em 3 a 5 dias.
- Seletor "Escolha o molho" cravado, ícone de **pimenta** na conta do cliente, talher e panela
  como ícones de qualidade, "mais sabor" no checkout, no catálogo e no upsell, "ingredientes
  honestos" no marquee.
- E o **prompt do briefing** mandava ler "porção, kcal, ingredientes" do rótulo — o agente
  estava sendo instruído a tratar toda marca como alimento.

**O que mudou — a regra é uma só: nada de um ramo renderiza sem dado daquele ramo.**

- `ProductTabs` reescrito. As abas existem em função do dado: "Características" só com ficha,
  "Informação nutricional" só com tabela real (e a base vem do dado, não "porção 1g"). "Modo
  de uso" só com o campo novo `usage` do enriquecimento. FAQ só com perguntas reais; o card
  some sem elas, junto com o "Ver todas as perguntas" que apontava para `#`.
- Ficha técnica só com as linhas que têm valor. "Ingredientes" virou **"Composição"**, que serve
  para ingrediente, INCI e material.
- **Sem selo default.** Sem enriquecimento, sem selo. E "Sem MSG" só entra quando o produto
  tem tabela nutricional: antes, qualquer composição sem a palavra "glutamato" ganhava o selo
  — inclusive INCI de shampoo.
- `RELATED_GROUPS` foi para `lib/store-config.ts`, vazio por default. A loja diz quais linhas
  tem e como chamar o seletor.
- Ícones neutros: `UserCircle` na conta, `SealCheck`/`SquaresFour` no card de qualidade, e o
  conjunto de ícones dos combos perdeu panela, folha, pimenta, carne e sol.
- Copy: "Leve mais por bem menos", "Mais itens, mais economia", "Combina com o que você já
  escolheu", "materiais escolhidos".
- Prompt do briefing pede **ficha técnica** (composição ou materiais, medidas ou peso, modo de
  uso, tabela nutricional *quando for alimento ou suplemento*).
- Todos os comentários que davam exemplo de tempero para o agente ("Molho de Pimenta Sriracha",
  "Páprica Defumada", "combo churrasco", "Garlic Powder") foram trocados por exemplos neutros —
  comentário ensina o agente a escrever igual.

**Bug achado no caminho:** `collImageSrc` apontava para `combos.png` e `lancamentos.webp`, que
não existem no template. Toda loja com categoria "Kits" ou "Lançamentos" mostrava imagem
quebrada na pill. Agora só o `default.png` (que existe) até a loja mapear as suas.

**Para não voltar:** `tools/check-template-neutro.mjs` roda no `prepack` do CLI e **bloqueia o
pack** com vocabulário de domínio ou nome de cliente na foundation, comentário incluído. Fica no
CLI, não no projeto gerado: loja de alimento pode e deve dizer "polvilhe" depois do briefing.
Testado com quatro violações plantadas: reprova as quatro.

### v0.15.2 — o ?id=&token= do checkout, agora à prova de refatoração

Reincidência: a URL do checkout voltou a sair sem o ponteiro do carrinho em loja customizável.
Sem ele a recuperação de carrinho abandonado não existe, porque o CRM e o pixel leem a URL
navegada, não o cookie httpOnly — e a falha é invisível: a loja continua funcionando e vendendo.

**Não consegui reproduzir na 0.15.1.** Testado num scaffold novo, com cookie de carrinho, o
`/checkout` devolvia 307 para a URL enriquecida; a navegação client-side carregava o redirect
no payload RSC; e o `/api/checkout-destination` montava os params. Então o problema desta
versão não é o mecanismo — é o fato de ele ser **fácil de perder**:

- A garantia vivia **só no `app/(loja)/checkout/page.tsx`**, um arquivo que some inteiro no
  modo hospedado e que qualquer refatoração desfaz sem sinal nenhum.
- Ela dependia de **todos os pontos de entrada** chamarem `goToCheckout`. Um `<Link>` novo
  para `/checkout` bastava para furar.
- O `lib/session.ts` trazia um comentário dizendo o **oposto** da regra: "cartToken é PII,
  nunca em URL". Quem lesse aquilo e removesse os params estaria seguindo a documentação.

O que mudou:

- **A garantia foi para o `middleware.ts`** (`urlDoCheckoutComPonteiro`), antes de qualquer
  coisa da porta de preview, porque vale em todo host — inclusive no domínio próprio da marca,
  onde o resto do middleware não fazia nada. Ele roda em TODA requisição: navegação do
  servidor, navegação client-side do App Router, link direto, refresh, retorno de gateway.
  Preserva `freq` de assinatura e acrescenta `step=1`, e não redireciona quando a URL já está
  completa (sem loop).
- **O build bloqueia** se a garantia sumir: o `check-unbox-brand.mjs` passou a exigir o
  `urlDoCheckoutComPonteiro` no middleware (no modo customizável) e a montagem de `id`/`token`
  no `checkout-destination` (nos dois modos). Testado removendo a função: exit 1.
- **O comentário contraditório do `session.ts` foi corrigido** para dizer a regra real e de
  onde ela vem.
- **A URL da porta de preview voltou a ser limpa.** Com os params no checkout, o `/acesso`
  passava a herdar `id`, `token` e `step` além do `de` — duplicando o token do carrinho numa
  URL que não precisa dele.

A guarda do `page.tsx` continua no lugar como segunda camada.

### v0.15.1 — correções do relatório dos times

Oito itens reportados. Dois deles produziam aprovação falsa: passavam pela revisão e só
apareciam depois, em produção.

- **🔴 Nota fabricada no grid da PDP.** `catalog-grid.tsx` exibia 4,8 e "(2,1k)" fixos em todo
  card. O bloco saiu (loja sem avaliação real não mostra nota). Sobre o diagnóstico: o gate
  `unbox:honestidade` **já varre código-fonte**, não a tela — componente que não renderiza no
  ambiente atual continua sendo lido. O ponto cego era outro e mais simples: **nenhum padrão
  descrevia uma nota escrita à mão no JSX**. Os padrões existentes nomeavam números
  específicos da foundation ("25.347") e props conhecidas. Entraram quatro padrões genéricos
  (nota literal na marcação, volume abreviado "(2,1k)", contagem de avaliações nas duas ordens,
  nota em texto corrido) e o cabeçalho do script agora diz o que ele vê e onde falha.
- **🔴 Passe mobile falso no QA.** Confirmado por medição: `chrome --headless
  --window-size=390,844` gera um PNG de 390px de largura, mas a página renderiza a **500** — o
  tamanho do arquivo parece certo, e é por isso que ninguém pegou. Novo `npm run unbox:qa` usa
  emulação de dispositivo do CDP, sem dependência nova (Node 22+ tem WebSocket nativo), e
  **confere a cada frame que `window.innerWidth` bateu com o pedido**, saindo com erro em vez
  de entregar captura inválida em silêncio.
- **🟠 Soft-404.** Rota inexistente devolvia 200 com a tela de 404 dentro. A causa não era a
  ausência de `notFound()` — ele sempre esteve lá em `categoria` e `produto`. É o `loading.tsx`
  do segmento: ele abre um `<Suspense>`, o shell sai com 200, e o `notFound()` chega tarde.
  Medido isolando a variável: mesma página, só adicionando `loading.tsx`, 404 vira 200. A
  validação foi para um `layout.tsx` de segmento, que renderiza acima da fronteira do Suspense.
  Agora `/categoria/inexistente` e `/produto/inexistente` devolvem **404 de verdade**.
- **🟠 301 no lugar de 308.** `permanent: true` emite 308. Os dois passam PageRank, mas a
  auditoria lê o status literal e já reprovou duas lojas. Agora `statusCode: 301`.
- **🟡 Verde da foundation nas sombras.** 19 ocorrências dentro de `shadow-[...]` e `boxShadow`
  inline — invisíveis para a varredura que trocou 304 cores literais, porque ela olhou classes
  de cor. Viraram tokens `--store-shadow-*`: a sombra de CTA acompanha a marca via
  `color-mix`, as de card são neutras (sombra é luz, não identidade).
- **🟡 Corpo em serif fora do `.store-layout`.** `html { @apply font-sans }` não resolvia
  `var(--font-sans)`, porque a variável é declarada na className do `<body>`. A família foi
  para o body.
- **🟡 Acessibilidade.** `userScalable: false` saiu do viewport (violava a WCAG 1.4.4). O
  motivo dele era o zoom automático do iOS ao focar campo com fonte menor que 16px; a correção
  certa, um piso de 16px nos controles no mobile, entrou no `globals.css`. Alvos de toque do
  header foram para 44px, e `/produtos` e `/categoria` ganharam `<h1>` (o título dos resultados
  virou h1 — `/carrinho` e `/busca` já tinham o seu).
- **🟢 Open Graph da PDP.** O App Router substitui o objeto `openGraph` inteiro do layout pai,
  sem merge, então a loja publicava card social sem `og:site_name`. Em vez de remover o OG da
  página, que custaria a imagem do produto no card, os campos do layout passaram a ser
  repetidos ali. Se preferirem o corte completo, é apagar o bloco `openGraph` do
  `generateMetadata` da PDP.

### v0.15.0 — custo de contexto da geração

Nada muda na loja que o cliente recebe: a mudança é no que o agente precisa ler pra trabalhar
nela. O template tem ~18 mil linhas, não cabe em contexto, e até aqui o agente descobria onde
tudo ficava abrindo arquivo.

- **`CLAUDE.md` no projeto gerado.** O mapa "quero mudar X, mexo em Y", cobrindo cor, layout,
  chrome, conteúdo, PDP, promessas comerciais, legais e assets. Aponta os dois registries e o
  `PADROES.md` como portas de entrada antes de abrir componente. Não existia memória de projeto
  nenhuma até agora.
- **`agents/workflow-storefront.js` saiu do template.** Era a automação da era "storefront do
  zero sem o CLI", que o próprio `MANAGER.md` declarava inaplicável a quem usa o CLI. Além dos
  43 KB, **as linhas 13-15 traziam caminhos absolutos da máquina do desenvolvedor**, que
  viajavam pra dentro do projeto de todo cliente. Agora fica em `tools/`, fora do pacote.
- **Fim da cópia do prompt.** `agents/definitions/15-branding.md` era uma duplicata integral
  (32 KB) de `.claude/agents/branding-briefing.md` — que o `settings.json` já carrega como
  system prompt da sessão. O `MANAGER.md` apontava pra ela como "a definição", convidando o
  agente a gastar ~8k tokens relendo o que já tinha em contexto. Virou ponteiro de 1 KB, e some
  o risco das duas versões divergirem.
- **Fase de construção em `agents/CONSTRUCAO.md`.** O prompt permanente perdeu 91 linhas que só
  valem depois que a entrevista fecha (contrato de design, ordem de aplicação, revisão, QA).
  Os marcos M2/M3 continuam no prompt como stub, pra o agente não perder o gate de vista.
- **QA visual com gates baratos na frente.** O `unbox:honestidade` era a etapa 4, *depois* dos
  screenshots: falhar nele obrigava a recapturar tudo. Agora `typecheck` → `honestidade` →
  `receita` → `build` rodam antes de qualquer imagem. As capturas ganharam orçamento (~20
  frames por rodada, contra 70+ do "nenhuma região sem frame"), e rodadas de correção só
  recapturam o que mudou.
- **Skill `web-design-guidelines` usa o snapshot que já viaja junto**, em vez de buscar da rede
  a cada revisão. Rede só se o snapshot sumir ou alguém pedir a versão nova.
- **Mapa de seções no topo do `app/globals.css`**, por âncora e não por número de linha: pra
  trocar a paleta da marca, só o `:root` importa.
- **Quatro subagentes em `.claude/agents/`**, para a fase que começa quando o contrato de
  design fecha (até lá a entrevista é conversa humana e não paraleliza). Os cinco olhares do QA
  — composição, contraste, responsivo, copy, honestidade — eram cinco leituras independentes
  rodando em série numa conversa só; agora rodam juntas. `conteudo-secao` e `avaliador-visual`
  **não recebem a ferramenta Write**: `home-recipe.ts` é um array com todas as seções e
  `globals.css` concentra a paleta, então escrita concorrente neles perderia trabalho em
  silêncio. Eles devolvem o conteúdo, o agente principal grava. Protocolo em
  `agents/CONSTRUCAO.md`.
- **Bug corrigido no `src/theme.js` (achado ao escrever o mapa acima).** A regex que escreve os
  tokens da marca não era ancorada e o `[^;]+` atravessava quebra de linha: uma *menção* ao
  token dentro de um comentário (`"o token --motion: 0 desliga tudo"`) casava antes da
  declaração real e substituía tudo até o `;` seguinte — várias linhas adiante, levando junto o
  fechamento do comentário e o `@import` do Tailwind. Resultado: CSS quebrado, detectado só no
  build, com erro que não apontava pra causa. A regex agora exige início de linha e não cruza
  quebra; o `--motion`, que era declarado inline (`:root { --motion: 1; }`), ganhou linha
  própria. Se o formato mudar, o CLI falha alto em vez de corromper o arquivo em silêncio.

### v0.14.3 — novo padrão visual

O default saía com os dois maiores "tells" de site de template. Trocados:

- **Header sem barra de busca.** O estilo essencial passa a usar o header `equilibrado`
  (categorias à esquerda, logo ao centro, busca/conta/carrinho em ícone à direita) no lugar do
  `classico`, que abria com um campo de busca largo no meio da tela. O `classico` continua na
  biblioteca pra catálogo grande onde a busca é mesmo o caminho principal.
- **Hero full-bleed no lugar do banner arredondado.** O default vira `imagem-imersiva`: a foto
  sangra até as bordas, com headline, subtítulo e CTA sobre ela. O card com cantos arredondados
  no meio da página é o tell nº 1 de template. O `carousel` (usado pelo promocional) também
  perdeu o card e passou a sangrar. O `imagem-full` segue disponível pra quem QUISER o banner
  contido.
- **Placeholder do essencial redesenhado** pra escuro com range garantido, já que o hero
  full-bleed leva texto branco por cima.

⚠️ O estilo essencial deixou de "reproduzir o visual histórico da foundation" — a nota em
`src/presets.js` foi corrigida. Lojas antigas não mudam; só o scaffold novo.


### v0.14.2 — logo placeholder honesto

O placeholder de logo era um quadrado com marca-d'água colorida e "NOME DA LOJA" — parecia um
logo de verdade, e loja entregue sem trocar passava despercebida. Agora é **um quadrado cinza
neutro com "sua marca" ao lado**: lê como campo a preencher, não como identidade.

- `logo.svg` (fundo claro) e `logo-chrome.svg` (sobre o chrome, em branco translúcido) —
  mesmo desenho, tons diferentes. `logo-white.svg` alinhado aos dois.
- Ícones do PWA (`app/icon.svg`, `app/apple-icon.svg`) viraram o mesmo quadrado cinza; o
  apple-icon mantém fundo opaco (iOS não aplica transparência).
- O aviso de acabamento do build passou a procurar o marcador novo ("sua marca").


### v0.14.1 — descaracterização completa

A v0.14.0 trocou os tokens, mas o verde/amarelo continuava espalhado como **fallback** no
código (`var(--store-primary,#15803D)`) e dentro dos assets. Varredura completa:

- **~570 hexes legados substituídos** em 69 arquivos de `components/`, `app/` e `lib/`:
  verdes (`#15803D`, `#166534`, `#EAF2EC`, `#1a3a28`), amarelos (`#F3C012`, `#f0b429`,
  `#ffd300`, `#E2B400`, `#F4A521`) e beges (`#FAF8F3`, `#F0ECE2`, `#F1E3B0`, `#E2D6BE`)
  pelos equivalentes da paleta neutra. Eram fallbacks invisíveis com token carregado, mas
  apareciam em qualquer falha e deixavam o código com cara de outra loja.
- **Logo e ícones placeholder recoloridos**: o quadrado verde com miolo amarelo (que aparecia
  no header, no menu mobile, no checkout, na porta de preview e na aba do navegador) virou
  grafite + âmbar.
- **Sentinelas de recolorização agora são neutras.** Os SVGs de placeholder (heros e `ph/`)
  usavam os hexes verdes como marcadores hex→token. Agora usam os próprios valores da paleta
  default, únicos entre si: o template cru já renderiza limpo E o recolorizador do scaffold
  continua funcionando.
- **Resíduos de outras lojas**: removida a última menção à marca anterior num comentário de
  `lib/enrichment/index.ts`, o `text-emerald-600` cravado no carrinho e as cores de exemplo
  do doc do agente 14. Varredura final: **zero** ocorrências de nome de cliente ou hex legado
  no template inteiro.
- `products.json` e `combos.ts` já estavam limpos (vazio e exemplos genéricos) — o conteúdo
  nunca teve dado de cliente; o problema era só cor.


### v0.14.0 — paleta neutra, motion e as extrações da taste-skill

**Paleta.** Os neutros bege quente saíram: a loja agora nasce em **cinza neutro + tinta**
(`#FAFAFA`/`#FFFFFF`/`#F4F4F5`, tinta `#18181B`) e as cores default viraram tinta quase-preta +
âmbar contido, no lugar do verde/amarelo. O bege tingia a loja inteira e brigava com marca fria.
Os tokens do shadcn (card, popover, secondary, muted, border) deixaram de ser oklch esverdeados
fixos e passaram a seguir os `--store-*` do estilo — antes eles tingiam por baixo mesmo com a
paleta trocada. Os 4 presets seguem diferentes, agora por temperatura e contraste.

⚠️ **A paleta neutra é canvas provisória, não escolha estética** — é a tela mais neutra pra
qualquer marca cair bem em cima. Três reforços pra ela não sobreviver até o cliente: comentário
no CSS, a prioridade 1 do agente 15 declarando que aplicar a cor real é o PRIMEIRO ato, e um
aviso no `npm run build` enquanto a paleta default estiver no ar.

**Heros placeholder redesenhados.** Com primária quase-preta, o gradiente antigo (chrome →
primária) colapsava num bloco preto. Agora são composições claras com formas na cor da marca
(e uma escura, com range garantido, para o hero imersivo que leva texto branco por cima). O
recolorizador ganhou os slots de `--store-ink-2` e `--store-surface-2`.

**Motion — CSS puro, zero JavaScript.** Reveal ao rolar e parallax pontual via
`animation-timeline: view()`, que roda no compositor. **O "First Load JS" ficou idêntico
(102 kB)**: não entra um byte no bundle e não há hidratação. Regra dura: nada da primeira dobra
anima (protege o LCP). Navegador sem suporte mostra tudo normal, `prefers-reduced-motion`
desliga, e a intensidade vem do dial (`--motion`).

**Extrações da taste-skill** (analisada e NÃO vendorizada — ~5.800 linhas de terceiro que
contradizem decisões nossas):
- **3 dials no briefing**: `variancia`, `motion`, `densidade` (1-10), com default por preset,
  gravados em `marca/briefing.json` e documentados no PADROES §1c.
- **"Design read"**: o agente 15 declara em uma linha como está lendo o projeto antes de codar.
- **Anti-tells de copy** no PADROES §5: verbos de enchimento, eyebrows numeradas, scroll cues,
  rótulos de versão, nomes genéricos em depoimento.
- **`npm run unbox:receita`**: mede a composição da receita (seções, famílias de layout,
  repetição consecutiva). Só MEDE por enquanto. A medição desmentiu a suspeita inicial: as
  receitas atuais já são variadas (16 seções, 9 famílias, no máximo 2 seguidas iguais).
- **PADROES §4b documenta o que recusamos** e por quê (bans de serifa/paleta, stack de motion
  com dependência, Picsum, design systems oficiais) — pra ninguém "consertar" depois.


### v0.13.1

Ajustes em cima da v0.13.0:

- **Header novo `equilibrado`** (pedido do Bruno): uma linha só, com as categorias à
  esquerda, o logo ao centro e as três ações (busca, conta, carrinho) em ícone à direita.
  É o meio-termo entre o `compacto` e o `centralizado` — logo como eixo da página sem gastar
  a segunda faixa. Já são **5 headers** na biblioteca.
- **Marquee de atributos alinhado ao layout**: era a única seção sem container, sangrando de
  ponta a ponta enquanto hero e trust-bar ficam recuados — lia como erro de layout. Agora
  respeita `--container-max` e usa os mesmos cantos das demais.
- **Aviso de logo placeholder no build**: o gate passa a apontar, sem bloquear, quando
  `logo.svg` ou `logo-chrome.svg` ainda são o "NOME DA LOJA" da foundation. São dois arquivos
  usados em lugares diferentes (o `logo.svg` serve o header claro, o menu mobile, o checkout
  e a porta de preview; o `logo-chrome.svg` serve o rodapé e o header sobreposto) — trocar só
  um deixava o outro placeholder no ar sem ninguém perceber.
- `AccountNav` ganhou `iconOnly` pra headers que alinham as ações só em ícone.

### v0.13.0 — biblioteca de header e rodapé

Ataca a percepção de "todas as lojas iguais" no lugar de maior impacto: o **chrome**
(header + rodapé) aparece em TODAS as páginas, e até agora os 4 estilos compartilhavam
exatamente a mesma estrutura — só mudava cor, fonte e raio.

- **4 headers e 4 rodapés**, escolhidos automaticamente pelo estilo (nenhuma pergunta nova
  no wizard) e trocáveis em 1 linha por quem faz o briefing:
  | Estilo | Header | Rodapé |
  |---|---|---|
  | essencial | `classico` (o de hoje) | `colunas` (o de hoje) |
  | promocional | `compacto` (barra fina, categorias inline) | `conversao` (captura de e-mail em destaque) |
  | editorial | `centralizado` (logo no centro, nav simétrica) | `editorial` (manifesto + colunas) |
  | boutique | `imersivo` (mínimo, transparente sobre a foto) | `minimal` (logo + uma linha de links) |
- **Nova receita tipada** `components/chrome/chrome-recipe.ts`, na mesma mecânica da receita
  da home — e com uma melhoria: aqui os nomes são união literal, então `npm run typecheck`
  **acusa variante inexistente** (a receita da home não acusa).
- **Header imersivo** + nova variante de hero `imagem-imersiva`: a foto sangra até a borda e
  passa por baixo do header, que fica transparente e vira sólido ao rolar. Degrada sozinho:
  em catálogo, PDP, conta — e em qualquer home sem esse hero — ele é sólido, então loja sem
  foto boa nunca fica com o logo ilegível. Transparência via `:has()` (mesma mecânica
  SSR-safe do checkout, sem flash) exigindo acordo dos dois lados (`data-chrome` + hero).
- **Contratos blindados por arquitetura:** `site-header.tsx`/`site-footer.tsx` viram cascas
  donas do elemento raiz (`store-layout site-chrome`) e da barra do selo. Nenhuma variante
  futura consegue vazar chrome no checkout nem derrubar o "Powered by" — e o gate do build
  não precisou de uma linha de mudança.
- **Normalizações que multiplicam o efeito:** o chrome agora respeita `--container-max` (o
  boutique fica 1000px, não 1240px fixo), o fundo do header virou token, o ano do rodapé é
  dinâmico e nasceu o token `--store-chrome-line` (divisores que funcionam também em chrome
  claro).
- Catálogo das variantes documentado em `agents/PADROES.md` (seção 2c) com quando usar/não
  usar, e a regra "chrome muda pela receita" no agente 15.
- Verificado: typecheck e build limpos, gate passando, scaffold dos 4 estilos com a receita
  certa, e screenshots confirmando header sólido no catálogo, transparente sobre o hero, e
  chrome ausente no checkout nas variantes novas.

> **Versionamento unificado (a partir daqui):** o nome do zip é a versão do pacote —
> `CLI - Unbox v0.12.13.zip` contém `create-unbox-store 0.12.13`. Um número só, em todo
> lugar. O esquema antigo "Beta v0.x" está aposentado; "Beta v0.9.8" foi o último nome
> duplo e equivale a este 0.12.13.

### v0.12.13 (ex-"Beta v0.9.8")

Retorno da revisão de autenticação do time:

- **Token do MCP não embarca mais no pacote** (era o achado sério): o
  `.mcp.json.example` trazia o `x-unbox-mcp-token` REAL fixo — credencial viva distribuída
  em todo tarball e todo projeto gerado, indo pro git de quem confundisse example com
  config. Agora o example tem só placeholders, e o wizard ganhou a pergunta opcional
  "Token do MCP da Unbox" (Enter pula): informado, o CLI já escreve o `.mcp.json` REAL
  preenchido com o token + credenciais coletadas (arquivo que o `.gitignore` já cobre).
  O token não vai pro `.env.local` (não é env do app).
- **`npx ... create-unbox-store --help` (e `-h`)**: uso, flags, exemplos e o fluxo do
  wizard — e o erro de flag desconhecida agora aponta pro `--help`.
- A descrição do time sobre o fluxo de autenticação confere com o código (dois caminhos de
  signIn decididos pela presença da `UNBOX_PARTNER_API_KEY`, mesmo JWT nos dois, aspas
  obrigatórias em senha com #/$, modo mockup sem credenciais) — documentação validada.

### Beta v0.9.7 (r3) — create-unbox-store 0.12.12

**Correção de escopo do M0** (apontada pelo Bruno): o "Diagnóstico de Ambição + separação
briefing × DESIGN-DRAFT" pertence ao agente de GERAÇÃO de briefing (montante, fora do CLI) —
tinha entrado por engano no agente 15 da foundation na v0.9.6. Removido do 15: a seção M0
inteira (diagnóstico de 4 eixos, instrumentos universais/condicionais, nota de calibração) e
as exigências dela no "Fim do briefing" e no M2. Ficou apenas a contraparte de CONSUMO: se o
projeto chegar com briefing pronto do agente de briefing, o 15 trata o corpo como lei e o
anexo DESIGN-DRAFT como default a desafiar com `frontend-design`.

### Beta v0.9.7 (r2) — create-unbox-store 0.12.11

**Checkout SEMPRE com `?id=&token=` na URL** (pedido do Bruno — sem isso a recuperação de
carrinho não existe pra quem só enxerga a navegação):

- O checkout customizado agora segue o MESMO contrato do hospedado da Unbox: a URL carrega
  `?id=<cartId>&token=<cartToken>[&freq=]&step=1`. Duas camadas garantem isso:
  `/api/checkout-destination` monta a URL enriquecida também no modo interno (antes só no
  hosted), e a própria página `/checkout` redireciona server-side pra URL enriquecida quando
  alguém chega sem os params (refresh, link direto, navegação antiga) — lendo o cookie
  httpOnly, que o client não alcança.
- Com o ponteiro na URL, o pixel/GTM captura a URL navegada e o CRM monta o e-mail de
  abandono sozinho, sem depender do webhook `checkout_started` (que continua existindo);
  e a URL copiada cola o carrinho em qualquer aparelho.
- `product-picker` (funil /oferta) trocou o `router.push("/checkout")` cru pelo
  `goToCheckout` do servidor — antes perdia os params e daria 404 no modo hosted.
- Validado ao vivo: destino interno enriquecido, redirect 307 preservando params, URL aberta
  sem cookie renderiza sem loop e restaura o carrinho ("Bendita Squeeze x1") em sessão nova.

### Beta v0.9.7 — create-unbox-store 0.12.10

**Revisão geral do CLI** (auditoria completa: matriz dos 4 estilos, build, gates, testes ao
vivo, varredura de consistência docs↔código e caça a código morto):

- **Bug corrigido no CLI (grave)**: o modo "checkout hospedado" removia `app/checkout` — um
  caminho que não existe mais desde o route group — e deixava `app/(loja)/checkout/`
  importando o `components/checkout` apagado: scaffold hosted nascia quebrado. Corrigido e
  validado por typecheck.
- **Docs dos agentes realinhadas ao código** (a varredura achou 7 referências graves):
  caminhos fantasma `app/p/`, `app/c/`, `app/api/auth/` e `app/checkout` corrigidos nos
  agentes 03/04/07/14 e no COVERAGE; o mito do `lib/metadata.ts` (que fazia o agente 14
  abortar no preflight) substituído pelos arquivos reais; docs de plano 00-11 ganharam
  aviso de "histórico — valem MANAGER e código"; agente 13 não manda mais criar segundo
  limiar de frete grátis nem trust strip duplicada (aponta pros existentes); agente 17 avisa
  que o `public/llms.txt` estático vence a rota dinâmica (apagar um dos dois); MANAGER com
  16/17 na tabela de status e na ordem; DEPLOY.md com a tabela de env no modelo de parceiro
  (a antiga só citava o modelo legado).
- **Código morto removido** (zero referências, confirmado por varredura + typecheck):
  cluster de PDP legada (`product-purchase`, `price`, `add-to-cart-button`, `freight-calc`,
  `gallery` antiga), `sort-select` + `sortArgs`, e os 5 SVGs de scaffold do Next
  (`next.svg`, `vercel.svg`...). Máscara de telefone da porta de preview deduplicada
  (usa `maskPhone` de `lib/format`).
- **Higiene**: nomes de cliente removidos de comentários do código shipped; codinome de
  protocolo interno removido do template; `NEXT_PUBLIC_SITE_NAME` agora existe no
  `.env.example` e o CLI a preenche no scaffold (era lida pelo manifest sem ninguém
  documentar); `UNBOX_TEST_EMAIL`/`WEBHOOK_ENDPOINT` documentadas; flag desconhecida no CLI
  agora é ERRO (antes era ignorada em silêncio — `--estylo` gerava loja com estilo errado);
  seção não-interativa do README com o nome estável do tgz; instruções de `bootstrap.sh`
  removidas dos docs de projeto gerado (o arquivo nem é copiado pelo CLI).
- Verificação completa pós-mudanças: scaffold dos 4 estilos ✓, typecheck ✓, build de
  produção 33 páginas ✓ (inclusive em modo mockup e modo hosted), gates ✓, `unbox:test`
  14/16 (3 falhas históricas de cotação de frete da loja de teste, não regressão).
- Simplificações maiores mapeadas e DEFERIDAS pra v0.10 (mexem em muitos arquivos):
  newsletter/trust-strip/reviews placeholder consolidados, renderer de receita único,
  busca unificada. Lista completa na auditoria.

### Beta v0.9.6 — create-unbox-store 0.12.9

Dois reforços de processo (proposta SEDE v2 + agente de AEO da operação):

- **M0 — o briefing começa por um julgamento**: a primeira seção obrigatória do
  `marca/BRIEFING.md` agora é o **Diagnóstico de Ambição** (4 eixos com evidência citada:
  marca↔performance com dial de imersão por página, universo visual disponível, forma do
  catálogo, job declarado do site), que dita quais instrumentos entram no briefing —
  universais (evidência "medido vs proposta", headlines escritas, DO/DON'T bloqueantes,
  pendências de go-live, sequência emocional, ≥1 momento-assinatura) e condicionais (seção
  "O FILME", orçamento de ousadia, nível de contenção). E a separação **briefing ×
  DESIGN-DRAFT**: o briefing prende mundo/voz/dados/aceitação como LEI; execução visual
  (hex, fontes, radius, motion) vira anexo rotulado "default a desafiar com
  frontend-design" — o `DESIGN-<MARCA>.md` do M2 nasce desse draft, evoluído por quem
  constrói. Calibração explícita: a SEDE é arquétipo, não padrão.
- **Agente 17 — AEO (novo, opcional)**: prepara a loja pra ser citada por motores de
  resposta (ChatGPT, Claude, Perplexity, AI Overviews). Menu de 6 módulos: `llms.txt`
  gerado do catálogo, FAQ answer-friendly + FAQPage schema, Product schema enriquecido
  (frete/troca/GTIN — estendendo o JSON-LD real da PDP, sem regredir o gate do
  aggregateRating), FAQ por produto derivado de ficha técnica real, conferência dos bots de
  IA no `robots.ts` (a foundation já os libera) e entidade da marca (Organization + página
  Sobre citável). Adaptado à foundation (caminhos reais, modo mockup sem quebrar build,
  regras de honestidade alinhadas ao M5). Ordem recomendada: 15 → 16 → 13 → 14 → 17 → 12.

### Beta v0.9.5 (r2) — create-unbox-store 0.12.8

Porta de preview mais esperta (pedido do Bruno):

- **Escopo automático por domínio**: a porta só existe em host de PREVIEW (`*.vercel.app`,
  `*.myunbox.com.br`, + sufixos opcionais em `PREVIEW_HOSTS`). Em **domínio próprio da
  marca ela some sozinha** — apontar o domínio É o lançamento, sem mexer em env. No
  localhost também fica desligada (dev e QA livres; `PREVIEW_FORCE=1` liga pra testar).
  `PREVIEW_DISABLED=1` segue como kill switch manual. O `.env.local` gerado não precisa
  mais de nenhuma env de porta.
- **Chave do time**: qualquer URL da loja com `?chave=<PREVIEW_PASSWORD>` (padrão `unbox`)
  grava o cookie de 30 dias e segue direto, sem formulário — o parâmetro é removido da URL
  no redirect. Ex.: `https://loja.vercel.app/?chave=unbox`. Chave errada cai na porta
  normal.
- Validado ao vivo nos 7 cenários: localhost aberto, vercel.app/myunbox travados, domínio
  próprio aberto, chave certa entra e limpa a URL, cookie persiste, chave errada barra.

### Beta v0.9.5 — create-unbox-store 0.12.7

**Porta de preview com captura de lead + Pipedrive** (receita zetona/oto, agora de fábrica):

- Toda loja nasce travada atrás da tela `/acesso` ("Prévia privada"): nome, marca, WhatsApp
  e e-mail liberam por cookie de 30 dias — sem senha, preencher é a chave. Com
  `PIPEDRIVE_API_TOKEN`, cada lead vira Pessoa + Negócio no funil (`"<slug> - Nome"`, com
  dedup por e-mail e resposta CONFERIDA — a recusa do Pipedrive vem com status 200).
  `PREVIEW_WEBHOOK_URL` opcional avisa Slack/Zapier em tempo real.
- O CLI troca o slug da loja nos cookies/título do negócio no scaffold, e o `.env.local`
  gerado já vem com `PREVIEW_DISABLED=1` (dev e QA local não tropeçam na porta; na Vercel a
  var ausente = porta LIGADA até o lançamento — `PREVIEW_DISABLED=1` lá é o botão de
  publicar; tudo documentado no DEPLOY.md).
- Armadilhas da receita já resolvidas de fábrica: navegação de documento inteiro no
  pós-formulário (RSC cache), `Cache-Control: private` em toda resposta do middleware,
  matcher liberando os assets da própria tela, rotas server-to-server (webhook/revalidate)
  fora da porta, `?de=` só com caminho interno, log explícito quando falta o token do
  Pipedrive, tela `/acesso` FORA do route group `(loja)` (nasce sem header/rodapé da loja) e
  `x-vercel-ip-city` decodificado antes de qualquer uso humano.
- Validado ao vivo: porta redireciona sem cookie, formulário inválido 400, lead 200 +
  cookie assinado libera a loja, logs `[preview-acesso]`/`[preview-lead]`/
  `[preview-lead-pipedrive]` estruturados, tela renderizada com os tokens da marca.

**M5 recalibrado (pedido do Bruno)**: o gate de honestidade agora bloqueia fabricação
**SILENCIOSA**, não a escolha do lojista. O agente segue proibido de inventar dado, mas o
que o LOJISTA, perguntado, mandar manter é decisão dele — registrada em
`marca/honestidade-permitido.txt` e anotada no DESIGN-<MARCA>.md. O que não existe é
placeholder fabricado ir pro ar sem ninguém ter decidido.

### Beta v0.9.4 — create-unbox-store 0.12.6

**Protocolo SEDE** (proposta do case SEDE Energy): eleva a média das lojas geradas tornando
obrigatório o que era opcional e bloqueando o "pronto" no que era só aviso. Zero dependência
nova; tudo em processo dos agentes + um utilitário.

- **M1 — coleta de assets bloqueante** (agente 15, Bloco 6): antes do primeiro componente,
  ou o agente extrai sozinho (logo do HTML, fotos do site em alta, grid do Instagram fatiado,
  dados de rótulo lidos da imagem) ou pede UMA lista única de upload pra marca nova. Item sem
  material ganha plano B declarado em voz alta. Regra: placeholder silencioso é bug.
- **M2 — contrato de design**: `marca/DESIGN-<MARCA>.md` gerado ANTES do primeiro componente
  (conceito, tokens, tipografia, tom com proibições, inventário de assets com limitações,
  dados que o site PODE afirmar). Feedback do cliente vira `marca/FEEDBACK-NN.md` executado
  com a mesma disciplina.
- **M3 — skills obrigatórias**: `frontend-design` antes de desenhar seção;
  `web-design-guidelines` no QA. Passo numerado, não sugestão.
- **M4 — agente 16 (QA Visual), novo**: o "pronto" agora é build de produção + `next start`
  (nunca dev server), screenshots de home/PDP/catálogo/carrinho/checkout em 1440 e 390,
  cada frame avaliado contra o DESIGN-<MARCA>.md, loop até limpar. Registrado no MANAGER
  (ordem: 15 → 16 → 13 → 14 → 12).
- **M5 — honestidade como bloqueio**: novo `npm run unbox:honestidade`
  (`scripts/check-honestidade.mjs`) caça prova social fabricada grep-ável ("793 vendidos",
  "25.347 avaliações", Cliente A/B/C, selo MAIS VENDIDO, prazos não confirmados, urgência de
  estoque). Exit 1 = não deploya pelo QA. Verdade confirmada com o lojista entra em
  `marca/honestidade-permitido.txt`. A foundation hoje acusa 23 itens de fábrica — é o
  trabalho que o agente 15/16 zera no briefing.
- **Fix direto**: JSON-LD da PDP não emite mais `aggregateRating` fabricado (4.9/25347) pro
  Google quando não há avaliações reais — o bloco inteiro só sai com `rstats` real.
- PADROES: fios decorativos contam como travessão; classes de fonte apontam pra variável do
  next/font com fallback completo (nunca pro `@theme inline` do Tailwind).
- Fica pra v0.10 (extras do case): `MockUnboxClient` (loja demo que VENDE sem credenciais) e
  o script de recorte de grid do Instagram (a técnica está documentada no Bloco 6).

### Beta v0.9.3 — create-unbox-store 0.12.5

**Recuperação de carrinho abandonado de ponta a ponta** (pedido do Bruno: garantir que todo
carrinho/checkout gere o link com id pra recuperação):

- O elo que faltava: o link `?id=&token=` e a restauração já existiam, mas o ponteiro do
  carrinho vivia SÓ no cookie do cliente — nenhum CRM/cron ficava sabendo dele. Agora, na
  hora em que o e-mail é digitado no checkout, a rota `/api/checkout/email` despacha o
  evento **`checkout_started`** pro `CRM_WEBHOOK_URL` com `cartId` + **`recoveryUrl`
  pronto** (`/checkout?id=&token=[&freq=]&step=1`). O CRM arma o fluxo: sem `order_created`
  com o mesmo `cartId` em N minutos, envia o e-mail com o link.
- `order_created` agora carrega o `cartId` (pro CRM cancelar o fluxo armado).
- Formato do link unificado em `lib/cart-recovery.ts` (rota e cron usam o MESMO builder,
  incluindo `freq` de assinatura — sem ela o carrinho de assinatura restaurado não finaliza).
- Contrato dos eventos documentado no `.env.example`.
- Validado ao vivo (loja real): item no carrinho → e-mail no checkout → webhook recebeu
  `checkout_started` com o link → cookie apagado (outro aparelho) → link restaurou o
  carrinho com item e e-mail preservados → cron `unbox:abandoned` enviou `abandoned_cart`
  com o mesmo link.

### Beta v0.9.2 — create-unbox-store 0.12.4

Correções do case Oddie/Zétona (relatório de 11 defeitos; os de código compartilhado
entram aqui — os itens 2, 3, 4 e 9 do relatório já tinham entrado na Beta v0.9):

- **Captcha: chave certa no header** (bloqueava compra): `x-captcha-verification` agora
  prioriza `UNBOX_CAPTCHA_BYPASS` (o segredo feito pra isso) em vez da api key `da2-...` —
  a key no lugar errado fazia o reCAPTCHA responder MALFORMED e o cliente ver
  `CAPTCHA_MALFORMED_ERROR` no meio do pagamento. Afetava placeOrder, OTP e signin sem senha.
- **Erro 5xx sempre logado no servidor**: `failFrom()` agora imprime JSON estruturado
  (`[api-erro]` com status, erro, detalhes do GraphQL e contexto como cartId) em todo 5xx —
  antes o motivo real ia só pro navegador do cliente e o painel da Vercel mostrava
  "502 (no message)"; pagamento falhado em produção ficava indiagnosticável.
- **Pós-login com navegação de documento inteiro**: `window.location.assign` no lugar de
  `router.push` no login e no sair — o App Router podia reusar payload RSC cacheado de antes
  do cookie existir ("digitei a senha e não entrou; recarreguei e foi").
- **Header/rodapé num route group `(loja)`**: o chrome saiu do layout raiz. Página criada
  fora do grupo (tela de acesso, erro, landing) nasce limpa, sem header/banner vazando por
  trás — as URLs não mudam. 404 verificado sem chrome; gate de build intacto.
- **Contraste sobre cor de marca**: textos sobre `--store-cta` passaram a usar
  `--store-cta-fg` e sobre `--store-chrome-bg` a usar `--store-chrome-text` (nada de
  `text-white` cravado — em marca com CTA claro o contraste caía pra 1,39:1). Regra nova de
  anti-padrão no PADROES.md.
- Comentário-armadilha no `CartItemInput`: é `productVariantId`, não `variantId` (o erro do
  GraphQL não diz qual campo faltou).
- Não aplicáveis à foundation (eram customizações do case): grid 422px sem `min-w-0`,
  `x-vercel-ip-city` percent-encoded (a foundation não usa o header; se usar, decodifique),
  porta de preview. O script de bifurcação (`--from <loja>`) fica como candidato de feature.

### Beta v0.9.1 — create-unbox-store 0.12.3

Onboarding sem atrito (feedback de cliente real travando no primeiro contato):

- **Primeira versão no ar SEM git e SEM GitHub**: `DEPLOY.md` e o agente 12 reordenados — o
  caminho principal virou `npx vercel login` (login por email, ignorando o "Continue with
  GitHub" da Vercel) + `npx vercel --prod` (upload direto da pasta local). Git/GitHub virou
  seção opcional DEPOIS da loja publicada, só pra redeploy automático, e o agente ganhou
  regra explícita de nunca pedir GitHub pro lojista ver a loja no ar.
- **Node.js como passo 0 explícito**: o README de uso agora avisa antes do primeiro comando
  (nodejs.org, instalador LTS) em vez de deixar o `npx` quebrar na cara de quem não é dev.
- **Tarball com nome estável**: o zip da beta passa a trazer `create-unbox-store.tgz` (sem
  versão no nome) — o comando das mensagens de primeiros passos nunca mais desatualiza
  quando sai revisão (um cliente travou com ENOENT por causa disso; o "tarball corrupted"
  do npm nesse caso é só nome de arquivo errado).

### Beta v0.9 (r2) — create-unbox-store 0.12.2

- **Selo "Powered by Unbox" com as duas variantes oficiais** (regra definida pela Unbox):
  rodapé ESCURO usa a logo neon transparente; rodapé CLARO usa a imagem da logo sobre fundo
  preto. O template agora traz as duas em `public/unbox/` (`powered-by-transparente.png` e
  `powered-by-fundo-preto.png`) e `powered-by.png` é o arquivo ATIVO: o CLI copia a variante
  certa conforme o chrome do preset (claro → fundo preto), na mesma mecânica do
  `logo-chrome.svg`. Mudou a cor do rodapé depois? É só copiar a outra variante por cima
  (instrução no próprio componente).

### Beta v0.9 — create-unbox-store 0.12.0

Correção integral do relatório de melhorias do time da Oddie (P0, P1, P2 e F3).

- **P0 — a loja não mente mais**: os defaults comerciais de `lib/store-config.ts` agora saem
  zerados/vazios (`PIX_DISCOUNT_PCT = 0`, `FREE_SHIPPING_THRESHOLD = null`, `GIFT_TIERS = []`,
  tiers da oferta com `offPct: 0`) e TODA a UI que exibia essas promessas (header, mini-cart,
  checkout, buy-box da PDP, catálogo, FAQ, trust bars da home) só renderiza o selo/régua/badge
  quando o valor existe de verdade. Scaffold novo não promete desconto Pix, frete grátis nem
  brinde que o backend não cumpre; preencheu a config, tudo volta a aparecer.
- **`npm run unbox:dump` (novo, F3)**: raio-X da loja real no terminal: shopSales (com tiers de
  brinde), cupons, política de assinatura, formas de pagamento e catálogo com preços, mais a
  sugestão pronta de `GIFT_TIERS`. É a fonte da verdade pra preencher a store-config; o agente
  de briefing agora tem essa etapa como prioridade 7.
- **P1.2 — tiers de brinde reais no `getShop`**: fragmento `CalculationFreeItemByTier { tiers {
  cartSubtotalGTE catalogProductVariant { _id title } } }` nas duas variantes da query (core e
  partners), validado ao vivo nos dois endpoints.
- **P1.1 — env unificado**: scripts passam a carregar `.env.local` via `scripts/load-env.ts`
  (`@next/env`, o MESMO parser do app) em vez de `--env-file` do Node: acabou a divergência de
  escaping de `#`/`$` entre `next dev` e `npm run unbox:test`. Regra de aspas documentada no
  `.env.example`.
- **P1.4 + thumbnail**: `/api/cart` documenta o contrato de assinatura (item `isRecurring` +
  `recurringItemsFrequencyId` SEMPRE juntos, senão vira compra avulsa silenciosa) e derruba
  `thumbnail` que não seja URL absoluta (a Unbox rejeitava o addCartItems inteiro).
- **P1.3 — favicon**: removido `icons: { icon: "/brand/logo.svg" }` do metadata; valem as
  convenções `app/icon.svg`/`app/apple-icon.svg`.
- **P2.1 — manifest de verdade**: o CLI agora escreve nome e `theme_color` (chrome da marca) no
  `app/manifest.ts` do scaffold.
- **P2.2 — acabamento com aviso**: o gate de build ganhou avisos NÃO bloqueantes quando os
  ícones ainda são placeholder ou o manifest segue "Minha Loja"; QA.md cobre apple-icon opaco e
  margem de maskable.
- Fix de typecheck no `pagination.tsx` (prop `size` duplicada).
- F1 (gate de senha) e F2 (extração de home-data) ficam pra quando houver fôlego, como o
  próprio relatório sugere.

⚠️ **Lojas JÁ no ar** (Oddie, temperosbadia etc.) foram geradas com os defaults antigos:
vale auditar com `npm run unbox:dump` se o que elas prometem (Pix 5%, frete grátis R$199,
brindes) existe no painel de cada uma, e zerar a store-config onde não existir.

### Beta v0.8 (r4) — create-unbox-store 0.11.3

- **Fix: barra de rolagem horizontal** (reportado por dev; afetava Oddie e temperosbadia):
  o hack `.full-bleed` usa `100vw`, que INCLUI a largura da scrollbar vertical no
  Windows/Linux — sobravam ~15px e nascia a barra horizontal. Corrigido na raiz com
  `html { overflow-x: clip }` (fallback `hidden`): corta o excedente sem criar scroll
  container (sticky/scrollIntoView intactos). Lojas JÁ deployadas precisam do mesmo patch
  de 3 linhas no globals.css delas.

### Beta v0.8 (r3) — create-unbox-store 0.11.2

- Área da conta enxuta: itens **Assinaturas** e **Endereços** removidos do menu lateral e
  dos cards da visão geral (pedido do Bruno, ref. loja Oddie). As rotas continuam existindo
  pra deep links (e-mails de assinatura etc.); pra reexibir, é recolocar os itens no `NAV`
  de `components/account/account-shell.tsx`.

### Beta v0.8 (r2) — create-unbox-store 0.11.1

- **"Powered by Unbox" obrigatório no rodapé + GATE DE DEPLOY**: toda loja gerada sai com o
  selo (componente `PoweredByUnbox` + logo em `/unbox/powered-by.png`, com link pra
  unbox.com.br) no rodapé do site e no rodapé do funil. E agora existe enforcement de
  verdade: o `prebuild` (`scripts/check-unbox-brand.mjs`) roda em todo `npm run build`
  (inclusive na Vercel) e **BLOQUEIA o build/deploy** se o selo OU o GTM central
  (GTM-PZLT336) forem removidos — verificando a RENDERIZAÇÃO no footer, não só o import.
  Contrato protegido em código, agente (guardrail), MANAGER (regra de ouro) e QA.

### Beta v0.8 — create-unbox-store 0.11.0

- **Eixos de composição**: a linguagem visual deixou de ser única. Novos tokens no bloco
  CONFIGURE (`--section-gap`, `--container-max`, `--card-bg/border/shadow` + classe
  `.store-card`) controlam ritmo vertical, largura de conteúdo e chrome dos cards da loja
  inteira. Cada estilo vem com uma combinação própria: essencial 52px/1240/bordado ·
  promocional 44px/1240/sombra flutuante · editorial 72px/1080/preenchido flat · boutique
  88px/1000/hairline — as MESMAS seções renderizam composições genuinamente diferentes,
  não só recoloridas.
- **Licença estruturada de variante no agente de branding**: a biblioteca virou "piso de
  qualidade, não teto estético" — o agente pode (e deve) ajustar eixos por marca e criar
  VARIANTES novas de seção guiado pelo skill `frontend-design`, sem editar destrutivamente
  as existentes. Anti-padrão novo no PADROES: "toda loja com a mesma composição".

### Beta v0.7 (r3) — create-unbox-store 0.10.2

- **GTM central da Unbox obrigatório**: toda loja gerada sai com o container `GTM-PZLT336`
  fixo no `app/layout.tsx` (`UNBOX_GTM_ID`) — script + noscript, sempre ativos, sem gate de
  env. É o container central da Unbox para captura de dados (contrato); NÃO pode ser removido
  nem trocado. Protegido em 4 camadas: comentário-contrato no código, regra de ouro no
  MANAGER, guardrail no agente de branding e item obrigatório no QA.md. Page_views de
  navegação SPA agora alimentam o dataLayer sempre (RouteAnalytics ativo mesmo sem GA4/Pixel);
  os eventos de e-commerce do lib/analytics já caíam no dataLayer via fallback. Tags próprias
  da marca seguem nos campos opcionais (GA4/Meta Pixel/GTM adicional).

### Beta v0.7 (r2) — create-unbox-store 0.10.1

- **Fluxo de compra refeito como COMPONENTE** (feedback do Bruno + referência de loja real):
  - Nova seção **`purchase-hero`** no registry: galeria + tiers de quantidade + vantagens +
    garantia (CDC), com âncora `#comprar` — entra DIRETO na home (receita do promocional já
    vem com ela) ou no topo de landing/PDP. CTAs internos apontam pra `#comprar` em vez de
    página avulsa.
  - **Picker (passo 2) refeito no padrão de produção**: tela split com imagem da marca,
    logo + selos de confiança, produtos com badge/stepper/link, e **frequência de envio** —
    assinatura com o desconto REAL da `recurringOrdersPolicy` da loja vs compra única (o
    bloco só aparece se a política existe e há produto com `recurrenceAllowed`); CTA
    bloqueado até fechar a quantidade ("Selecione mais N pacotes"). Envia `isRecurring` +
    `recurringItemsFrequencyId` reais pro carrinho.
  - `QUANTITY_TIERS` ganhou `badge`/`selected`; `/oferta` vira deep-link de campanha usando
    a MESMA seção.

### Beta v0.7 — create-unbox-store 0.10.0

- **Biblioteca de conversão portada de uma loja Unbox real em produção** — a loja gerada nasce
  COMPLETA, no padrão de uma loja real, não mais uma vitrine genérica:
  - **13 seções novas** genericizadas dessa loja (todas tokenizadas, conteúdo via receita
    com defaults neutros): marquee de atributos, benefícios 2+foto+2, stats,
    quote banner, media cards, ficha técnica com modal, ritual/como usar, história do
    fundador, video wall, social/creators row, carrossel de reviews com pílulas,
    comparativo estrutural ("aqui vs por aí") e vitrine de produtos com fundos coloridos
    (produtos/preços do CATÁLOGO real). Hero ganhou a variante `carousel`.
  - **Funil de oferta** (`/oferta` → `/carrinho/oferta` → `/checkout`): landing de venda
    com galeria + tiers de quantidade (`QUANTITY_TIERS`, defaults SEM desconto falso) +
    picker de produtos com stepper — padrão do funil da loja de referência, mas com preços do catálogo
    real (a loja de referência hardcodava). Receita própria (`components/landing/landing-recipe.ts`).
  - **Receitas ricas por estilo**: essencial 16 seções, promocional 15 (CTAs no funil),
    editorial 13, boutique 10 — antes eram 5-9 genéricas.
  - **Placeholders recoloríveis**: biblioteca `/brand/ph/*.svg` (fotos, posters, avatares)
    recolorida com a paleta da marca no scaffold, junto com os heros.
  - Regras de honestidade preservadas: número/review/vídeo/creator só com dado REAL
    (defaults qualitativos; `PADROES.md` documenta cada regra por seção).

### Beta v0.6 — create-unbox-store 0.9.0

- **Estilos visuais (presets) + home componível** — cada loja nasce com layout pensado pra
  marca, não mais uma cópia da foundation:
  - **4 estilos**: essencial (reproduz o visual histórico), promocional (Barlow Condensed,
    oferta em primeiro plano), editorial (Fraunces, clima de clube/assinatura, chrome
    neutro) e boutique (Playfair Display, minimal premium, 5 seções). O CLI **sugere** um
    estilo a partir do objetivo/site/Instagram, o usuário confirma no select, e o scaffold
    aplica: receita da home, par tipográfico, neutros, chrome, raios e hero placeholder
    recolorido com a marca. Flag `--estilo <nome>` no modo não-interativo; campo `estilo`
    gravado no `marca/briefing.json`.
  - **Home componível**: as 9 seções viraram componentes independentes
    (`components/home/sections/`) montados por uma receita tipada
    (`components/home/home-recipe.ts`) — reordenar/trocar/remover seção é editar a receita,
    com `typecheck` validando. Variantes novas: hero `split-editorial` e `minimal-texto`,
    reviews `faixa`, newsletter `inline`.
  - **Foundation tokenizada**: 651 hex literais viraram tokens de estilo
    (`--store-ink/muted/bg/surface/line/sale...`), raios literais viraram a escala de
    `--radius`, e as fontes moram num bloco `UNBOX-FONTS` reescrito por estilo — o preset
    muda a cara da loja INTEIRA (catálogo, PDP e checkout herdam o tema).
  - **Skills de design embarcados** no projeto gerado (`.claude/skills/`):
    `frontend-design` (Anthropic, Apache 2.0) como direção estética e
    `web-design-guidelines` (Vercel, MIT, com snapshot offline) como auditoria de
    UI/acessibilidade — o agente 15 usa os dois no fluxo.
  - **Agente 15 com bloco de layout** + novo `agents/PADROES.md` (repertório: estilos,
    seções/variantes, receitas por objetivo, anti-padrões). Regra nova: layout muda pela
    RECEITA, nunca reescrevendo JSX de seção.
  - Quick wins: título da aba/OpenGraph agora recebem o nome da loja (era "Minha Loja" em
    toda loja gerada); hero sem 404 (placeholder SVG recolorido por marca); fallback de
    imagem das categorias sem ícone quebrado.
  - Terminologia: a base agora se chama **foundation** na copy e docs (o diretório
    `template/` do pacote npm permanece, é detalhe de empacotamento).

### Beta v0.5 — create-unbox-store 0.8.0

- **Vitrine COMPLETA na API de parceiros** — a Unbox expôs no gateway as 3 queries do core
  (`catalogItems`, `catalogItemProductBySlug`, `shopBySlug`), com `Product`/`ProductVariant`
  completos (título, slug, imagens, variantes com preço, flags de estoque, tagIds). Com
  `UNBOX_PARTNER_API_KEY`, agora roteiam pra lá também: `getCatalog`, `getProductBySlug`,
  `getProductById` (via `catalogItems(productIdsOrERPCodes)`) e `getShop`.
  - Peculiaridades do gateway tratadas no SDK: args opcionais não aceitam null (query
    montada só com args presentes); unions exigem `__typename`; `shopBySlug()` sem
    argumentos (loja vem do JWT); sem `allowGuestCheckout`/`maxInstallments` (app usa
    defaults).
  - **Validado ao vivo contra uma loja real (parceiro piloto)** (modo só-parceiro, sem key de loja):
    signIn GQL + vitrine + tags + cupons + parcelas + pagamento + CEP + carrinho core com o
    mesmo JWT — 14/16 passos do `unbox:test` (os 2 restantes: loja de teste sem opção de
    frete configurada pro CEP usado).
  - `unbox:test` agora extrai o shopId do JWT quando `UNBOX_SHOP_ID` está vazio (igual ao
    app). Lembrete: valores de env com `#`/`$` (senhas, bypass) precisam de aspas no
    `.env.local`.
  - Fica no core: carrinho/checkout/`placeOrder`, OTP/área do cliente,
    `availablePaymentMethods` e CEP — até as escritas saírem na API de parceiros.
- **MCP da Unbox verificado ao vivo** (`https://mcp.unbox.com.br/mcp`): 9 tools ok,
  knowledge atualizado (catálogo liberado pra parceiros). `.mcp.json.example` agora traz a
  URL real e o token de acesso corrente. Divergência achada e testada: a doc pública diz
  "token puro, sem Bearer", o MCP diz "Bearer" — na prática o gateway aceita OS DOIS
  (SDK segue com token puro por padrão).

### Beta v0.4 (r2) — create-unbox-store 0.7.1

- Ajustes conforme a doc oficial publicada em docs.unbox.com.br:
  - **`Authorization` da API de parceiros**: token **puro**, sem `Bearer ` — a doc é
    explícita ("prefixá-lo quebra a autenticação"). O SDK agora manda o token cru por
    padrão (o auto-fallback continua, só como defesa).
  - **`x-captcha-verification` no signIn de parceiros é OBRIGATÓRIO** — `UNBOX_CAPTCHA_BYPASS`
    deixou de ser "opcional" nos comentários/.env.example, e o erro de signIn sem ela agora
    inclui a dica do que preencher.
  - Confirmado contra a doc: a lista de operações com shopId resolvido pelo token
    (discountCodes, tag/tags, simpleInventory, shopSettings, orderByReferenceId,
    productGroup, getInstallments) bate 1:1 com o roteamento implementado; e
    `createCartByTemplate` segue com shopId explícito, como está no SDK. Sem refresh de
    token: re-signIn na expiração (já era o comportamento do cache em `lib/unbox/store.ts`).

### Beta v0.4 — create-unbox-store 0.7.0

- **API pública de PARCEIROS** (`partners.unbox.com.br/graphql`) — novo modelo de credencial:
  **uma api key por parceiro** (independente do nº de lojas), com a loja específica
  autenticada por user/senha no signIn. Suporte lado a lado com o modelo antigo:
  - `UNBOX_PARTNER_API_KEY` preenchida → **signIn vira mutation GQL** na API de parceiros
    (com `UNBOX_CAPTCHA_BYPASS` opcional no `x-captcha-verification`) e roteiam para lá:
    **tags, cupons (leitura), pedido por referenceId, parcelas, `subscribeToWebhook`,
    `createCartByTemplate`** e o novo **`getSimpleInventory`** (inventário por variante).
    Paridade de campos validada por introspecção; única diferença normalizada no SDK:
    `OrderItem.imageURLs` → `thumbnail`.
  - Vazia → comportamento 100% anterior (core + signin REST). Zero mudança nos call sites:
    o roteamento fica dentro do `UnboxClient` (`usesPartnerApi`).
  - **Seguem no core** (a API de parceiros ainda não expõe): catálogo de vitrine (o
    `Product` de parceiros só tem price/pricing por ora), `shopBySlug`, carrinho, checkout,
    `placeOrder`, CEP, OTP e área do cliente. Quando a Unbox publicar as escritas, cada
    método ganha o mesmo roteamento condicional.
  - A verificação de posse do pedido continua no BFF (cookie) — o `orderByReferenceId` de
    parceiros não aceita token de posse.
  - `npm run unbox:test` informa qual rota está ativa; CLI pergunta a key de parceiro no
    bloco de credenciais.
- **MCP da Unbox**: projeto gerado traz `.mcp.json.example` (com o `x-unbox-mcp-token` fixo
  e modo `headless`) + seção no README; `.mcp.json` real entra no `.gitignore`.
- **`.gitignore` no projeto gerado** (não existia): node_modules, .next, `.env*`,
  `.mcp.json` etc. — a foundation o carrega como `gitignore` (sem ponto, por causa do npm
  pack) e o CLI renomeia ao copiar.

### Beta v0.3 — create-unbox-store 0.6.0

- **Agente 15 (Branding & Identidade) + briefing automático no primeiro acesso** (por Ricardo):
  - Novo `agents/definitions/15-branding.md` no projeto gerado: entrevista de marca guiada
    (expectativa → referências → identidade → site atual → Instagram → imagens → dados reais),
    postura de especialista, regra "perguntar antes de mostrar", trava "nenhum componente sem
    imagem", QA embutido antes de dizer "pronto" e neutralização da prova social fabricada.
  - **Gatilho validado**: o projeto gerado traz `.claude/agents/branding-briefing.md`
    (frontmatter com `initialPrompt`) + `.claude/settings.json` com `{ "agent":
    "branding-briefing" }` — abrir o Claude Code na pasta já inicia o briefing sozinho, sem
    o cliente digitar comando. Ao fim do briefing o agente remove a chave `"agent"` e as
    sessões voltam ao normal. (Só `CLAUDE.md` não dispara — testado.)
  - **CLI**: 3 perguntas opcionais novas (site atual, Instagram, objetivo da loja); tudo que o
    formulário coleta (menos credenciais) vai pra `marca/briefing.json`, que o agente 15 lê pra
    não reperguntar. A mensagem final agora direciona pro `claude` (briefing), não mais pro
    `npm run dev` — o cliente não vê a loja padrão antes da personalização.
  - `agents/MANAGER.md` atualizado: agente 15 como primeiro passo pós-setup, ordem 15 → 13 →
    14 → 12.

### Beta v0.2 — create-unbox-store 0.5.0

- **`device` (antifraude/3DS Unbox) no `placeOrder`** — a Unbox passou a exigir o campo
  `device` no **nível raiz** do `PlaceOrderInput` (irmão de `order` e `payments`):
  - `type: "BROWSER"` — 8 campos reais do navegador, coletados no checkout
    (`components/checkout/checkout-client.tsx`) e repassados pelo BFF (`/api/checkout`).
  - `type: "API"` — fallback automático do SDK para pedidos server-side (scripts).
  - Arquivos: `components/checkout/checkout-client.tsx`, `lib/schemas.ts`,
    `lib/unbox/types.ts`, `app/api/checkout/route.ts`, `lib/unbox/client.ts`,
    `scripts/place-order-pix.ts`.
  - Como testar pelo Chrome: interceptar o `fetch` de `/api/checkout` ou aba Network →
    Payload (a mutation servidor→Unbox NÃO aparece no browser — a loja é BFF). Validação
    server-side: `npm run unbox:order:pix -- --confirm` (envia `device: { type: "API" }`;
    pedido criado = root placement confirmado).
  - ⚠️ Ponto aberto: `timezoneOffset` enviado em **minutos** (BRT → 180), igual ao
    storefront de referência; a doc da Unbox mostrava horas. Se confirmarem horas, dividir
    por 60 na coleta em `checkout-client.tsx`.

### Beta v0.1 — create-unbox-store 0.4.0

- Versão inicial distribuída (tarball + README).


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

A seção "Editor: o que não pode quebrar" do `CLAUDE.md` do template lista cada ponto com o que acontece se for tocado.
