# PADRÕES: biblioteca de layout da foundation

Repertório pro agente de Branding (15) decidir **estrutura visual** com critério, sem
reinventar código. A regra de ouro: **layout muda pela RECEITA**
(`components/home/home-recipe.ts`), pelas **fontes** (bloco `UNBOX-FONTS` de
`app/layout.tsx`) e pelos **tokens** (`app/globals.css`), nunca reescrevendo o JSX de uma
seção pra ela "virar outra coisa". Variante nova = arquivo novo em
`components/home/sections/` + registro no `registry.ts` + entrada aqui.

O mesmo vale pro **chrome** (header e rodapé): muda pela receita
`components/chrome/chrome-recipe.ts`, nunca reescrevendo `site-header.tsx`/`site-footer.tsx`
(esses são só a casca: fetch, wrapper e o selo obrigatório). Ver seção 2c.

Complementos gerais (skills em `.claude/skills/`): `frontend-design` (direção estética na
hora de construir, use pra fugir de escolha "de template") e `web-design-guidelines`
(auditoria de UI/acessibilidade, rode antes de declarar pronto).

## 1. Os 4 estilos (presets do CLI)

O scaffold já aplicou um (campo `estilo` do `marca/briefing.json`). Seu papel no briefing é
VALIDAR contra as referências reais do cliente e ajustar, trocar o estilo inteiro é raro;
ajustar receita/fontes/variantes é comum.

| Estilo | Quando usar | Quando NÃO usar | Chrome | Radius | Display |
|---|---|---|---|---|---|
| **essencial** | qualquer segmento, cliente sem opinião forte de design | marca com identidade visual forte já definida | brand-dark | 0.875rem | Poppins |
| **promocional** | ticket médio, kits/combos, oferta agressiva, food/consumo recorrente | marca premium (fica "feirão") | brand-dark | 1.25rem (pill) | Barlow Condensed |
| **editorial** | assinatura/clube, curadoria, marca com história pra contar | catálogo grande de conveniência | ink-dark | 0.5rem | Fraunces (serif) |
| **boutique** | premium, minimal, autoral, poucos SKUs | loja de volume com muitas categorias | ink-dark | 0.25rem | Playfair Display (serif) |

Receitas default de cada um: ver o `components/home/home-recipe.ts` gerado neste projeto
(a fonte delas vive no CLI `create-unbox-store`, fora deste repo).

## 1b. Eixos de composição (a linguagem visual além de cor/fonte)

Tokens no bloco CONFIGURE de `globals.css`, mudam o "jeito" da loja inteira sem tocar em
componente. Cada estilo já vem com uma combinação; ajuste por marca livremente:

| Eixo | Token | O que muda | Valores dos estilos |
|---|---|---|---|
| Ritmo vertical | `--section-gap` | respiro entre seções (denso ↔ arejado) | essencial 52px · promocional 44px · editorial 72px · boutique 88px |
| Largura | `--container-max` | largura do conteúdo das seções | 1240px · 1240px · 1080px · 1000px |
| Chrome dos cards | `--card-bg`/`--card-border`/`--card-shadow` (classe `.store-card`) | bordado clássico · sombra flutuante · preenchido flat · hairline | essencial bordado · promocional sombra · editorial preenchido · boutique hairline |

Combinar eixos + fontes + neutros + radius = linguagens genuinamente diferentes com as MESMAS
seções. Se ainda assim a referência da marca pedir outra cara pra uma seção específica, o
caminho é **variante nova** (nível 2 abaixo), nunca editar a existente.

## 1c. Dials do briefing (variância · motion · densidade)

`marca/briefing.json` traz `dials` (1-10) com o default do estilo. Eles são a *temperatura*
da loja, e você revalida cada um no briefing contra as referências da marca:

| Dial | O que governa | Onde mexer |
|---|---|---|
| `variancia` | quão ousada é a composição: variantes menos óbvias, chrome mais autoral | receita da home e `chrome-recipe.ts` |
| `motion` | quanta animação (0 desliga tudo) | token `--motion` em `globals.css` |
| `densidade` | quanto conteúdo por tela | `--section-gap`, `--container-max`, nº de seções da receita |

**A paleta neutra é canvas provisória, não escolha estética.** A loja nasce em cinza + tinta
porque é a tela mais neutra pra qualquer marca cair bem em cima, aplicar as cores REAIS é o
primeiro ato do briefing, antes de qualquer seção. O `npm run build` avisa enquanto a paleta
default estiver no ar.

## 2. Catálogo de seções e variantes

