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
| `unbox download [pasta]` | baixa para esta máquina uma loja que já existe na Unbox, pronta para editar |
| `unbox provision` | provisiona o repositório e a hospedagem da loja na Unbox e liga o projeto à branch `deploy` |
| `unbox env` | envia as variáveis do `.env.local` para a hospedagem da loja (`--list` mostra, `--unset` remove) |
| `unbox deploy` | commita as mudanças, envia a branch `deploy` para a Unbox e mostra a URL do preview |
| `unbox publish [commit]` | publica em produção um commit com preview pronto e acompanha até o fim |
| `unbox rollback` | volta produção para a publicação anterior (ou para a página "Em breve") |
| `unbox status` | mostra o estado da loja, do preview do commit atual e da produção, e o que falta enviar |
| `unbox keys` | lista, adiciona e remove as chaves de deploy da loja (uma por máquina, pessoa ou CI) |
| `unbox analyze-version` | a versão do template que gerou a loja, o que mudou desde então, o que a loja mudou por cima, e se compensa refatorar ou refazer |
| `unbox upgrade-template` | aplica a parte mecânica da migração para o template atual e deixa o resto num relatório, com a cópia do template ao lado |

Os comandos acima, menos o `create`, falam com a Partners API da Unbox, e por isso todos seguem
as mesmas regras abaixo.

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
loja não passar despercebida. Faltando alguma das três, o comando para e diz qual. A exceção é o
`unbox download`, que roda antes de existir projeto: ele pergunta as três (já preenchidas com o que
estiver no ambiente) e as grava no `.env.local` da loja que baixou.

### Do `unbox create` à produção

O fluxo completo, na pasta do projeto, com as credenciais no `.env.local`:

```bash
unbox create minha-loja && cd minha-loja   # gera a loja (veja o começo deste README)
unbox provision                            # uma vez: repositório, hospedagem e branch deploy
unbox env                                  # a cada mudança no .env.local (o provision já envia)
unbox deploy                               # a cada mudança: commit, envio e preview
unbox publish                              # o preview conferido vai para produção
unbox status                               # o que está no ar e o que falta enviar
unbox rollback                             # volta a publicação anterior (não é idempotente)
```

A loja que **já está na Unbox** não repete esse começo: `unbox download` traz o repositório para a
máquina com a chave, o vínculo e o `.env.local` prontos, e o fluxo continua no `unbox deploy`.

- **Produção** fica em `https://<slug>.myunbox.com.br`, com a página "Em breve" até o primeiro
  `unbox publish`. No futuro, um domínio próprio da loja substitui esse endereço.
- **Preview estável** em `https://preview.<slug>.myunbox.com.br`: o envio mais recente que terminou
  com sucesso, além da URL de cada commit. É público para quem tem o link (o `noindex` só afasta
  buscadores). No código, `process.env.VERCEL_TARGET_ENV === "preview-unbox"`.
- **Preview ok não garante produção ok:** o `publish` refaz o build com a configuração de produção.
- **`unbox rollback` não é idempotente:** cada execução é um rollback novo, a partir do que estiver
  no ar. Confira com `unbox status` antes de repetir.

O projeto gerado traz o mesmo caminho para o lojista e para os agentes, com os endereços, o preview
estável e a tabela de erros comuns, no `DEPLOY.md`.

### `unbox download`

O caminho inverso do `create` + `provision`: a loja já existe na Unbox e você quer trabalhar nela
nesta máquina (outro computador, outra pessoa da equipe, uma máquina nova). Roda em qualquer pasta,
sem projeto nenhum por perto.

```bash
unbox download                          # pergunta as credenciais e a pasta
unbox download ~/lojas/minha-loja       # a pasta já vem no comando
unbox download ~/lojas/x --json --yes   # para agentes e scripts: credenciais do ambiente, sem perguntas
```

Ele pergunta `UNBOX_PARTNER_API_KEY`, `UNBOX_USER` e `UNBOX_PASS` (o que já estiver exportado no
terminal vem preenchido, é só dar Enter) e a pasta, e então:

1. **acha o repositório da loja** na Partners API (`customStorefront.repositorySshUrl`);
2. **adiciona a chave de deploy desta máquina à loja**, como o `unbox keys add`. A loja aceita
   várias chaves, uma por máquina, pessoa ou CI: as que já estão lá continuam. Se a chave desta
   máquina já estiver na loja, nada muda (`deployKey.added: false`);
