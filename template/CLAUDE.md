# Mapa do projeto

Storefront Next.js 15 (App Router, Tailwind v4, shadcn) gerado pelo `create-unbox-store`,
conectado à API headless da Unbox. São ~220 arquivos e ~18 mil linhas: **não cabe em contexto,
nem perto.** Este arquivo existe pra você não precisar procurar.

## Antes de abrir qualquer componente

Três arquivos indexam quase tudo. Juntos custam ~2k tokens e substituem ~30k de leitura às
cegas. Leia o que for do seu caso **antes** de sair abrindo `.tsx`:

| Arquivo | O que indexa | Custo |
|---|---|---|
| `agents/PADROES.md` §2 | **o catálogo**: o que cada uma das 23 seções é, suas variantes e quando cabe | ~4,3k |
| `components/home/sections/registry.ts` | os nomes válidos de seção (union tipada, o `tsc` reprova nome inventado) | ~0,9k |
| `components/chrome/registry.ts` | os 5 headers e 4 rodapés, com quando usar cada um | ~0,7k |

Para **escolher** uma seção, leia o PADROES §2, não os componentes. Para **escrever** o nome dela
na receita, o registry é a fonte da verdade. Os arquivos de chrome (`headers/`, `footers/`) abrem
com um comentário de "quando usar / quando não usar"; os de seção não, por isso o catálogo.

## Quero mudar X, mexo em Y

### Identidade e aparência
| Quero | Arquivo |
|---|---|
| Cores da marca, tipografia, raio, ritmo vertical, largura de container | `app/globals.css` (tokens `--store-*` no topo; o resto do arquivo deriva daí) |
| Tamanho, peso ou entrelinha de QUALQUER título | `app/globals.css`, bloco "A ESCADA DOS TÍTULOS" — e só ele (veja abaixo) |
| Trocar o logo | `public/brand/logo.svg` (+ `logo-white.svg`, `logo-chrome.svg` para fundo escuro) |
| Intensidade de animação/parallax | token `--motion` em `app/globals.css` (`0` desliga tudo) |
| Qual header e qual rodapé a loja usa | `components/chrome/chrome-recipe.ts` (só troca os nomes; as variantes já existem) |
| Barra de aviso do topo | `components/chrome/announce-bar.tsx` |
| Menu mobile | `components/chrome/header-bar-mobile.tsx` |

**Título não leva tamanho na classe.** `h1` a `h4` já têm tamanho, peso, família e entrelinha na
escada de `app/globals.css`, e é de lá que o lojista mexe em todos de uma vez pelo editor. Escrever
`text-[26px]`, `font-extrabold` ou `leading-[1.1]` num título faz três estragos de uma vez: a classe
vence a escada, o seletor de tamanho do editor deixa de mover aquele título, e a troca de fonte da
seção passa por cima dele sem tocá-lo. Se o título precisa MESMO de outro tamanho (é o caso do herói
e do nome do produto), a saída é uma classe nova no mesmo bloco da escada, em `clamp()` e multiplicada
por `--store-escala-titulos` — nunca um ponto de quebra (`sm:`), que é um salto seco numa largura só.
Escolha o degrau pelo que o título É: `h1` título de página, `h2` título de seção, `h3` subtítulo
dentro de uma seção, `h4` rótulo de bloco.

**Não edite** `site-header.tsx` / `site-footer.tsx` para trocar aparência. Eles são a casca fixa:
fazem o fetch, derivam o nome da loja e montam o `<header>`/`<footer>` raiz. O miolo variável
está em `components/chrome/headers/` e `footers/`.

### Conteúdo e estrutura
| Quero | Arquivo |
|---|---|
| Quais seções a home tem, em que ordem, com que texto | `components/home/home-recipe.ts`, **um array só, com as props de conteúdo dentro** |
| Criar uma seção que não existe | novo arquivo em `components/home/sections/` + entrada no `registry.ts` + registro no `PADROES.md` |
| Página de produto (PDP) | `app/(loja)/produto/[productSlug]/page.tsx` + `components/product/` |
| Listagem, busca, categoria | `app/(loja)/{produtos,busca,categoria}/` + `components/catalog/` |
| Carrinho / checkout | `app/(loja)/{carrinho,checkout}/` + `components/{cart,checkout}/` |
| Textos de produto enriquecidos (FAQ, benefícios, combos) | `lib/enrichment/` (`products.json`, `combos.ts`) |
| Termos, privacidade, devoluções | `app/(loja)/{termos,privacidade,devolucoes}/` |
| Landing de campanha | `app/(loja)/oferta/` + `components/landing/` |

