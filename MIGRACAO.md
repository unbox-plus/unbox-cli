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

Onde está "(inferido)" nas seções antigas, o CHANGELOG não tinha o parágrafo e a lista veio do `git diff`.

## Refatorar ou refazer: a régua de corte

Abaixo de **0.22.0, refazer** (`unbox create` novo e portar `public/brand/`, fontes, tokens de cor, `marca/`,
redirects e as seções próprias, reescritas com primitivos): a 0.22.0 trocou a API inteira, entre 0.21.0 e 0.22.0
há dez consertos encadeados nos mesmos arquivos, e abaixo de 0.21.0 o próprio CHANGELOG diz "mais barato
regerar". Distância medida (fração do template atual que mudou desde um template puro daquela versão):
0.22.0 = 0,44; 0.21.3 = 0,50; 0.20.1 = 0,64; 0.17.1 = 0,74.

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

## 0.30.0
### Template
nada: o que entrou é da CLI (o carimbo `unbox.templateVersion` no `package.json` da loja gerada, a seção Template do
`unbox status`, o aviso no `unbox deploy`, `unbox analyze-version`, `unbox upgrade-template`, e este arquivo dentro
do pacote).
### Loja já gerada
nada
### Ambiente
nada
### Mudanças de comportamento
nada
### Armadilhas
Loja gerada antes desta versão não tem o carimbo: `unbox analyze-version` a reconhece por marcadores
(`src/version-markers.json`); loja sincronizada à mão engana o marcador, e aí vale `--base <versão>`.

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
