# Migração de lojas já geradas

A loja gerada é uma CÓPIA de `template/` na versão que a criou. Ela não recebe atualização sozinha: trazer uma
loja ao template atual é decidir, arquivo a arquivo, entre copiar o novo, reaplicar o que a loja mudou por cima,
ou manter o da loja. Este arquivo é a ficha que essa decisão consome, **uma seção por versão**, escrita por quem
fecha a versão (é quem sabe o que mudou; reconstruir depois lendo diffs custa uma sessão inteira por loja).

O `CHANGELOG.md` conta a história e vira o release no GitHub; aqui fica só o que uma loja já no ar precisa
fazer. Quem lê este arquivo: `unbox analyze-version` (imprime as fichas entre a base da loja e a versão atual) e
`unbox upgrade-template` (o relatório de pendentes), a skill `migrar-loja-analisar`, `tools/cli-version-lojas.sh` e
o gate `tools/check-migracao.mjs`, que recusa fechar uma versão sem a seção dela aqui. O arquivo vai no pacote npm.

## Como se sabe a versão de uma loja

- **Da 0.30.0 em diante**: `unbox create` carimba `unbox.templateVersion` no `package.json` da loja. É a fonte.
- **Antes disso**: marcadores em `src/version-markers.json` (um arquivo ou trecho que só existe a partir
  daquela versão). Loja sincronizada à mão aparece com a versão para a qual foi atualizada; o primeiro commit
  dela (`scaffold: create-unbox-store ...`) diz a verdadeira.
- Tags no git: 0.17.1, 0.20.1, 0.20.3–0.20.5, 0.21.3, 0.21.5–0.21.9, 0.22.0, 0.22.1, 0.23.0, 0.24.0, 0.25.0; da
  0.26.0 à 0.29.0 o template é o `HEAD` de `main`. Versão sem tag nem marcador (0.20.0, 0.20.2, 0.21.0–0.21.2,
  0.21.4, 0.27, 0.28) é lida como a anterior.

## O formato de cada seção (o gate confere os títulos)

```
## X.Y.Z
### Template
+ arquivo novo · ~ arquivo alterado · - arquivo removido   (sai de `git diff --name-status <anterior> HEAD -- template`)
### Loja já gerada
o que copiar, o que reaplicar, o que recriar em outro lugar; "nada" quando for só docs
### Ambiente
variáveis que entram e saem (ou "nada")
### Mudanças de comportamento
o que o lojista ou o cliente passa a ver diferente, e a escolha migrar × manter quando houver (ou "nada")
### Armadilhas
o que custou numa migração real (ou "nenhuma conhecida"); a próxima migração acrescenta aqui
```

Mudança que entra em `develop` antes de a versão existir vai numa seção `## próxima`, no topo, com os mesmos
cinco títulos; quem fecha a versão a renomeia para `## X.Y.Z` (é o passo 3 do release em `CLAUDE.md`). A CLI
ignora essa seção (o parser só lê título com número), e o gate `check-migracao` recusa pacote e release enquanto
ela existir, para a ficha nunca apontar para uma versão que ainda não saiu nem ficar sem número depois de sair.

Onde está "(inferido)" nas seções antigas, o CHANGELOG não tinha o parágrafo e a lista veio do `git diff`.

## Refatorar ou refazer: a régua de corte

Abaixo de **0.22.0, refazer** (`unbox create` novo e portar `public/brand/`, fontes, tokens de cor, `marca/`,
redirects e as seções, páginas e PDP próprias, tal qual, embrulhadas em primitivos): a 0.22.0 trocou a API inteira,
entre 0.21.0 e 0.22.0 há dez consertos encadeados nos mesmos arquivos, e abaixo de 0.21.0 o próprio CHANGELOG diz
"mais barato regerar". Distância medida (fração do template atual que mudou desde um template puro daquela versão):
0.22.0 = 0,44; 0.21.3 = 0,50; 0.20.1 = 0,64; 0.17.1 = 0,74.

Nos dois caminhos a meta de layout é a mesma: a loja sai igual à que entrou (mesmas seções, copy, imagens e
comportamento em 1440 e 390), comparada contra as capturas que a análise tira antes de qualquer mudança. Só muda
de aparência o que o dono da loja escolheu migrar nas "Mudanças de comportamento". Quando primitivo e layout
conflitam, o layout ganha e o componente fica registrado como "sem primitivo, por fidelidade"; os 80% do gate são
meta, não restrição. A execução, refatorando ou refazendo, começa por um plano por bloco (origem de cada arquivo,
critério de pronto por comando, lógica própria que muda de lugar), revisado por um agente adversarial e aprovado
pelo usuário antes do primeiro arquivo.