| Seção | O que faz | Variantes | Critério |
|---|---|---|---|
| `hero` | primeira dobra | `imagem-full` (banner clicável), `carousel` (banners com setas), `split-editorial` (texto+CTA / imagem), `minimal-texto` (tipográfico, sem imagem), `imagem-imersiva` (foto sangrando até o topo, por baixo do header, par do header `imersivo`) | **full-bleed é o default** (`imagem-imersiva`): banner em card arredondado é o tell nº 1 de "site de template". História/proposta clara → split; sem foto decente AINDA → minimal-texto (nunca deixe hero com foto ruim); `imagem-full` só quando a marca QUISER o banner contido |
| `trust-bar` | selos de confiança claros (`items` via receita; some sem itens) | única | logo abaixo do hero em lojas novas (dá segurança); em boutique costuma sair |
| `category-pills` | chips de categorias | única | só faz sentido com 3+ categorias reais |
| `combos-carousel` | produtos em destaque com add-to-cart (âncora `#destaques`) | única | quase sempre presente; é o coração comercial |
| `savings` | comparativo de economia | única (some sozinha sem desconto real) | lojas de kit/combo; NUNCA force com desconto fake |
| `reviews` | depoimentos | `grid` (3 cards), `faixa` (linha discreta) | grid quando reviews são um ativo; faixa em estilos minimais; SEMPRE conteúdo real ou remova |
| `kits` | kits temáticos curados (`lib/enrichment/combos.ts`) | única (some com `COMBOS` vazio) | popular os combos reais primeiro |
| `trust-strip` | faixa escura de diferenciais | única | reforço no fim da página; redundante se trust-bar já diz o mesmo |
| `newsletter` | captura de e-mail (`title` + `action` obrigatórios; some sem eles) | `bloco` (CTA forte), `inline` (linha fina) | bloco em lojas promocionais; inline em editorial/boutique; form ainda é TODO de integração |

**Biblioteca de conversão** (portada de uma loja Unbox real em produção, genericizadas, todas aceitam
conteúdo via `props` com defaults neutros):

