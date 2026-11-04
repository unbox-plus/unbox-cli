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
- **git** instalado. Não precisa de conta em lugar nenhum: a CLI cria o repositório e a chave.
- **Credenciais da loja no `.env.local`**: `UNBOX_PARTNER_API_KEY`, `UNBOX_USER` e `UNBOX_PASS`
  (veja `.env.example`). São elas que autorizam os comandos `unbox`, e também o build da loja.
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

Todos os comandos abaixo rodam **na pasta do projeto**. `unbox <comando> --help` mostra as opções
de cada um, e `--json` dá uma saída para agentes e scripts.

---

## 1. `unbox provision`: criar a hospedagem (uma vez)

```bash
unbox provision
```

**O que cria:** o repositório git da loja e o projeto de hospedagem na Unbox, com o endereço de
produção (veja [Endereços da loja](#endereços-da-loja)). Leva alguns minutos. No fim, envia as
variáveis do `.env.local`, como o `unbox env` faria. Rodar de novo é seguro: nada é duplicado.

**Onde fica a chave:** a CLI gera uma chave de deploy em `~/.config/unbox/keys/<loja>_ed25519`.
Ela é a única credencial do envio, e só existe nesta máquina. Para enviar de outra máquina, peça a
troca à Unbox; não copie a chave privada.

**Como fica o git:**

- Pasta sem git: o repositório nasce na branch `deploy`, com os seus arquivos como estão.
- Projeto que já tem commits: a branch `deploy` é criada ao lado da sua, que não muda. O trabalho de
  publicação segue na `deploy`.
- O projeto ganha um remote `unbox`. Não use `git push unbox` à mão: ele não leva a chave. Use
  `unbox deploy`.
- `.github/`, `.gitea/` e `.forgejo/` não vão para a Unbox. O `provision` pede confirmação se o
  projeto tiver alguma delas, e elas continuam na sua branch.

---

## 2. `unbox env`: as variáveis da loja

O `.env.local` não vai no envio (está no `.gitignore`), e sem as variáveis o build falha no login
da API. O `unbox env` grava as variáveis do arquivo na hospedagem, para os builds de preview e de
produção. O `provision` já faz isso uma vez; rode de novo **sempre que mudar o `.env.local`**.

```bash
unbox env                          # envia as variáveis do .env.local
unbox env --list                   # o que está na hospedagem e o que falta enviar
unbox env --unset CHAVE            # remove da hospedagem
```

- **Vão** todas as chaves preenchidas do arquivo. As vazias ficam de fora (opcional em branco é
  escolha), e o comando avisa as que pula: nomes reservados (`TZ`, `VERCEL_*`, `NOW_*`, `AWS_*`,
  `LAMBDA_*`), nomes fora do formato e `NEXT_PUBLIC_SITE_URL` (veja abaixo).
- **Os valores nunca são exibidos**, nem com `--json`, nem no `--list`: a saída mostra só os nomes.
  Por isso o `--list` não percebe um valor alterado; rode `unbox env` para enviar de novo.
- **Variável nova só vale num build novo.** Depois de mudar, rode `unbox deploy` e publique esse
  commit. Publicar de novo o que já está no ar não refaz o build. Sem mudança de código, crie um
  commit vazio: `git commit --allow-empty -m "variáveis"`, depois `unbox deploy` e `unbox publish`.

### Referência: o que o `unbox env` envia

| Variável | Obrigatório | Descrição |
|---|---|---|
| `UNBOX_PARTNER_API_KEY` | ✅ | Api key única do PARCEIRO (`da2-...`): toda chamada à Unbox passa por ela |
| `UNBOX_USER` | ✅ | Usuário de acesso à API da loja |
| `UNBOX_PASS` | ✅ | Senha de acesso à API |
| `SESSION_SECRET` | ✅ | String aleatória forte (≥ 32 chars). Sem ela, em produção, a posse de pedido é RECUSADA (não é aviso: `/api/checkout` falha e o pedido não vira cookie) |
| `NEXT_PUBLIC_SITE_NAME` | ✅ | Nome de exibição (manifest/PWA) |
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
> parceiros.

`NEXT_PUBLIC_SITE_URL` não está na tabela de propósito: ela é **reservada e gerenciada pela Unbox**,
que vai preenchê-la com o endereço de produção da loja. O `unbox env` não a envia (o valor do
`.env.local` serve só para o `next dev`), e não há como defini-la por ele.

---

## 3. `unbox deploy`: enviar e gerar o preview

```bash
unbox deploy                    # commita tudo e envia
unbox deploy -m "nova vitrine"  # com outra mensagem de commit
unbox deploy --build            # roda npm run build antes, para pegar erro sem gastar um envio
```

Cada `unbox deploy` commita o que mudou (`git add -A`), envia a branch `deploy` para a Unbox e
acompanha o build. No fim mostra duas URLs: a **do preview desse commit** e o
**[preview estável](#preview-estável)** da loja. Nada disso muda a produção.

- **Só na branch `deploy`.** Em outra branch o comando para sem mexer em nada e diz o que rodar
  (`git checkout deploy` e, para trazer as mudanças, `git merge <sua-branch>`).
- **`.forgejo/` é protegido:** é onde fica o workflow de deploy da Unbox. Mudanças nele (ou em
  `.github/` e `.gitea/`) param o comando antes do commit, com a lista do que desfazer.
- **Build com falha (`FAILURE`):** a API não devolve o motivo. Rode `unbox deploy --build` para ver
  o erro na sua máquina. Build que passa aqui e falha na Unbox costuma ser variável faltando na
  hospedagem (`unbox env --list`).
- Os hooks do projeto (husky, commitlint) não rodam no commit nem no envio do `unbox deploy`.

---

## 4. `unbox publish`: pôr em produção

```bash
unbox publish            # o último commit enviado pelo unbox deploy
unbox publish 3f9c2a1    # um commit enviado antes (hash curto ou completo)
```

O comando confere que o preview do commit está pronto, pede confirmação mostrando o que está no ar
e acompanha até o fim. A Unbox **refaz o build com a configuração de produção** e só troca o
endereço quando ele termina: costuma levar 1 a 2 minutos, mais até 1 minuto para o endereço mostrar
o novo conteúdo. Ctrl+C não cancela; `unbox publish <commit>` volta a acompanhar.

- **Preview ok não garante produção ok.** Produção é outro build, com outras variáveis de ambiente
  (`VERCEL_ENV` vale `production`, por exemplo). Se ele falhar, a produção continua com o que
  estava no ar. Código que muda de comportamento por ambiente merece um olhar antes de publicar.
- **Uma operação por vez:** com outra publicação ou rollback em andamento, o comando para e diz
  qual.
- **Previews ficam 90 dias.** Para publicar algo mais antigo, faça um commit novo (pode ser vazio),
  `unbox deploy` e publique esse.
- Publicar exige uma permissão própria, separada da de deploy. Sem ela, peça a liberação à Unbox.

Antes da primeira publicação, rode o checklist do `QA.md` com credenciais reais e o
`npm run unbox:placeholder`: ele reprova enquanto houver `[NOME DA LOJA]`, `[CNPJ]` ou logo
provisório no HTML servido.

---

## 5. `unbox rollback` e `unbox status`

```bash
unbox status      # loja, preview do commit atual, produção e o que falta enviar
unbox rollback    # volta a produção para a publicação anterior
```

**`unbox status`** só lê, não altera nada. Use antes de publicar ("há preview pronto para
`unbox publish`?"), depois de um envio, e sempre que não souber o que está no ar.

**`unbox rollback`** devolve a produção ao commit publicado antes do atual, ou à página "Em breve"
se só houve uma publicação. **Não é idempotente:** cada execução é um rollback novo, a partir do
que estiver no ar naquele momento. Se o comando for interrompido ou a dúvida for "já voltou?",
confira com `unbox status` antes de repetir, para não voltar uma publicação a mais. Para seguir em
frente depois de um rollback, corrija o código, `unbox deploy` e `unbox publish`.

---

## Endereços da loja

| Endereço | O que mostra |
|---|---|
| `https://<slug>.myunbox.com.br` | **Produção.** Mostra a página "Em breve" até o primeiro `unbox publish`. No futuro, um domínio próprio da loja substitui esse endereço. |
| `https://preview.<slug>.myunbox.com.br` | **Preview estável:** o envio mais recente que deu certo. |
| URL de cada commit | O preview daquele envio, mostrado pelo `unbox deploy`. |

### Preview estável

`https://preview.<slug>.myunbox.com.br` é um endereço fixo para compartilhar a versão em
andamento, sem trocar de link a cada envio. Ele exibe o `unbox deploy` mais recente que terminou
com sucesso, alguns segundos depois de pronto. Um build com falha não o substitui: o anterior
continua no ar. Antes do primeiro deploy, o endereço não exibe a loja.

- **No código**, o preview estável se reconhece por `process.env.VERCEL_TARGET_ENV === "preview-unbox"`.
  Ali o `VERCEL_ENV` vale `preview`; em produção, `production`.
- **Buscadores:** antes de cada deploy, o workflow da Unbox acrescenta ao `vercel.json` um header
  `X-Robots-Tag: noindex` que vale só para o host de preview (em produção ele não se aplica). Por
  isso o `vercel.json`, se o projeto tiver um, precisa ser um objeto JSON válido, com `headers` e
  `routes` (quando existirem) em formato de lista. Fora disso o deploy termina em `FAILURE`.
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

| Erro | Causa | O que fazer |
|---|---|---|
| `CREDENCIAIS_AUSENTES` | Falta `UNBOX_PARTNER_API_KEY`, `UNBOX_USER` ou `UNBOX_PASS` no `.env.local` | Preencher e rodar de novo |
| `SIGN_IN_FAILED` / `API_KEY_RECUSADA` | Credencial errada, ou uma variável exportada no terminal de outra loja | Conferir o `.env.local` e o terminal (a CLI diz de onde veio cada credencial) |
| `MISSING_PERMISSION` | A credencial não tem a permissão do comando (publicar tem uma própria) | Pedir a liberação à Unbox |
| `CUSTOM_STOREFRONT_HOSTING_DOMAIN_IN_USE_ERROR` | O endereço da loja (`<slug>.myunbox.com.br`) está em uso ou é reservado pela Unbox | Repetir não adianta: fale com a Unbox informando o `_id` que o comando mostra |
| `CUSTOM_STOREFRONT_NOT_READY_ERROR` / `NAO_PROVISIONADO` | A loja ainda não foi provisionada, ou o projeto não está ligado a ela | `unbox provision` |
| A chave de deploy não está nesta máquina | O projeto foi provisionado em outra máquina | Pedir a troca da chave à Unbox (não copie a chave privada) |
| `FORA_DA_DEPLOY` | `unbox deploy` fora da branch `deploy` | `git checkout deploy` (e `git merge <sua-branch>` para trazer as mudanças) |
| `GIT_IDENTITY_MISSING` | git sem nome e e-mail (com `--json`/`--yes`) | `git config --global user.name "..."` e `user.email "..."` |
| `PROTECTED_PATHS` | Mudança em `.forgejo/`, `.github/` ou `.gitea/` | Desfazer a mudança nessas pastas (o comando lista os arquivos) |
| `REBASE_CONFLITO` / `MERGE_CONFLITO` | A `deploy` da Unbox tem commits que conflitam com os seus | Nada foi enviado: resolver como o comando indica e rodar de novo |
| `FAILURE` no `unbox deploy` | O build do preview falhou | `unbox deploy --build` mostra o erro aqui; passou aqui? `unbox env --list` |
| `FAILURE` com `vercel.json` no projeto | `vercel.json` inválido, ou com `headers`/`routes` fora de lista | Corrigir o JSON (veja [Preview estável](#preview-estável)) |
| `UnboxError: signin HTTP 403` no build | Variáveis ausentes na hospedagem | `unbox env`, depois `unbox deploy` |
| Prerender error na home `/` | API inacessível durante o build | Conferir credenciais e `npm run unbox:test` |
| `COMMIT_NAO_ENVIADO` | `unbox publish` de um commit que não está na `deploy` da Unbox | `unbox deploy`; ou ver os enviados em `git log --oneline unbox/deploy` |
| `PREVIEW_FALHOU` / `PREVIEW_PENDENTE` | O preview do commit falhou, ou ainda está sendo gerado | Corrigir e enviar de novo; ou esperar e repetir |
| `CUSTOM_STOREFRONT_PRODUCTION_BUILD_ERROR` | O build de produção falhou (o preview passou) | Revisar o que muda entre preview e produção; a produção segue com o que estava no ar |
| `CUSTOM_STOREFRONT_PRODUCTION_BUSY_ERROR` | Outra publicação ou rollback em andamento | Esperar; `unbox status` mostra qual |
| Variável mudou e a loja não | Só builds novos usam as variáveis | `unbox env`, commit (pode ser vazio), `unbox deploy`, `unbox publish` |
| `npm ERR! ...` no install | `~/package-lock.json` global | `rm -f ~/package-lock.json` |
| Startup > 5 min em dev | Node.js v26 instalado | `nvm use 22` |