De 0.22.0 em diante, refatorar, salvo três ou mais sinais da loja (os números são do script da skill):
`reescrita ≥ 10`, `fracao_em_conflito ≥ 0,4`, `foundation_editada_a_mao > 0`,
`integracao_com_logica_propria ≥ 1` com base < 0.25.0, `sem_primitivo ≥ 30` e `rotas_sem_declaracao ≥ 8`.

### Custo por salto (ordem de grandeza, loja com customização média)

| Salto | Refatorar | O que pesa |
|---|---|---|
| 0.24.0 → atual | 1,5 a 2 dias | SDK (~30 arquivos de import; lógica em `store.ts`), conta/assinaturas (cópia), docs |
| 0.23.0 → atual | + 0,5 dia | LPs por público, `catalog-client` novo, `moldura-da-loja` |
| 0.22.x → atual | + 1 dia | home para `PaginaInicial`, borda do público, `/api/unbox/publicos` |
| 0.21.x → atual | + 1 a 2 dias e o merge dos dez consertos | a régua manda refazer |
| < 0.21.0 | não refatore | refazer |
| Editor até 80% | 0,1 dia por componente sem primitivo + 0,5 dia para rotas, colisões e gate | igual nos dois caminhos |
| Refazer (qualquer base) | 1 a 2 dias de scaffold + marca + redirects, mais o editor | as seções próprias nascem com primitivos |

---

## próxima
### Template
~ `scripts/check-editable.mjs`: as reprovações de container declarado sem rota dizem onde tirar a declaração
  (`DECLARACAO_DA_PERSONALIZACAO` em `lib/personalizacao.ts`, `OCULTA_CHROME_EM` em `lib/chrome-das-paginas.ts`).
~ `scripts/check-recipe.mjs`: as famílias de layout das seções PRÓPRIAS saem do script e passam a ser lidas de
  `components/home/sections/familias.json`, arquivo da loja (opcional; o template não o traz), mesclado por cima
  do mapa do template. O script volta a ser igual em toda loja.
~ `agents/PADROES.md`: seção nova declara a família em `components/home/sections/familias.json`.
### Loja já gerada
Opcional: copiar `scripts/check-editable.mjs`. Só o texto das mensagens muda; o gate aprova e reprova o mesmo.

`scripts/check-recipe.mjs`: se a loja acrescentou entradas ao `FAMILIA` do script (compare com o do template da
base; são as seções próprias), passe cada uma para `components/home/sections/familias.json`, como
`{ "quiz-da-marca": "grade" }`, e copie o script do template. Sem entradas próprias, só copiar. Sem o JSON, o
medidor lista as seções sem família e mostra o exemplo; ele só mede, nunca reprova o build. `agents/PADROES.md`:
copiar.
### Ambiente
nada
### Mudanças de comportamento
nada
### Armadilhas
- `scripts/check-recipe.mjs` era o único `scripts/check-*` que a loja precisava editar (a byzance tinha as seções
  próprias no mapa). Daqui em diante todos os `scripts/check-*` saem iguais ao template, e uma verificação por hash
  pode tratá-los da mesma forma.

## 0.31.1
### Template
~ `.claude/skills/migrar-loja-analisar/SKILL.md`, `.claude/skills/migrar-loja-executar/SKILL.md`: só entra no
  relatório de migração o que chega na loja (versão só de CLI fica de fora); a referência visual da loja antiga
  (capturas em 1440 e 390, `npm run unbox:qa`) é tirada na análise, antes de qualquer mudança; a execução cobre
  refatorar e refazer, começa por um plano de execução revisado por um agente adversarial e aprovado pelo
  usuário antes do primeiro arquivo, e tem fidelidade ao layout atual como restrição (o gate do editor é meta,
  o layout é restrição; só muda de aparência o que o cliente escolheu migrar). A análise fecha com a lista
  numerada das decisões do usuário (opções, o que se perde em cada uma, recomendação e efeito no plano), que a
  execução usa como pauta; as duas skills dividem o trabalho independente entre quantos subagentes forem úteis.
