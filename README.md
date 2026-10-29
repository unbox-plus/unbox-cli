# Unbox CLI

CLI das lojas Unbox. O comando é `unbox`, e o primeiro subcomando, `unbox create`, gera um
storefront Next.js completo integrado com a API Unbox, a partir da foundation oficial
(`storefront-foundation`), já com a sua marca aplicada: estilo visual (layout, fontes, neutros),
cores e nome da loja. Os próximos subcomandos levam a loja ao ar pela Partners API (veja
[Comando `unbox`](#comando-unbox)).

## Uso — sem instalar nada

> **Passo 0**: precisa do Node.js instalado (baixe em [nodejs.org](https://nodejs.org), botão
> "LTS", instalador comum de 2 minutos). É o único pré-requisito da máquina.

Navegue até a pasta onde queira criar o projeto e rode:

```bash
npx --package=@unbox-plus/cli unbox create
```

O `npx` roda o CLI direto do pacote publicado no NPM, sem instalar nada global. O
`--package=` é obrigatório: veja [Dois cuidados com o `npx`](#dois-cuidados-com-o-npx).
O comando antigo, `create-unbox-store`, continua funcionando com as mesmas flags e gera o mesmo
projeto; ele só avisa que o padrão agora é `unbox create`.
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
9. Se você já tem as credenciais da loja Unbox (`UNBOX_PARTNER_API_KEY`, `UNBOX_USER`,
   `UNBOX_PASS`)
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
unbox create
```

## Uso — sem instalar, clonando a pasta/repositório

Se você recebeu a pasta inteira (zip) ou clonou o repositório:

```bash
cd unbox-cli
npm install
node bin/unbox.js create
```

## Uso não-interativo (scripts/CI)

```bash
npx --package=@unbox-plus/cli unbox create minha-loja --yes --no-install
```

Gera com as cores/nome default e o estilo **essencial** — use `--estilo <nome>`
(essencial, promocional, editorial, boutique) pra escolher outro sem interação. Cores e
tokens podem ser editados depois em `app/globals.css` (bloco "CONFIGURE"); o layout da home
em `components/home/home-recipe.ts`.

## Comando `unbox`

```bash
unbox --help                 # lista os comandos
unbox <comando> --help       # uso e exemplos de um comando
```

| Comando | O que faz |
|---|---|
| `unbox create [pasta]` | gera a loja (o wizard descrito acima) |
| `unbox provision` | provisiona o repositório e a hospedagem da loja na Unbox e liga o projeto à branch `deploy` |
| `unbox env` | envia as variáveis do `.env.local` para a hospedagem da loja (`--list` mostra, `--unset` remove) |
| `unbox deploy` | commita as mudanças, envia a branch `deploy` para a Unbox e mostra a URL do preview |
| `unbox publish [commit]` | publica em produção um commit com preview pronto e acompanha até o fim |
| `unbox rollback` | volta produção para a publicação anterior (ou para a página "Em breve") |

O `status` entra numa próxima versão. Os comandos acima, menos o `create`, falam com a Partners API
da Unbox, e por isso todos seguem as mesmas regras abaixo.

**Flags globais**, que valem antes ou depois do comando:

| Flag | Padrão | |
|---|---|---|
| `--help`, `-h` | | ajuda geral, ou do comando quando vem com um |
| `--json` | | saída para agentes e scripts: um único objeto JSON em stdout (`{"ok":true,"data":...}` ou `{"ok":false,"error":{"code","message"}}`, este com `data` quando o comando já tinha um estado a mostrar, como no `publish` e no `rollback`); o andamento vai para stderr |
| `--yes`, `-y` | | não pede confirmação (no `create`, gera com os padrões, sem perguntas) |
| `--dir <caminho>` | pasta atual | a pasta do projeto da loja |
| `--env-file <arquivo>` | `.env.local` | o arquivo das credenciais (e das variáveis do `unbox env`), relativo ao `--dir` |

**Códigos de saída:** `0` deu certo, `1` a operação falhou, `2` uso incorreto (comando ou flag que
não existe, valor faltando). O `create` usa `1` também para uso incorreto, como sempre fez.

**Credenciais.** Os comandos que falam com a Unbox leem as mesmas variáveis da loja, do
`.env.local` do projeto (ou do `--env-file`): `UNBOX_PARTNER_API_KEY`, `UNBOX_USER`, `UNBOX_PASS`
e, opcional, `UNBOX_PARTNER_GRAPHQL_URL`. O arquivo é lido pelo mesmo parser do Next, então uma
senha que funciona na loja funciona na CLI. Uma variável exportada no terminal vence a do arquivo,
como no Next; por isso a CLI diz de onde veio cada credencial, para uma variável esquecida de outra
loja não passar despercebida. Faltando alguma das três, o comando para e diz qual.

### `unbox provision`

Roda na pasta do projeto: a que o `unbox create` gerou, ou um projeto seu, com ou sem git.

```bash
unbox provision            # na pasta do projeto
unbox provision --json     # para agentes: um objeto { status, repositorySshUrl, shopId, productionUrl, env }
```

1. **Provisiona** o repositório e a hospedagem da loja na Unbox e espera ficarem prontos. Leva
   alguns minutos; quando uma etapa falha, o servidor tenta de novo sozinho, e a CLI chama de novo
   uma vez quando faz sentido. Erros que repetir não resolve (endereço da loja já em uso, por
   exemplo) param na hora, com o que informar à Unbox. Depois de 30 min, a CLI para e avisa: o
   provisionamento continua no servidor, e rodar de novo é seguro.
2. **Liga o git** à branch `deploy` da Unbox, que é onde o `unbox deploy` vai enviar o código:
   - pasta sem git (ou sem commits): o repositório nasce na `deploy`, com os seus arquivos intactos;
   - repositório com commits: a `deploy` é criada **ao lado** da sua branch atual, que não muda
     (mesmo nome, mesmo histórico). O trabalho de publicação segue na `deploy`.
3. **Envia as variáveis** do `.env.local` para a hospedagem, como o `unbox env` (veja abaixo). Se
   isso falhar, o `provision` termina mesmo assim, com um aviso: a loja e o vínculo estão prontos,
   e `unbox env` completa (no `--json`, `env.error`).
4. Mostra o endereço de produção da loja (`https://<slug>.myunbox.com.br`), que exibe "Em breve"
   até o primeiro `unbox publish`.

Rodar de novo é seguro: mesma chave, nada duplicado. O que convém saber:

- **A chave de deploy** fica em `~/.config/unbox/keys/<loja>_ed25519`, só nesta máquina. É a única
  credencial do push. Em outra máquina, o `provision` para e explica: a loja já está ligada à
  chave da primeira, e a troca é pedida à Unbox. Não copie a chave privada entre máquinas.
- **O push só confia nas chaves do servidor git da Unbox que vêm na CLI** (gravadas em
  `~/.config/unbox/known_hosts`). Se o servidor apresentar outra, o comando para: atualize a CLI e,
  se continuar, fale com a Unbox.
- **A CLI não grava `core.sshCommand`** no repositório: ele valeria para todos os remotes e
  quebraria um `origin` por SSH (GitHub, por exemplo). Cada comando da CLI passa a chave só nas
  chamadas que falam com a Unbox. Por isso um `git push unbox` feito à mão não funciona: use
  `unbox deploy`.
- **`.github/`, `.gitea/` e `.forgejo/` não vão para a Unbox** (o servidor recusa; o GitHub
  Actions não roda lá). Se o projeto tiver alguma delas, o `provision` pede confirmação (`--yes`
  confirma; com `--json`, sem `--yes`, ele para e lista os arquivos). Elas ficam fora da `deploy`
  (o `.forgejo/` passa a ser o da Unbox) e continuam na sua branch. O `provision` também as põe no
  `.git/info/exclude`, para nunca entrarem num commit da `deploy`; efeito colateral: arquivos
  **novos** nessas pastas deixam de aparecer no `git status` da sua branch também.
- **Nome e e-mail do git** são necessários quando o vínculo cria um commit (projeto com commits).
  No terminal, a CLI pergunta e grava só neste repositório; com `--json` ou `--yes`, ela para e
  mostra o `git config --global` a rodar.
- **Antes de chamar a Unbox, a CLI confere a pasta** e para, sem mudar nada, se: houver mudanças
  não commitadas (num projeto com commits), um merge ou rebase em andamento, o HEAD fora de uma
  branch, uma branch `deploy` sua que não é a da Unbox, ou a pasta for parte de outro repositório.

### `unbox env`

O `.env.local` não vai no push (está no `.gitignore`), e sem as variáveis o build da loja falha no
login da Partners API. O `unbox env` grava as variáveis do arquivo no projeto de hospedagem da loja,
para os builds de preview e de produção. O `unbox provision` já faz isso no fim; rode de novo
sempre que mudar o `.env.local`.

```bash
unbox env                          # envia as variáveis do .env.local
unbox env --list                   # o que está na hospedagem e o que ainda não foi enviado
unbox env --unset CHAVE [CHAVE...] # remove da hospedagem
unbox env --json                   # { sent, skipped, fromTerminal, keys }
```

- **Vão as chaves do arquivo**, com o valor que o `next dev` vê: uma variável exportada no
  terminal com o mesmo nome vence a do arquivo, e o comando avisa quais. Variáveis que existem só
  no terminal não vão (se for uma das credenciais, o comando avisa que o build vai falhar).
- **Não vão**, sem atrapalhar as outras: as vazias (numa linha só, porque opcional em branco é
  escolha), e, com um aviso por chave, nomes fora do formato (letras
  maiúsculas, dígitos e `_`, começando por letra), valores acima de 16384 caracteres, e os nomes
  reservados: `TZ` e os que começam com `VERCEL_`, `NEXT_PUBLIC_VERCEL_`, `NOW_`, `AWS_` e `LAMBDA_`.
- **`NEXT_PUBLIC_SITE_URL` é gerenciada pela Unbox**: ela grava o endereço da loja na hospedagem
  (produção e, quando a loja tem, o endereço fixo de preview), e por isso o lojista não define nem
  remove. Lojas provisionadas antes de a Unbox passar a gravá-la só ganham a variável numa migração
  futura. Se a Unbox reservar um nome novo que esta versão da CLI não conhece, o comando acha qual
  é, pula com aviso e grava o resto.
- **Só builds novos usam as variáveis.** Depois de mudar, rode `unbox deploy` para um preview com
  elas, e publique esse commit. Publicar de novo o que já está no ar não refaz o build.
- **Repetir é seguro**: a gravação substitui o valor. O `unbox env` nunca remove o que sumiu do
  arquivo; para isso existe o `--unset`. Uma chave removida que continue no arquivo volta no
  próximo `unbox env`.
- **`--list` compara só os nomes.** A hospedagem nunca devolve valores, então um valor alterado no
  arquivo não aparece como pendente: rode `unbox env` para enviar de novo.
- **Os valores nunca são impressos**, nem com `--json`. A saída cita só os nomes.

### `unbox deploy`

Substitui o antigo `ubx save`. Roda na branch `deploy` do projeto, depois do `unbox provision`.

```bash
unbox deploy                       # commita tudo com a mensagem "unbox: deploy"
unbox deploy -m "nova vitrine"     # com outra mensagem
unbox deploy --build               # roda npm run build antes, para pegar erro sem gastar um deploy
unbox deploy --json                # para agentes: um objeto { commitSha, state, url, previewUrl }
```

1. **Confere, sem mudar nada:** que o projeto está ligado à Unbox (`unbox.shopId`, `unbox.keyPath`
   com a chave presente e o remote `unbox`; senão, "rode unbox provision"), que você está na
   `deploy`, as credenciais, o nome e e-mail do git, o login e os arquivos protegidos.
2. **Commita** tudo o que mudou (`git add -A`). Os hooks do projeto (husky, commitlint) não rodam
   nesse commit nem no push, como no do vínculo.
3. **Envia** a `deploy` local para a `deploy` da Unbox, nunca com force. Se a da Unbox estiver à
   frente, a CLI traz o que ela tem (rebase dos seus commits; merge no primeiro deploy de um
   projeto com histórico próprio, para não achatar esse histórico) e envia de novo. Conflito:
   a operação é desfeita, nada é enviado, e a CLI diz como resolver.
4. **Acompanha o build** do commit enviado (2 s, 5 s e depois a cada 10 s, até ~15 min) e mostra a
   URL do preview desse commit e, quando a loja tiver, o **endereço fixo de preview**
   (`https://preview.<slug>.myunbox.com.br`). O endereço fixo mostra sempre o deploy mais recente
   que terminou com sucesso: pode ser um mais novo que o deste comando, e um build com falha
   mantém o anterior no ar. Loja sem o endereço Unbox (ou provisionada antes dele): a linha não
   aparece e o `--json` traz `previewUrl: null`.

O que convém saber:

- **Fora da `deploy`** (na `main`, por exemplo), o comando para sem commit, sem push e sem rebase,
  e diz o que rodar: `git checkout deploy` e, para levar as mudanças, `git merge <sua-branch>`.
  O push de uma branch que não descende da `deploy` da Unbox seria recusado.
- **Nome e e-mail do git:** no terminal, a CLI pergunta e grava só neste repositório; com `--json`
  ou `--yes` (ou sem terminal), ela para com `GIT_IDENTITY_MISSING` antes de commitar e mostra o
  `git config --global` a rodar. A CLI nunca usa uma identidade inventada: o commit é seu.
- **`.github/`, `.gitea/` e `.forgejo/`:** mudanças nessas pastas (na árvore ou em commits ainda não
  enviados) param o comando antes do commit e do push, com a lista e como desfazer. Arquivo novo
  e não rastreado nelas não conta: o `provision` as pôs no `.git/info/exclude`.
- **A chave vai só nas chamadas à Unbox**, por `GIT_SSH_COMMAND` montado a partir do
  `unbox.keyPath`, com as host keys da CLI. Um `origin` por SSH continua funcionando.
- **`FAILURE`:** o motivo não vem da API. Corrija e rode de novo; `--build` mostra o erro aqui.
  Build que passa aqui e falha na Unbox costuma ser variável de ambiente faltando na hospedagem.
- **Teto em `PENDING`:** a CLI para depois de ~15 min e mostra o commit para informar à Unbox.
- **Nada a enviar** (sem mudanças e sem commits novos): avisa e sai com `0`; o `--json` traz
  `state: null`.

### `unbox publish`

Substitui o antigo `ubx publish`. Põe em produção um commit cujo preview está pronto; a Unbox refaz
o build com a configuração de produção e troca o endereço quando termina.

```bash
unbox publish                      # o último commit enviado pelo unbox deploy
unbox publish 3f9c2a1              # um commit enviado antes, pelo hash curto ou completo
unbox publish --yes --json         # para agentes: sem pergunta, um objeto com a produção final
```

1. **Acha o commit** na branch `deploy` da Unbox (depois de um fetch): sem argumento, o topo; com
   argumento, o hash curto (4 caracteres ou mais) ou completo. Só os commits da `deploy` da Unbox
   contam: um commit não enviado, ou reescrito por rebase no envio, para o comando com
   `COMMIT_NAO_ENVIADO` (veja os enviados com `git log --oneline unbox/deploy`). Não importa a
   branch atual: o publish só lê o git.
2. **Confere o preview** do commit: com falha, para (`PREVIEW_FALHOU`); ainda sendo gerado, espera
   só se for o último enviado (até ~15 min). Para um commit mais antigo, um preview pendente para o
   comando (`PREVIEW_PENDENTE`): só o último commit de cada envio gera preview.
3. **Pede confirmação**, mostrando o que está no ar, o commit e o preview. `--yes` pula; com
   `--json` ou sem terminal, sem `--yes`, o comando para com `CONFIRMACAO_NECESSARIA`.
4. **Acompanha** a publicação a cada 10 s, até ~25 min. O build de produção costuma levar 1 a 2 min,
   e o endereço passa a mostrar o novo conteúdo em até 1 min. Ctrl+C não cancela: a publicação segue
   na Unbox, e `unbox publish <commit>` volta a acompanhar.

O que convém saber:

- **Preview ok não garante produção ok.** Produção é um build novo, com a configuração de produção
  (variáveis, `VERCEL_ENV`, `NEXT_PUBLIC_SITE_URL`). Se ele falhar
  (`CUSTOM_STOREFRONT_PRODUCTION_BUILD_ERROR`), produção continua com o que estava no ar.
- **Publicar o commit que já está no ar não refaz o build**: o comando avisa e sai com `0`
  (`alreadyLive: true` no `--json`). Variáveis mudadas com `unbox env` pedem um commit novo
  (`git commit --allow-empty`), `unbox deploy` e `unbox publish`.
- **Uma operação por vez:** com outra publicação ou rollback em andamento, o comando para com
  `CUSTOM_STOREFRONT_PRODUCTION_BUSY_ERROR` e diz qual; `unbox publish <commit dela>` a acompanha.
- **Previews ficam 90 dias.** Para publicar um commit mais antigo, crie um commit novo (ainda que
  vazio), rode `unbox deploy` e publique esse.
- **Permissão própria:** publicar exige uma permissão separada da de deploy; sem ela, o comando diz
  para pedir a liberação à Unbox.
- **De outra máquina ou de um CI**, sem o projeto ligado, o hash completo basta (com as credenciais).
- **`--json`:** `{ state, commitSha, url, publishedAt, rollbackCommitSha, canRollback, operation,
  alreadyLive }`. Numa falha depois de ler a produção, o erro traz a mesma produção em `data`.

### `unbox rollback`

Desfaz a publicação que está no ar: volta para a publicação feita antes dela (na ordem em que foram
publicadas), ou para a página "Em breve" quando a do ar é a primeira. Não há build novo: a troca é
imediata.

```bash
unbox rollback                     # mostra o que está no ar e para onde volta, e pede confirmação
unbox rollback --yes --json        # para agentes: sem pergunta, um objeto com a produção final
```

- **Cada rollback volta mais uma publicação.** Com A, B e C publicados (C no ar), rollbacks seguidos
  levam para B, A e então à página "Em breve". Por isso o comando pede o rollback **uma vez só**,
  em qualquer caminho, e nunca repete sozinho.
- **Resposta perdida** (rede, timeout, 5xx): o comando confere a produção, e só dá o rollback por
  aplicado se ela mostra um rollback novo. Sem resposta, o pedido pode ainda estar na Unbox: ele
  procura por até 1 min e meio e, sem sinal, para com `ROLLBACK_INCERTO`. Antes de tentar de novo,
  rode `unbox rollback` sem `--yes`: ele mostra o que está no ar e o destino antes de confirmar.
- **Sem rollback possível, nada é pedido:** produção em "Em breve", alterada fora da Unbox, já na
  publicação mais antiga que a Unbox guarda (as 20 últimas), ou com uma publicação ou rollback em
  andamento. O comando diz qual é o caso.
- **Produção mudou com a confirmação aberta** (outro terminal, a CI): o comando para com
  `PRODUCAO_MUDOU`, sem pedir o rollback, porque o destino confirmado pode não ser mais o mesmo.
- **Destino que não existe mais** na hospedagem (`CUSTOM_STOREFRONT_ROLLBACK_TARGET_UNAVAILABLE_ERROR`):
  publique o commit desejado com `unbox publish <commit>`.
- **Para pôr um commit específico no ar**, use `unbox publish <commit>`; o rollback não recebe
  argumentos. A permissão é a mesma de publicar.
- Não precisa do git: funciona em qualquer pasta com as credenciais. Num projeto ligado, confere
  que o login é da mesma loja.
- **`--json`:** a produção depois do rollback (`{ state, commitSha, url, publishedAt,
  rollbackCommitSha, canRollback, operation }`); numa falha, o erro traz a última produção lida em
  `data`.

### Dois cuidados com o `npx`

- **Sempre com `--package=@unbox-plus/cli`.** `npx unbox` sem ele baixa outro pacote do NPM, que
  também se chama `unbox` e não tem nada a ver com este.
- **`npx @unbox-plus/cli` (sem `--package=`) deixou de funcionar.** O pacote agora tem dois
  comandos, `unbox` e `create-unbox-store`, e o `npx` não sabe qual rodar. Use
  `npx --package=@unbox-plus/cli unbox ...` ou instale global (`npm install -g @unbox-plus/cli`).

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
- Credenciais da loja Unbox (`UNBOX_PARTNER_API_KEY`, `UNBOX_USER`, `UNBOX_PASS`) — opcional pra rodar em
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

A loja diz quem é e onde vive (0.20.4): `/api/unbox/paginas` responde `loja: { slug, nome, url }`. É por isso que o editor acha a loja sem registro nenhum (`https://<slug>.myunbox.com.br`) e, quando `NEXT_PUBLIC_SITE_URL` é o domínio próprio (https), confirma lá e abre a loja por ele: prévia, publicação e revalidação vão para o domínio de verdade. Em produção, `NEXT_PUBLIC_SITE_URL` certo é o único cuidado; `http://localhost` (dev) não é declarado. No build do endereço fixo de preview, a variável é esse endereço, e é ele que a rota declara ali; o editor consulta a loja pelo endereço de produção, e lá a rota declara o endereço de produção.

O lojista cria páginas, artigos e coleções (0.21.0). A loja nasce com quatro rotas que servem o que o lojista escreve no editor: `/paginas/<endereco>` (página avulsa), `/<colecao>/<endereco>` (artigo), `/<colecao>` (listagem) e `/<colecao>/pagina/N` (as seguintes), mais `/previa-do-editor`, por onde o editor abre uma página antes de ela existir na loja. A coleção que nasce com a loja é o `blog`, declarada em `lib/paginas-do-lojista.ts`; trocar o rótulo e o endereço dela é uma linha. O corpo da página é montado com as mesmas seções da home, mais uma seção de **Texto** com parágrafo, negrito, link, lista, subtítulo e citação. SEO: título, descrição, endereço canônico, Open Graph, dados estruturados (artigo, página, listagem e migalhas) e sitemap com a data de alteração verdadeira, tudo derivado do documento.

A prévia dessas páginas depende do editor: a loja só abre a prévia com uma assinatura que confere. Editor mal configurado do lado dele, toda prévia de página do lojista responde 404, e o log da loja diz isso em uma linha. A loja publicada não é afetada.

A seção "Editor: o que não pode quebrar" do `CLAUDE.md` do template lista cada ponto com o que acontece se for tocado.