### Promessas comerciais: a área perigosa
`lib/store-config.ts` concentra desconto do Pix, limiar de frete grátis e régua de brinde.
Os defaults saem **zerados de propósito**: cada valor ali é uma promessa exibida ao cliente, e
prometer o que o backend não cumpre faz o checkout mostrar um total e cobrar outro. Só preencha
depois de confirmar a promoção real com `npm run unbox:dump`. O gate `unbox:honestidade` cobra
isso.

### Integração e infra
| Quero | Arquivo |
|---|---|
| O que o `/llms.txt` diz a agentes de IA | `lib/llms-txt.ts` (formato) + `app/llms.txt/route.ts` (dados). É ROTA, montada do catálogo real: nunca crie `public/llms.txt`, ele esconderia a rota |
| Credenciais, domínio, IDs de analytics | `.env.local` |
| Cliente da API Unbox, queries, tipos | `lib/unbox/` e `lib/queries.ts` |
| Porta de preview (prévia privada) | `middleware.ts` + `app/acesso/` |
| Recuperação de carrinho abandonado | `lib/cart-recovery.ts` (o link com id e token nasce aí) |
| Tracking (GA4, GTM, Meta Pixel, CAPI) | `lib/analytics.ts`, a camada ÚNICA; nenhum outro arquivo empurra no dataLayer |
| O que o cliente respondeu no formulário do CLI | `marca/briefing.json` |
| Editor da Unbox: o que o lojista edita sem código | `lib/editable/` (foundation, não edite à mão), `lib/rotas-editaveis.ts` (páginas e containers), `app/api/unbox/*`, `app/api/revalidate` |

## Comandos

```
npm run dev              # servidor local
npm run typecheck        # tsc --noEmit, o gate mais barato, rode primeiro
npm run build            # dispara o prebuild de marca automaticamente
npm run unbox:honestidade # promessas comerciais sem lastro
npm run unbox:receita    # variedade da receita (mede, não bloqueia)
npm run unbox:qa         # screenshots do QA (emulação de dispositivo, servidor no ar)
npm run unbox:dump       # imprime o catálogo e as promoções REAIS da loja
npm run unbox:editavel   # gate do editor: cobertura editável por página (servidor no ar)
```

Ordem barata → cara: `typecheck` → `unbox:honestidade` → `unbox:receita` → `build` → só então
subir o servidor e capturar tela. Screenshot é o passo mais caro do ciclo; não use como primeiro
diagnóstico.

## Medidores de sistema visual (relatório, ainda não gate)

`npm run unbox:medir` roda dois medidores de Python que contam o que faz uma loja ter "cara de
template": quantos tamanhos de tipo, raios, hex fora de token e larguras de container existem
(`scripts/sistema.py`), e se o vocabulário gráfico da marca foi distribuído ou vive numa seção só
(`scripts/vocabulario.py`). Rodam no `prebuild` e **não bloqueiam**: imprimem e saem 0.

Não são gate ainda de propósito. Medido em cinco lojas geradas e na própria foundation, todas
estouram os tetos que vieram no script, a foundation inclusive: ligar como gate hoje reprovaria
até um scaffold recém-criado. Os números servem para escolher a régua depois, e para o agente de
branding ver o custo do que acrescenta enquanto trabalha.

Sem python3 na máquina, os medidores são pulados com aviso. Nunca derrubam build.

## Placeholder no ar (antes de publicar)

`npm run unbox:placeholder` varre o **HTML servido**, não o código-fonte. É a diferença que
decide dois casos: varredura de fonte acusa `TODO` em comentário de componente que nem está na
receita, e não acha o texto que vaza sem existir como string, como `[NOME DA LOJA]` vindo do
conteúdo ou um logotipo com o nome errado dentro de um SVG.

Precisa de build de produção. Sem base explícita ele sobe o próprio servidor a partir do `.next`
e mede a si mesmo: **nunca** aponte para "o que estiver na porta 3000", que foi como a primeira
versão deste gate mediu outro projeto e quase aprovou a loja errada. Para medir o que está no ar:
`PLACEHOLDER_BASE=https://a-loja.com.br npm run unbox:placeholder`.