~ `lib/env-check.ts`: o `#` sozinho deixou de ser sinal de comentário colado como valor (senha com `#`, como a
  do próprio `.env.example`, gerava o aviso com a credencial funcionando); espaço, acento e parêntese continuam.
### Loja já gerada
Copiar `.claude/skills/` inteira (a loja não mexe nisso). `lib/env-check.ts`: copiar se a loja não o tocou (é
uma função só, `pareceProsa`, e a linha do aviso).
### Ambiente
nada
### Mudanças de comportamento
nada
### Armadilhas
nenhuma conhecida

## 0.31.0
### Template
+ `lib/cart-thumbnail.ts` (a foto da linha do carrinho, resolvida do catálogo no servidor)
~ `lib/queries.ts` (`getProductImage`), `app/api/cart/route.ts` (chama o resolvedor no lugar da validação de URI
  que estava inline), `app/api/cart/link/route.ts` (idem, antes do `createCart`), `components/cart/cart-provider.tsx`
  (para de mandar `thumbnail` no corpo do POST; o campo de `AddItemArgs` fica só para a linha otimista),
  `CLAUDE.md` (a regra ao lado da do preço)
### Loja já gerada
Copiar `lib/cart-thumbnail.ts`. `lib/queries.ts`: acrescentar o `getProductImage` (a loja costuma ter TTL e
fetchers próprios aí, então é acrescentar, não copiar o arquivo). `app/api/cart/route.ts` e
`app/api/cart/link/route.ts`: copiar direto se a loja não os tocou; se tocou, reaplicar as duas linhas (o import
e a chamada `comImagemDoCatalogo` antes do `createCart`/`addCartItems`, no lugar do `items.map` que só validava a
URI absoluta). `cart-provider.tsx` é arquivo grande e muito customizado: reaplicar à mão, tirando só
`thumbnail: item.thumbnail` do corpo do POST, e NÃO da linha otimista. Loja que adiciona ao carrinho por um
caminho próprio (landing, quiz, seção feita sob medida) não precisa de nada: a foto passa a ser decidida no
servidor, qualquer que seja a tela. Exige SDK `^0.4.1` (usa `getProductsByIds`), que a 0.29.0 já pedia.
### Ambiente
nada
### Mudanças de comportamento
A foto do item no carrinho, no checkout e no pedido passa a ser a do catálogo da Unbox, mesmo onde a tela mandava
outra. Na prática nada muda em loja de template puro (todas as telas já mandavam a do catálogo); muda para a loja
que escolheu uma imagem diferente em algum ponto de "adicionar ao carrinho", caso típico do card de combo com
arte própria. Migrar é o padrão: a foto gravada na linha é a que o cliente vê como "o que estou comprando" e ela
segue para o pedido. Manter a arte própria é decisão do dono da loja; para isso, não copie
`lib/cart-thumbnail.ts` e deixe as rotas como estão. Caminho do meio, quando o que se quer é a arte do combo:
cadastrar a imagem no produto do catálogo, que arruma PDP, vitrine, carrinho e pedido de uma vez.
### Armadilhas
Foto que não aparece no carrinho depois da migração é produto sem `imageUrls` no catálogo, não a migração:
confira com `npm run unbox:dump` antes de mexer no código. Item de kit resolve a foto pelo `productKitId`, então
o kit precisa ter imagem própria cadastrada; sem ela, a linha fica com o placeholder, mesmo com os itens
escolhidos tendo foto.

## 0.30.0
### Template
+ `.claude/skills/migrar-loja-analisar/SKILL.md`, `.claude/skills/migrar-loja-executar/SKILL.md`,
  `.claude/skills/migrar-loja-executar/references/editor.md` (as skills de migração; a CLI é chamada pelo `npx`)
+ `lib/editable/imagem-otimizada.ts`
~ `lib/editable/index.ts` (exporta `imagemOtimizada`), `lib/editable/primitives.tsx` (`Editable.Img` com `sizes`
  passa pelo otimizador do Next), `components/home/sections/hero.tsx` (as quatro variantes com imagem passam
  `sizes`; a arte do celular vai pelo `<source>`), `components/landing/product-picker.tsx` (sem a seta nos botões),
  `DEPLOY.md` e `agents/definitions/12-deploy.md` (várias chaves de deploy por loja, `unbox keys`)