| Seção | O que faz | Regra de conteúdo |
|---|---|---|
| `attributes-marquee` | marquee infinito de atributos do produto (vegano, artesanal...) | atributos VERDADEIROS do produto; ícones por nome (leaf, drop, heart, shield...) |
| `benefits` | grid 2+foto+2 de benefícios | sem promessa de resultado inventada |
| `stats-grid` | 4 cards de destaque (com números OU qualitativos) | número SÓ com pesquisa/dado real (passe `source`); default é qualitativo de propósito |
| `quote-banner` | faixa foto + citação grande | citação da própria marca/fundador, nunca depoimento inventado |
| `media-cards` | carrossel de cards de imagem com legenda (ingredientes, materiais, bastidores) | fotos reais assim que existirem |
| `spec-table` | ficha técnica com modal (nutricional, composição, medidas) | dados REAIS do produto |
| `ritual` | crossfade de fotos + checklist "como usar" |, |
| `founder-story` | card de história com foto de fundo + assinatura (âncora #nossa-historia) | história real |
| `video-wall` | grade 9:16 de vídeo-depoimentos com play inline | SÓ vídeo real; sem vídeo, remova da receita |
| `social-row` | cards de comunidade/creators com @handle | gente real com autorização; seguidores só se verdadeiros |
| `reviews-carousel` | carrossel de reviews em card bordado com pílulas de tema | reviews reais |
| `comparison` | tabela "aqui vs por aí" estrutural | compare atributos, sem citar concorrente nem inventar |
| `product-showcase` | vitrine de cards com fundo colorido, produtos e preços do CATÁLOGO | `ctaHref: "#comprar"` pra mandar pro hero de compra |
| `purchase-hero` | **o bloco de conversão principal**: galeria + tiers de quantidade + vantagens + garantia (âncora `#comprar`) | produto/preço do catálogo (data.featured); tiers de `QUANTITY_TIERS`; CTA → passo 2 |

## 2c. Catálogo de header e rodapé (o chrome)

O chrome aparece em TODAS as páginas, é ele que mais pesa na sensação de "loja igual às
outras". Troque em `components/chrome/chrome-recipe.ts` (1 linha cada). `npm run typecheck`
acusa nome inexistente.

| Header | O que é | Quando usar | Quando NÃO usar |
|---|---|---|---|
| `classico` | logo esq · busca · ações · faixa de categorias abaixo | catálogo grande, busca é o caminho principal | marca que quer respiro |
| `compacto` | uma barra fina, categorias inline, busca em ícone | promocional/campanha: menos altura, mais tela pra oferta | catálogo com muitas categorias (não cabem) |
| `centralizado` | logo grande no centro, ações nas pontas, nav centralizada abaixo | editorial, assinatura, wordmark bonito | loja de volume onde busca manda |
| `equilibrado` | UMA linha: categorias à esquerda, logo ao centro, busca/conta/carrinho em ícone à direita | logo no centro sem gastar duas faixas; catálogo de 2 a 6 categorias | muitas categorias (empurram o logo do centro) |
| `imersivo` | barra mínima, menu em drawer (inclusive desktop), **transparente sobre hero de imagem** e sólido ao rolar | marca com fotografia boa, catálogo curto, premium | catálogo grande, ou loja sem foto real |

| Rodapé | O que é | Quando usar |
|---|---|---|
| `colunas` | trust strip + 4 colunas + pagamento | loja completa, navegação secundária importa |
| `conversao` | captura de e-mail em destaque + links enxutos | promocional: rodapé como última conversão |
| `editorial` | manifesto da marca + colunas discretas + redes | marca com história, tom de revista |
| `minimal` | logo, uma linha de links, pagamento discreto | catálogo curto, estética premium/minimal |

**Regras do chrome:**
- Variante muda composição e hierarquia, **nunca capacidade**: busca, conta, carrinho,
  categorias e links legais existem em todas. Trocar o chrome não pode tirar função da loja.
- O `imersivo` só fica transparente com o hero `imagem-imersiva` na receita da home (é a
  única variante que emite `.hero-imersivo`). Em qualquer outra página, e em qualquer home
  sem esse hero, ele é sólido. Sem foto boa da marca, use outro hero: o header se ajusta
  sozinho, e foto ruim em tela cheia é pior que header sólido.
- A barra inferior do rodapé (© + selo Powered by Unbox) é da CASCA, não da variante: é
  contrato da plataforma e o build falha sem ela.

## 2b. O funil de compra (purchase-hero → picker → checkout)

O padrão das lojas Unbox de produção: o **hero de compra é uma SEÇÃO da home** (ou topo da
PDP/landing), não uma página escondida. Fluxo:

1. **`purchase-hero`** (seção, âncora `#comprar`): quantidade via `QUANTITY_TIERS`
   (`lib/store-config.ts`) com preço real por unidade. CTAs de outras seções apontam pra cá
   (`href`/`ctaHref: "#comprar"`).
2. **`/carrinho/oferta`** (picker, tela split sem chrome): escolha de produtos/variantes com
   stepper + **frequência de envio**, assinatura com o desconto REAL da política da loja
   (`recurringOrdersPolicy`) vs compra única. Só aparece se a política existe e há produto
   com `recurrenceAllowed`.
3. `/checkout`.

`/oferta` existe como deep-link de campanha (mesma seção + pilha de convencimento de
`components/landing/landing-recipe.ts`). Regras: preços SEMPRE do catálogo; `offPct`/
`perks`/`badge` dos tiers só quando a promoção equivalente EXISTE no painel Unbox (senão o
total diverge no checkout, defaults saem zerados por isso).

## 3. Receitas por objetivo

- **Subir ticket médio:** promocional; `combos-carousel` + `savings` logo após o hero;
  `kits` populado; newsletter `bloco` prometendo oferta (só se a oferta existir).
- **Assinatura/clube:** editorial; hero `split-editorial` contando a proposta; reviews
  `faixa`; newsletter `inline` como "entrar pra lista"; assinatura destacada na PDP (a
  PDP já suporta; não mexa na estrutura dela nesta versão).
- **Marca premium/minimal:** boutique; 5 a 6 seções NO MÁXIMO; hero `minimal-texto` até
  existir fotografia à altura; sem `savings`, sem `trust-strip`.
- **Cliente não sabe / loja generalista:** essencial completo; corte o que não tiver
  conteúdo real (reviews fake NÃO, ou dado real, ou remove).

## 4. Como aplicar mudanças

1. **Ordem/presença/variante de seção:** editar `components/home/home-recipe.ts`.
2. **Copy do hero (split/minimal):** `props` da entrada `hero` na receita
   (`title`, `subtitle`, `ctaLabel`, `ctaHref`).
3. **Imagens do hero:** troque os arquivos em `public/brand/` e os paths nos `props`
   (`.webp` otimizado; os `.svg` gerados são placeholder até existir imagem real).
4. **Tipografia:** bloco `UNBOX-FONTS` em `app/layout.tsx` (só Google Fonts com pesos
   500-800; corpo legível + display com personalidade).
5. **Neutros/radius/chrome:** tokens em `app/globals.css` (bloco CONFIGURE). Cor SEMPRE
   via `var(--store-*)`, nunca hex solto.
6. **Composição (ritmo/largura/cards):** eixos `--section-gap`, `--container-max` e
   `--card-*` no mesmo bloco CONFIGURE (ver seção 1b).
7. **Variante nova de seção:** criar o componente em `components/home/sections/`,
   registrar no `registry.ts`, documentar aqui. Antes de desenhar, carregue o skill
   `frontend-design` e faça uma escolha estética própria da marca, variante nova que
   parece a original com outra cor não justifica existir. `npm run typecheck` valida a
   receita.
8. **Chrome (header/rodapé):** trocar a variante = editar `components/chrome/chrome-recipe.ts`
   (ver seção 2c). Variante NOVA = arquivo em `components/chrome/headers/` ou `footers/` +
   entrada no `components/chrome/registry.ts` (e no `HEADER_SHELL`, se for header) +
   linha na tabela daqui. A variante desenha só o MIOLO: o `<header>`/`<footer>` com
   `store-layout site-chrome` e o selo Powered by são da casca, e é assim que a loja garante
   que o chrome some no checkout e que o contrato não cai.

## 4b. O que NÃO importamos de frameworks externos de "taste"

Avaliamos a `taste-skill` (anti-slop) e extraímos o que serve: os dials (1c), o "design read"
do agente 15, os anti-tells de copy (5) e a medição de composição (`npm run unbox:receita`).
**Recusamos de propósito**, não "conserte" isto depois:

- **Ban de serifa** (Fraunces/Playfair): são o display de dois estilos nossos, escolha decidida.
- **Ban de paleta**: a crítica ao bege premium procede e já foi resolvida trocando os neutros;
  quem decide a cor da marca é o briefing, não um doc externo.
- **Stack de motion com dependência nova** (GSAP/motion): nosso motion é CSS puro, sem JS.
- **Imagens de Picsum**: foto aleatória numa loja real é pior que placeholder declarado.
- **Design systems oficiais** (Material/Fluent/Carbon): a loja é shadcn/Base UI + tokens `--store-*`.

## 5. Anti-padrões

- 9 seções numa loja minimal (boutique com receita do essencial).
- **Toda loja com a mesma composição.** Se as referências da marca pedem outra linguagem
  e você entregou o default da biblioteca, o briefing falhou, use os eixos (1b) e
  variantes novas.
- Remover toda âncora de confiança de loja nova (algum trust fica).
- Prova social inventada em QUALQUER estilo, dado real, estado honesto, ou decisão
  EXPLÍCITA do lojista registrada (`marca/honestidade-permitido.txt`). Nunca por omissão.
- Hex solto no JSX; fonte fora do bloco UNBOX-FONTS; receita reescrita como JSX.
- Editar destrutivamente variante existente da biblioteca (crie uma nova).
- Mexer no motor (`lib/unbox`, `app/api`, checkout) por causa de layout.
- **Copy que denuncia texto de IA** (some com ela; se a marca quiser algo assim, tem que ser
  decisão declarada dela): verbos de enchimento ("Elevate", "Seamless", "Unleash",
  "Revolucione"), eyebrows numeradas ("001 · Recursos"), rótulos de etapa por número
  (Etapa 1/2/3, use o verbo direto: Instale, Configure), "role para explorar"/scroll cues,
  rótulos de versão (v1.4.2, BETA) fora de contexto, nomes genéricos em depoimento
  (João Silva, Maria S.), legendas decorativas de foto ("Estudo de campo nº 12").
- Travessão na copy voltada ao cliente final. **Fios/traços decorativos contam**: o
  risquinho antes de eyebrow/kicker lê como "cara de AI" pro cliente, mesma proibição.
- Classe de marca apontando pra variável de fonte que só existe no `@theme inline` do
  Tailwind (ex.: `var(--font-mono)`): funciona por acaso dentro de `.store-layout` e cai
  em serifa fora dele. Classes de fonte apontam pra variável do **next/font** com stack
  completa de fallback.
- **`text-white` (ou cor cravada) sobre fundo de cor de marca.** A cor da marca muda por
  loja: na loja de referência o CTA era escuro e funcionou; numa bifurcação virou
  verde-limão e o texto caiu pra 1,39:1 de contraste. Sobre `--store-cta` use SEMPRE
  `--store-cta-fg`; sobre `--store-chrome-bg` use `--store-chrome-text`. Branco fixo só
  sobre `--store-primary` (o CLI garante primary escuro o bastante).
