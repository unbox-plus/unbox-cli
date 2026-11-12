# O bloco do editor: regras para deixar a loja editável sem quebrar o contrato

Fonte das regras: `template/CLAUDE.md` ("Editor: o que não pode quebrar"), `template/scripts/check-editable.mjs`
(o cabeçalho explica cada reprovação), `template/lib/rotas-editaveis.ts`, e o `docs/LEVANTAMENTO-EDITAVEL.md` do
`unbox-editor` (o que o editor já edita e o que ainda não). Quando este arquivo e eles divergirem, eles ganham;
corrija aqui.

## 1. O que o gate mede e em que ordem reprova

`npm run unbox:editavel` abre cada página que `GET /api/unbox/paginas` lista, em modo edição
(`?unbox_editor=1`), espera o manifesto dos primitivos e mede: de todo texto visível e toda imagem, quanto está
dentro de um `[data-editor-path]`. Aprova com ≥ 80% por página (`--minimo`), exceto as que a loja declarou
`SO_CHROME`, onde a cobertura é impressa e não julgada. Antes da cobertura, reprova por construção:

1. rota que a loja lista sem declaração em `CONTAINERS_POR_ROTA` (ou com containers diferentes dos observados);
2. seção sem `kind`/`label` no manifesto (o painel mostraria id de código ao lojista);
3. editável fora de container (primitivo numa página que ninguém declarou: não é editável, e a loja o denuncia
   em `manifest.semContainer`);
4. container do código com prefixo reservado ao lojista (`pagina-`, `artigo-`, `colecao-`);
5. rota do lojista sem `<EditableFatia>` (o texto do lojista some da tela sem erro);
6. com personalização declarada: página do público sem `<EditablePublico>`, `seguir` fora do middleware,
   `publicoNoLogin(` fora do signin, `<LojaPadrao` fora da privacidade; com `ocultaChromeEm`: a marca na rota.

Saída `2` é "não rodou" (servidor fora, rota dinâmica sem exemplo, manifesto que não chegou). Nunca é aprovação.

## 2. Declarar rotas

Toda rota de `app/(loja)/` que o `robots.ts` não bloqueia entra em `lib/rotas-editaveis.ts`:

- `CONTAINERS_POR_ROTA["/rota"] = ["id-do-container"]`: os containers que a página renderiza, fora o `chrome`.
  Uma página institucional própria com três seções tem UM container próprio (`"/sobre": ["sobre"]`), e as
  seções dentro dele têm `id`, `kind` e `label`.
- `CONTAINERS_POR_ROTA["/rota"] = []` mais a entrada em `SO_CHROME`, com o motivo ao lado, quando a página é
  texto legal (termos, privacidade, devoluções, política de entrega), rótulo de formulário/UI ou mecânica de
  compra (busca, carrinho, checkout, conta). O gate não infere isso do conteúdo: é a loja que declara.
- Container de rota do código não pode começar com `pagina-`, `artigo-` ou `colecao-`: esses prefixos são os
  das páginas do lojista (`PREFIXOS_DO_LOJISTA` em `document.ts`), a loja leria a seção como página dele, e o
  gate reprova (§1, item 4).
- `app/robots.ts` exporta `DISALLOW` por segmento; o que está lá o editor não oferece. Não use o robots para
  "esconder" do gate uma página pública: ela some do editor e do sitemap junto.

Coleção do lojista (`lib/paginas-do-lojista.ts`, `COLECOES_DO_CODIGO`, `blog` de fábrica) nunca pode ter o nome de
um primeiro segmento de rota do código nem de uma entrada de `public/`. Se a loja criou `app/(loja)/blog/`, ou a
coleção muda de handle (uma linha), ou o blog em código sai e o conteúdo vira artigos do lojista.

## 3. O que vira primitivo e o que não vira

Vira: título, parágrafo, CTA, link, foto, ícone, pôster de vídeo, cor de fundo de seção, e a cópia que mora em
JSON do repositório (vira o `fallback`). Os primitivos, todos exportados por `lib/editable/index.ts`:
`Editable.Text`, `Editable.RichText` (texto formatado: o substituto do HTML cru), `Editable.Image`/`Img`,
`Editable.Icon`, `Editable.Link`, `Editable.Slot` (cor de fundo e estilo por elemento), `Editable.Html`,
`Editable.Video`, `Editable.Vitrine` (lista de produtos escolhida pelo lojista), `Editable.Section` (com `kind` e
`label`) e `Editable.Sections` (o container, com `layout`). Leia a assinatura em `lib/editable/primitives.tsx`
antes de usar um que não conhece; o `path` de cada um é chave do documento publicado.

Não vira, por regra (`template/CLAUDE.md`, seção "Editor: o que não pode quebrar"; o comentário "§8" em
`lib/rotas-editaveis.ts` aponta para uma numeração antiga do README do editor que não existe mais, a regra é a
do `CLAUDE.md` e o `dado-do-catalogo` do `LEVANTAMENTO-EDITAVEL.md`):

- **preço, nome, estoque, descrição, imagem e variantes de produto do catálogo**: vêm do painel da Unbox
  (`dado-do-catalogo` no levantamento do editor). O gate não conta esses como falta;