O resto da versão é da CLI: o carimbo `unbox.templateVersion` no `package.json` da loja gerada, a seção Template
do `unbox status`, o aviso no `unbox deploy`, `unbox analyze-version`, `unbox upgrade-template`, `unbox keys` e
este arquivo dentro do pacote.
### Loja já gerada
Copiar `.claude/skills/` (loja não mexe nisso) e `lib/editable/imagem-otimizada.ts`; `lib/editable/index.ts` e
`primitives.tsx` são foundation do editor, copiar direto se a loja não os editou (se editou, reaplicar: uma
linha no `index.ts` e o bloco de `sizes` no `Img`). `hero.tsx`: copiar se a loja ainda usa o hero do template;
loja com hero próprio só ganha o otimizador se passar `sizes` no `Editable.Img` dela (opcional). `product-picker.tsx`:
copiar se a loja não o tocou; se tocou, tirar a seta dos dois rótulos. `DEPLOY.md` e `12-deploy.md`: docs, copiar.
`unbox upgrade-template` escreve o carimbo `unbox.templateVersion` no `package.json` da loja; sem ele, acrescentar
`"unbox": { "templateVersion": "0.30.0" }` à mão depois da migração, para o `status` e o `deploy` lerem a versão.
### Ambiente
nada
### Mudanças de comportamento
O banner da home sai pelo otimizador de imagem do Next (WebP, `srcset` por largura): a mesma arte, mais leve. Host
fora de `images.remotePatterns` do `next.config.ts`, SVG, `data:` e `blob:` continuam como estavam. Migrar é o
padrão; manter só se a loja serve o banner de um CDN já otimizado e não quer o `/_next/image` no caminho.
Os botões do seletor de pacotes perdem a seta ("Selecione mais N pacotes", "Ir pro pagamento"): migrar.
### Armadilhas
Loja gerada antes desta versão não tem o carimbo: `unbox analyze-version` a reconhece por marcadores
(`src/version-markers.json`); loja sincronizada à mão engana o marcador, e aí vale `--base <versão>`.
Banner de host que não está em `images.remotePatterns`: o `imagemOtimizada` devolve a URL como veio e nada quebra,
mas a loja não ganha a otimização; acrescentar o host ao `next.config.ts` para ganhar.
`unbox upgrade-template` aplica ao `atual/` o slug sem hífen (`cereousv2` numa loja `cereous-v2`) em
`app/api/acesso/route.ts`, e o nome técnico (`cereous-v2`) onde o template usa `NEXT_PUBLIC_SITE_NAME`: conferir o
`LOJA` do acesso contra o `middleware.ts` e o `lib/editable/config.ts` da loja antes de copiar.

## 0.29.0
### Template
+ `components/account/subscription-editor/*` (10 arquivos), `components/account/subscription-items-section.tsx`,
  `lib/subscription-draft.ts`, `lib/subscription-items.ts`, `scripts/check-subscription-draft.ts`,
  `scripts/check-subscription-items.ts`
~ `components/account/subscription-actions.tsx`, `account-shell.tsx`, `app/api/subscriptions/[id]/route.ts`,
  `app/(loja)/conta/assinaturas/[referenceId]/page.tsx`, `conta/page.tsx`, `lib/schemas.ts`, `lib/queries.ts`,
  `lib/icons.ts`, `next.config.ts`, `.env.example`, `lib/env-check.ts`, `package.json` (SDK `^0.4.0`; o HEAD
  já pede `^0.4.1`), `DEPLOY.md`, `agents/definitions/08-customer.md`, `12-deploy.md`, `COVERAGE.md`, `README.md`,
  `CLAUDE.md`, `agents/MANAGER.md`
Kits na PDP e no carrinho (UBX-5238):
+ `components/product/pdp/kit-box.tsx`, `components/cart/kit-lines.tsx`
~ `pdp-view.tsx`, `buy-box.tsx`, `quantity-stepper.tsx`, `cart-provider.tsx` (+413), `checkout-client.tsx`
  (+1298, em grande parte reformatação), `app/(loja)/produto/[productSlug]/page.tsx` (+353),
  `lib/cart-normalize.ts`, `lib/schemas.ts`, `lib/queries.ts`, `lib/catalog-map.ts`, `lib/vitrine.ts`