**Scaffold recém-criado reprova de propósito**, porque as páginas legais nascem com `[NOME DA
LOJA]` e `[CNPJ]` para o lojista preencher. Por isso o gate NÃO está no `prebuild`: ele é da
publicação, não do build. Imagem raster não é varrida por texto, e o script avisa quando existe
alguma: logotipo errado dentro de um PNG só aparece olhando.

## Contraste e classificação de cor

`scripts/contraste.js` é para COLAR no console do DevTools com a loja aberta. Duas funções:
`contraste()` varre o texto visível e lista o que reprova; `classificar("#HEX")` diz se a cor
pode receber texto (**superfície**) ou só serve para contorno, ícone e faixa (**acento**).

A classificação é o uso principal: ao receber a paleta, meça cada cor contra a tinta e contra o
branco. Passa em algum dos dois (≥4,5) é superfície; não passa em nenhum é acento e **nunca**
vira fundo de texto. Se a marca quiser aquela cor como fundo, gere a versão funda e ponha branco
em cima. **Escreva o número ao lado do token no CSS**, senão o próximo agente refaz a mesma
avaliação e erra de novo.

O CLI não escolhe cor sozinho "para passar no WCAG": corrigir cor de marca em silêncio
descaracteriza a marca. Mede, aplica o que a marca pediu, e deixa o número e o custo escritos.

Duas coisas que a ferramenta não resolve, e estão ditas no cabeçalho dela: texto sobre foto (é
preciso amostrar os pixels da imagem) e conclusão tirada de captura de tela (esqueleto de
carregamento já enganou a leitura; confirme no DOM).

## Não negociável

O prebuild (`scripts/check-unbox-brand.mjs`) **bloqueia o build** se faltar:
- `<PoweredByUnbox />` em `components/site-footer.tsx`
- o container GTM em `app/layout.tsx`

Ele também avisa (sem bloquear) sobre logo, ícones, manifest e paleta ainda no placeholder, a
paleta default é canvas provisória, não escolha estética, e trocar pelas cores reais da marca é
o primeiro ato do briefing.

## Editor: o que não pode quebrar

A loja nasce ligada ao editor da Unbox (`editor.myunbox.com.br`): o lojista edita texto, foto, cor
e vitrine no painel, e a loja lê o publicado por HTTP e aplica por cima do código. A fiação é do
scaffold e tem oito pontos; mexer em qualquer um deles sem saber o que faz desliga o editor em
silêncio, sem erro de build:

- `lib/editable/` é cópia da foundation do editor. Não edite à mão: correção entra por versão da
  foundation. A exceção é `lib/editable/tokens.ts`, a lista de cores que o lojista pode mudar.
- `lib/editable/config.ts` carrega o slug desta loja no editor (o CLI carimba). Tem de ser IGUAL ao
  `slug` da entrada dela no `shops.json` do editor, senão o lojista publica e a loja nunca muda.
- `app/robots.ts` EXPORTA `DISALLOW`, e é essa lista que decide quais páginas o editor oferece
  (`lib/rotas-editaveis.ts` varre `app/(loja)/` e tira o que o robots bloqueia). Não há segunda lista.
- Rota nova em `app/(loja)/` entra em `CONTAINERS_POR_ROTA` (e em `SO_CHROME` se for só texto legal
  ou mecânica de compra), ou o gate reprova dizendo a rota.
- `next.config.ts`: `frame-ancestors` com `NEXT_PUBLIC_EDITOR_ORIGIN` (o editor abre a loja num
  iframe; `X-Frame-Options` não aceita origem externa) e `outputFileTracingIncludes` dos `page.tsx`
  (sem isso a varredura acha zero em produção).
- `middleware.ts` deixa passar `?unbox_editor_token=` (a prévia atrás da porta), grava o cookie da
  prévia das páginas do lojista em TODO host (a porta de preview só existe em host de preview) e deixa
  passar as rotas que o editor chama de servidor (`/api/revalidate`, `/api/unbox/catalogo`,
  `/api/unbox/paginas`).
- `/api/revalidate` aceita `x-editor-token`, purga a tag `unbox-editor-content` e devolve o recibo
  com `conteudo`: é com ele que o editor afirma "a loja está no ar com a versão N".
- `app/layout.tsx`: `EditableProvider` em volta do chrome e a linha única `<Rastreio>` no fim do
  `<body>`. Nenhum snippet de GTM, GA4 ou Pixel escrito à mão fora dela, senão o provedor dispara
  duas vezes.