3. **clona o repositório** na pasta, na branch `deploy`, com o remote chamado `unbox`;
4. **grava a loja e a chave** na config do repositório (`unbox.shopId` e `unbox.keyPath`), como o
   `unbox provision` faz. É por eles que o `deploy`, o `publish` e o `status` reconhecem o projeto;
5. **cria um `.env.local` mínimo** com as três credenciais (modo `0600`, fora do git). Um
   `.env.local` que já exista na pasta não é alterado, e a CLI avisa;
6. **mostra o estado**: o deploy do commit baixado e o que está em produção.

- **A pasta é o destino do clone.** Se ela já existir com arquivos dentro, a loja vai para
  `<pasta>/<nome-do-repositório>` (quem digita `~/lojas` quer a loja dentro dela). Sem pasta, o
  clone usa o nome do repositório, na pasta atual. Pasta de destino ocupada para o comando antes de
  qualquer coisa (`PASTA_OCUPADA`).
- **A loja precisa estar provisionada.** Sem storefront na Unbox, ou com o provisionamento em
  andamento ou falho, o download para e diz o que fazer (`NAO_PROVISIONADO`); nada é criado no
  disco.
- **Só as credenciais vão para o `.env.local`.** As outras variáveis da loja estão no `.env.example`
  do projeto e na hospedagem (`unbox env --list` mostra as que estão lá). Quando o ambiente aponta
  outro servidor da Unbox, o `UNBOX_PARTNER_GRAPHQL_URL` vai junto, senão a loja baixada falaria com
  a produção.
- **O download não roda `npm install`, build, deploy nem publicação.** Depois dele: `npm install`,
  `npm run dev` para ver a loja, e `unbox deploy` para enviar o que você editar.
- `--json`: `{ dir, shopId, repositorySshUrl, branch, commitSha, deployKey, envFile, storefront, deployment, production }`,
  e `errors` quando a consulta do deploy ou da produção falhar (o clone já está no disco: elas viram
  aviso, não erro).

### `unbox provision`

Roda na pasta do projeto: a que o `unbox create` gerou, ou um projeto seu, com ou sem git.