### Loja já gerada
(inferido) `npm install @unbox-plus/sdk@^0.4.1`; copiar a área da conta inteira (raramente customizada), a rota de
assinaturas, `lib/subscription-*.ts`, os dois scripts e a linha deles no `package.json`; `next.config.ts`
reaplicando o que a loja tinha; `.env.example`, `lib/env-check.ts`, docs. Kits: só importa para loja que vende KITS
da Unbox (`productKitId`); loja com "combo" próprio (um produto com N unidades repartidas no front) não é kit:
ignorar esses arquivos e reaplicar só os imports do SDK neles.
### Ambiente
+ `NEXT_PUBLIC_ADMIN_ORIGIN` (variável de BUILD: o painel Admin abre a loja num iframe; sem ela no
`frame-ancestors`, não abre).
### Mudanças de comportamento
O cliente passa a editar os produtos da assinatura (quantidade, remoção, variante, adição, kits), cada permissão
de `recurringOrdersPolicy.customerActions` valendo sozinha. Loja que escondia isso de propósito precisa decidir.
Kit aparece como um item só no carrinho, com os itens escolhidos; combo próprio continua como estava.
### Armadilhas
Rótulo de frequência da assinatura escrito por índice na loja (`index===0?"Todo mês":...`) em vez de `title` de
`allowedFrequencies`: a conta nova lê a policy, e as duas telas divergem. Corrigir na migração. Pergunte ao usuário
se os combos são kits antes de decidir sobre os arquivos de kit; é uma das decisões do relatório da análise.

## 0.26.0 a 0.28.0
### Template
~ `package.json` (SDK `^0.4.0`, era `^0.2.0`), `DEPLOY.md`, `agents/definitions/12-deploy.md`; entre a tag
  0.25.0 e a 0.29.0 entrou também `lib/subscription-items.ts` (é o marcador "0.26.0"; não há tag, o template-base
  usado é o da 0.25.0)
### Loja já gerada
(inferido) o bump do SDK; e a decisão de publicar pela CLI (`unbox provision/deploy`) ou não, que é processo.
### Ambiente
nada
### Mudanças de comportamento
nada na loja; o `unbox create` substitui o `create-unbox-store` (que continua).
### Armadilhas
O teste de `npm test` garante que `unbox create` e `create-unbox-store` geram o mesmo projeto, não que ele é o
da 0.25.0.

## 0.25.0
### Template
+ `lib/unbox.ts`
- `lib/unbox/{client,customer,errors,index,pedido,store,types,webhooks}.ts`, `lib/dataloader.ts`
~ `lib/config.ts` (sem `decodeJwtClaims`/`SHOP_*_CLAIM`), `lib/api.ts` (sem `invalidAddressFields`),
  `lib/customer-session.ts` (três linhas), `package.json` (`@unbox-plus/sdk`), todas as rotas de `app/api/*`,
  `app/sitemap.ts`, `app/llms.txt/route.ts`, `components/cart/cart-provider.tsx`, cinco scripts de `scripts/`
### Loja já gerada
(inferido; o CHANGELOG só diz "lojas no ar sobem com `npm install @unbox-plus/sdk`") `npm install
@unbox-plus/sdk@^0.4.1`; copiar `lib/unbox.ts`, `lib/config.ts`, `lib/api.ts`, `lib/customer-session.ts`; apagar
`lib/unbox/` e `lib/dataloader.ts`; reapontar imports: `@/lib/unbox/{client,types,errors,customer}` →
`@unbox-plus/sdk`, `@/lib/unbox/webhooks` → `@unbox-plus/sdk/webhooks`, `@/lib/unbox/store` → `@/lib/unbox`;
copiar as rotas de `app/api/*` que a loja não tocou.
### Ambiente
nada
### Mudanças de comportamento
Renovação de token cobre "No authenticated user"; erro HTTP sem `errors[]` vira erro com causa. A página
continua indo para `error.tsx`.
### Armadilhas
- Lógica da loja dentro de `lib/unbox/store.ts` ou `client.ts` (modo preview/fake, campo tirado de uma query,
  cache próprio): o arquivo deixa de existir, e o SDK NÃO tem ponto de injeção de client (`connectUnboxStore` só
  aceita `tokenStore`). O desvio é recriado em `lib/unbox.ts`, o único arquivo da fiação que é "desta loja"; o
  client falso passa a ser tipado contra `UnboxClient` do pacote.
- `lib/unbox.ts` × `lib/unbox/`: qualquer arquivo que sobre na pasta deixa `@/lib/unbox` ambíguo. Mover.
- Campo tirado à mão de uma query (`keepOrderPricingPolicy`): o SDK 0.4.1 já o exclui; conferir em
  `dist/client.js` antes de recriar um patch.