**Páginas do lojista e coleções** (as rotas `/paginas/<endereço>`, `/<coleção>` e `/<coleção>/<artigo>`,
que o dono da loja cria pelo editor). Mais treze pontos, e cada um já custou uma vez:

- `app/layout.tsx` passa `paginasDoLojista={declaracaoDoLojista()}` ao provider. É o INTERRUPTOR: sem
  essa prop, o editor não oferece páginas nesta loja. Só passe enquanto as rotas de
  `app/(loja)/paginas`, `app/(loja)/[colecao]` e a casca de `components/paginas/` existirem.
- **SEM os `reservados` no layout, e COM eles em `/api/unbox/paginas`.** São duas portas com dois
  públicos: o provider serve o navegador de quem COMPRA (esta prop sai serializada no HTML de toda
  página), e a rota de API serve o EDITOR, servidor a servidor. A lista tem dezenas de rotas internas e
  nomes de arquivo de `public/`, ninguém no navegador do comprador a lê, e ela custava ~560 bytes por
  rota. Não acrescente o argumento no layout "para ficar igual".
- Uma coleção nunca pode ter o nome de um primeiro segmento de rota do código nem de uma entrada de
  `public/`: a rota estática ganha da dinâmica e a coleção nunca abriria. A lista é CALCULADA
  (`lib/reservados.ts`) e vai ao editor pela rota de API, que recusa o endereço antes de gravar. Rota
  nova entra sozinha; não digite a lista.
- A varredura dos RESERVADOS é a de `app/` INTEIRA (`segmentosDoCodigo()`), não a das páginas
  editáveis, que olha só `app/(loja)/`. Uma rota em `app/parceiros/page.tsx` ocupa `/parceiros` e
  ganha da coleção do mesmo jeito. São duas perguntas diferentes e por isso duas varreduras.
- `next.config.ts`: `outputFileTracingIncludes` cobre `"/**"`, e não só a rota de páginas, porque a
  lista de reservados é lida no `app/layout.tsx`, que roda em toda função. Reduzir esse escopo faz a
  lista sair curta em produção, sem erro nenhum. Ele inclui também `route.*` e os arquivos de metadata
  do Next, porque eles ocupam primeiro segmento de URL e entram na mesma lista.
- **Nada de `loading.tsx`** nos segmentos `paginas/[handle]`, `[colecao]` e `[colecao]/[handle]`: com
  um, o `notFound()` vira 200 com noindex (soft 404) e o endereço apagado nunca sai do índice.
- A PÁGINA VIVA vem antes do mapa de redirecionamentos: a rota resolve a página, e só quando nada
  responde é que `redirecionamentoDe` vale (308). Ao contrário, uma entrada antiga escondia a página
  publicada agora, e o sitemap prometia 200 numa URL que redirecionava.
- Nenhuma das quatro rotas lê `searchParams` ou `headers()`, que as tornariam dinâmicas e matariam o
  ISR. `/previa-do-editor` lê os dois de propósito: ela é `force-dynamic` e não tem ISR a perder.
- `generateMetadata` de cada uma repete o `openGraph` INTEIRO (o App Router substitui o objeto do
  layout pai, não faz merge) e declara `alternates.canonical` relativo, inclusive na paginação. Pelo
  mesmo motivo, ele declara `images` SEMPRE: `app/opengraph-image.tsx` só é injetado enquanto ninguém
  declara `openGraph`, então deixar `images` de fora não "cai" na imagem da loja, apaga o cartão.
- A DESCRIÇÃO tirada do corpo sai de uma lista FECHADA de campos de prosa (`CAMPOS_DE_PROSA`, em
  `lib/paginas-seo.ts`), na ordem de leitura. Varrer `values` alfabeticamente fazia `cta` ganhar de
  `titulo`, e a description de uma página sem resumo saía "Comprar agora". Campo de prosa novo num
  componente desta loja entra nessa lista.
- `/previa-do-editor` exige o token assinado do editor (`verifyEditorToken(…, "preview")`), na query ou
  no cookie que o `middleware.ts` grava a partir dela. É a rota que renderiza página OCULTA, e a loja
  responde 404 nessa mesma página; o middleware não serve de porta porque ele só fecha a loja em host
  de preview.
- A loja PENEIRA os mapas do publicado ao lê-los (`lib/paginas-publicadas.ts`): id que não bate com o
  registro, artigo de coleção inexistente e endereço reservado ficam de fora. A régua do editor já
  recusa tudo isso ao gravar; a peneira existe porque o documento pode chegar por outro caminho, e o
  sitemap é a superfície pública onde o erro sai.
