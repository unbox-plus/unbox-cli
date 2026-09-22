## Changelog

### Não lançado (v0.25.0) — a integração com a Unbox saiu do template e virou pacote

Até aqui, toda chamada à API de parceiros vivia dentro do template, em `lib/unbox/*.ts`, e era
**copiada** para cada loja gerada. Isso fazia com que atualizar a integração, inclusive as
correções de segurança e as de cobrança, exigisse substituir arquivo a arquivo em cada loja no
ar, uma por uma, e antes disso descobrir quais lojas estavam atrás de qual versão. Agora essa
camada é o pacote **[`@unbox-plus/sdk`](https://github.com/unbox-plus/unbox-sdk)**, dependência
da loja: atualizar é `npm install @unbox-plus/sdk@latest`, e nenhum arquivo da loja muda.

**As chamadas não mudaram de comportamento.** Foram para o pacote como estavam, com as
peculiaridades do gateway escritas ao lado de cada uma: os três cabeçalhos, a seleção rica com
volta para a enxuta no pedido, o prazo próprio do `placeOrder`, a regra de não repetir mutação, o
filtro de produto oculto, a tradução de erro em PT-BR e os rótulos de status.

O que mudou na loja gerada:

- **`lib/unbox/` deixou de existir; no lugar entrou `lib/unbox.ts`**, um arquivo só, com
  `import "server-only"` na primeira linha, que amarra o `.env` desta instalação ao pacote
  (`createUnboxStore`) e exporta `withStoreClient`, `getStoreClient`, `getShopContext`,
  `getCustomerClientFor` e `loadAllCatalogItems`. É o único ponto da loja que conhece credencial
  da Unbox, e é o que torna a atualização um bump de versão.
- **`lib/dataloader.ts` foi absorvido.** A paginação por offset do catálogo inteiro (a que não
  confia num `first` gigante, porque há teto de servidor que trunca em silêncio) é
  `loadAllCatalogItems` do pacote. `app/sitemap.ts` e `app/llms.txt/route.ts` importam de
  `@/lib/unbox`.
- **`lib/config.ts` encolheu.** `decodeJwtClaims` e os dois `SHOP_*_CLAIM` saíram (são do pacote,
  e a leitura do JWT deixou de usar `Buffer` para rodar no Edge), e `hasUnboxCredentials` passou
  a usar a régua do pacote. `serverEnv` continua igual: o ambiente é da loja.
- **`lib/api.ts` deixou de ter a leitura de `invalidAddressFields`.** Dizer QUAL campo do endereço
  a Unbox recusou é interpretação de erro da API, então virou `invalidAddressMessage` no
  pacote. A resposta do BFF (`ok`, `fail`, `failFrom` e o log que nunca vaza o corpo da
  requisição) continua na loja.
- **`lib/customer-session.ts` virou três linhas**: lê o cookie httpOnly e entrega ao pacote. A
  regra de "token vencido vale como deslogado" foi com ele.
- **Imports reapontados** em 30 arquivos: `@/lib/unbox/{client,types,errors,customer}` →
  `@unbox-plus/sdk`, `@/lib/unbox/webhooks` → `@unbox-plus/sdk/webhooks`, `@/lib/unbox/store` →
  `@/lib/unbox`. Os cinco scripts de `scripts/` (`unbox:test`, `unbox:dump`, `unbox:order:pix`,
  `unbox:webhook:subscribe`, `unbox:abandoned`) importam o pacote direto.
- **O bundle do navegador não engordou.** `components/cart/cart-provider.tsx` importa
  `cartEventLabel` do pacote, e o índice dele é livre de builtin do Node de propósito (o
  `node:crypto` do webhook mora em `@unbox-plus/sdk/webhooks`). Medido no build de produção: o
  chunk do cliente leva o rótulo e nenhuma query do GraphQL.

### v0.24.0 — foundation 18, fase 2: landing pages por público

A versão por público chega às landing pages, nas duas formas. A primeira é a versão da própria LP: a oferta
(`/oferta`) e toda página avulsa do lojista (`/paginas/<endereço>`) mudam para cada público como a home já mudava
(textos, imagens, ordem e seções ocultas), pelo mesmo "Ver como" do editor. A segunda é a cópia: na ficha de uma
página avulsa, "Duplicar para um público" faz uma cópia com endereço próprio (`<endereço>-<público>`), oculta e
fora dos buscadores, e quem abre esse endereço entra no público, como pelo link do anúncio.

- **A declaração** (`lib/personalizacao.ts`) passa a `["home", "oferta", "pagina-*"]`. O curinga é o das rotas
  editáveis: casa toda página avulsa, cujo container nasce no documento.
- **A borda** (`lib/publicos-da-borda.ts`): `containerDoPedido` diz o container da página pedida (`/` → `home`,
  `/oferta` → `oferta`, `/paginas/<h>` → `pagina-<h>`, só o que a declaração tem), e a reescrita vai para a rota do
  público da página (`/_publico/<id>`, `/_publico/<id>/oferta`, `/_publico/<id>/paginas/<h>`). Uma LP só é
  reescrita quando o público TEM versão nela (`versoes` na lista), para não guardar em cache uma cópia por público
  igual à de Todos; a home vai sempre, como antes. A página feita para um público grava a escolha como o link do
  anúncio, mas só na navegação do documento (`sec-fetch-dest`): o prefetch do `<Link>` não põe ninguém no público.
  Numa instância fria, a página avulsa também espera a lista (até 400 ms), porque só ela sabe se a página é de um
  público.
- **As rotas do público das LPs**: `app/(loja)/%5Fpublico/[publico]/oferta` (a mesma `PaginaDaOferta`, agora em
  `components/landing/pagina-da-oferta.tsx`, dentro de `<EditablePublico>` com a camada cortada na oferta) e
  `app/(loja)/%5Fpublico/[publico]/paginas/[handle]` (a mesma resposta de `/paginas/[handle]`, agora em
  `components/paginas/pagina-avulsa.tsx`, com `PaginaDoLojistaNaTela publico=`: a fatia, as vitrines e o dado
  estruturado saem do documento efetivo do público). As duas têm a canônica e os metadados da página de Todos.
- `camadaDoPublico(doc, id, containers)` corta a camada nos containers da página: a versão da home deixa de levar no
  HTML a camada das LPs, e vice-versa.
- `GET /api/unbox/publicos` ganha `versoes` (os containers em que cada público tem versão) e `paginas` (as páginas
  avulsas visíveis feitas para um público). Publicar pelo editor revalida a lista SEMPRE (a primeira troca numa LP
  muda `versoes`), e cada caminho publicado revalida as versões dele (`/oferta` a da oferta, `/paginas/…` a das
  páginas, `/` as três).
- O `check-editable` cobra, para cada container declarado além da home, a página do público da rota que o
  renderiza (a rota sai de `CONTAINERS_POR_ROTA`) e que ela junte a versão (`<EditablePublico>` numa rota do código,
  `aplicarPublico` na página do lojista). A tabela passou a ser lida do arquivo cru: a peneira de comentários lia o
  `pdp/*` de um comentário de linha como começo de comentário de bloco e engolia metade dela.
- **Landing page sem cabeçalho e sem rodapé**: a ficha da página avulsa ganha "Ocultar cabeçalho" e "Ocultar
  rodapé" (`ocultarCabecalho`, `ocultarRodape` no registro; a cópia para um público herda). A casca marca o pedido
  (`.lp-sem-cabecalho`, `.lp-sem-rodape`) e o `app/globals.css` esconde pela mesma mecânica do checkout
  (`body:has(...)`, sem JS, sem piscar). O cabeçalho some com a faixa de avisos (`.chrome-faixa`), e o botão do
  WhatsApp fica. O rodapé some MENOS a barra de baixo (`.rodape-barra`), que leva o selo "Powered by Unbox" (contrato)
  e os dados da empresa (a lei do comércio eletrônico os pede à vista). A loja declara `ocultaChrome: true` em
  `lib/paginas-do-lojista.ts`, e o `check-editable` cobra a casca, o CSS e a barra.
- **A oferta também esconde cabeçalho e rodapé**: a `/oferta` (página do código, sem ficha) ganha os mesmos dois
  interruptores, na aba Seções do editor, no grupo "Cabeçalho e rodapé". O pedido mora no estado do container da
  página (`sections.oferta.ocultarCabecalho`, `ocultarRodape`, pela operação `set_chrome`, com desfazer), e a versão
  de um público o herda. `<PedidoDeChrome container="oferta"/>` (`components/landing/pedido-de-chrome.tsx`) marca o
  pedido com as mesmas classes da página avulsa, e o CSS é o mesmo: a barra do rodapé com o selo e os dados da
  empresa fica. A loja declara as páginas em `lib/chrome-das-paginas.ts` (`OCULTA_CHROME_EM`), que o layout passa ao
  editor (`ocultaChromeEm`); o `check-editable` cobra a marca na rota de cada página declarada, o CSS e a barra.
- **A prévia do editor ganha a moldura da loja**: `app/previa-do-editor/layout.tsx` usa `components/moldura-da-loja.tsx`,
  a mesma de `app/(loja)/layout.tsx`. A página do lojista aparece na prévia com o cabeçalho e o rodapé, como vai ao ar,
  e o "Ocultar" aparece na hora (o pedido sai do rascunho).
- **O catálogo da loja em toda página** ("+ Adicionar seção"): a home, a oferta, as páginas e os artigos do lojista,
  a listagem de uma coleção, o catálogo de produtos e a página de produto oferecem o MESMO catálogo
  (`catalogoDaLoja`, `components/home/sections/catalogo.ts`; nomes em `components/home/sections/tipos.ts`). Só entra o
  que aparece: as seções que se desenham sozinhas (texto, banner, benefícios, como funciona, cards, citação, HTML),
  as de produto (vitrine e bloco de compra sempre; categorias, destaques, economia e kits quando o catálogo tem o que
  mostrar) e as que dependem de conteúdo real da marca (depoimentos, avaliações, selos, diferenciais, faixa rolante,
  ficha técnica, vídeos, nossa história, comparativo, números, comunidade, newsletter), que entram quando a receita
  da loja as traz com conteúdo, e nascem com ele. Nada de depoimento ou número inventado.
- **O bloco de compra tem o produto escolhido pelo lojista** (a foto é o seletor, o mesmo da vitrine; vale o primeiro
  com preço), com versão por público como toda escolha. O botão leva o produto ao passo 2
  (`/carrinho/oferta?…&produto=<endereço>`), que o põe primeiro e já com a quantidade. Cada bloco adicionado ganha a
  âncora dele (`#comprar-<id>`); o da receita guarda `#comprar`. E o passo 2 cabe no celular: a coluna do grid não
  tinha tamanho no celular e crescia até o slogan com os selos (medido: 478 px numa tela de 375); agora é
  `grid-cols-1`, e o nome do produto quebra em até duas linhas em vez de cortar em "Máscara Nu…".
- **Os dados das seções só vão no HTML quando há seção**: produto, catálogo, listagem e páginas do lojista mandam o
  `HomeData` só quando o container tem seção adicionada no publicado (`dadosSeHouverSecoes`). Na prévia, a página
  busca em `GET /api/unbox/secoes` (com o token da prévia) pelo `useDadosDasSecoes`. A oferta e a página de produto
  montam o catálogo pelo invólucro de cliente `<SecoesComCatalogo>`. A listagem de coleção ganhou a lista de artigos
  como seção fixa (o que se adiciona entra antes ou depois dela), e as páginas passam a ter os mesmos destaques e
  kits da home.
- **A categoria espelha o catálogo de produtos**: `Editable.Sections` ganha `layout="espelho"`, a página que mostra a
  lista da dona igual a ela (ordem, ocultas, cópias e as seções adicionadas) sem mandar nela: não declara catálogo nem
  posição, e o manifesto sai com `semLayout`, como no `layout={false}`. `/categoria/[tagSlug]` passa a usá-lo (era
  `layout={false}`, que só levava a copy): o que o lojista adiciona, move ou oculta em `/produtos` vale em toda
  categoria, como o painel da categoria já dizia. O "+" continua só em `/produtos`.
- **A ordem de cada público acompanha a seção nova**: numa versão com ordem própria, a cópia entra logo depois da
  origem e a seção adicionada depois da mesma vizinha que tem em Todos (antes, as duas caíam no fim da versão); a
  removida sai das camadas, e desfazer as devolve.
- **A foundation (`lib/editable`)**: `containerVaria` (o curinga), a operação `duplicate_page` (conteúdo de Todos,
  sem camada, oculta e fora dos buscadores, com desfazer exato), `publico` no registro da página e em
  `update_page`, excluir um público desliga as páginas dele (desfazer religa), e `decidirPublico` recebe o
  `container` e a `navegacao` do pedido.

Medido na loja gerada por este CLI (`next build && next start`, lendo o editor local), 34 de 34: a oferta e a
página avulsa servem a versão de quem tem uma e a de Todos para os outros (público sem versão naquela página e
controle incluídos), com a canônica da página; a home do público não leva a camada das LPs; o link `?para=` da LP
grava o público; abrir a cópia grava o público (e no navegador a home seguinte já vem na versão dele), o prefetch
não; `/_publico/…/oferta` e `/_publico/…/paginas/…` respondem 404 por acesso direto; e o gate reprova a loja que
declara a oferta sem a página do público dela. Cabeçalho e rodapé, 19 de 19: os interruptores escondem na prévia na
hora e na loja depois de publicar (375 e 1440 px, sem rolagem lateral), a barra com o selo fica, as outras páginas
continuam com cabeçalho, a versão de um público herda o pedido, e o gate reprova a loja que declara sem a regra do
CSS. A vitrine de uma página avulsa aceita escolha própria por público (camada). Catálogo em toda página, 34 de 34
(com um catálogo de teste): o "+" das seis páginas oferece os 12 tipos que a loja de teste consegue mostrar e nenhum
sem conteúdo real; o bloco de compra entra pelo clique na página de produto e aparece na hora; a escolha de produto
troca na prévia e vale em toda página de produto; na oferta, o bloco adicionado convive com o da receita sem âncora
repetida e mostra o produto da versão de Cacheados para Cacheados; destaques numa página avulsa, categorias depois
da lista do blog e benefícios no catálogo; página sem seção não leva o catálogo no HTML; o botão do bloco leva o
produto ao passo 2, que o mostra primeiro. E o `check-editable` aprova a loja de teste com catálogo (11 páginas).
Categoria, 24 de 24: o bloco adicionado em `/produtos` aparece na prévia da categoria antes de publicar, com o
produto escolhido; o painel da categoria diz que a lista é a de `/produtos`, não oferece o "+" e não deixa arrastar;
publicado, as duas categorias mostram o bloco; subir o bloco e ocultar a faixa de confiança em `/produtos` vale na
categoria; sem rolagem lateral em 375 e 1440 px. Oferta sem cabeçalho e rodapé, 23 de 23: os interruptores da aba
Seções escondem na prévia na hora; o que mudou diz qual dos dois e para que lado; a home continua inteira (e não
mostra os interruptores); publicado, o HTML da `/oferta` já sai marcado do servidor, também na versão de Cacheados;
em 375 e 1440 px o cabeçalho some, o rodapé fica só com a barra do selo e não há rolagem lateral, e `/produtos`
continua inteira; desligar volta ao normal. O gate reprova a loja que declara `ocultaChromeEm` sem a marca na página.

Loja já gerada: como na 0.23.0, nada muda sozinho. As LPs por público ligam quando a loja declara `oferta` e
`pagina-*` e tem as duas rotas do público (o `check-editable` diz o que falta). A categoria que espelha `/produtos`
chega com o `components/catalog/catalog-client.tsx` e a página da categoria novos; o cabeçalho e o rodapé da oferta,
com o `pedido-de-chrome.tsx`, o `lib/chrome-das-paginas.ts`, a marca em `pagina-da-oferta.tsx` e a prop no layout.

### v0.23.0 — foundation 18: a home muda para cada público

O lojista define até cinco PÚBLICOS no editor (quem busca volume, quem chegou pelo anúncio de inverno) e dá a
cada um a sua versão da home: textos, imagens, vitrines, ordem e seções ocultas. O que o público não mudou
continua sendo o de Todos. Quem decide quem vê o quê é a borda da loja, por sinais FORTES (o link do anúncio
`?para=<id>`, a campanha `utm_*` contém um texto, os apps da loja como o quiz, e a conta do cliente, conferida no
login) e FRACOS (o site de onde a pessoa veio e a região dela), que nunca passam por cima de um forte. Um grupo de
controle (20% por padrão) cai no público e vê Todos, para medir se a versão vende mais. E quem não quer a
personalização pede a loja padrão na página de privacidade.

- **A home virou `PaginaInicial({ doc })`** (`components/home/pagina-inicial.tsx`). `app/(loja)/page.tsx` é
  casca, e a versão de cada público (`app/(loja)/%5Fpublico/[publico]`) renderiza o mesmo corpo com o
  documento dela. É o que faz as vitrines saírem por público.
- **A borda** (`lib/publicos-da-borda.ts`): o middleware passa as saídas que liberam a loja por `seguir`, que
  reescreve `/` para `/_publico/<id>` (inclusive o RSC da navegação interna, que o Next não deixa o middleware
  distinguir) e grava o cookie `unbox_publico`. A lista dos públicos fica em memória e se renova em segundo
  plano: nenhum pedido espera busca. Acesso direto a `/_publico/…` responde 404.
- `GET /api/unbox/publicos`: `{ controle, publicos: [{ id, nome, entrada }] }`, pública como a de páginas, sem
  a descrição (que é do chat do editor).
- **O contrato dos apps**: o quiz só avisa a resposta,
  `window.dispatchEvent(new CustomEvent("unbox:resposta-do-quiz", { detail: { resposta } }))` (ou `respostas: [...]`),
  e quem liga a resposta ao público é o lojista, no editor (a regra "Respostas do quiz"). O app que já sabe o id o
  diz direto: `unbox:definir-publico` com `{ id }`. `<PontoDePublico/>`, no layout, ouve os dois, grava a escolha e
  troca a versão sem recarregar. A resposta não vai para o dataLayer; vai só o público.
- **A medição**: `scriptDaMedicaoDoPublico` empurra `publico`, `publico_grupo` (versão ou controle) e
  `publico_origem` para o dataLayer antes do GTM. Não vai para Meta, TikTok nem CAPI.
- `app/api/revalidate` revalida as versões junto com `/`; `lib/rotas-editaveis.ts` lê a pasta `%5Fx` como a
  rota `/_x` (e a do público é interna); o gate de marca cobra o `dataLayerReady` na `PaginaInicial`; e o
  `check-editable` cobra o par da personalização (a página do público com `<EditablePublico>` e o `seguir` no
  middleware) quando o layout a declara.
- **A foundation (`lib/editable`)**: públicos e camada no documento, as operações com desfazer exato, a
  projeção para o navegador como lista de permissão (campo novo fica no servidor até alguém o permitir), o
  "Ver como" do editor e `EditablePublico`. Detalhe no README da foundation, seção "Personalização por público".

- **Os sinais fracos, na borda**: `seguir` passa a `decidirPublico` o `referer` (site de outro host: Instagram,
  Google… ou o endereço de outro site, com os subdomínios) e a região que a Vercel põe em todo pedido
  (`x-vercel-ip-country`, `-country-region`, `-city`; só no Brasil, porque "SC" também é a Carolina do Sul). Sinal
  fraco grava como fraco, o que guarda o sorteio do visitante, e não regrava quando só repete o gravado.
- **A conta, no login** (`lib/publico-do-cliente.ts`): `app/api/account/signin` chama `publicoNoLogin` depois de
  gravar o token. Ele lê as regras de cliente do documento (comprou o produto, assinatura ativa, estado do
  endereço; elas não saem em `/api/unbox/publicos`), consulta só o que elas perguntam, com teto de 800 ms, e grava o
  público na mesma resposta. Nunca derruba nem atrasa o login além do teto, e respeita o quiz respondido e a loja
  padrão. `UnboxCustomerClient.produtosComprados` é a consulta mínima dos pedidos pagos.
- **A loja padrão** (direito de oposição): a privacidade ganha "Versões da loja por interesse", que só aparece em
  loja com públicos e lista os sinais que ELA usa, com o botão `<LojaPadrao/>`. Ver a loja padrão grava
  `todos~<sorteio>~forte~recusa` por 365 dias, e nenhum sinal automático tira a pessoa de lá.
- O `check-editable` cobra também `publicoNoLogin(` no login e `<LojaPadrao` na privacidade quando o layout declara
  a personalização.
- Numa instância fria, a borda espera a lista (até 400 ms) também para quem chega com uma escolha já gravada: sem
  isso, quem volta com o cookie via Todos na primeira página e a versão na seguinte.

- Publicar revalida também a LISTA dos públicos (`revalidatePath("/api/unbox/publicos")` com `/`): gerada no build
  antes da primeira publicação, ela não entra no cache com a tag do conteúdo. Publicado, a versão vale em até 1
  minuto (o que a borda leva para renovar a cópia em memória).
- Texto editado na própria prévia do editor (`contentEditable`) remonta com o documento seguinte: antes, desfazer
  ou trocar a visão deixava o texto velho na prévia até recarregar.

Medido na loja gerada por este CLI (`next build && next start`, lendo um editor de teste): Todos sem cookie é
a página de sempre, o link e a campanha gravam e servem a versão, o controle vê Todos, 50 pedidos paralelos
alternando cookie sem mistura, e publicar revalida a home, as versões e a lista. A versão pesa 760 bytes a mais
que Todos, comprimida (a camada e o caminho do bundle da rota). Nos sinais novos (29 de 29): Instagram, blog e
região levam à versão certa e gravam fraco; forte gravado resiste a site e região; a loja padrão resiste a tudo; o
login (contra uma API de parceiros falsa) grava o público da compra paga e da assinatura, não grava para pedido
cancelado, respeita quiz e loja padrão, e com a API lenta (2,5 s) responde em 806 ms, sem público.

Loja já gerada: a foundation nova (`lib/editable`) não muda nada sozinha; a personalização liga quando a loja
tem as três peças e passa `personalizacao` ao provider (o `check-editable` diz o que falta).

### v0.22.1 — o WhatsApp do Brasil escrito sem o 55 ganha o 55

"(11) 99999-8888" digitado na aba Apps do painel virava `11999998888`, passava na régua (10 a 15 dígitos), e
o botão da loja abria `wa.me/11999998888`, que o WhatsApp lê como +1: outro país. A régua da foundation
(`lib/editable/document.ts`) passa a pôr o 55, e o chat do editor, que já punha por conta própria, passa a
usar a mesma régua.

- `numeroDoWhatsapp`: o número com a forma exata de um telefone do Brasil sem o código do país (DDD de 1 a 9
  nos dois dígitos; celular com 9 e mais 8, ou fixo de 2 a 5 e mais 7) e sem "+" na frente ganha o 55. O
  resto passa como veio.
- Com "+" na frente o país é o que foi escrito. O "+" fica guardado só quando é ele que diz que o número é de
  fora do Brasil ("+56 9 9999 8888" vira "+56999998888"): a régua passa mais de uma vez pelo mesmo valor, e
  sem ele a segunda passada poria o 55 num celular do Chile. A régua aceita esse "+" e `linkDoWhatsapp` o tira
  do link.
- Vale também para `NEXT_PUBLIC_WHATSAPP_NUMERO`: "11 99999-8888" no cadastro da loja passa a abrir o Brasil.

Sem número novo de foundation: a loja anterior lê o número novo com a régua dela (tira o "+" e confere os
mesmos 10 a 15 dígitos), e a rota pública do editor já entrega com o 55 o número gravado sem ele.

Loja já gerada: o botão sai certo assim que o editor sobe. Trocar `lib/editable/document.ts` (igual byte a
byte ao do editor) só é preciso para o número do cadastro (`NEXT_PUBLIC_WHATSAPP_NUMERO`) escrito sem o 55.

### v0.22.0 — a loja passa a falar com uma API só, a de parceiros

Até aqui a loja conversava com três endereços da Unbox: `core.unbox.com.br/graphql`, o REST de
`api.unbox.com.br` (só o `/auth/signin`) e `partners.unbox.com.br/graphql`, este último só no que já tinha
paridade. O `UnboxClient` carregava os dois caminhos e um `usesPartnerApi` decidindo cada método. Agora
**tudo** passa por `partners.unbox.com.br/graphql`: vitrine, carrinho, checkout, `placeOrder`, pedido, área do
cliente, assinaturas, cupons, CEP, OTP, webhooks e inventário. O roteamento condicional deixou de existir.

**Três cabeçalhos, e cada um responde uma pergunta.** `x-api-key` diz qual PARCEIRO; `Authorization` leva o
token da LOJA, e é dele que o gateway extrai o shopId; `x-customer-token` leva o token do CLIENTE final e só
aparece na área do cliente. Por isso **nenhuma chamada manda shopId**. As duas exceções são campos que o
próprio schema declara: o `shopId` de cada `fulfillmentGroup` no `placeOrder` e o de `createCartByTemplate`.

- **A loja deixou de guardar segredo de captcha.** As operações protegidas por reCAPTCHA (`signIn`,
  `customerOTPRequest`, `customerPasswordlessSignIn`, `placeOrder`, `placePaymentLinkOrder` e os dois
  `setup*3DSTransaction`) recebem o token injetado na BORDA do gateway de parceiros. Some o header
  `x-captcha-verification`, some o campo `captchaBypass` do client e some a variável
  `UNBOX_CAPTCHA_BYPASS` do `.env`, do CLI e da documentação. Isso encerra também a armadilha que a v0.20.x
  teve de consertar: mandar a api key `da2-...` nesse header fazia o backend repassá-la ao reCAPTCHA
  Enterprise, que respondia MALFORMED, e o cliente via `CAPTCHA_MALFORMED_ERROR` no meio do pagamento. Não há
  mais header para preencher errado. O que continua protegendo OTP e checkout de abuso do lado da loja é o
  rate-limit do BFF (`lib/ratelimit.ts`), que sempre foi a defesa real — o header nunca foi um captcha.
- **`lib/unbox/customer.ts` deixou de ter transporte próprio.** O `UnboxCustomerClient` agora carrega um
  `UnboxClient` de loja já autenticado e delega a ele, acrescentando o `x-customer-token`. São duas
  identidades na mesma requisição, e nenhuma das duas é dispensável: sem o token da loja não há contexto de
  loja, sem o do cliente não há conta. Isso apagou a cópia da lógica de autenticação que vivia ali e fez a
  área do cliente herdar prazo, formato do `Authorization` e a regra de não repetir mutação.
- **Diferenças de argumento que a migração fechou**, uma a uma: `createCart` sem `shopId`;
  `applyDiscountCodeToCart` e `removeDiscountCodeFromCart` sem `shopId`; `OrderInput` sem `shopId`;
  `getInstallments`, `getAddressByPostalCode`, `customerOTPRequest`, `customerPasswordlessSignIn` e
  `hasCustomerAccount` sem `shopId`; `orderByReferenceId` só com o id; `first` passou de
  `ConnectionLimitInt` para `Int`; `updateCustomerAccount` aninha `receiveNewOrderEmail` em `metafields`; e o
  upsert de endereço virou input PLANO (`UpsertAddressBookInput`), sem o envelope `addressBook`.
- **`catalogItemProductById` não existe na API de parceiros.** O fallback de PDP por id passa a usar
  `catalogItems(productIdsOrERPCodes:[id], first:1)`, que devolve o mesmo `CatalogItemProduct`. É a única
  lacuna que sobrou, e está escrita no README da loja.
- **Item de Payment Link mudou de forma.** Em parceiros ele é PRODUTO VIRTUAL (`PaymentLinkItemInput`):
  título, quantidade e preço são do link, e o vínculo com o catálogo, quando existe, é por código de ERP.
  Mandar `{productId, productVariantId}` ali cria um link sem nome e sem valor, que a página pública mostra
  vazio; `app/api/payment-link` passa a exigir `title`, `quantity` e `price.amount` antes de chamar a Unbox.
- **O scalar `AWSJSON` é assimétrico, e o `placeOrder` passou a respeitar isso.** Medido contra a API: na
  ENTRADA o campo espera o JSON já serializado em string; na SAÍDA ele volta como objeto puro. O único campo
  `AWSJSON` de input que a loja alcança é `PaymentInput.data` (os outros dois do schema, `calculation` de
  `DiscountCodeInputCreate`/`Update`, são de mutações que a loja não chama), e ele ia como objeto: os dois
  ramos de `placeOrder`, Pix e cartão, agora mandam `JSON.stringify(...)`. A recusa acontece na validação da
  variável, antes de qualquer cobrança, então o sintoma era pedido nenhum, não pedido torto. A leitura não
  mudou em lugar nenhum: `cartEvents.data`, `UnboxPayPaymentData.paymentRecord` e `installments` continuam
  sendo lidos como objeto, que é o que a saída entrega. Além disso, foi incluído o `__typename` ao campo
  `Payment.data` para evitar erros de resolução em runtime.
- **MUTAÇÃO NUNCA REPETE POR ERRO DE AUTENTICAÇÃO.** O cliente tenta o `Authorization` cru (o formato da doc)
  e, se o gateway recusar, repete uma vez com `Bearer`. Com o `placeOrder` passando pelo mesmo caminho isso
  vira risco de cobrança dupla: a régua casa por texto, e "not authorized" é também o que a adquirente
  responde num cartão recusado. Agora só CONSULTA repete; sem formato medido, uma consulta leve mede antes e
  a mutação vai uma vez. O formato aceito passou a viver no módulo, e não na instância, porque
  `getStoreClient()` cria um client novo a cada request e o valor nunca chegava a ser memorizado.
- **A posse do pedido continua sendo do BFF, e agora é só dele.** `orderByReferenceId` de parceiros não
  recebe token de posse, então quem chama `getOwnedOrder` passa antes pelo cookie httpOnly assinado
  (`lib/session.ts`). Sem essa guarda, a consulta abre qualquer pedido só pelo `referenceId`, que é curto.
- **Credenciais**: `UNBOX_API_KEY`, `UNBOX_AUTH_URL`, `UNBOX_GRAPHQL_URL` e `UNBOX_CAPTCHA_BYPASS` saíram do
  código, do `.env.example`, do CLI e da documentação. Sobraram três obrigatórias:
  `UNBOX_PARTNER_API_KEY`, `UNBOX_USER` e `UNBOX_PASS`. O formulário do CLI passou a fazer uma pergunta a
  menos.
- **Gate 10 do `prebuild` saiu.** "A variável do id da loja tem de se chamar `shopId`" era regra do core, que
  descobria a loja procurando esse nome literal nas variables. Nenhuma consulta manda mais shopId, e a regra
  passaria a reprovar por engano justamente os dois pontos em que o schema declara o campo, onde o nome da
  variável é livre.

Conferido: `tsc --noEmit` limpo sobre o template inteiro com as dependências instaladas (é ele que cobre as
mudanças de assinatura espalhadas pelo app), `scripts/check-unbox-brand.mjs` e o gate de neutralidade do
pacote passando. O gate de marca pegou um erro real durante a migração: a reescrita do `client.ts` tinha
trazido de volta `payments{amount{amount}}` no pedido, o mesmo campo que derrubou a área logada na v0.21.10.
Todos os literais GraphQL do arquivo novo foram comparados com os do anterior; fora as mudanças descritas
acima, são idênticos. **Nada disto foi executado contra a loja real**: antes de publicar, rodar
`npm run unbox:test`.

Alterada sequência de testes de carrinho (8b) no `scripts/test-live.ts` para não seguir com um carrinho vazio
após a remoção do item existente, fazendo com que o `addCartItems` seja chamado apenas no final da sequência.

Loja já gerada: trocar `lib/unbox/client.ts`, `lib/unbox/customer.ts`, `lib/unbox/types.ts`,
`lib/unbox/store.ts`, `lib/customer-session.ts`, `lib/config.ts`, `lib/env-check.ts`, `lib/orders.ts`,
`lib/session.ts`, `lib/ratelimit.ts`, `app/api/payment-link/route.ts`, `app/api/account/otp/route.ts` e
`scripts/check-unbox-brand.mjs`. No ambiente, preencher `UNBOX_PARTNER_API_KEY`; `UNBOX_API_KEY`,
`UNBOX_AUTH_URL`, `UNBOX_GRAPHQL_URL` e `UNBOX_CAPTCHA_BYPASS` podem sair. Quem chama `createPaymentLink`
com itens de catálogo precisa passar a mandar título, quantidade e preço.

O `document.ts` leva um conserto que só o editor usa: o "usar esta versão" (op interna `replace_doc`)
passa a trazer o CSS, o SEO das páginas e os dados da loja da versão escolhida, em vez de manter os do
rascunho de hoje. Na loja, nada muda.

### v0.21.10 — o valor nulo do pagamento deixa de derrubar a área logada

`Money.amount` é non-null no schema da Unbox e volta null quando o pagamento não tem valor numérico. Como
`customerOrders` também é non-null, UM pedido assim apaga a resposta inteira: o cliente logado vê "Não
conseguimos carregar seus pedidos" com os pedidos lá no painel. Medido numa loja no ar: os 14 pedidos eram
assim, e a volta para a seleção enxuta não salvava, porque ela pedia o mesmo campo.

- As consultas de pedido (lista, detalhe e o pedido de quem comprou sem conta) pedem de `payments.amount` só
  o `displayAmount`. O número que a tela usa vem de `summary`.
- O valor do pagamento e o total aceitam o texto já formatado quando o número não vem, conferindo o formato:
  o `displayAmount` no contexto de cliente já devolveu "R$NaN,undefined", e esse não entra.
- Gate novo no `prebuild`: pedir o valor numérico dentro de `payments` reprova o build.

Conferido no formato do pedido: pagamento sem número mostra "R$ 157,24" na tela e no total; texto torto some;
pedido com número continua igual.

Loja já gerada: trocar `lib/unbox/customer.ts`, `lib/unbox/client.ts`, `lib/orders.ts` e
`scripts/check-unbox-brand.mjs`. A consulta que confere se a loja está no caso está em
`patch-cli-money-amount-nulo.md`.

Pendente com a Unbox: `Money.amount` non-null voltando null é defeito do backend
(`bug-unbox-sessao-de-cliente.md`, item 4).

### v0.21.9 — redirecionamento conferido também decodificado, e JSON-LD sempre por `ldJson`

Duas correções de segurança. Endereço legítimo e JSON-LD que a foundation já gera não mudam.

- **Redirecionamento manual**: a régua do caminho barrava `//outro-site` e `/\outro-site`, mas aceitava
  `/%2F%2Foutro-site` e `/%5Coutro-site`. Gravados assim, eles só ficam seguros enquanto nenhuma camada entre a
  loja e o navegador decodificar a barra, e isso a loja não tem como garantir. Agora o caminho é conferido nas
  duas formas, como veio e decodificado, na gravação (`recusaDoRedirecionamento`) e na leitura
  (`redirecionamentoDe`, por onde passam produto, categoria e as páginas do lojista): barra ou contrabarra
  codificada, inclusive codificada duas vezes, e decodificação malformada são recusadas. Caminho com acento
  codificado (`/produto/caf%C3%A9`) continua valendo.
- **Instrução dos agentes 04, 14 e 17**: mandavam serializar o JSON-LD com `JSON.stringify()` e diziam que isso
  evitava XSS com `</script>`. Não evita: `JSON.stringify` não escapa `<`, e um título, descrição ou resposta de
  FAQ com `</script>` fecha a tag e o resto vira HTML na página (medido). Os exemplos (breadcrumbs, FAQ) e as
  regras passam a usar `ldJson()` de `@/lib/json-ld`, que as páginas da foundation já usavam. O risco era o
  agente seguir a instrução ao escrever um bloco novo.

Conferido: caminhos legítimos (inclusive com acento codificado) gravados e seguidos; `%2F` e `%5C` em
maiúscula e minúscula, `/.%2F%2F`, codificação dupla, decodificação malformada e `%3Cscript%3E` recusados na
gravação e na leitura; `//`, `/\` e `https://` continuam recusados.

Loja já gerada: atualizar `lib/editable/document.ts`. Se algum agente já escreveu JSON-LD com
`__html: JSON.stringify(...)`, trocar por `ldJson(...)`.

### v0.21.8 — favicon, Search Console, redirecionamentos e dados da empresa pelo editor

Foundation 17. O editor ganha a aba SEO (prévia do resultado no Google e do compartilhamento, título e
descrição por página, favicon, verificação do Search Console e redirecionamentos) e, em Configurações gerais,
os dados da empresa e as redes sociais. A loja passa a mostrar cada um no lugar certo:

- **Favicon** (32×32, 48×48 e o ícone do iPhone 180×180): o layout declara `icons` só quando há ícone
  enviado. Declarar `icons` faz o Next deixar de emitir o `app/icon.svg` (medido no HTML servido), então sem
  envio vale o arquivo da loja, como antes. O ícone do iPhone não existia: `app/apple-icon.svg` não gera tag,
  porque o Next só aceita esse ícone em PNG ou JPG.
- **Verificação do Google Search Console**: `<meta name="google-site-verification">` pelo `verification` do
  metadata.
- **Dados da empresa** (razão social, CNPJ, endereço, e-mail e telefone de atendimento, e-mail de privacidade):
  numa linha no rodapé, no lugar dos marcadores de termos de uso e política de privacidade (inclusive o foro),
  e no dado estruturado da empresa (`legalName`, `taxID`, `address`, `contactPoint`). É o que a lei do
  comércio eletrônico (Decreto 7.962/2013) pede num lugar visível. Sem cadastro, o marcador continua e o gate
  de publicação cobra, como antes.
- **Redes sociais**: `sameAs` no dado estruturado da empresa.
- **Redirecionamento manual**: produto e categoria conferem o mapa antes de responder 404 e redirecionam com
  308; os endereços de um e dois segmentos já passavam pelas rotas das páginas do lojista, que conferiam. Não
  cobre endereço de três segmentos ou mais.
- **`lib/dados-da-loja.ts`**: a declaração ao editor (`DECLARACAO_DOS_DADOS_DA_LOJA`) e quem formata cada dado.
- **`jsonLdDaLoja(doc)`** recebe o documento, e as três rotas que emitem a entidade passam o mesmo.

Conferido no HTML servido, com um documento publicado com os dados e sem eles: com dados, os três ícones, a
verificação, a entidade completa, a linha do rodapé, termos e privacidade sem marcador e os três
redirecionamentos em 308; sem dados, `app/icon.svg`, entidade só com nome, sem linha no rodapé, marcadores de
volta e 404. Termos, privacidade, produto e categoria mantêm o modo de renderização.

Não entraram, da tela de SEO do painel da Unbox: **palavras-chave** (o Google ignora a meta keywords desde
2009) e **URL externa de robots.txt e sitemap.xml** (a loja gera os dois do catálogo e das páginas).

Loja já gerada: atualizar `lib/editable/`, acrescentar `lib/dados-da-loja.ts`, e trocar `app/layout.tsx`,
`lib/paginas-seo.ts`, `components/site-footer.tsx`, `components/paginas/{colecao,pagina}-do-lojista.tsx`,
`app/(loja)/page.tsx`, `app/(loja)/{termos,privacidade}/page.tsx` e os layouts de produto e categoria.

### v0.21.7 — o lojista escreve como a página inicial e o catálogo aparecem no Google

Foundation 16. As páginas que o lojista cria já tinham título, descrição e imagem de compartilhamento na
ficha. As que vieram com a loja não: o título da página inicial estava escrito no `app/layout.tsx` e a
descrição vinha de `NEXT_PUBLIC_SITE_DESCRIPTION`, lida no build. Mudar o que aparece no Google pedia deploy.

Agora o editor tem, em Configurações gerais, o bloco "Como a loja aparece no Google" para a página inicial e
o catálogo, com os mesmos contadores e a mesma exigência de texto alternativo da ficha de página, e passando
pela mesma honestidade.

- **`lib/seo-das-rotas.ts`**: a lista das rotas que o layout declara ao editor (com o título e a descrição que
  cada uma emite hoje) e o `metadadosDaRotaDoCodigo` que a página inicial e o catálogo usam no
  `generateMetadata`.
- **Sem edição, nada muda.** Conferido no HTML servido: o `<head>` da página inicial e do catálogo sai igual
  ao da versão anterior, campo a campo, e as duas rotas continuam estáticas com ISR.
- **Título da página inicial sai como o lojista escreveu**; no catálogo, o nome da loja entra no fim, como em
  toda página. O painel mostra essa diferença antes de salvar.
- **Sem "ocultar de buscadores"** nestas rotas: na página inicial seria tirar a loja do Google.
- O SEO das rotas não viaja ao navegador: quem lê é o servidor.
- `lib/editable/`: `document.ts` e `provider.tsx` da foundation 16, e o `page_view` de entrada da v0.21.6, agora
  também na fonte da foundation.

Junto, no editor: a rota pública passa a entregar o **CSS do lojista** (v0.21.5), que ficava de fora. Ele
aparecia na prévia e nunca ia ao ar. A loja não precisa mudar nada para isso.

Loja já gerada: atualizar `lib/editable/`, acrescentar `lib/seo-das-rotas.ts`, exportar `imagemAbsoluta` e
`imagensDoCartao` de `lib/paginas-seo.ts`, e trocar `app/layout.tsx`, `app/(loja)/page.tsx` e
`app/(loja)/produtos/page.tsx`. Loja que só atualizar `lib/editable/` fica como estava: sem `rotasComSeo` no
layout, o editor não oferece o bloco.

### v0.21.6 — a área logada volta a mostrar os pedidos, e a página do pedido ganha blocos

Rodada que saiu de uma loja em produção: cliente logado sem nenhum pedido na conta, o cabeçalho dizendo
"Entrar" para quem estava logado, produto oculto à venda na home e status crus na tela. Quatro das causas
são do backend da Unbox e estão com o time do core; aqui entra o que a loja precisa fazer para não
depender delas.

**Consultas do cliente logado**

- **`payments` junto de `summary`, sempre.** O resolver do total lê `payments[0]` e o banco só traz
  `payments` quando a consulta pede. Pedir o total sem o pagamento apagava a lista de pedidos inteira.
- **A variável do id da loja se chama `$shopId`.** O backend acha a loja pelo NOME da variável; com `$s`,
  `currentCustomerAccount` caía e o cabeçalho mostrava "Entrar". Gate novo no `prebuild` cobra o nome.
- **Imagem do item por `imageURLs`**, normalizada para o `thumbnail` que a loja já lia, nas três
  consultas de pedido. E quando o pedido não traz foto, ela vem do catálogo, casada pelo slug, sem
  sobrescrever a que o pedido trouxe.
- **`FulfillmentMethod` só pelos campos anuláveis** (`label`, `carrier`, `daysToDeliver`): `displayName` e
  `name` são obrigatórios no schema e voltam vazios, derrubando a consulta.
- **Seleção completa com volta para a enxuta.** Resumo detalhado, envio, rastreio e status do pagamento
  entram numa tentativa; se a API recusar, a página cai para o essencial e o motivo fica no log.
- **O cliente logado alterna o formato do `Authorization`**, como o de loja já fazia. Só consulta repete;
  mutação nunca, porque pausar assinatura é um interruptor e executar duas vezes desfaz.

**Comportamento**

- **Falha de leitura deixou de virar "você não tem pedidos".** Pedidos, assinaturas, endereços e
  preferências registram o erro e mostram estado próprio. Preferências não abre o formulário com valores
  padrão quando não conseguiu ler: salvar ali sobrescreveria a escolha real.
- **Token de cliente vencido vale como deslogado**, em vez de deixar a conta num beco sem saída.
- **Produto oculto no painel sai de toda vitrine**, no ponto por onde todo catálogo passa, com o
  `totalCount` descontado. Também sai quando foi escolhido a dedo e buscado sozinho.
- **Card de vitrine se resolve contra o catálogo**, não contra o recorte de combos: produto fora das
  ofertas perdia o botão de comprar. Só os produtos citados pelas vitrines viajam no HTML.
- **`page_view` de entrada no dataLayer mesmo com Pixel na página.** A regra pulava tudo por haver um
  provedor, e o GTM central ficava sem o evento de entrada numa loja com Pixel e sem GA4.
- **Datas no fuso de São Paulo** (`formatarData`, `formatarDataHora`). No servidor saíam em UTC: 20:59
  virava 23:59. Gate novo recusa data formatada sem fuso.
- **Status com rótulo em português**: grupo de entrega (com e sem o prefixo `coreOrderWorkflow/`), tipo
  de entrega, eventos de rastreio e pagamento. O que não tem rótulo aparece como veio, em vez de sumir.

**Página do pedido**

- Em blocos com título, na ordem da conta hospedada: Detalhes da compra (grade de duas colunas), Histórico
  de rastreio, Produto e preço, Resumo.
- O selo é o status do **pagamento** ("Pedido pago"), ao lado do título.
- Resumo com Subtotal, Frete, Descontos e Total, quando a API entrega a quebra.
- Link "Rastrear" pela `tracking.url`, que existe no grupo de entrega. O comentário que dizia o contrário
  valia só para `Order`.
- No celular, o menu da conta vem depois do conteúdo.

Loja já gerada: trocar `lib/unbox/{customer,client,pedido}.ts`, `lib/customer-session.ts`, `lib/orders.ts`,
`lib/format.ts`, `lib/catalog-map.ts`, `lib/vitrine.ts`, `lib/paginas-dados.ts`,
`lib/editable/rastreio-navegacao.tsx`, `components/order-status.tsx`, `components/account/account-shell.tsx`,
`components/home/{combos-home.tsx,sections/registry.ts,sections/combos-carousel.tsx}`,
`scripts/check-unbox-brand.mjs` e as páginas de `app/(loja)/conta/`, `app/(loja)/page.tsx`,
`app/(loja)/oferta/page.tsx` e `app/api/account/me/route.ts`.

### v0.21.5 — o lojista escreve o CSS da loja

A saída para o ajuste que os controles do editor não alcançam. A loja passa a emitir, por último, a
folha que o lojista escreve: ela vem depois de tudo que a loja traz, então o que ele escreve vence por
ordem de documento.

Não há lista de propriedades permitidas nem escopo por seção, e isso é deliberado: o que o lojista
escrever é responsabilidade dele, e a tela do editor diz isso com todas as letras.

O que a loja ainda faz com o valor, e não é trava sobre o conteúdo: escapa a sequência que fecharia a
tag `<style>`. Sem isso, um `</style>` no campo transformaria o resto em HTML, inclusive `<script>`.

Loja já gerada: atualizar `lib/editable/`.

### v0.21.4 — Next 15.5.24

O 15.5.19 acumulava dez avisos de segurança, sendo dois críticos: execução remota de código sem
autenticação pela API de otimização de imagem, e a mesma coisa em host Windows. A subida é de patch
dentro do mesmo minor, e leva junto `@next/env` e `eslint-config-next`, que andam com ele.

Loja já gerada: subir as três para `15.5.24` e refazer o deploy. Nada mais muda.

### v0.21.3 — a escada dos títulos, o segredo que deixou de ter valor de fábrica, o que saiu do pacote e o gate que passou a medir o arquivo inteiro

Duas coisas grandes e uma rodada de limpeza. A grande do lado da LOJA é a escada dos títulos, que tira o
tamanho da classe de cada componente e o põe num bloco só de `app/globals.css`, com a letra e o tamanho na
mão do lojista pelo editor. O resto é o que viaja no tarball e o que o `prepack` consegue reprovar, sem
efeito na loja gerada. **Há UMA exceção, e ela muda o comportamento da
loja em produção: `SESSION_SECRET` deixou de ter valor de fábrica e passou a ser obrigatório para fechar
pedido.** Está logo abaixo, antes do resto, porque é a única coisa desta versão que exige providência no
ambiente do deploy ANTES de publicar.

**`SESSION_SECRET` virou obrigatório em produção, e sem ele o checkout recusa na porta.** Até a v0.21.2 o
`lib/config.ts` tinha um fallback fixo para essa variável. Ele era, na prática, o segredo de toda loja que
não a definiu, e ele viajava escrito no pacote público: quem baixasse o tarball assinava o cookie de posse
de pedido de qualquer uma dessas lojas. O fallback saiu, e em produção a variável ausente deixa o segredo
VAZIO de propósito. Assinar com segredo vazio dá uma assinatura constante, igual em toda loja e
reproduzível por quem leu o pacote, que é exatamente a posse forjável que o HMAC existe para impedir;
então `lib/session.ts` **recusa** assinar e conferir. O que isso significa na prática:

- **Cadastre `SESSION_SECRET` no ambiente do deploy antes do primeiro pedido.** O CLI gera um valor no
  `.env.local`, e o `.env.local` é ignorado pelo git de propósito: ele NÃO sobe junto com o projeto. Numa
  loja que roda na Vercel, a variável tem de estar cadastrada no painel do projeto (qualquer valor
  aleatório longo serve) e o deploy refeito depois disso. Loja que hoje está no ar sem a variável vinha
  funcionando com o segredo de fábrica e vai parar de fechar pedido na 0.21.x.
- **A recusa acontece ANTES de cobrar.** A assinatura da posse só aconteceria depois do `placeOrder`, que
  é produção real e não é idempotente: a recusa lá dentro cairia no `catch` do handler como 502 com o
  pedido já criado e cobrado na Unbox, o cliente leria "não foi possível concluir" e tentaria de novo. É a
  cobrança dupla que o próprio comentário daquele `catch` existe para evitar. Então `POST /api/checkout`
  passou a conferir a variável na primeira guarda do handler, junto do rate-limit, e a responder **503**
  com o código `SESSION_SECRET_AUSENTE` e o carrinho intacto. O log do servidor nomeia a variável.
- **O `lib/env-check.ts` avisa no boot, e continua sendo só aviso.** Ele roda no import do `lib/config.ts`,
  que o layout raiz carrega em toda página; lançar ali derrubaria a loja inteira por uma variável que
  talvez nem seja usada naquela visita. A defesa é a guarda do checkout; o aviso serve para o problema
  aparecer no primeiro deploy, e não no primeiro pedido.

**A escada dos títulos, e o tamanho da letra na mão do lojista.** O reset do Tailwind zera `font-size` e
`font-weight` de `h1..h6`, e o `app/globals.css` só dizia a família: cada um dos 91 títulos da loja
carregava o próprio tamanho na classe. Dava 18 tamanhos diferentes, irmãos da mesma lista em degraus
trocados, e duas páginas inteiras (`/termos` e `/privacidade`) com o título do mesmo tamanho do texto — 14px,
menor que o corpo da loja. Agora `h1` a `h4` têm tamanho, peso, família e entrelinha num bloco só, e cada
degrau é um `clamp()` que passa por (375px, mínimo) e (1240px, máximo): 28/28/21/17 no desktop, 24/22/18/16
no celular. Os cinco títulos que precisam mesmo de outro tamanho (as três capas de herói, o nome do produto
e a capa de página) ganharam classe própria no mesmo bloco, também em `clamp()`, reproduzindo as duas pontas
de hoje com erro de 0px e enchendo o meio, que era um salto seco em 640px. Nenhum `sm:` sobrou em título, e
nenhum `!important` entrou na escada: com ele, o `style=` inline que o editor escreve perderia para a folha,
e o lojista trocaria a letra de um título sem nada mudar na tela.

**E o tamanho virou decisão do lojista**, por `--store-escala-titulos`, que MULTIPLICA o resultado de cada
`clamp()` — a multiplicação fica fora dele para o piso e o teto subirem juntos. Multiplicando só o termo do
meio, o celular e o desktop largo ficariam parados justamente nas duas pontas que ele olha. O
`@property --store-escala-titulos` é obrigatório porque o valor entra num `calc()`: sem o registro, um valor
inválido derruba a conta e o `font-size` cai em `inherit`, com a loja inteira despencando para o tamanho do
corpo. **A faixa tem teto e piso no próprio CSS** (`clamp(0.8, …, 1.5)`, na variável `--unbox-escala-titulos`
que multiplica cada degrau): o `@property` garante que o valor é um NÚMERO e não sabe dizer que 999 não é
tamanho de título — medido, `999` rendia títulos de 10000px, e o preset que declara o token nos `axes`
escreve o valor direto no arquivo, onde um `11` no lugar de `1.1` passaria inteiro.

**Junto, a letra.** `--store-fonte-titulo` e `--store-fonte-texto` entram nas cadeias de `font-family` do
`globals.css`, lidas também pelo `.font-display` (quase todo título carrega essa classe, e classe vence
seletor de elemento) e por `--unbox-sec-fonte-titulo` / `--unbox-sec-peso-titulo`, que é como a letra de uma
seção inteira alcança os títulos dela. A cadeia de `h1..h4` lê `var(--font-display)` e não
`var(--font-heading)`: as duas nascem no next/font, mas `--font-heading` é declarada no `@theme inline`
(`:root`), onde `--font-display` ainda não existe — ela vive na className do `<body>`. Medido no render,
`--font-heading` computava vazio, a linha de família da escada era inerte, e os poucos títulos SEM a classe
`.font-display` (Pix, erro, 404) saíam na letra do corpo.

**O `create-unbox-store` confere as duas pontas juntas, e cobra a FORMA.** `checarLetraDaLoja` exige a escada
no `app/globals.css`, o marcador `--unbox-letra-da-loja`, o valor da escala dentro de 0,8–1,5, e no
`lib/editable/tokens.ts` exige `tipo: "fonte"` nos dois tokens de letra e `tipo: "escala"` com ao menos um
degrau em `opcoes` no de tamanho. Só o nome não basta: token de escala sem o bloco `opcoes` faz o editor
recusar TODA troca de tamanho, procurando o valor numa lista vazia — e o defeito seria o pior que este
projeto conhece, o lojista mexendo, o painel dizendo que aplicou e a tela não mudando.

**O marcador `--unbox-letra-da-loja` existe porque o número da versão da lib responde errado.** A foundation
chega a uma loja já construída por cópia de arquivo; o `app/globals.css` dela não vai junto. Três lojas no ar
receberam a foundation 14 assim, sem a escada — declaravam saber ler a letra e não sabiam. Agora quem
responde é a folha da loja, e o editor lê a resposta do valor computado. Loja sem o marcador não mostra o
bloco de letra no painel e tem a troca recusada com uma frase que diz de quem é o trabalho.

**A regra do `template/CLAUDE.md` sobre título prometia um estrago que não acontece.** Ela dizia que
`text-[26px]` num título faz a classe vencer a escada. Medido no render: no Tailwind v4 as utilitárias vivem
em `@layer utilities` e a escada está fora de layer, e regra fora de layer vence regra em layer — a
utilitária simplesmente não pega. O risco prático era o contrário do descrito: quem precisa de outro tamanho
escreve `text-[26px]`, não vê nada mudar, e o passo seguinte natural é `!important`, que é justamente o que a
escada não pode ter. A regra passou a nomear o que vence de verdade (classe própria do `globals.css` e
`!important`) e o que MANTER na classe do título: `font-display`, que é o que leva a fonte de títulos até
ele. Junto saiu um `font-semibold` que tinha sobrado num `<h3>` da casca de coleção.

**A marcação errada foi junto:** o carrinho vazio e o pedido sem acesso davam página sem `h1` nenhum (o
`EmptyState` ganhou nível, como o catálogo já fazia); `/produtos` tinha um `h1` de 20px; a página do picker
começava no passo 2 e os dois passos irmãos estavam em níveis diferentes; e um combo dentro de uma seção
tinha o tamanho do título dela. As três páginas de documento saíram de `.richtext` e vestiram `.texto-rico`,
que tem escada relativa própria: `.richtext` leva `font-size: inherit` porque aquele HTML é a descrição do
produto vinda da API, e um `<h2>` ali é ênfase de quem escreveu, não título de seção.
**O que muda de APARÊNCIA numa loja gerada, e é para olhar antes de mesclar:** entre 640px e 1023px os
títulos que tinham `sm:` agora andam pelo `clamp()` em vez de saltar. As duas pontas ficam idênticas (375px e
1024px, erro de 0,01px), e o meio muda: medido numa loja gerada, a 768px a capa do herói de foto sai em
44,90px onde hoje sai 52, e o nome do produto em 31,25px onde hoje sai 34. É o iPad em retrato. Se ficar
magro demais, a segunda âncora do `clamp()` muda de 1024 para 768 e nada mais precisa mudar. E os títulos que
não carregam `.font-display` (Pix, erro, 404) passam a sair na fonte de títulos, como todos os outros, em vez
da fonte do corpo.

O resto da versão, a rodada de limpeza, não muda comportamento nenhum:

**Saiu dado de pessoa de dentro de dois scripts que rodam contra a loja de produção.**
`scripts/test-live.ts` e `scripts/place-order-pix.ts` carregavam, em texto aberto, um CPF que fecha a conta do
dígito verificador, com nome, endereço completo com complemento e telefone ao lado. Os dois passam a usar um CPF
de sequência repetida, que de propósito NÃO fecha a conta e por isso não tem como ser o documento de alguém, e o
endereço de uma praça pública, porque o cálculo de frete precisa de um CEP que exista. Quem precisar de documento
válido para o antifraude aceitar põe o dele em `.env.local`, em `UNBOX_TEST_CPF`, que arquivo publicado não
carrega documento de ninguém.

**Saíram dois telefones de consumidor.** Eles vinham de relatório de caso real e estavam em três lugares: o
README, `lib/schemas.ts` e `app/api/acesso/route.ts`. Trocados por número obviamente inventado, no mesmo padrão
do resto do pacote, preservando o que o exemplo precisava mostrar (o zero à esquerda do DDD).

**Saiu o nome de um cliente do changelog, e a atribuição a uma pessoa do time.** Nos dois casos a informação que
interessa a quem usa o CLI é o defeito, não de quem era a loja nem quem pediu o conserto.

**Saiu a configuração de dentro da nossa conta de analytics.** O ID de medição e o inventário de gatilhos do
container central não são informação de produto. O achado que interessa ao leitor, que não existe gatilho de
custom event `page_view`, continua escrito. O `GTM-PZLT336` fica: ele é contrato, toda loja gerada sai com ele.

**Saiu vocabulário do ramo de origem de dentro do template.** Quatro exemplos em `lib/enrichment/index.ts`
tinham sobrevivido às varreduras anteriores por estarem em inglês, e um valor nutricional era medição de produto
real. Trocados pelo vocabulário neutro que o próprio arquivo já usava no resto do código.

**Saiu a citação literal de uma mensagem de revisão de dentro de `scripts/sistema.py`**, que é copiado para
dentro do projeto de todo cliente. O diagnóstico foi parafraseado: o conteúdo técnico continua inteiro e a
mensagem de alguém sai do pacote. Junto saíram as três referências ao `escala.py`, um script irmão que nunca
viajou no tarball: quem recebia o projeto lia a citação de uma ferramenta que não está na pasta.

**O gate do `prepack` passou a medir o ARQUIVO, e não a linha.** Este é o conserto que fecha o buraco por onde o
nome do cliente passou: ele estava na lista de proibidos do próprio gate, mas caiu no fim de uma linha do README
e continuou na seguinte, e a janela de três palavras nunca via as duas metades juntas. Quem escreve o texto não
escolhe onde a linha quebra, então o gate não pode depender disso. Agora a varredura de nome roda sobre o texto
inteiro com as quebras colapsadas, guardando a linha da primeira palavra da janela para a mensagem de erro.

**E o gate ganhou quatro réguas que ele não tinha:**

- **Documento com dígito verificador conferido.** Nenhuma das famílias de regex olhava para isso, e era por isso
  que um CPF válido viajava havia versões. O que separa um documento de um número qualquer não é a forma, é a
  aritmética, então o gate calcula.
- **Telefone de pessoa.** Aqui não há conta a fazer, todo número é bem formado. O que separa fixture de telefone
  de gente é a repetição: no máximo três dígitos distintos nos oito finais.
- **Propriedade de analytics** (`GTM-`, `G-`, `AW-`, `UA-`, `DC-`), com duas exceções nomeadas e com o motivo
  escrito ao lado, porque exceção sem motivo é buraco.
- **A forma curta que põe o autor entre parênteses**, `(por` seguido de um primeiro nome, que é como uma
  atribuição pessoal atravessou as três regras que já existiam: ela não tem verbo nenhum para casar.

Junto, três ajustes de alcance: a peneira estrutural de nome passou a enxergar o nome próprio que vem depois de
um parêntese ou de aspas de abertura, e não só depois de um espaço, que era onde o nome se escondia; o
vocabulário de ramo ganhou os nomes em inglês; e a lista de arquivos da checagem de
travessão passou a vir do próprio npm em vez de quatro nomes escritos à mão, senão um arquivo novo em `src/`
entrava no pacote sem nunca ser conferido.

**E o gate passou a varrer o que é público sem estar no tarball.** O escopo dele era a lista do `npm pack`,
e nesta mesma versão o `files` perdeu o `tools`: o gate teria deixado de enxergar justamente a pasta que ele
mora dentro. Pior, ele nunca enxergou o `CHANGELOG.md`. Os dois estão no GitHub, que é público, e foi de
dentro deles que saíram, à mão, nesta versão, cinco nomes de cliente, o caminho da máquina de quem escreveu
o `workflow-storefront.legado.js` e o id de uma página do Notion. Agora o escopo é a lista do npm MAIS uma
lista fixa (`CHANGELOG.md`, `LEIA-ME-FONTE.md` e `tools/` inteiro), com todas as réguas menos a de
vocabulário de ramo, que continua valendo só dentro de `template/` porque o changelog precisa poder narrar o
defeito. As duas listas aparecem separadas na linha de saída do gate.

**As réguas de dado de pessoa deixaram de depender da forma.** Elas cobravam a pontuação canônica, e a
pontuação é o que há de mais fácil de trocar: o mesmo documento passava escrito com espaço em vez de ponto,
ou embutido numa corrida maior de algarismos; e o telefone só era procurado com o `9` de celular colado nos
quatro algarismos seguintes, então o `9` separado escapava e telefone FIXO de pessoa nunca foi procurado.
Agora o dígito verificador roda sobre CORRIDAS de algarismos (na corrida colada, toda subsequência de 11 e
de 14; na corrida pontuada, o valor inteiro) e o telefone tem três formas, com a do fixo exigindo pontuação,
senão um `z-index` do CSS viraria telefone. Medido com os oito plantios que acharam os buracos: seis
bloqueiam agora e os dois que sobram, e-mail pessoal e endereço residencial, estão escritos no
`tools/LEIA-ME.md` como o que a régua NÃO cobre, porque promessa que o gate não cumpre é pior que régua
faltando. As duas primeiras coisas que o gate novo reprovou foram comentários dele mesmo, escritos com o
documento e o telefone de verdade que eles explicavam.

**Exceção do gate agora é arquivo MAIS trecho, não o arquivo inteiro.** Perdoar um arquivo por causa de uma
linha o cega para tudo o que entrar nele depois. A lista tem dois itens, os dois dentro do próprio gate, que
cita a forma que cada régua pega como exemplo e por isso casa com ela.

**O exemplo de telefone fixo do pacote passou a repetir algarismo, como todos os outros.** Ele estava em
`lib/schemas.ts` e no changelog explicando a remoção do zero do DDD, com um número inventado em escada, e
escada tem oito algarismos distintos: pela régua da repetição, número de gente. Chegou a existir uma régua
para perdoar escada, e ela foi retirada porque perdoava junto um celular perfeitamente plausível. Sai mais
barato o exemplo seguir a convenção do resto do pacote.

**Saiu do `README.md` uma instrução de operação do editor da Unbox.** O README é público e é documento de
quem GERA loja, e quem instala o CLI não configura o ambiente do editor. Ficou lá só o efeito que essa
pessoa consegue ver: prévia de página do lojista responde 404 quando o editor não está configurado, com uma
linha no log da loja. A variável e o porquê foram para o `LEIA-ME-FONTE.md`.

**Ficou registrado o que não dá para consertar aqui:** o skill `web-design-guidelines`, vendorizado sob MIT, não
tem como ganhar o `LICENSE.txt` ao lado que o skill vizinho tem. O repositório de origem declara MIT só na seção
"License" do README e não publica arquivo de licença nenhum, então não existe texto nem linha de copyright para
acompanhar a cópia, e escrever um seria atribuir a outra pessoa uma declaração que ela não fez. O `ATTRIBUTION.md`
passa a dizer isso, com a data em que foi conferido.

### v0.21.2 — nove consertos que a revisão de uma loja de cliente achou

A 0.21.1 nunca chegou a ninguém: ela foi substituída no mesmo dia, antes de qualquer loja usá-la. **Use a
0.21.2.** Ela tem tudo o que a 0.21.1 tinha (as páginas do lojista e o corte do documento por rota), mais os
consertos abaixo, todos achados subindo a foundation 13 numa loja de cliente de verdade e todos do TEMPLATE, ou
seja, toda loja gerada os levaria.

**A casca das páginas pintava branco puro sobre o fundo da loja.** Numa loja de fundo creme, toda página e todo
artigo do lojista nascia com uma faixa branca de ponta a ponta, com emenda visível. Agora ela usa o fundo da loja.

**O editor fora do ar derrubava toda página do lojista para 404, e o 404 ficava cacheado.** Quando a loja não
consegue LER o que foi publicado, ela não sabe se a página existe — e responder "não existe" é afirmar o que não
se sabe, numa URL que pode estar indexada. Agora ela responde erro, que é a verdade, e o Next serve a versão
anterior. Junto veio a guarda que impede isso de quebrar o build: no build não existe versão anterior, e sem ela
um soluço do editor na hora do deploy impediria a loja inteira de subir.

**O `robots.txt` deixava passar URL com query.** Como o checkout só existe com `?id=&token=`, ele nunca era
bloqueado de verdade. Agora as três formas de cada área entram na lista.

**Um 308 permanente apontava para uma página que responde 404.** Numa coleção renomeada e encolhida,
`/velha/pagina/3` mandava para `/nova/pagina/3`, que não existe mais. Agora o número só vai junto quando a
página existe no destino.

**Título de uma palavra longa fazia a página rolar na horizontal no celular.** Um link colado como título tem 60
caracteres sem espaço e empurrava a página inteira a 375 px.

**O cookie da prévia era recusado pelo navegador em desenvolvimento.** `SameSite=None` sem `Secure` não é um
cookie mais permissivo: é um cookie descartado. Era exatamente o modo de falha que o comentário dizia evitar.

**A paginação dizia "Página N de M" duas vezes**, e **o objeto de SEO da página viajava para o navegador** sem
ninguém lê-lo do lado do cliente.

E o contrato de `GET /api/unbox/paginas` passou a documentar `loja.paginasDoLojista` e `doLojista`, que são o
interruptor das páginas e a marca das rotas de molde.

Loja gerada pela 0.21.x: os consertos estão em `app/robots.ts`, `app/sitemap.ts`, `middleware.ts`,
`lib/paginas-publicadas.ts`, `components/paginas/casca-de-pagina.tsx` e nas quatro rotas do lojista.

### v0.21.1 — a loja manda ao navegador só o conteúdo que a página usa

O documento publicado inteiro viajava no HTML de TODA página, porque o layout raiz o entrega ao
provider, que é componente de cliente. Enquanto o documento guardava só o que o lojista tinha editado
nas páginas do código isso era pequeno. Com as páginas da 0.21.0 deixa de ser: cada artigo é todo
documento, e a página de produto passaria a carregar o blog inteiro. É peso que conta nos Core Web
Vitals, que o Google usa.

Agora o layout entrega o documento **sem nada das páginas do lojista**, e cada rota de página, artigo ou
coleção acrescenta a **fatia** dela (`EditableFatia`). A listagem leva a coleção inteira e, de cada
artigo, só o cabeçalho, que é o que o card mostra.

Medido numa loja com 40 artigos, build de produção:

| rota | antes | depois |
|---|---|---|
| página inicial | 276 KB | 81 KB |
| página de produto | 295 KB | 100 KB |
| artigo | 266 KB | 71 KB |
| listagem do blog | 266 KB | 73 KB |

O gate passa a cobrar o par: rota do lojista sem a fatia REPROVA o build, porque adotar metade da
mudança esvazia a página em silêncio.

Duas correções que vieram junto: o rastreio recebia `process.env` inteiro e agora recebe só as
variáveis que ele conhece pelo nome; e o registro de honestidade (`declared`) parou de viajar ao
navegador, onde ninguém o lê.

Loja gerada pela 0.21.0: trocar `app/layout.tsx` e `components/paginas/{pagina,colecao}-do-lojista.tsx`,
e atualizar `lib/editable/`.

### v0.21.0 — o lojista cria páginas, artigos e coleções

A loja gerada passa a servir o que o lojista escreve no editor, e não só o que está no código. Quatro
rotas novas: `/paginas/<endereco>` para a página avulsa, `/<colecao>/<endereco>` para o artigo,
`/<colecao>` para a listagem e `/<colecao>/pagina/N` para as seguintes. Mais `/previa-do-editor`, que
abre uma página antes de ela existir na loja, atrás do token assinado do editor.

O modelo é o do Shopify, com as URLs em português: endereço gerado do título (minúsculas, sem acento,
hífen), que não muda quando o título muda; colisão ganha sufixo; renomear oferece deixar o endereço
antigo levando ao novo, para sempre e sem cadeia; página nasce visível e artigo nasce oculto; data de
publicação pode ser agendada; oculto responde 404.

O corpo da página é montado com as mesmas seções da home, mais uma seção de **Texto** nova, com
parágrafo, negrito, itálico, link, lista, subtítulo e citação, sobre uma lista fechada de marcação.

SEO de fábrica: título e descrição por página, endereço canônico, Open Graph completo (com data,
autor e imagem), dados estruturados de artigo, de página, de listagem e de caminho de migalhas, e
sitemap com a data de alteração de verdade. Página oculta, agendada ou marcada "ocultar de
buscadores" fica fora do sitemap e responde `noindex`.

Arquivos novos: `lib/paginas-do-lojista.ts` (a declaração: prefixo, coleções e endereços reservados),
`lib/reservados.ts`, `lib/paginas-publicadas.ts`, `lib/paginas-seo.ts`, `lib/paginas-dados.ts`,
`lib/previa.ts` e `components/paginas/`. `app/sitemap.ts`, `app/robots.ts`, `app/layout.tsx`,
`lib/rotas-editaveis.ts`, `app/api/unbox/paginas/route.ts`, `middleware.ts` e `next.config.ts`
mudaram; `CLAUDE.md` ganhou os pontos novos em "Editor: o que não pode quebrar".

Exige o editor na foundation 13 (o documento com páginas, coleções e texto formatado) e o editor
assinando com `EDITOR_PRIVATE_KEY_JWK`; sem essa chave nenhuma prévia de página abre.

Loja já gerada (0.20.x): dá para trazer os arquivos acima, mas é mais barato regerar.

**A loja diz quem é e onde vive, e isso entrou aqui.** `GET /api/unbox/paginas` passa a responder
`loja: { slug, nome, url }` além da lista de páginas. `slug` é o `STORE_SLUG` carimbado no scaffold;
`nome` é `NEXT_PUBLIC_SITE_NAME` (senão o nome de exibição que o CLI carimba na rota); `url` é a
origem de `NEXT_PUBLIC_SITE_URL`, só quando é https (em dev, com `http://localhost`, o campo não
sai). Por quê: o editor da Unbox deixou de precisar de registro por loja. Dado um slug, ele procura
em `https://<slug>.myunbox.com.br/api/unbox/paginas`; um 200 no contrato é "a loja existe e é
editável", e `loja.slug` é a trava que impede um host curinga de abrir a loja errada. E quando `url`
é outro endereço (o domínio próprio já apontado para a loja), o editor confirma que ele responde a
mesma rota com o mesmo slug e passa a abrir a loja por ele: prévia, publicação e revalidação vão para
o domínio de verdade, sem ninguém registrar nada. Endereço que não confirma (DNS ainda não apontado,
certificado pendente) é ignorado com aviso no log do editor, e o host de revisão segue valendo.
`src/theme.js` passa a carimbar o nome da loja nessa rota no scaffold. Este contrato foi numerado
v0.20.4 na linha interna e nunca saiu publicado com esse número: a v0.20.4 do registro npm é a de
empacotamento, logo abaixo. Está nesta entrada para nenhum número aparecer duas vezes. Loja já
gerada na faixa 0.20.0 a 0.20.3 que só queira este pedaço: trocar `app/api/unbox/paginas/route.ts`
pelo desta versão e conferir o nome de exibição na última linha dele.

### v0.20.5 — ajustes no README

Apenas atualizações internas:

Alterada instrução no README.md de como executar o CLI corretamente utilizando o `npx`.

### v0.20.4 — publicação no NPM

Apenas atualizações internas:

Separação do changelog do arquivo readme, ajustes na nomenclatura do projeto para publicação no NPM
e ajustes nas instruções de uso para referenciar o CLI publicado.

### v0.20.3 — a foundation não compilava no estilo promocional, e dois formulários engoliam o e-mail

Duas correções vindas de quem usou a versão nova, e as duas com a mesma causa de fundo do meu
lado: eu testava sempre com `--estilo essencial`.

**O build quebrava com `--estilo promocional`, em scaffold intocado.** `footers/conversao.tsx` é
Server Component e passava uma render-prop para o `EditableSlot`, que é client: função não
atravessa a fronteira servidor→cliente e o Next derruba o prerender com "Functions cannot be
passed directly to Client Components". Como o rodapé vive no layout de `(loja)`, o erro caía em
TODA página — o build morria em `/conta/entrar`, que nem tem rodapé próprio. O botão foi isolado
num componente de cliente (`footers/captura-botao.tsx`), com o motivo escrito ao lado para não
voltar. Reproduzido em scaffold limpo antes e depois: `promocional` reprovava, agora passa.

**Dois formulários de e-mail descartavam o que recebiam.** A captura do rodapé "conversão" e a do
catálogo tinham `onSubmit={(e) => e.preventDefault()}` e nenhum destino: a pessoa preenchia, via a
página não fazer nada e ia embora achando que tinha se cadastrado. Agora os três blocos de captura
(rodapé, catálogo e a seção `newsletter` da home) leem `NEXT_PUBLIC_NEWSLETTER_ACTION`, um lugar só
(`lib/newsletter.ts`), e **sem destino o bloco não renderiza** — no rodapé some a faixa inteira,
com a borda, senão sobra uma tira vazia. Com destino, o formulário é POST de verdade, com
`name="email"` e `required`. A `action` da receita continua vencendo, para a seção que tiver
destino próprio.

**Gate novo:** `<input type="email">` com `preventDefault` sozinho reprova o build. É o padrão
exato do defeito, e a regra já estava escrita ("formulário sem destino não nasce") sem nada que a
cobrasse.

**E o buraco no meu teste**, que é o que deixou os dois passarem: eu gerava a loja sempre no estilo
`essencial`, e `conversao` é o rodapé do `promocional`. Esta versão foi verificada gerando e
buildando os **quatro presets** (essencial, promocional, editorial, boutique): os quatro passam.

Arquivo: `CLI - Unbox v0.20.3.zip`.

### v0.20.2 — vitrine da home vinculava produto pelo slug

O vínculo de produto aceita `productId`, `_id` ou `slug`, e o painel salva o `productId` (é o que a
rota `/api/unbox/catalogo` devolve como `id`). Mas o vínculo **default do código**, o que vale
enquanto o lojista não escolheu nada, era montado com `slug`: `product-showcase` e
`combos-carousel` faziam `produtos: [...].map((p) => p.slug)`.

Slug é editável no painel da Unbox. Quando muda (renomear produto, ajuste de SEO), o vínculo por
slug para de resolver — e `resolverVitrine` descarta o que não encontra, então o produto **some da
home sem erro nenhum**. Os dois passaram a usar `p.productId || p.slug`: o id é estável e o slug
fica de reserva para catálogo que não devolva id. A resolução continua aceitando os três, então
documento já publicado com slug continua funcionando enquanto o slug existir.

E o silêncio também saiu: vínculo pedido que não resolve agora deixa um aviso no log do servidor
dizendo quantos e quais, em vez de a seção simplesmente encolher.

Arquivo: `CLI - Unbox v0.20.2.zip`.

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

> **Revertido depois.** Publicar o `tools/` num registro público levou junto ferramenta interna
> que não é de ninguém mais. O `files` voltou a `bin`, `src` e `template`, e a consistência veio
> pelo outro lado: o `prepack` roda no repositório de trabalho, onde `tools/` existe, e quem
> instala do registro nunca roda `prepack`.

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

**Achou defeito no primeiro uso, numa loja real.** Rodado contra uma loja gerada, servindo local:
`[NOME DA LOJA]` e `[CNPJ]` em `/termos` e `/privacidade`, as duas com `robots: index, follow`.
É o mesmo caso que o documento relata de outra loja, e estava lá, indexável.

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
| loja gerada A | 49 | 15 | 22 | 2 |
| loja gerada B | 84 | 29 | 51 | 4 |
| loja gerada C | 84 | 24 | 18 | 5 |
| loja gerada D | 88 | 23 | 56 | 4 |
| loja gerada E | 116 | 41 | 135 | 4 |
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

### v0.17.0 — rodada 3 do case em produção: PageSpeed, AEO, imagem e rastreamento

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

### v0.16.4 — rodada 2 do case em produção: o backend dizia o que estava errado e o front jogava fora

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
que a pessoa quis dizer ("011 99999-8888" vira 11999998888, "019 3333-4444" vira DDD 19), e o DDD
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

Segunda leitura do relatório da mesma loja em produção, agora com o item de tracking (§4: "o pageview de
entrada nunca é disparado"). O resto do relatório já tinha saído nas 0.15.3, 0.15.6 e 0.16.0.

**Medi o container central antes de mexer, e a medição corrigiu o diagnóstico.** Conferi no JS do
`GTM-PZLT336` que gatilhos de evento ele tem (a configuração de dentro da conta não se escreve
aqui). **Não existe gatilho de custom event
`page_view`** — empurrar `page_view` no dataLayer não acionaria nada lá. Depois rodei a loja
gerada, sem `NEXT_PUBLIC_GA_ID` e sem Pixel:

- **O pageview de ENTRADA é contado**, ao contrário do que o relatório supõe: o hit
  `en=page_view` sai no carregamento, disparado pela tag GA4 que o próprio container já tem no
  gatilho de todas as páginas.
- **A navegação SPA é que não vira pageview**: quatro trocas de rota no dataLayer e o contador
  de hits parado em 1. Isso é configuração do container, não do código, e só a Unbox pode
  resolver: está fora do que o CLI controla.
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

Relatório de uma loja gerada pelo CLI e levada a produção. A maior parte dos itens
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

Vem de duas fontes: a auditoria do tracking da foundation e o relatório de um cliente sobre a
loja nativa da Unbox, com sete defeitos reproduzíveis. Medi o container central `GTM-PZLT336` e
duas lojas nativas para saber o que ele espera; a foundation agora entrega isso e evita cada um
dos sete.

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

- **Header novo `equilibrado`** (pedido do time): uma linha só, com as categorias à
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

**Correção de escopo do M0** (apontada na revisão): o "Diagnóstico de Ambição + separação
briefing × DESIGN-DRAFT" pertence ao agente de GERAÇÃO de briefing (montante, fora do CLI) —
tinha entrado por engano no agente 15 da foundation na v0.9.6. Removido do 15: a seção M0
inteira (diagnóstico de 4 eixos, instrumentos universais/condicionais, nota de calibração) e
as exigências dela no "Fim do briefing" e no M2. Ficou apenas a contraparte de CONSUMO: se o
projeto chegar com briefing pronto do agente de briefing, o 15 trata o corpo como lei e o
anexo DESIGN-DRAFT como default a desafiar com `frontend-design`.

### Beta v0.9.7 (r2) — create-unbox-store 0.12.11

**Checkout SEMPRE com `?id=&token=` na URL** (pedido do time — sem isso a recuperação de
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

Dois reforços de processo (proposta de elevação de média v2 + agente de AEO da operação):

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
  constrói. Calibração explícita: essa proposta é arquétipo, não padrão.
- **Agente 17 — AEO (novo, opcional)**: prepara a loja pra ser citada por motores de
  resposta (ChatGPT, Claude, Perplexity, AI Overviews). Menu de 6 módulos: `llms.txt`
  gerado do catálogo, FAQ answer-friendly + FAQPage schema, Product schema enriquecido
  (frete/troca/GTIN — estendendo o JSON-LD real da PDP, sem regredir o gate do
  aggregateRating), FAQ por produto derivado de ficha técnica real, conferência dos bots de
  IA no `robots.ts` (a foundation já os libera) e entidade da marca (Organization + página
  Sobre citável). Adaptado à foundation (caminhos reais, modo mockup sem quebrar build,
  regras de honestidade alinhadas ao M5). Ordem recomendada: 15 → 16 → 13 → 14 → 17 → 12.

### Beta v0.9.5 (r2) — create-unbox-store 0.12.8

Porta de preview mais esperta (pedido do time):

- **Escopo automático por domínio**: a porta só existe em host de PREVIEW (`*.vercel.app`,
  `*.myunbox.com.br`, + sufixos opcionais em `PREVIEW_HOSTS`). Em **domínio próprio da
  marca ela some sozinha** — apontar o domínio É o lançamento, sem mexer em env. No
  localhost também fica desligada (dev e QA livres; `PREVIEW_FORCE=1` liga pra testar).
  `PREVIEW_DISABLED=1` segue como kill switch manual. O `.env.local` gerado não precisa
  mais de nenhuma env de porta.
- **Chave do time**: qualquer URL da loja com `?chave=<PREVIEW_PASSWORD>` grava o cookie de
  30 dias e segue direto, sem formulário — o parâmetro é removido da URL no redirect. Ex.:
  `https://loja.vercel.app/?chave=SUA_CHAVE`. Chave errada cai na porta normal. (Esta versão
  trazia uma senha de fábrica no código, que era a mesma em toda loja gerada e viajava no
  pacote público. Não existe mais: o CLI sorteia uma por instalação, e sem a variável o
  atalho é recusado.)
- Validado ao vivo nos 7 cenários: localhost aberto, vercel.app/myunbox travados, domínio
  próprio aberto, chave certa entra e limpa a URL, cookie persiste, chave errada barra.

### Beta v0.9.5 — create-unbox-store 0.12.7

**Porta de preview com captura de lead + Pipedrive** (receita de duas lojas em produção, agora de fábrica):

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

**M5 recalibrado (pedido do time)**: o gate de honestidade agora bloqueia fabricação
**SILENCIOSA**, não a escolha do lojista. O agente segue proibido de inventar dado, mas o
que o LOJISTA, perguntado, mandar manter é decisão dele — registrada em
`marca/honestidade-permitido.txt` e anotada no DESIGN-<MARCA>.md. O que não existe é
placeholder fabricado ir pro ar sem ninguém ter decidido.

### Beta v0.9.4 — create-unbox-store 0.12.6

**Protocolo de elevação da média** (proposta vinda de um case de loja em produção): eleva a média das lojas geradas tornando
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

**Recuperação de carrinho abandonado de ponta a ponta** (pedido do time: garantir que todo
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

Correções de dois cases em produção (relatório de 11 defeitos; os de código compartilhado
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

Correção integral do relatório de melhorias do time de uma loja em produção (P0, P1, P2 e F3).

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

⚠️ **Lojas JÁ no ar** (as geradas antes desta versão) saíram com os defaults antigos:
vale auditar com `npm run unbox:dump` se o que elas prometem (Pix 5%, frete grátis R$199,
brindes) existe no painel de cada uma, e zerar a store-config onde não existir.

### Beta v0.8 (r4) — create-unbox-store 0.11.3

- **Fix: barra de rolagem horizontal** (reportado por dev; afetava duas lojas em produção):
  o hack `.full-bleed` usa `100vw`, que INCLUI a largura da scrollbar vertical no
  Windows/Linux — sobravam ~15px e nascia a barra horizontal. Corrigido na raiz com
  `html { overflow-x: clip }` (fallback `hidden`): corta o excedente sem criar scroll
  container (sticky/scrollIntoView intactos). Lojas JÁ deployadas precisam do mesmo patch
  de 3 linhas no globals.css delas.

### Beta v0.8 (r3) — create-unbox-store 0.11.2

- Área da conta enxuta: itens **Assinaturas** e **Endereços** removidos do menu lateral e
  dos cards da visão geral (pedido do time, a partir de uma loja em produção). As rotas continuam existindo
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

- **Fluxo de compra refeito como COMPONENTE** (feedback do time + referência de loja real):
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

- **Agente 15 (Branding & Identidade) + briefing automático no primeiro acesso**:
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
