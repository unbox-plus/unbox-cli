# Deploy na Unbox

A loja vai ao ar pela hospedagem da Unbox, com a CLI `unbox`. Não precisa de conta em serviço de
hospedagem, nem de GitHub: o código vai para um repositório git da própria Unbox, e cada envio vira
um preview. Produção só muda quando você publica.

```
unbox provision  →  unbox env  →  unbox deploy  →  unbox publish   (e, se precisar, unbox rollback)
   (uma vez)         (quando        (a cada          (quando o
                      mudar o        mudança:         preview
                      .env.local)    preview)         estiver bom)
```

`unbox status` mostra, a qualquer momento, em que ponto desse caminho a loja está.

---

## Pré-requisitos

- **Node.js v22 LTS** (`nvm install 22 && nvm use 22`). A v26 deixa o `next dev` lento; o `.nvmrc`
  do projeto já aponta a 22.
- **git** e **OpenSSH** (`ssh-keygen`) instalados. Não precisa de conta em lugar nenhum: a CLI cria
  o repositório e a chave. No Windows 10+, o OpenSSH vem em Recursos opcionais.
- **Credenciais da loja no `.env.local`**: `UNBOX_PARTNER_API_KEY`, `UNBOX_USER` e `UNBOX_PASS`
  (veja `.env.example`). São elas que autorizam os comandos `unbox`, e também o build da loja.
  Outro arquivo: `--env-file <arquivo>`.
- **A CLI `unbox`.** Instale uma vez (`npm install -g @unbox-plus/cli`) ou rode cada comando com
  `npx --package=@unbox-plus/cli unbox <comando>`. Sem o `--package=`, o `npx` baixa outro pacote.

Antes do primeiro envio, confira na sua máquina:

```bash
nvm use 22
rm -f ~/package-lock.json   # um lock file na pasta pessoal atrapalha o npm install
npm install
npm run unbox:test          # a loja fala com a API com essas credenciais?
npm run build               # o que não compila aqui não compila na Unbox
```

Todos os comandos abaixo rodam **na pasta do projeto** (ou em outra, com `--dir <pasta>`).
`unbox <comando> --help` mostra as opções de cada um. `--json` dá uma saída para agentes e scripts
(um objeto só em stdout), e `--yes` pula as confirmações: sem terminal interativo, ou com `--json`,
os comandos que pedem confirmação param e pedem o `--yes`.

---

## 1. `unbox provision`: criar a hospedagem (uma vez)

```bash
unbox provision
```