- `hasUnboxCredentials` continua exportado de `lib/config.ts`, agora pela régua do pacote.
- Teste: `tsc --noEmit` limpo, build com as mesmas rotas; `import "server-only"` quebra o build se um componente
  de cliente importar `@/lib/unbox`, e é o desejado.
- Método que a loja acrescentou ao `UnboxClient` local e que o SDK não tem: o caso conhecido é
  `setCartFrequency` (mutation `updateCart` com `recurringItemsFrequencyId`, para o checkout ler a frequência
  escolhida no carrinho), ausente do SDK 0.4.1. O `gql()` do pacote é público: recriar como função da loja que
  recebe o client (`setCartFrequency(c, cartId, cartToken, freqId)` chamando `c.gql(...)`) e trocar a chamada
  `c.setCartFrequency(...)` por ela. Listar os métodos do `client.ts` da loja que não existem em
  `dist/client.d.ts` antes de apagar a pasta.

## 0.24.0
### Template
+ `app/(loja)/%5Fpublico/[publico]/oferta`, `%5Fpublico/[publico]/paginas/[handle]`,
  `components/landing/pagina-da-oferta.tsx`, `components/landing/pedido-de-chrome.tsx`,
  `components/paginas/pagina-avulsa.tsx`, `lib/chrome-das-paginas.ts`, `components/moldura-da-loja.tsx`,
  `components/home/sections/catalogo.ts`, `tipos.ts`
~ `lib/personalizacao.ts` (`["home", "oferta", "pagina-*"]`), `components/catalog/catalog-client.tsx`
  (`layout="espelho"`), a página de categoria, `app/previa-do-editor/layout.tsx`, `lib/editable/*`