- O card da listagem usa `next/image`, o mesmo que a página do artigo: com `<img>` cru, as duas telas
  obedeciam a listas de hosts diferentes e a mesma foto abria numa e quebrava na outra.
- Rota nova das páginas entra em `CONTAINERS_POR_ROTA` com curinga (`pagina-*`, `colecao-*`,
  `artigo-*`) e em `ROTAS_DO_LOJISTA` (`lib/rotas-editaveis.ts`), senão o gate reprova. E **nenhum
  container do código pode começar com `pagina-`, `artigo-` ou `colecao-`**: esses prefixos são das
  páginas do lojista, e o gate reprova quem os usar.
- **ROTA QUE RENDERIZA CONTAINER DO LOJISTA PRECISA DA FATIA DO DOCUMENTO.** O `app/layout.tsx` entrega
  ao provider `documentoSemPaginas(conteudo)`: o documento viaja serializado no HTML de TODA página, e
  sem esse corte cem artigos publicados viajariam junto com a página de um produto. Quem renderiza uma
  página do lojista acrescenta o que ela usa, com `<EditableFatia fatia={fatiaDoDocumento(doc, [...])}>`
  em volta da casca — a página avulsa e o artigo levam o próprio container; a listagem leva o container
  da coleção MAIS o **cabeçalho** de cada artigo que ela mostra (`${a.id}.${SECAO_CABECALHO}.`), porque o
  card lê três caminhos e o corpo do artigo não aparece nele. Hoje isso está nas duas metades de servidor
  (`components/paginas/pagina-do-lojista.tsx` e `colecao-do-lojista.tsx`), e é por elas que as quatro
  rotas e a prévia passam. **Rota nova que renderize container do lojista sem a fatia não dá erro nenhum:
  o texto do lojista simplesmente some da tela e no lugar dele aparece o literal do código** — o
  `unbox:editavel` reprova o build por isso, conferindo no fonte que toda rota de `ROTAS_DO_LOJISTA`
  chega a um `<EditableFatia>`. Medido no template com 40 artigos de ~3.600 caracteres, em build de
  produção (em `next dev` o corte não aparece: o React serializa as props de servidor no HTML): a
  página inicial caiu de 282.936 para 83.081 bytes, a de produto de 302.550 para 102.695 e a listagem
  de 269.394 para 74.762.

**SEO das páginas do lojista, os detalhes que não se veem no navegador:**

- `app/robots.ts` exporta duas listas: `DISALLOW` (por SEGMENTO, que é como o Next roteia e como
  `bloqueadaPeloRobots()` decide o que o editor oferece) e `DISALLOW_NO_ROBOTS`, que é a mesma coisa na
  gramática do arquivo (`/conta$` e `/conta/`). O robots.txt casa por PREFIXO DE TEXTO: com
  `Disallow: /conta` solto, a coleção `contato` era publicada no sitemap e bloqueada pelo próprio
  robots.txt da loja.
- Listagem de coleção SEM nenhum artigo responde 200 e `noindex, follow`: a URL é da loja, mas uma
  página com uma frase só não é o que se oferece ao índice. Ela volta a ser indexável sozinha no dia
  do primeiro artigo.
- Artigo marcado "ocultar de buscadores" mantém o card na listagem (quem lê tem de chegar nele) e sai
  do `ItemList` do dado estruturado, como já saía do sitemap.
- O nó da `Organization`/`WebSite` é emitido NA PÁGINA que o referencia por `@id`: parser de dado
  estruturado não sai da página para resolver um `@id` que só existe na home.
- `dateModified` e `article:modified_time` só saem quando a data se lê. Na prévia o registro nasce com
  as datas em branco, e `""` é dado inválido publicado, não campo ausente.

Toda seção nova nasce editável pelos primitivos (`Editable.Text`, `Editable.Image`, `Editable.Icon`,
`Editable.Section` com `kind` e `label`). As regras completas, com o modo de falha de cada uma, estão
no README do editor da Unbox. O que NÃO vira primitivo: preço, produto do catálogo, texto legal,
rótulo de formulário e "Powered by Unbox".

Gate: `npm run unbox:editavel` com o servidor no ar e `NEXT_PUBLIC_EDITOR_ORIGIN` preenchida. Saída
`2` é NÃO RODOU, nunca aprovação.

## Subagentes disponíveis