**O que cria:** o repositório git da loja e o projeto de hospedagem na Unbox, com o endereço de
produção (veja [Endereços da loja](#endereços-da-loja)). Leva alguns minutos; uma falha no meio é
tentada de novo a partir do passo que falhou, e o comando desiste depois de 30 min (o
provisionamento continua no servidor). No fim, envia as variáveis do `.env.local`, como o
`unbox env` faria. **Rodar de novo é seguro:** mesma chave, nada duplicado, e ele retoma de onde
parou.

**Onde fica a chave:** a CLI gera uma chave de deploy em `~/.config/unbox/keys/<shopId>_ed25519`
(o id da loja na Unbox). Ela é a credencial do envio, e só existe nesta máquina. **A loja aceita
várias chaves**, uma por máquina, pessoa ou CI (a do lojista e a da agência, por exemplo). Em outra
máquina (ou com a chave perdida), rode `unbox provision` lá, com as credenciais da mesma loja: ele
adiciona a chave daquela máquina como mais uma, sem tirar as outras. Não copie a chave privada.

`unbox keys` lista as chaves da loja; `unbox keys add <arquivo.pub>` adiciona a chave pública de
alguém que não roda a CLI (um CI, por exemplo); `unbox keys remove <fingerprint>` tira uma chave que
não deve mais enviar código (pede confirmação).

**Como fica o git:**

- Pasta sem git: o repositório nasce na branch `deploy`, com os seus arquivos como estão.
- Projeto que já tem commits: a branch `deploy` é criada ao lado da sua, que não muda. O trabalho de
  publicação segue na `deploy`.
- O projeto ganha um remote `unbox` e o `git config unbox.shopId`, que amarra a pasta à loja. Não
  use `git push unbox` à mão: ele não leva a chave. Use `unbox deploy`.
- `.github/`, `.gitea/` e `.forgejo/` não vão para a Unbox. O `provision` pede confirmação se o
  projeto tiver alguma delas (sem terminal, pede `--yes`), e elas continuam na sua branch.

**Antes de mexer no git, o `provision` confere e para (sem alterar nada) se:** houver mudança não
commitada quando o vínculo precisa trocar de branch ou trazer commits novos da `deploy` da Unbox
(faça commit ou `git stash`); houver merge,
rebase ou cherry-pick em andamento; o HEAD estiver destacado; já existir uma branch `deploy` sua ou
um remote `unbox` que não foram criados por ele; a pasta estiver dentro de outro repositório git;
ou a pasta já estiver ligada a outra loja. Cada caso tem o código na
[tabela de erros](#erros-comuns).

---

## 2. `unbox env`: as variáveis da loja

O `.env.local` não vai no envio (está no `.gitignore`), e sem as variáveis o build falha no login
da API. O `unbox env` grava as variáveis do arquivo na hospedagem, para os builds de preview e de
produção (os dois recebem o mesmo conjunto). O `provision` já faz isso uma vez; rode de novo
**sempre que mudar o `.env.local`**.

```bash
unbox env                          # envia as variáveis do .env.local
unbox env --list                   # o que está na hospedagem e o que falta enviar
unbox env --unset CHAVE [CHAVE...] # remove da hospedagem
```

- **Vão** todas as chaves preenchidas do arquivo, com o valor que o `next dev` vê (uma variável
  exportada no terminal com o mesmo nome vence a do arquivo, e o comando avisa). Repetir é seguro:
  o valor é substituído.
- **Não vão**, com aviso pelo nome: as vazias (opcional em branco é escolha); os nomes reservados
  (`TZ`, `VERCEL_*`, `NEXT_PUBLIC_VERCEL_*`, `NOW_*`, `AWS_*`, `LAMBDA_*`); nomes fora do formato
  (maiúsculas, dígitos e `_`, começando por letra); valores com mais de 16384 caracteres; e
  `NEXT_PUBLIC_SITE_URL` (veja abaixo).
- **Os valores nunca são exibidos**, nem com `--json`, nem no `--list`: a saída mostra só os nomes.
  Por isso o `--list` não percebe um valor alterado; rode `unbox env` para enviar de novo.
- **Variável nova só vale num build novo.** Depois de mudar, rode `unbox deploy` e publique esse
  commit. Publicar de novo o que já está no ar não refaz o build. Sem mudança de código, crie um
  commit vazio: `git commit --allow-empty -m "variáveis"`, depois `unbox deploy` e `unbox publish`.
- Uma falha no meio diz quantas variáveis já foram gravadas. Rodar de novo completa.

### Referência: o que o `unbox env` envia

| Variável | Obrigatório | Descrição |
|---|---|---|
| `UNBOX_PARTNER_API_KEY` | ✅ | Api key única do PARCEIRO (`da2-...`): toda chamada à Unbox passa por ela |
| `UNBOX_USER` | ✅ | Usuário de acesso à API da loja |
| `UNBOX_PASS` | ✅ | Senha de acesso à API |
| `SESSION_SECRET` | ✅ | String aleatória forte (≥ 32 chars). Sem ela, em produção, a posse de pedido é RECUSADA (não é aviso: `/api/checkout` falha e o pedido não vira cookie) |
| `NEXT_PUBLIC_SITE_NAME` | ✅ | Nome de exibição (manifest/PWA) |
| `NEXT_PUBLIC_EDITOR_ORIGIN` | | Origem do editor da loja. Entra no `frame-ancestors`: sem ela o lojista não edita a loja no editor |
| `NEXT_PUBLIC_ADMIN_ORIGIN` | | Origem do painel Admin Unbox. Entra no `frame-ancestors`: sem ela o painel não abre a loja |
| `UNBOX_SHOP_ID` | | Extraído do JWT se vazio |
| `UNBOX_SHOP_SLUG` | | Extraído do JWT se vazio |
| `UNBOX_WEBHOOK_SECRET` | | Secret(s) dos webhooks (vírgula p/ múltiplos) |
| `REVALIDATE_SECRET` | | Protege `/api/revalidate` |
| `CRM_WEBHOOK_URL` | | Webhook do CRM (carrinho abandonado; ver `.env.example`) |
| `PIPEDRIVE_API_TOKEN` | | Leads da porta de preview → Pessoa+Negócio no Pipedrive |
| `PREVIEW_PASSWORD` | | Chave do time da porta de preview. Sem padrão: sem ela o atalho `?chave=` não existe e só o formulário abre a porta. O CLI sorteou uma por instalação, no `.env.local` |
| `UNBOX_HOSTED_CHECKOUT_URL` | | Só no modo checkout hospedado da Unbox. **Caminho completo** (`https://sualoja.com.br/carrinho/finalizar-pedido`, nunca só o domínio) e **mesmo domínio da loja**: em hosts diferentes o cliente cai no `/login`. |
| `NEXT_PUBLIC_GA_ID` | | GA4 measurement ID |
| `NEXT_PUBLIC_META_PIXEL_ID` | | Meta Pixel ID |
| `META_PIXEL_ID` / `META_CAPI_TOKEN` | | Meta Conversions API (server) |

> **Sem as três credenciais o build falha** durante o prerender, com o erro de `signIn` da API de
> parceiros. As variáveis `NEXT_PUBLIC_*` entram no build: mudou, precisa de build novo.

`NEXT_PUBLIC_SITE_URL` não está na tabela de propósito: ela é **reservada e gerenciada pela Unbox**,
que vai preenchê-la com o endereço de produção da loja. O `unbox env` não a envia nem a remove (o
valor do `.env.local` serve só para o `next dev`), e não há como defini-la por ele. Enquanto a
Unbox não a preenche, o build hospedado usa o padrão do código (`http://localhost:3000`) em
canonical, sitemap, robots e Open Graph, e o `lib/env-check.ts` avisa disso no boot de produção.

---

## 3. `unbox deploy`: enviar e gerar o preview

```bash
unbox deploy                    # commita tudo e envia (mensagem "unbox: deploy")
unbox deploy -m "nova vitrine"  # com outra mensagem de commit
unbox deploy --build            # roda npm run build antes, para pegar erro sem gastar um envio
```

Cada `unbox deploy` commita o que mudou (`git add -A`), envia a branch `deploy` para a Unbox e
acompanha o build (até ~15 min). No fim mostra duas URLs: a **do preview desse commit** e o
**[preview estável](#preview-estável)** da loja. Nada disso muda a produção.

- **Só na branch `deploy`.** Em outra branch o comando para sem mexer em nada e diz o que rodar
  (`git checkout deploy` e, para trazer as mudanças, `git merge <sua-branch>`).
- **`.forgejo/` é protegido:** é onde fica o workflow de deploy da Unbox. Mudanças nele (ou em
  `.github/` e `.gitea/`) param o comando antes do envio (`ARQUIVO_PROTEGIDO`), com o comando que
  desfaz cada uma.
- **A `deploy` da Unbox à frente da sua:** o comando traz o que ela tem (rebase ou merge) e envia
  de novo, nunca força. Se houver conflito, aborta e nada é enviado.
- **Sem mudanças e sem commits novos:** "Nada a enviar", e o comando termina sem erro.
- **Build com falha (`DEPLOY_FAILURE`):** a API não devolve o motivo. Rode `unbox deploy --build`
  para ver o erro na sua máquina. Build que passa aqui e falha na Unbox costuma ser variável
  faltando na hospedagem (`unbox env --list`).
- Os hooks do projeto (husky, commitlint) não rodam no commit nem no envio do `unbox deploy`.
- git sem nome e e-mail: o comando pergunta no terminal; sem terminal (ou com `--json`/`--yes`),
  para com `GIT_IDENTITY_MISSING`.

---

## 4. `unbox publish`: pôr em produção

```bash
unbox publish            # o último commit enviado pelo unbox deploy
unbox publish 3f9c2a1    # um commit enviado antes (hash curto ou completo)
unbox publish --yes      # sem a confirmação (obrigatório com --json ou sem terminal)
```

O comando confere que o preview do commit está pronto (se for o último enviado e ainda estiver
sendo gerado, espera), pede confirmação mostrando o que está no ar e o que vai entrar, e acompanha
até o fim (até ~25 min). A Unbox **refaz o build com a configuração de produção** e só troca o
endereço quando ele termina: costuma levar 1 a 2 minutos, mais até 1 minuto para o endereço mostrar
o novo conteúdo. Ctrl+C não cancela; `unbox publish <commit>` volta a acompanhar.

- **Preview ok não garante produção ok.** Produção é outro build: as suas variáveis são as mesmas,
  mas o ambiente da hospedagem muda (`VERCEL_ENV` vale `production`; no preview estável,
  `VERCEL_TARGET_ENV` vale `preview-unbox`). Se ele falhar, a produção continua com o que estava no
  ar. Código que muda de comportamento por ambiente merece um olhar antes de publicar.
- **Sem commit, vai o último ENVIADO**, não o da sua pasta: com commits não enviados ou mudanças
  não commitadas, o comando avisa. Rode `unbox deploy` antes para incluí-los.
- **Commit que já está no ar:** nada a publicar, e o comando termina sem erro. Para refazer o build
  (variável mudou), faça um commit vazio, `unbox deploy` e publique esse.
- **Uma operação por vez:** com outra publicação ou rollback em andamento, o comando para e diz
  qual. Se a operação em andamento for a do mesmo commit, ele passa a acompanhá-la.
- **Previews ficam 90 dias.** Para publicar algo mais antigo, faça um commit novo (pode ser vazio),
  `unbox deploy` e publique esse.
- Publicar exige uma permissão própria, separada da de deploy. Sem ela, peça a liberação à Unbox.
- Com o hash completo, dá para publicar de uma pasta não ligada à Unbox (bastam as credenciais).

Antes da primeira publicação, rode o checklist do `QA.md` com credenciais reais e o
`npm run unbox:placeholder`: ele reprova enquanto houver `[NOME DA LOJA]`, `[CNPJ]` ou logo
provisório no HTML servido.

---

## 5. `unbox rollback` e `unbox status`

```bash
unbox status            # loja, preview do commit atual, produção e o que falta enviar
unbox rollback          # volta a produção para a publicação anterior
unbox rollback --yes    # sem a confirmação (obrigatório com --json ou sem terminal)
```

**`unbox status`** só lê, não altera nada na Unbox. Use antes de publicar ("Há preview pronto
para `unbox publish`" quer dizer que o commit atual da pasta já está na Unbox, sem commits locais por
enviar, com preview pronto, e não é o que está no ar), depois de um envio, e sempre que não souber o que está no ar. Ele mostra:

1. o provisionamento da loja e o endereço fixo de preview (num provisionamento com falha, o código
   e o que fazer);
2. o preview do commit atual;
3. o que está em produção, se o rollback está disponível e para onde, e a publicação ou o rollback
   em andamento;
4. os commits ainda não enviados e as mudanças não commitadas.

Para comparar com a Unbox, ele faz `git fetch unbox deploy` (atualiza só o `unbox/deploy` local).
Sem a chave ou sem rede, avisa e compara com a cópia local. Fora da pasta de um projeto ligado à
Unbox, mostra só a parte da API. Uma consulta que falha vira aviso; o comando só termina com erro
se todas falharem.

**`unbox rollback`** devolve a produção à publicação feita antes da que está no ar (na ordem em
que foram publicadas), ou à página "Em breve" se só houve uma publicação. Não recebe argumento:
para pôr um commit específico no ar, use `unbox publish <commit>`.

- **Não há build novo:** a troca é imediata (o endereço pode levar até 1 minuto para mostrar).
- **Pede confirmação**, mostrando o que está no ar e para onde volta. Se a produção mudar enquanto
  a pergunta está aberta, o comando para sem fazer nada (`PRODUCAO_MUDOU`).
- **Não é idempotente:** cada execução é um rollback novo, a partir do que estiver no ar naquele
  momento. Por isso o comando pede o rollback uma vez só e nunca repete sozinho, nem quando a
  resposta se perde. Se ele terminar em dúvida (`ROLLBACK_INCERTO`) ou for interrompido, **não
  repita às cegas:** rode `unbox rollback` **sem `--yes`**; ele mostra o que está no ar e o destino
  antes de confirmar, e você decide se ainda precisa.
- Sem rollback disponível: com a página "Em breve" no ar, com a produção alterada fora da Unbox, ou
  quando a publicação no ar é a mais antiga que a Unbox guarda. Nesses casos, `unbox publish
  <commit>`.
- Usa a mesma permissão do `unbox publish`.
- Para seguir em frente depois de um rollback, corrija o código, `unbox deploy` e `unbox publish`.

---

## Endereços da loja

| Endereço | O que mostra |
|---|---|
| `https://<slug>.myunbox.com.br` | **Produção.** Mostra a página "Em breve" até o primeiro `unbox publish`. No futuro, um domínio próprio da loja substitui esse endereço. |
| `https://preview.<slug>.myunbox.com.br` | **Preview estável:** o envio mais recente que deu certo. |
| URL de cada commit | O preview daquele envio, mostrado pelo `unbox deploy`. |

O `unbox provision` mostra o endereço de produção, e o `unbox status` mostra os dois.

### Preview estável

`https://preview.<slug>.myunbox.com.br` (`customStorefront.previewUrl`) é um endereço fixo para
compartilhar a versão em andamento, sem trocar de link a cada envio. Ele exibe o `unbox deploy`
mais recente que terminou com sucesso, alguns segundos depois de pronto. Um build com falha não o
substitui: o anterior continua no ar. Antes do primeiro deploy, o endereço não exibe a loja.

- **No código**, o preview estável se reconhece por `process.env.VERCEL_TARGET_ENV === "preview-unbox"`.
  Ali o `VERCEL_ENV` vale `preview`; em produção, `production`.
- **Buscadores:** antes de cada deploy, o workflow da Unbox acrescenta ao `vercel.json` um header
  `X-Robots-Tag: noindex` que vale só para o host de preview (em produção ele não se aplica). Por
  isso o `vercel.json`, se o projeto tiver um, precisa ser um objeto JSON válido, com `headers` e
  `routes` (quando existirem) em formato de lista. Fora disso o deploy termina em falha
  (`DEPLOY_FAILURE`).
- **O endereço é público.** Qualquer pessoa com o link vê o conteúdo ainda não publicado. O
  `noindex` só afasta buscadores; não é controle de acesso.
- Lojas sem o endereço Unbox, ou provisionadas antes dele, não têm preview estável: o
  `unbox deploy` não mostra a linha, e o `--json` traz `previewUrl: null`. Os previews por commit
  continuam valendo.

---

## Porta de preview (prévia privada) e o lançamento da loja

A loja nasce travada atrás da tela `/acesso` ("Prévia privada"): quem preencher
nome/marca/WhatsApp/e-mail entra (cookie de 30 dias) e vira lead. Com `PIPEDRIVE_API_TOKEN`
configurado, cada lead cria Pessoa + Negócio no Pipedrive (título `"<slug> - Nome"`, no funil de
Negócios).

**A porta se escopa pelo domínio sozinha**: só existe em host de preview (`*.vercel.app`,
`*.myunbox.com.br`, mais os sufixos de `PREVIEW_HOSTS`). Não precisa ligar nem desligar nada:

- **Nos endereços `myunbox.com.br`**, produção inclusive: porta LIGADA. Enquanto a loja não tem
  domínio próprio, quem abre `https://<slug>.myunbox.com.br` passa pela porta. Para abrir a loja
  ao público antes do domínio próprio, use `PREVIEW_DISABLED=1` (kill switch): como o `unbox env`
  envia a mesma variável para preview e produção, a porta some nos dois.
- **No lançamento** (domínio próprio da marca): a porta SOME automaticamente no domínio próprio.
  Os endereços `myunbox.com.br` continuam com porta.
- **Time interno não preenche formulário**: qualquer URL da loja com `?chave=<PREVIEW_PASSWORD>`
  grava o cookie e segue direto, ex.: `https://preview.<slug>.myunbox.com.br/?chave=SUA_CHAVE`.
  Compartilhe ESSE link internamente; o cookie vale 30 dias por navegador. A chave é a que o CLI
  sorteou no `.env.local`, e o `unbox env` a leva para a hospedagem. Sem a variável lá, o atalho é
  recusado e a porta continua abrindo pelo formulário, como deve.
- **Local**: localhost fica fora da porta por padrão (dev e QA não tropeçam nela). Pra testar a
  porta localmente: `PREVIEW_FORCE=1` no `.env.local`.
- ⚠️ Variável nova só vale **num build novo**: `unbox env`, `unbox deploy` e, para produção,
  `unbox publish`.
- Conferência depois do primeiro deploy (não pule): abrir o preview numa aba anônima → deve cair
  em `/acesso`; preencher → deve entrar; o Negócio deve aparecer no Pipedrive (a recusa do
  Pipedrive vem com **status 200**: não confie em "não deu erro"). Apague a Pessoa/Negócio de
  teste do CRM.

---

## Erros comuns

Todo erro da CLI vem com um código e a mensagem diz o que fazer. Com `--json`, sai em stdout como
`{ "ok": false, "error": { "code", "message" } }`; `publish` e `rollback` trazem também, em `data`,
a última leitura da produção. Saída `2` é uso incorreto (flag ou argumento), `1` é falha da
operação. Um código que não está aqui veio repassado da Unbox: siga a mensagem e, persistindo, fale
com a Unbox informando o código. `UNBOX_DEBUG=1` mostra o detalhe técnico (sem credenciais).

**Regra geral:** onde a mensagem diz "fale com a Unbox informando…", repetir o comando não
resolve; mande o que ela pede (`_id`, passo, código ou commit).

### Uso, credenciais e conexão (todos os comandos)

| Código | Causa | O que fazer |
|---|---|---|
| `USAGE` (saída 2) | Comando ou flag desconhecida, flag sem valor (ou com valor sem precisar), argumento a mais | Ver `unbox <comando> --help`. A pasta vai em `--dir`, a mensagem do deploy em `-m` |
| `CREDENCIAIS_AUSENTES` | Não achou o `.env.local` (ou o `--env-file`), ou falta `UNBOX_PARTNER_API_KEY`, `UNBOX_USER` ou `UNBOX_PASS` nele | Preencher a partir do `.env.example`, ou apontar outro arquivo com `--env-file`. Se as três estão no `.env`, use `--env-file .env` |
| `SIGN_IN_FAILED` | Usuário ou senha recusados (`INVALID_CREDENTIALS_ERROR`), ou outra recusa do login | Conferir `UNBOX_USER` e `UNBOX_PASS`, e se não há uma variável exportada no terminal de outra loja (a CLI diz de onde veio cada credencial) |
| `API_KEY_RECUSADA` | A api key foi recusada pelo gateway | Conferir `UNBOX_PARTNER_API_KEY` e se ela é do mesmo ambiente do `UNBOX_PARTNER_GRAPHQL_URL` |
| `MISSING_PERMISSION` | A conta não tem a permissão do comando (publicar e rollback têm uma própria, separada da de deploy) | Pedir a liberação à Unbox |
| `TIMEOUT` | A Unbox não respondeu no prazo | Rodar de novo |
| `NETWORK` | Sem rede, ou endereço da API errado | Conferir a rede e o `UNBOX_PARTNER_GRAPHQL_URL` |
| `HTTP_5xx` (ex.: `HTTP_502`) | Falha momentânea da Unbox | Rodar de novo em instantes |
| `HTTP_4xx` (ex.: `HTTP_403`) | Requisição recusada antes de chegar à API (costuma ser api key errada) | Conferir a api key e o `UNBOX_PARTNER_GRAPHQL_URL` |
| `CANCELADO` | Você respondeu "não" (ou Ctrl+C) numa confirmação | Nada foi alterado |
| `CONFIRMACAO_NECESSARIA` | `publish` ou `rollback` com `--json` ou sem terminal, sem `--yes` | Rodar de novo com `--yes` |
| `ERRO` | Erro inesperado, sem código | Rodar de novo com `UNBOX_DEBUG=1` e mandar a saída à Unbox |

### Git e máquina local (`provision`, `deploy`, `publish`, `status`; `OUTRA_LOJA` também no `rollback`)

| Código | Causa | O que fazer |
|---|---|---|
| `GIT_MISSING` | git não instalado | Instalar o git (https://git-scm.com/downloads) |
| `SSH_KEYGEN_MISSING` | `ssh-keygen` não instalado (`provision`) | Instalar o OpenSSH (no Windows 10+, em Recursos opcionais) |
| `SSH_KEYGEN_FALHOU` | O `ssh-keygen` falhou ao gerar a chave | Ler o erro mostrado; corrigir permissões de `~/.config/unbox` e rodar de novo |
| `SHOP_ID_INVALIDO` | O id da loja veio com caracteres inesperados | Falar com a Unbox |
| `REPO_ANINHADO` | A pasta está dentro de outro repositório git | Rodar na raiz do projeto da loja, ou fazer dela um repositório próprio |
| `HEAD_DESTACADO` | HEAD destacado (fora de qualquer branch) | `git switch <branch>` e rodar de novo |
| `GIT_EM_ANDAMENTO` | Merge, rebase, cherry-pick, revert ou bisect em andamento | Terminar ou abortar (ex.: `git merge --abort`) e rodar de novo |
| `ARVORE_SUJA` | Mudanças não commitadas quando o `provision` precisa trocar de branch, ou trazer commits novos da `deploy` da Unbox numa nova execução | Commit ou `git stash` e rodar de novo |
| `DEPLOY_ALHEIA` | Já existe uma branch `deploy` sua, que não é a da Unbox | `git branch -m deploy <outro-nome>` e rodar de novo; nada foi alterado |
| `REMOTE_ALHEIO` | Já existe um remote `unbox` que não foi a CLI que criou | Renomear ou remover esse remote e rodar de novo |
| `OUTRA_LOJA` | A pasta está ligada a outra loja (`git config unbox.shopId`) que não a das credenciais | Conferir as credenciais do `.env.local` (o `status` só avisa) |
| `UNEXPECTED_GIT_HOST` | O repositório da Unbox veio com um endereço inesperado | Atualizar a CLI; persistindo, falar com a Unbox |
| `HOST_KEY_MISMATCH` | A identidade do servidor git da Unbox não confere | Atualizar a CLI e falar com a Unbox antes de qualquer outra coisa. **Não apague o `known_hosts`** |
| `GIT_FETCH_FALHOU` | O `git fetch` da `deploy` da Unbox falhou | Conferir a rede e rodar de novo |
| `CHAVE_RECUSADA` | O servidor git recusou a chave de deploy desta máquina: ela não está entre as chaves da loja (outra máquina, chave recriada ou removida) | `unbox provision` nesta máquina, que adiciona a chave dela à loja sem tirar as outras; depois, rodar o comando de novo |
| `GIT_FALHOU` | Um comando git falhou (init, remote, config, add) | Ler o erro do git mostrado e rodar de novo |
| `PROGRAMA_AUSENTE` | Outro programa externo não encontrado | Instalar o programa que a mensagem cita |

### `unbox provision`

| Código | Causa | O que fazer |
|---|---|---|
| `PROTECTED_PATHS` | O projeto tem `.github/`, `.gitea/` ou `.forgejo/` e o comando rodou sem terminal, sem `--yes` | Rodar de novo com `--yes` (as pastas ficam fora da `deploy` e continuam na sua branch) |
| `GIT_IDENTITY_MISSING` | git sem nome e e-mail, sem terminal (ou com `--json`/`--yes`), quando o vínculo cria um commit | `git config --global user.name "Seu Nome"` e `git config --global user.email "voce@exemplo.com"` |
| `MERGE_FALHOU` | Primeira execução num projeto com commits: o merge que cria a `deploy` falhou (a sua branch foi restaurada e a `deploy` apagada). Nova execução: a sua `deploy` e a da Unbox divergiram e o merge automático foi abortado | Primeira execução: ler o erro, resolver o que ele aponta e rodar de novo (não faça merge na sua branch). Nova execução: na `deploy`, `git merge unbox/deploy`, resolver e rodar de novo |
| `COMMIT_FALHOU` / `VINCULO_FALHOU` | O commit do vínculo falhou | Nada foi alterado (a branch original foi restaurada); ler o erro e rodar de novo |
| `CUSTOM_STOREFRONT_NOT_CONFIGURED_ERROR` | A hospedagem não está configurada neste ambiente da Unbox | Falar com a Unbox |
| `CUSTOM_STOREFRONT_INVALID_DEPLOY_PUBLIC_KEY_ERROR` | A chave pública foi recusada | Apagar o par `~/.config/unbox/keys/<shopId>_ed25519*` e rodar de novo |
| `CUSTOM_STOREFRONT_DEPLOY_KEY_IN_USE_ERROR` | A chave já está em uso em outro repositório. Na primeira vez a CLI gera outra sozinha e avisa; este erro é a chave nova também recusada | Falar com a Unbox informando o `_id`, o passo e o código |
| `CUSTOM_STOREFRONT_DEPLOY_KEYS_LIMIT_ERROR` | A loja já tem o máximo de chaves de deploy (10), e esta máquina não está entre elas | `unbox keys` e `unbox keys remove <fingerprint>` de uma que não esteja mais em uso; depois, rodar de novo |
| `CUSTOM_STOREFRONT_HOSTING_DOMAIN_IN_USE_ERROR` | O endereço da loja (`<slug>.myunbox.com.br`) está em uso ou é reservado pela Unbox | Repetir não adianta: falar com a Unbox informando o `_id` que o comando mostra |
| `CUSTOM_STOREFRONT_INVALID_SHOP_SLUG_ERROR` | O slug da loja não serve como nome de repositório ou de domínio | Falar com a Unbox informando o `_id` |
| `CUSTOM_STOREFRONT_DEPLOY_WORKFLOW_MISMATCH_ERROR` | O workflow de deploy do repositório foi alterado | Falar com a Unbox informando o `_id` |
| `CUSTOM_STOREFRONT_GIT_REPOSITORY_OWNER_MISMATCH_ERROR` | Já existe um repositório com o nome da loja em outro dono | Falar com a Unbox informando o `_id` |
| `CUSTOM_STOREFRONT_HOSTING_DOMAIN_MISCONFIGURED_ERROR` | O domínio está ligado a outro ambiente de hospedagem | Falar com a Unbox informando o `_id` |
| `CUSTOM_STOREFRONT_HOSTING_ENVIRONMENT_LIMIT_ERROR` | A conta de hospedagem atingiu o limite de ambientes | Falar com a Unbox informando o `_id` |
| `CUSTOM_STOREFRONT_INVALID_DEPLOY_CLI_VERSION_ERROR` / `CUSTOM_STOREFRONT_INVALID_PREVIEW_DOMAIN_ERROR` | Configuração da Unbox inválida | Falar com a Unbox informando o `_id` |
| `PROVISIONING_FAILED` (ou o código do passo, ex.: `CUSTOM_STOREFRONT_GIT_ERROR`) | O provisionamento falhou duas vezes (a primeira falha é tentada de novo sozinha) | Falar com a Unbox informando o `_id`, o passo e o código |
| `PROVISIONING_TIMEOUT` | Ainda provisionando depois de 30 min | Ele continua no servidor: rodar `unbox provision` de novo mais tarde (é seguro) |
| `NETWORK` / `TIMEOUT` / `HTTP_5xx` no meio | Contato perdido com a Unbox durante o acompanhamento | Ele continua no servidor: rodar `unbox provision` de novo (é seguro) |
| Aviso "não consegui enviar as variáveis" | O provisionamento deu certo, mas o envio das variáveis falhou | `unbox env` (é seguro) |

### `unbox env`

| Código | Causa | O que fazer |
|---|---|---|
| `ENV_FILE_AUSENTE` | O arquivo de variáveis não existe | Criar o `.env.local` ou apontar outro com `--env-file` |
| `USAGE` | `--list` e `--unset` juntos; `--unset` sem chave; `--unset` de nome inválido ou de uma variável gerenciada/reservada (ex.: `NEXT_PUBLIC_SITE_URL`) | Ver `unbox env --help` |
| `CUSTOM_STOREFRONT_NOT_READY_ERROR` | A loja ainda não foi provisionada | `unbox provision` |
| `CUSTOM_STOREFRONT_ENVIRONMENT_KEY_RESERVED_ERROR` | A Unbox passou a reservar um nome que esta versão da CLI não conhece (no envio normal ela só pula a chave e avisa; o erro aparece no `--list`/`--unset`) | Atualizar a CLI ou falar com a Unbox; nada daquele lote foi alterado |
| `CUSTOM_STOREFRONT_HOSTING_SET_ENVIRONMENT_ERROR` / `..._REMOVE_ENVIRONMENT_ERROR` / `..._LIST_ENVIRONMENT_ERROR` | A hospedagem não concluiu a operação | Rodar de novo (é seguro; completa um lote parcial) |
| `ENV_INVALIDA` | A Unbox recusou uma variável (a mensagem diz qual) | Corrigir o valor no `.env.local` e rodar de novo |
| `ENV_RECUSADO` | Outra recusa da Unbox nas variáveis | Rodar de novo; persistindo, falar com a Unbox |
| "N de M variáveis já foram gravadas" | Falha no meio dos lotes | Rodar de novo completa |
| Aviso "vazia no terminal" | Variável exportada vazia no terminal escondendo a do arquivo | `unset CHAVE` no terminal e `unbox env` de novo |
| Aviso de credencial só no terminal | Uma das credenciais está exportada no terminal e não no arquivo: não vai para a hospedagem | Colocar no `.env.local` (senão o build falha no login) |

### `unbox deploy`

| Código | Causa | O que fazer |
|---|---|---|
| `NAO_PROVISIONADO` | O projeto não está ligado à Unbox, ou a chave de deploy dele não está nesta máquina | `unbox provision` (em outra máquina, ele adiciona a chave desta à loja) |
| `FORA_DA_DEPLOY` | `unbox deploy` fora da branch `deploy` | `git checkout deploy` (e `git merge <sua-branch>` para trazer as mudanças) |
| `GIT_IDENTITY_MISSING` | git sem nome e e-mail, sem terminal (ou com `--json`/`--yes`) | `git config --global user.name "..."` e `git config --global user.email "..."` |
| `ARQUIVO_PROTEGIDO` | O envio levaria mudanças em `.forgejo/`, `.github/` ou `.gitea/` | Nada foi enviado: desfazer como o comando indica (ex.: `git checkout unbox/deploy -- .forgejo`) |
| `BUILD_FALHOU` | Com `--build`: o `npm run build` local falhou | Nada foi commitado nem enviado: corrigir o erro mostrado |
| `COMMIT_FALHOU` | O `git commit` falhou | Nada foi enviado; as mudanças ficaram no índice. Ler o erro e rodar de novo |
| `REBASE_CONFLITO` / `MERGE_CONFLITO` | A `deploy` da Unbox tem commits que conflitam com os seus | Nada foi enviado: `git rebase unbox/deploy` (ou `git merge`), resolver e `unbox deploy` |
| `CHAVE_RECUSADA` | O servidor git recusou a chave de deploy desta máquina (ela não está entre as chaves da loja) | `unbox provision` nesta máquina, que adiciona a chave dela; depois, `unbox deploy` |
| `PUSH_RECUSADO` | O servidor recusou o envio (as linhas `remote:` dizem o motivo) | Ler o motivo; persistindo, falar com a Unbox |
| `PUSH_FALHOU` | Outra falha no envio | Ler o erro do git, conferir a rede e rodar de novo |
| `CUSTOM_STOREFRONT_NOT_READY_ERROR` | A loja ainda não foi provisionada | `unbox provision` |
| `CUSTOM_STOREFRONT_NOT_CONFIGURED_ERROR` | Deploy não configurado neste ambiente da Unbox | Falar com a Unbox |
| `DEPLOY_FAILURE` | O build do preview falhou (a API não diz o motivo) | `unbox deploy --build` mostra o erro aqui; passou aqui? Conferir `unbox env --list`, e o `vercel.json` se houver |
| `DEPLOY_TIMEOUT` | O build não terminou em ~15 min | Falar com a Unbox informando o commit |
| `DEPLOY_CONSULTA_FALHOU` (ou `TIMEOUT`/`NETWORK`/`HTTP_5xx`/código da Unbox) | Perdeu o contato com a Unbox no acompanhamento; o deploy segue lá | `unbox status` mostra o resultado; persistindo, falar com a Unbox informando o commit |

### `unbox publish`

| Código | Causa | O que fazer |
|---|---|---|
| `USAGE` | Mais de um commit, ou o argumento não é um hash (4 a 64 caracteres hexadecimais) | `unbox publish [commit]` |
| `NAO_PROVISIONADO` | Sem a branch `deploy` da Unbox nesta pasta (e sem hash completo) | `unbox provision`, ou passar o hash completo |
| `COMMIT_AMBIGUO` | O hash curto bate com mais de um commit | Usar mais caracteres |
| `COMMIT_NAO_ENVIADO` | O commit não está na `deploy` da Unbox (não foi enviado, ou mudou de hash num rebase) | `unbox deploy`; ver os enviados em `git log --oneline unbox/deploy` |
| `PREVIEW_FALHOU` | O preview do commit falhou | Corrigir e `unbox deploy` |
| `PREVIEW_PENDENTE` | O preview ainda está sendo gerado, ou o commit não é o último de um envio (só ele gera preview) | Esperar e repetir; ou `unbox publish` sem commit para o último enviado |
| `DEPLOY_FAILURE` / `DEPLOY_TIMEOUT` / `DEPLOY_CONSULTA_FALHOU` (ou `TIMEOUT`/`NETWORK`) | Esperando o preview do último commit enviado: o build falhou, passou de ~15 min, ou a consulta falhou | Como no `unbox deploy` |
| `CUSTOM_STOREFRONT_DEPLOYMENT_NOT_FOUND_ERROR` | O commit não tem preview (o deploy falhou, ou o preview tem mais de 90 dias) | `git commit --allow-empty -m "unbox: republica"`, `unbox deploy` e publicar esse |
| `CUSTOM_STOREFRONT_DEPLOYMENT_INVALID_ERROR` | O commit não pode ser publicado nesta loja | Não repetir: falar com a Unbox informando o commit |
| `CUSTOM_STOREFRONT_PRODUCTION_BUSY_ERROR` | Outra publicação ou rollback em andamento | Esperar terminar (`unbox status` mostra qual) e rodar de novo |
| `CUSTOM_STOREFRONT_PRODUCTION_BUILD_ERROR` | O build de produção falhou, mesmo com o preview ok | A produção segue com o que estava no ar. Revisar o que muda entre preview e produção, corrigir, `unbox deploy` e publicar de novo |
| `CUSTOM_STOREFRONT_PRODUCTION_TIMEOUT_ERROR` | A publicação não terminou em 20 min na Unbox | `unbox publish <commit>` de novo; persistindo, falar com a Unbox informando o commit |
| `PUBLICACAO_FALHOU` (ou o código da operação, ex.: `CUSTOM_STOREFRONT_HOSTING_CREATE_PRODUCTION_DEPLOYMENT_ERROR`) | A publicação falhou por outro motivo | `unbox publish <commit>` de novo; persistindo, falar com a Unbox |
| `PUBLICACAO_PRESA` | Uma publicação em andamento há mais de 25 min | Não adianta esperar: falar com a Unbox informando o commit |
| `PUBLICACAO_TIMEOUT` | A CLI parou de acompanhar depois de ~25 min; a publicação segue na Unbox | `unbox status`; persistindo, falar com a Unbox informando o commit |
| `PUBLICACAO_SUBSTITUIDA` | Outra operação de produção começou antes desta ser confirmada | `unbox status`; se ainda precisar, `unbox publish <commit>` de novo |
| `PRODUCAO_CONSULTA_FALHOU` (ou `NETWORK`/`HTTP_5xx`) | Perdeu o contato no acompanhamento; a publicação segue na Unbox | `unbox publish <commit>` volta a acompanhar |
| `CUSTOM_STOREFRONT_NOT_READY_ERROR` / `CUSTOM_STOREFRONT_NOT_CONFIGURED_ERROR` | Loja não provisionada / hospedagem não configurada | `unbox provision` / falar com a Unbox |

### `unbox rollback`

| Código | Causa | O que fazer |
|---|---|---|
| `USAGE` | Recebeu um argumento | Para um commit específico, `unbox publish <commit>` |
| `CUSTOM_STOREFRONT_NOTHING_TO_ROLLBACK_ERROR` | Não há para onde voltar: a página "Em breve" está no ar, a produção foi alterada fora da Unbox, a publicação no ar é a mais antiga guardada, ou a produção mudou desde a leitura | `unbox publish <commit>` |
| `CUSTOM_STOREFRONT_PRODUCTION_BUSY_ERROR` | Outra publicação ou rollback em andamento | Nada foi feito. Quando terminar, `unbox rollback` sem `--yes` |
| `ROLLBACK_INTERROMPIDO` | Um rollback anterior ficou preso e a Unbox ainda não aceita outro | `unbox publish <commit>`; persistindo, falar com a Unbox |
| `PRODUCAO_MUDOU` | A produção mudou enquanto a confirmação estava aberta | Nada foi feito: `unbox rollback` de novo |
| `CUSTOM_STOREFRONT_ROLLBACK_TARGET_UNAVAILABLE_ERROR` | A publicação de destino não existe mais na hospedagem (ou a página "Em breve" sumiu) | `unbox publish <commit do destino>` (preview com mais de 90 dias: commit vazio, `unbox deploy` e publicar); para a "Em breve", falar com a Unbox |
| `ROLLBACK_INCERTO` | A resposta se perdeu e não deu para saber se o rollback valeu | **Não repetir às cegas:** `unbox rollback` sem `--yes` mostra o que está no ar e o destino antes de confirmar |
| `ROLLBACK_SUBSTITUIDO` | Outra operação começou, e não dá para saber se o rollback valeu | Conferir com `unbox status` antes de repetir |
| `ROLLBACK_FALHOU` (ou o código da operação, ex.: `CUSTOM_STOREFRONT_HOSTING_PROMOTE_ERROR`) | O rollback não foi aplicado; a produção não mudou | `unbox rollback` sem `--yes`; persistindo, falar com a Unbox |
| Aviso "não rode de novo" | A Unbox registrou falha, mas o destino está no ar | Não repetir: voltaria mais uma publicação |
| `CUSTOM_STOREFRONT_NOT_READY_ERROR` / `CUSTOM_STOREFRONT_NOT_CONFIGURED_ERROR` | Loja não provisionada / hospedagem não configurada | `unbox provision` / falar com a Unbox |

### `unbox status`

Só lê: uma consulta que falha vira aviso (com o código) e o resto é mostrado. Termina com erro
(com o código da consulta) só se todas falharem; aí valem as linhas de credenciais e conexão acima.
Um provisionamento com falha aparece com o código e o que fazer, como na tabela do `provision`.

### `unbox keys`

| Código | Causa | O que fazer |
|---|---|---|
| `CHAVE_PRIVADA` | O arquivo do `add` é uma chave privada; nada foi enviado | Passar o `.pub` do par |
| `CHAVE_INVALIDA` | O arquivo não é uma chave pública SSH de uma linha (ssh-ed25519 ou ssh-rsa) | Conferir o arquivo |
| `CONFIRMACAO_NECESSARIA` | `remove` sem terminal (ou com `--json`) e sem `--yes` | Rodar de novo com `--yes`, depois de conferir a chave com `unbox keys` |
| `CUSTOM_STOREFRONT_DEPLOY_KEYS_LIMIT_ERROR` | A loja já tem o máximo de chaves (10) | Remover uma que não esteja mais em uso |
| `CUSTOM_STOREFRONT_DEPLOY_KEY_TITLE_IN_USE_ERROR` | Outra chave da loja já tem esse título | Outro `--title` |
| `CUSTOM_STOREFRONT_DEPLOY_KEY_NOT_FOUND_ERROR` | A chave não está (mais) na loja | `unbox keys` para ver as que estão |
| `CUSTOM_STOREFRONT_DEPLOY_KEY_IN_USE_ERROR` | A chave já é usada em outro repositório da Unbox | Usar outra chave |
| `CUSTOM_STOREFRONT_NOT_READY_ERROR` | A loja ainda não foi provisionada | `unbox provision` |

### Build e ambiente (sem código da CLI)

| Sintoma | Causa | O que fazer |
|---|---|---|
| `DEPLOY_FAILURE` com `vercel.json` no projeto | `vercel.json` inválido, ou com `headers`/`routes` fora de lista | Corrigir o JSON (veja [Preview estável](#preview-estável)) |
| `signIn: HTTP 403` no build | Credenciais ausentes ou erradas na hospedagem | `unbox env`, depois `unbox deploy` |
| Prerender error na home `/` | API inacessível durante o build | Conferir credenciais e `npm run unbox:test` |
| Variável mudou e a loja não | Só builds novos usam as variáveis | `unbox env`, commit (pode ser vazio), `unbox deploy`, `unbox publish` |
| Links da loja apontam para `localhost` em produção | `NEXT_PUBLIC_SITE_URL` ainda não é preenchida pela Unbox | Esperado por enquanto (veja [o `unbox env`](#2-unbox-env-as-variáveis-da-loja)); não tente defini-la pelo `unbox env` |
| `npm ERR! ...` no install | `~/package-lock.json` global | `rm -f ~/package-lock.json` |
| Startup > 5 min em dev | Node.js v26 instalado | `nvm use 22` |