### Loja já gerada
Nada muda sozinho; as LPs por público ligam quando a loja declara `oferta` e `pagina-*` e tem as duas rotas do
público; a categoria que espelha chega com `catalog-client.tsx` e a página da categoria novos; o chrome da
oferta com `pedido-de-chrome.tsx`, `lib/chrome-das-paginas.ts`, a marca em `pagina-da-oferta.tsx` e a prop no
layout. O `check-editable` diz o que falta.
### Ambiente
nada
### Mudanças de comportamento
"+ Adicionar seção" em toda página; a categoria passa a espelhar `/produtos`; oferta e página avulsa podem
esconder cabeçalho e rodapé.
### Armadilhas
Loja que reescreveu `catalog-client.tsx` perde o espelho da categoria no editor; o template só mudou uma linha
ali depois, então a reescrita fica, mas sem o `layout="espelho"` a categoria não acompanha `/produtos`.
Loja sem a landing `/oferta` (redirecionada no `next.config.ts` ou com `app/(loja)/oferta` removida): o build passa
e o gate `unbox:editavel` reprova enquanto "oferta" estiver declarada ("a loja declara «oferta» e nenhuma rota o
renderiza", "ocultaChromeEm sem a marca"). Tirar `"oferta"` de `DECLARACAO_DA_PERSONALIZACAO` (lib/personalizacao.ts)
e `/oferta` de `CONTAINERS_POR_ROTA` (lib/rotas-editaveis.ts); no redirect, pôr `/oferta` em `ROTAS_INTERNAS`, senão
o gate mede o destino no lugar dela. Esvaziar `OCULTA_CHROME_EM` (lib/chrome-das-paginas.ts) e tirar a prop
`ocultaChromeEm` do `app/layout.tsx` (lista vazia com a prop passada reprova: "a loja declara ocultaChromeEm sem a
lista das páginas"). Na remoção, apagar também `app/(loja)/%5Fpublico/[publico]/oferta`. `lib/publicos-da-borda.ts`
não muda: a borda segue a declaração. `/carrinho/oferta` é outro fluxo (o passo 2 do bloco de compra) e fica, com
`components/landing/product-picker.tsx`.

## 0.23.0
### Template
+ `components/home/pagina-inicial.tsx`, `app/(loja)/%5Fpublico/[publico]`, `lib/publicos-da-borda.ts`,
  `lib/personalizacao.ts`, `lib/publico-do-cliente.ts`, `app/api/unbox/publicos`
~ `app/(loja)/page.tsx` (casca), `middleware.ts` (`seguir`), `app/layout.tsx` (`<PontoDePublico/>`),
  `app/(loja)/privacidade` (`<LojaPadrao/>`), `app/api/account/signin` (`publicoNoLogin`),
  `app/api/revalidate`, `lib/rotas-editaveis.ts`, `lib/editable/*`
### Loja já gerada
Nada muda sozinho; a personalização liga quando a loja tem as três peças e passa `personalizacao` ao provider.
### Ambiente
nada
### Mudanças de comportamento
A home muda por público (link do anúncio, utm, quiz, conta, referer, região), com grupo de controle.
### Armadilhas
Loja que reescreveu a home ANTES desta versão tem a home em `app/(loja)/page.tsx`; mover para `PaginaInicial` é
condição para o público e para a vitrine por público. Loja que reescreveu `pagina-inicial.tsx` depois: conferir
se manteve `catalogoDasVitrines(items, vitrines)` (o script acusa `vitrine_ignorada`).
Loja sem a landing `/oferta` (redirecionada no `next.config.ts` ou removida) não pode declarar o container `oferta`
em `lib/personalizacao.ts` (`DECLARACAO_DA_PERSONALIZACAO`): o gate `unbox:editavel` reprova com "a loja declara
personalização por público sem a página do público de «oferta»". Tirar `"oferta"` dali e `/oferta` de
`CONTAINERS_POR_ROTA`; no redirect, pôr `/oferta` em `ROTAS_INTERNAS` (lib/rotas-editaveis.ts), senão o gate mede
`/combos` (ou o destino) no lugar dela. Da 0.24.0 em diante a lista completa (com o chrome ocultável) está na ficha
0.24.0.

## 0.22.1
### Template
~ `lib/editable/document.ts` (`numeroDoWhatsapp`)
### Loja já gerada
Só trocar `document.ts` se `NEXT_PUBLIC_WHATSAPP_NUMERO` foi escrito sem o 55.
### Ambiente
nada
### Mudanças de comportamento
Número do Brasil sem 55 ganha o 55.
### Armadilhas
nenhuma conhecida

## 0.22.0
### Template
~ `lib/unbox/client.ts`, `customer.ts`, `types.ts`, `store.ts`, `lib/customer-session.ts`, `lib/config.ts`,
  `lib/env-check.ts`, `lib/orders.ts`, `lib/session.ts`, `lib/ratelimit.ts`, `app/api/payment-link/route.ts`,
  `app/api/account/otp/route.ts`, `scripts/check-unbox-brand.mjs`, `.env.example`
### Loja já gerada
Trocar os 13 arquivos acima. Quem chama `createPaymentLink` com itens de catálogo passa a mandar título,
quantidade e preço. Abaixo desta versão a régua manda refazer; refazendo, a loja já nasce no SDK.
### Ambiente
+ `UNBOX_PARTNER_API_KEY` · - `UNBOX_API_KEY`, `UNBOX_AUTH_URL`, `UNBOX_GRAPHQL_URL`, `UNBOX_CAPTCHA_BYPASS`
### Mudanças de comportamento
Tudo passa por `partners.unbox.com.br/graphql`; sem captcha do lado da loja; dez chamadas mudaram de assinatura
(`createCart`, cupons, `OrderInput`, `getInstallments`, `getAddressByPostalCode`, OTP, `hasCustomerAccount` sem
`shopId`; `orderByReferenceId` só com id; `first: Int`; endereço plano); `catalogItemProductById` não existe;
item de Payment Link é produto virtual; `PaymentInput.data` vai como `JSON.stringify`; mutação nunca repete
por erro de autenticação; posse do pedido só pelo cookie assinado.
### Armadilhas
Código próprio contra chamadas que mudaram de assinatura: `tsc --noEmit` depois da troca é o que acha cada ponto.

## 0.21.3 a 0.21.10
### Template
0.21.3: `lib/paginas-do-lojista.ts`, `lib/segredo-da-loja.ts`, escada dos títulos, gate de placeholder.
0.21.4: Next 15.5.24. 0.21.5: CSS do lojista (`document.ts`). 0.21.6: pedidos na área logada (`lerDaConta`).
0.21.7: SEO da home e do catálogo (`lib/seo-das-rotas.ts`). 0.21.8: favicon, Search Console, redirecionamentos,
dados da empresa (`lib/dados-da-loja.ts`). 0.21.9: `ldJson` sempre. 0.21.10: `textoDeDinheiro`.
### Loja já gerada
0.21.4: subir `next`, `eslint-config-next`, `@next/env` para 15.5.24. 0.21.5 e 0.21.9: `lib/editable/`. 0.21.6:
`lib/unbox/{customer,client,pedido}.ts`, `lib/customer-session.ts`, `lib/orders.ts`, `lib/format.ts`,
`lib/catalog-map.ts`, `lib/vitrine.ts`, `lib/paginas-dados.ts`, `lib/editable/rastreio-navegacao.tsx`,
`components/order-status.tsx`, `components/account/account-shell.tsx`,
`components/home/{combos-home.tsx,sections/registry.ts,sections/combos-carousel.tsx}`,
`scripts/check-unbox-brand.mjs`, as páginas de `app/(loja)/conta/`, `app/(loja)/page.tsx`,
`app/(loja)/oferta/page.tsx`, `app/api/account/me/route.ts`. 0.21.7: `lib/editable/`, `lib/seo-das-rotas.ts`,
`imagemAbsoluta`/`imagensDoCartao` em `lib/paginas-seo.ts`, `app/layout.tsx`, `app/(loja)/page.tsx`,
`app/(loja)/produtos/page.tsx`. 0.21.8: `lib/editable/`, `lib/dados-da-loja.ts`, `app/layout.tsx`,
`lib/paginas-seo.ts`, `components/site-footer.tsx`, `components/paginas/{colecao,pagina}-do-lojista.tsx`,
`app/(loja)/page.tsx`, `app/(loja)/{termos,privacidade}/page.tsx`, layouts de produto e categoria. 0.21.9: trocar
`__html: JSON.stringify(...)` por `ldJson(...)`. 0.21.10: `lib/unbox/customer.ts`, `client.ts`, `lib/orders.ts`,
`scripts/check-unbox-brand.mjs`.
### Ambiente
nada
### Mudanças de comportamento
Lojista escreve CSS, SEO, favicon, redirecionamentos e dados da empresa pelo editor.
### Armadilhas
Dez trocas encadeadas nos mesmos arquivos; fazer uma por uma é o mesmo merge dez vezes. A régua põe tudo
abaixo de 0.22.0 do lado do refazer.

## 0.21.0 a 0.21.2
### Template
+ `lib/paginas-do-lojista.ts` (coleção `blog` de fábrica), `lib/reservados.ts`, `lib/paginas-publicadas.ts`,
  `lib/paginas-seo.ts`, `lib/paginas-dados.ts`, `components/paginas/*`, as rotas `/paginas/[handle]`,
  `/[colecao]`, `/[colecao]/pagina/[n]`, `/[colecao]/[handle]`, `/previa-do-editor`
~ `app/layout.tsx` (`paginasDoLojista`, `documentoSemPaginas`), `middleware.ts` (cookie da prévia)
### Loja já gerada
O CHANGELOG diz: "dá para trazer os arquivos, mas é mais barato regerar".
### Ambiente
nada
### Mudanças de comportamento
O lojista cria páginas, artigos e coleções pelo editor.
### Armadilhas
Rota do código com o nome de uma coleção (`app/(loja)/blog/`) ganha da coleção, que nunca abre.

## 0.20.0 a 0.20.5
### Template
+ `lib/editable/*`, `app/api/unbox/{paginas,catalogo,vitrine}`, `lib/rotas-editaveis.ts`, `app/api/revalidate`
  com token do editor, `scripts/check-editable.mjs`; 0.20.3: `lib/newsletter.ts`, `captura-botao.tsx`
~ home, chrome, catálogo e PDP com primitivos; `app/layout.tsx` (`<Rastreio/>`); `next.config.ts`
  (`frame-ancestors`); `middleware.ts`
- `components/analytics/route-analytics.tsx`
### Loja já gerada
Refazer (ver 0.21.0).
### Ambiente
+ `EDITOR_URL`, `NEXT_PUBLIC_EDITOR_ORIGIN` (BUILD), `UNBOX_EDITOR_SHOP`
### Mudanças de comportamento
A loja nasce editável pelo editor da Unbox; rastreio decidido pela foundation.
### Armadilhas
nenhuma conhecida (ninguém refatora daqui)

## Antes de 0.20.0
Sem editor: não há `lib/editable/`, rotas do editor, `frame-ancestors`, `<Rastreio/>`. Refazer; o que se porta é
`public/brand/`, tokens de cor, textos (como defaults dos primitivos) e redirects.