Declarados em `.claude/agents/`, para uso **depois** que o contrato de design fecha (o
protocolo está em `agents/CONSTRUCAO.md`):

| Agente | Para | Escreve? |
|---|---|---|
| `avaliador-visual` | uma leitura do QA (composição, contraste, responsivo, copy ou honestidade) | não |
| `conteudo-secao` | o conteúdo de uma seção da home | não, devolve o objeto |
| `paginas-legais` | uma página institucional | sim, só a dela |
| `assets-marca` | preparar `public/brand/` | sim, só essa pasta |

Os dois primeiros não têm Write de propósito: `home-recipe.ts` e `globals.css` são arquivos de
dono único, e escrita concorrente neles perde trabalho em silêncio.

## Dado que a loja não tem, o bloco não renderiza

A regra veio de uma loja real em produção: a foundation preenchia vazio com conteúdo plausível
(nota 4,9 com 25 mil avaliações, "793 vendidos esta semana", depoimentos de "Cliente A" com
selo de compra verificada, estoque que descia sozinho enquanto a pessoa lia, "Sem glúten" por
default, prazo de devolução de 30 dias contradizendo a página do CDC). Tudo foi ao ar como fato,
e parte disso é violação de política do Google, da ANVISA ou do CDC. Nada disso existe mais.
Se um bloco depende de dado (avaliação, depoimento, estoque, prazo, atributo de produto), ele
**some** sem o dado. Nunca cai em default. O `unbox:honestidade` pega o que voltar.

Seções da home que somem sem props na receita: `reviews`, `reviews-carousel`, `savings`, `kits`,
`combos-carousel`, `category-pills`, `product-showcase`, `trust-bar` (sem `items` e sem frete
grátis real), `trust-strip`, `spec-table`, `comparison`, `attributes-marquee`, `founder-story`,
`video-wall`, `newsletter` (sem `title` + `action`, a URL que recebe o e-mail). `purchase-hero` só mostra
estrelas com `rating` e perks com `perks`. O que resta com
default é copy de interface (título do hero, rótulo de botão), nunca um fato sobre a loja.

## Copy sem travessão

Nada de travessão na copy da loja: use vírgula, dois-pontos, ponto ou parênteses, e `·` quando
for separador (endereço, título de aba, selo). Vale para a interface, para os textos que você
escreve na conversa com o lojista e para o que você deixa em comentário: o travessão em
comentário é o que ensina a próxima seção a nascer com um. O `npm run build` reprova travessão
na copy de `app/` e `components/`.

## Como falar da plataforma

A loja é de um cliente que comprou a Unbox, e **tudo o que você escreve chega nele**: a conversa,
o comentário no código, a copy da tela, o relatório do fim. Restrição de plataforma existe em
qualquer plataforma; o que não pode é você virar crítico dela dentro do produto que ela vende.

**Diga o que a regra é, o que ela significa para a loja e qual é a decisão.** Sem juízo de valor,
sem diagnóstico da qualidade da plataforma, sem dramatizar. Ficam de fora: "é pior do que parece",
"limitação da plataforma", "não dá pra resolver", "infelizmente", "a Unbox não deixa/não aceita",
"culpa/problema/falha da Unbox". Não é eufemismo: o fato inteiro continua dito, o julgamento é
que sai. Se a restrição realmente bloqueia o que o lojista pediu, diga o que dá pra fazer e
registre o pedido, quem leva isso adiante é o gerente de conta da Unbox, não a interface da loja.

**Para o comprador, nunca explique a plataforma.** Ele precisa da regra da loja, não do motivo
técnico dela, e o único lugar onde a Unbox aparece para ele é o selo "Powered by Unbox".

O caso que originou esta regra, frequência de assinatura, que é campo do pedido e vale para o
pedido inteiro:

| | |
|---|---|
| ✗ para o lojista | "É pior do que parece: a Unbox guarda um `recurringItemsFrequencyId` por pedido. É limitação da plataforma e não dá pra resolver no front." |
| ✓ para o lojista | "A frequência é do pedido, então vale para todos os itens assinados dele: escolher 60 dias num segundo produto passa o pedido todo para 60. Deixei isso explícito na tela antes de finalizar." |
| ✗ para o comprador | "Por limitação do sistema, só é possível uma frequência por pedido." |
| ✓ para o comprador | "Os itens assinados deste pedido chegam na mesma frequência." |

O `npm run build` reprova o julgamento sobre a plataforma em qualquer arquivo do projeto.