```bash
unbox provision            # na pasta do projeto
unbox provision --json     # para agentes: um objeto { status, repositorySshUrl, shopId, productionUrl, deployKey, env }
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

- **A chave de deploy** fica em `~/.config/unbox/keys/<shopId>_ed25519`, só nesta máquina. É a
  credencial do push. **A loja aceita várias chaves** (até 10), uma por máquina, pessoa ou CI: o
  cliente e a agência podem enviar código para o mesmo projeto, cada um com a sua. Rodar o
  `provision` em outra máquina, com as credenciais da mesma loja, adiciona a chave de lá como mais
  uma, sem tirar as outras (no `--json`, `deployKey.added: true`). Na máquina de sempre nada muda:
  a chave já está na loja. Não copie a chave privada entre máquinas; para ver, adicionar ou tirar
  chaves, `unbox keys` (abaixo).
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

### `unbox keys`

As chaves de deploy da loja. Cada uma envia código para a loja; tirar uma não mexe nas outras.

```bash
unbox keys                                    # lista (a desta máquina vem marcada)
unbox keys add                                # adiciona a chave desta máquina (o provision já faz)
unbox keys add ci_ed25519.pub --title ci      # adiciona a chave pública de outra pessoa ou de um CI
unbox keys remove SHA256:...                  # remove pelo fingerprint (ou pelo id da lista)
```

- **Só a parte pública sai da máquina.** Um arquivo com chave privada é recusado antes de qualquer
  envio (`CHAVE_PRIVADA`).
- **Título:** padrão `usuário@máquina` e o começo do fingerprint; com `--title`, até 50
  caracteres, único na loja. Adicionar uma chave que já está lá não muda nada (`added: false`).
- **Remover pede confirmação**; `--yes` pula, e com `--json` ou fora de um terminal ele é
  obrigatório. A CLI avisa quando a chave é a desta máquina ou a última da loja. Quem usava a chave
  removida passa a ter o envio recusado (`CHAVE_RECUSADA`), até rodar `unbox provision` de novo.
- `--json`: `{ keys }`, `{ key, added }` ou `{ removed }`.

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
- **`NEXT_PUBLIC_SITE_URL` é reservada e gerenciada pela Unbox**, que vai preenchê-la com o
  endereço de produção da loja; por isso o lojista não define nem remove (o valor do `.env.local`
  vale só para o `next dev`). Ela ainda não é preenchida automaticamente. Se a Unbox reservar um nome novo que esta versão da CLI não conhece, o comando acha qual
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
  (as mesmas variáveis, mas `VERCEL_ENV` vale `production`). Se ele falhar
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
  publicação mais antiga que a Unbox guarda, ou com uma publicação ou rollback em
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

### `unbox status`

Só lê: não altera a loja, a produção nem o repositório.

```bash
unbox status            # na pasta do projeto
unbox status --json     # para agentes: { storefront, deployment, production, local, template, publishable }
```

- **Loja:** o provisionamento. Não provisionada: sugere `unbox provision`. Em andamento: o passo
  atual e a falha que o servidor está repetindo. `FAILED`: com um código que repetir não resolve
  (como `CUSTOM_STOREFRONT_HOSTING_DOMAIN_IN_USE_ERROR`), diz para falar com a Unbox informando o
  `_id`; com os outros, manda rodar `unbox provision`, que retoma do passo que falhou. Pronta:
  o repositório e o **endereço fixo de preview** (`storefront.previewUrl`); a linha some quando a
  loja não tem o endereço Unbox.
- **Preview do commit atual:** o `customStorefrontDeployment` do `HEAD`. Commit ainda não enviado
  aparece como "não enviado", e não como em andamento (ele ficaria `PENDING` para sempre).
- **Produção:** `NOT_PUBLISHED` mostra o endereço, que exibe "Em breve" até o primeiro
  `unbox publish`; `PUBLISHED`, o commit no ar, a data e se há rollback; `UNKNOWN`, que a produção
  foi alterada fora da Unbox. A publicação ou o rollback em andamento, ou o último que falhou,
  aparece junto.
- **Local** (só num projeto ligado à Unbox): busca a `deploy` da Unbox (`git fetch unbox deploy`;
  sem a chave ou sem rede, compara com a última cópia local e avisa) e mostra os commits não
  enviados, as mudanças não commitadas e se você está fora da `deploy`. No `--json`,
  `local: { ahead, dirty, branch, commitSha }`, ou `null` fora de um projeto ligado.
- **Template:** a versão do template que gerou a loja (o carimbo `unbox.templateVersion` que o
  `unbox create` grava no `package.json` desde a 0.30.0), contra a última CLI publicada no npm. A loja
  é uma cópia do template e não atualiza sozinha: "atrás" quer dizer que há uma migração descrita em
  `MIGRACAO.md`, não um `npm update`. Loja anterior ao carimbo aparece como "anterior a 0.30.0" (a
  skill `migrar-loja-analisar` descobre a versão). A consulta ao npm leva até 2 s e falha em
  silêncio: sem rede, compara com a CLI em uso e diz isso (`template.fonte: "cli"`);
  `UNBOX_NO_UPDATE_CHECK=1` a desliga. No `--json`, `template: { versao, atual, fonte, atualizada }`,
  ou `null` numa pasta sem `package.json`.
- **"Há preview pronto para unbox publish"** (`publishable: true`): o commit atual já foi enviado, o
  preview dele está pronto e não é o que está no ar.
- **As três consultas vão em paralelo**, e a falha de uma não esconde as outras: a seção fica `null`
  e o `--json` traz `errors.<seção>` com `{ code, message }`. Só se todas falharem a saída é `1`.
- Fora da pasta do projeto, mostra só a parte da API, com as credenciais do terminal ou do
  `--env-file`.

### `unbox analyze-version`

A loja é uma cópia do `template/` na versão que a gerou e não recebe atualização sozinha. Este comando diz
de onde ela partiu e o que a separa do template atual. Só lê; sem credenciais.

```bash
unbox analyze-version                       # na pasta da loja
unbox analyze-version --json                # para agentes
unbox analyze-version --base 0.24.0         # quando o carimbo ou o marcador engana (loja sincronizada à mão)
unbox analyze-version --base-template ./t   # o template da base já extraído (sem rede, ou versão não publicada)
```

- **Versão-base:** o carimbo `unbox.templateVersion` do `package.json` (gravado pelo `unbox create` desde a
  0.30.0); antes dele, por marcadores (arquivos que só existem a partir de cada versão). O template da base vem
  do npm (`npm pack`, em cache em `~/.config/unbox/templates/`); versão anterior à primeira publicada (0.21.3) não
  tem template, e a régua manda refazer de qualquer jeito.
- **Arquivos:** cada um classificado contra o template da base e o atual: copiar direto (o template mudou, a
  loja não tocou), reaplicar (os dois mudaram; a da loja é pequena), reescrita (a da loja é a maior),
  personalizado pelo `create` (tokens, receitas, slug: nunca se copia por cima), foundation do editor, novo,
  removido. O nome da loja é aplicado ao template antes de comparar, para "Minha Loja" trocado pelo `create`
  não aparecer como conflito.
- **Editor:** o que o gate `unbox:editavel` reprovaria, na ordem em que para; componentes sem primitivo.
- **Mudanças de comportamento:** catálogo duplicado em JSON no repositório, páginas institucionais e blog em
  código. São decisões do dono da loja (migrar e perder o hard-coded, ou manter), e o comando só as aponta.
- **Régua:** abaixo de 0.22.0, refazer; de 0.22.0 em diante, refatorar, salvo três ou mais sinais de
  customização pesada. A justificativa está em `MIGRACAO.md`, que também traz a ficha de cada versão (o que
  entrou, o que a loja já gerada faz, variáveis de ambiente, armadilhas); o comando imprime as fichas entre a
  base e a atual.
- Loja mais nova que a CLI em uso: `CLI_DESATUALIZADA` (rode com `@latest`). `--no-network` não consulta o npm.

### `unbox upgrade-template`

Aplica a parte mecânica da migração. Parte da mesma análise.

```bash
unbox upgrade-template --dry-run   # o plano, sem escrever nada
unbox upgrade-template             # mostra o plano e pergunta; --yes pula
```

- **Aplica:** copiar direto, novos sem colisão, a foundation do editor intacta, as remoções seguras (nada que
  outro arquivo da loja ainda importe, nada de uma pasta onde a loja tem lógica própria), o `package.json` por
  chave (chave nova entra; chave igual à da base sobe; o que a loja mudou fica; `name` e scripts próprios são da
  loja) e o carimbo da versão nova.
- **Não toca:** reaplicar, reescrita, personalizados, colisões (`lib/unbox.ts` com `lib/unbox/` ainda na loja),
  foundation editada à mão, copiado cujo import não resolve. Vão para `~/.config/unbox/upgrade/<pasta>/`:
  `RELATORIO.md` (o que fazer com cada um, as fichas, as variáveis de ambiente, os próximos passos),
  `atual/<arquivo>` (o template atual) e, para os personalizados, `base/<arquivo>`. Fora do projeto de
  propósito: dentro, entraria no `tsc`, no build e no próximo deploy.
- **Exige** `package.json`, os sinais de loja da CLI, git com árvore limpa (inclusive sem arquivo novo) e um
  commit: o git é o ponto de retorno (`git reset --hard && git clean -fd` desfaz tudo; `.env.local` e o que o
  `.gitignore` ignora não são tocados). Régua recomendando refazer: recusa, salvo `--force`.
- Não roda `npm install`, build nem commit: termina dizendo os próximos passos. Rodar de novo depois do commit
  responde "nada a fazer".
- `--json` sem `--yes`: `CONFIRMACAO_NECESSARIA`. Códigos dos dois comandos: `SEM_PACKAGE_JSON`,
  `PACKAGE_JSON_INVALIDO`, `SEM_LOJA`, `VERSAO_DESCONHECIDA`, `CLI_DESATUALIZADA`, `TEMPLATE_INDISPONIVEL`,
  `NETWORK`, `NPM_MISSING`, `TAR_FALHOU`; só do upgrade: `ARVORE_SUJA`, `SEM_GIT`, `GIT_EM_ANDAMENTO`,
  `REFAZER_RECOMENDADO`, `CANCELADO`, `UPGRADE_FALHOU`. Uso incorreto (`USAGE`) sai com 2.

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
SEO básico já implementados — ver `DEPLOY.md` e `QA.md` dentro do projeto gerado para o caminho até
produção pela hospedagem da Unbox (`unbox provision`, `env`, `deploy`, `publish`).

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