- **texto legal** (termos, privacidade, devoluções, política de entrega): `SO_CHROME`;
- **rótulo de formulário e de UI** (campo de busca, stepper, "Adicionar ao carrinho");
- **mecânica de compra** (carrinho, checkout, área da conta, construtor de combo);
- **"Powered by Unbox"** e os dados da empresa na barra do rodapé (contrato e lei do comércio eletrônico).

Vocabulário fechado de `kind` (`SECTION_KINDS` em `lib/editable/document.ts`): `cabecalho`, `faixa-de-anuncio`,
`banner`, `texto-rolante`, `vitrine-de-produtos`, `produto-em-destaque`, `beneficios`, `como-funciona`,
`depoimentos`, `perguntas-frequentes`, `galeria`, `video`, `sobre-a-marca`, `comparacao`, `newsletter`, `contato`,
`lojas-fisicas`, `botao-flutuante`, `rodape`, `outro`. Use o específico; `outro` tira do agente do chat os verbos
daquela seção. Ids de seção são chave do documento publicado: não renomeie um id que já foi ao ar.

## 4. Dado que vem da API

A regra que mais se erra na migração, nas duas direções:

- **Não embrulhe dado da API em primitivo** para subir a cobertura. O lojista passaria a editar no editor o que
  edita no painel, e as duas fontes divergem na primeira publicação. Título de produto, preço e foto do catálogo
  ficam como `{product.title}` puro, dentro da seção editável, fora de `Editable.Text`.
- **Não duplique o catálogo em JSON no repositório** (título, `descriptionHtml`, variantes raspados do site da
  marca): desliga o painel como fonte. Na migração, dado de produto volta a vir da API; o que a loja tinha a mais
  (texto de ingrediente, storytelling, selo) é prosa da marca e vira primitivo com o JSON como `fallback`.
- **HTML da API passa por `lib/sanitize.ts`** antes de `dangerouslySetInnerHTML` (é o que `pdp-view.tsx` faz com
  a descrição). HTML de JSON do repositório não é vetor de XSS, mas quando esse conteúdo virar editável ele deixa
  de ser do repositório: o editor limpa ao gravar (`lib/html.ts` dele), e a loja renderiza por
  `Editable.RichText`, não por HTML cru.
- **Vitrine**: produto escolhido pelo lojista chega por `catalogoDasVitrines(items, vitrines)` em
  `pagina-inicial.tsx` e pelas seções `vitrine-de-produtos`; uma seção própria que lista produtos lê
  `props.data.catalogo`, e não um JSON.
- **Honestidade**: seção que depende de dado (avaliação, depoimento, estoque, prazo) some sem o dado; nunca cai
  em default inventado. `npm run unbox:honestidade` pega o que voltar.

## 5. Páginas do lojista como alternativa ao código

Página institucional em código (sobre, sustentabilidade, imprensa, parceiros) custa um container, N primitivos e
uma linha em `CONTAINERS_POR_ROTA`; a mesma página criada no editor (`/paginas/<endereço>`, seção de Texto e as
seções da home) custa zero código e é 100% editável. Ofereça a troca ao usuário quando a página for prosa e foto (chave `paginasInstitucionais`; blog,
`blog`);
mantenha em código quando o layout for parte da identidade (grid próprio, animação, dados da API).

### Quando a decisão foi "migrar"

- **Catálogo em JSON → API**: a página de produto volta a ler `getProductBySlug`/`getCatalog` e a renderizar
  pelo `pdp-view.tsx` do template (ou pelo componente próprio da loja, lendo os mesmos campos); descrição por
  `sanitizeHtml`. Cada campo do JSON que a API não tem vira, nesta ordem de preferência: campo do produto no
  painel (pergunte ao usuário se existe; sem chave), prosa da marca em `Editable.Text`/`RichText` dentro da seção da
  PDP com o JSON como `fallback`, ou some (regra da honestidade: bloco sem dado não renderiza). Nunca mantenha
  o `{...json, ...api}`: é o que cria as duas fontes. O JSON só sai do repositório quando nenhum `fallback` o
  lê mais.
- **Página em código → página do lojista**: a página do editor tem de existir e estar publicada ANTES de a
  rota do código sair, senão o endereço responde 404 entre um deploy e outro. A ordem: (1) entregar ao usuário
  o conteúdo da página em texto (títulos, parágrafos, fotos em `public/`, links) para ele criar no editor com o
  mesmo endereço; (2) só depois remover `app/(loja)/<rota>/`, o componente e a entrada em `CONTAINERS_POR_ROTA`;
  (3) conferir que `lib/reservados.ts` deixou de reservar o segmento (a rota saiu de `app/`). Para o blog, o
  mesmo por artigo, com a coleção do lojista no endereço antigo. Enquanto a página do editor não existe, a rota
  do código fica e passa no gate como página comum (primitivos nela), ou o relatório diz que ela está pendente.

## 6. O que o editor ainda não edita (não force)

Do levantamento do `unbox-editor`: listas com adicionar/remover item (perguntas do FAQ, frases da faixa,
links do menu) e vídeo como tipo. Para o FAQ, cada pergunta e resposta vira `Editable.Text` com contagem fixa;
para o vídeo, o pôster vira `Editable.Image`. Isso já conta como editável para o gate; não construa um conceito
novo de lista na loja.