## A foundation é de ramo nenhum

Ela nasceu de uma loja de alimentação e por duas varreduras ainda entregava loja de outro ramo
com instrução de uso de um produto alimentício na PDP, aba nutricional com traços e selo "Sem
glúten" inventado. A regra que decorre disso:

**Nada específico de um ramo renderiza sem dado daquele ramo.** Tabela nutricional, modo de
uso, composição, selos de atributo, FAQ, produtos relacionados: tudo vem do enriquecimento
(`lib/enrichment/products.json`) ou de `lib/store-config.ts`, e o que não existir não
aparece. Não existe default de conteúdo na PDP. Copy com vocabulário de um ramo é escrita
pelo briefing, para a marca certa, nunca na foundation. O `npm pack` do CLI reprova se isso
voltar, inclusive em comentário, porque comentário ensina o agente a escrever igual.

## Armadilhas que já custaram caro

- **O prompt do briefing já está no seu contexto.** `.claude/settings.json` carrega
  `.claude/agents/branding-briefing.md` como system prompt da sessão. Não abra esse arquivo pra
  "conferir o que fazer": são ~8k tokens do que você já tem.
- **`home-recipe.ts` e `globals.css` são arquivos-gargalo.** Concentram, cada um, decisões de
  várias frentes. Se houver trabalho paralelo, eles precisam de um dono só.
- **Header imersivo tem dois lados que precisam concordar:** a seção emite `.hero-imersivo` e o
  header lê `[data-chrome="imersivo"]`. Mexer num sem o outro quebra silenciosamente.
- **`html { overflow-x: clip }`** é o que segura o marquee no layout. Por causa dele o header
  imersivo usa `sticky` com margem negativa, não `fixed`.
- **O dataLayer fala GA4 padrão E o dialeto do GTM central da Unbox, no mesmo push.** O
  container central lê `ecommerce.items` (GA4), `ecommerce.purchase.*` (Universal Analytics),
  `transactionId`/`transactionTotal` (clássico) e `dataLayerReady { pageType, products[] }`. A
  camada emite tudo; "limpar" para GA4 puro deixa a compra vazia no GA4 da Unbox, sem erro
  visível. O build bloqueia. Nunca priorize o `gtag` sobre o dataLayer: foi assim que o GTM
  central ficava cego em toda loja com GA4 próprio. `value` é número, `discount` vem do
  carrinho, purchase só com pedido PAGO, dados de cliente saem hasheados.
- **A URL do checkout SEMPRE carrega `?id=&token=` do carrinho, e o build bloqueia sem isso.**
  É o que permite recuperar carrinho abandonado: o CRM e o pixel leem a URL navegada, não o
  cookie httpOnly. A garantia vive no `middleware.ts` (`urlDoCheckoutComPonteiro`), porque ele
  roda em toda requisição, servidor, client-side, link direto, refresh, e não depende de
  alguém lembrar de chamar o helper certo. A regra já se perdeu uma vez por viver só na página.
- **`loading.tsx` no segmento anula o `notFound()` da página.** Ele abre um `<Suspense>`; o
  shell fica pronto na hora e sai com HTTP 200, e quando o `notFound()` acontece o status já
  foi, soft-404, que faz o Google indexar página vazia. Por isso `categoria/[tagSlug]` e
  `produto/[productSlug]` validam a existência num `layout.tsx`, que renderiza acima da
  fronteira do Suspense. Criou rota dinâmica com `loading.tsx`? Valide no layout, não na page.
- **Nunca escreva cor literal em `box-shadow`.** Use os tokens `--store-shadow-*`. O verde da
  foundation sobreviveu a uma varredura de 304 cores literais porque estava dentro de
  `shadow-[...]` e de `boxShadow` inline, que ninguém olhou.
- **Fonte vive no `<body>`, não no `<html>`.** As variáveis do `next/font` são declaradas na
  className do body; regra em `html` não as enxerga e o corpo cai em serif. Só aparecia no
  build de produção.
- **Falha da API só vira "vazio" SEM credenciais.** Nunca `.catch(() => [])` em página, layout ou
  chrome: use `mockupOr(promessa, fallback, "rótulo")` (`lib/mockup.ts`). Sem `.env`, devolve o
  fallback (modo mockup). Com credenciais, loga e relança: o ISR mantém a versão anterior e o
  `error.tsx` aparece. O `.catch` cego produzia home vazia com HTTP 200 cacheada por 5 minutos e,
  nos layouts de produto/categoria, um 404 cacheado quando a Unbox oscilava.
- **`placeOrder` tem timeout próprio (90 s) e erro próprio (`PLACE_ORDER_TIMEOUT`, 504).** Abortar
  no cliente não aborta no servidor: o pedido pode nascer depois que a loja desistiu. Com esse
  código, o checkout-client NÃO reabre o botão de pagar e manda conferir em Meus pedidos. Não
  "simplifique" isso num retry.
- **`alternates`/`openGraph` não fazem merge entre layout e página.** Canonical no `app/layout.tsx`
  é herdado por TODAS as rotas que não declaram o seu (catálogo, categorias, legais viraram
  canonical da home e saíram do índice). Canonical é por página, sempre relativo (`/produtos`),
  e o `metadataBase` resolve. Nunca use `publishedUrl` do painel como canonical: pode ser outro domínio.
- **Posse de pedido é cookie ASSINADO.** `setOrderToken` grava `<token>.<HMAC(SESSION_SECRET)>` e
  `getOrderToken` verifica. Sem isso qualquer valor de cookie abria qualquer pedido pelo
  `referenceId` (modo parceiro nem valida o token). O CLI gera `SESSION_SECRET` no `.env.local`;
  em produção ele precisa existir, e não existir não é aviso: `lib/session.ts` **recusa** assinar
  e conferir a posse (lança), porque assinar com segredo vazio dá uma assinatura constante, igual
  em toda loja, que é a posse forjável que o HMAC existe para impedir. Em desenvolvimento,
  `lib/config.ts` sorteia um valor no boot e nada disso aparece. **A recusa é conferida na PORTA do
  `POST /api/checkout`**, junto do rate-limit: sem a variável a rota responde 503 com o código
  `SESSION_SECRET_AUSENTE` e o carrinho intacto. Não mova essa guarda para depois do `placeOrder`:
  lá o pedido já foi criado e cobrado, a recusa cairia no `catch` como 502 e o cliente tentaria de
  novo, que é a cobrança dupla que o comentário daquele `catch` existe para evitar.
- **O preço final vem sempre do catálogo.** O servidor recalcula o carrinho a partir dele, então
  o preço enviado no `addCartItems` não altera o que é cobrado.
  Kit "com desconto" calculado no front (`combos.ts`) é promessa que o carrinho desmente: desconto
  real de kit é regra de preço/cupom no painel Unbox. O mesmo vale pra desconto de assinatura: só
  com `pricingPolicy` do backend (sem ele, `percentOff` é `null` e nenhum "-N%" aparece).
- **Foto de seção usa `<Foto>` (`components/ui/foto.tsx`), com `sizes` do tamanho real na tela.**
  `next/image` direto quebra a página inteira quando o `src` da receita aponta para um host que o
  `next.config.ts` não autoriza; o `<Foto>` cai em `<img>` nesse caso, sem otimizar mas sem
  derrubar. E `sizes` errado é o mesmo que não ter: baixa grande demais (peso) ou pequena demais
  (borrada). Logo do chrome, bandeira de pagamento e o hero em `<picture>` continuam em `<img>`
  cru, cada um com o motivo escrito ao lado do `eslint-disable`.
- **`<img>` abaixo da dobra nasce `loading="lazy" decoding="async"`.** O React 19 emite
  `<link rel="preload">` sozinho para `<img>` eager renderizado no servidor: as bandeiras do
  RODAPÉ estavam disputando conexão com a primeira dobra. Não é sobre bytes, é sobre prioridade.
- **Em `<picture>`, cada `<source>` precisa da SUA dimensão e do SEU `sizes`.** Sem dimensão, o
  navegador reserva a proporção do `<img>` (a de desktop) e a página pula quando a arte mobile
  chega. Sem `sizes` no source que casou, ele escolhe uma variante pequena e a arte chega borrada.
- **ID de analytics passa por `idValido()`.** Placeholder é truthy: uma loja rodou 31 dias com
  `NEXT_PUBLIC_GA_ID="x"`, script carregando e nada chegando em conta nenhuma. Campo vazio quebra
  visivelmente; placeholder quebra em silêncio. Mesma razão da description nascer vazia.
- **`NEXT_PUBLIC_GTM_ID` desliga o Pixel do código.** Pixel no container da loja E no código conta
  PageView duas vezes, e a inflação não dá sinal. Com container, tudo entra por ele.
