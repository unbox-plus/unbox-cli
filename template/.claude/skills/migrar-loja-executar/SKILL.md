---
name: migrar-loja-executar
description: Executa a migração de uma loja ANTIGA (gerada por uma versão anterior do @unbox-plus/cli) para o template atual, a partir do relatório da skill migrar-loja-analisar, nos dois caminhos (refatorar a loja ou refazer com unbox create e portar), sempre com um plano de execução revisado e aprovado antes do primeiro arquivo e com fidelidade ao layout atual como restrição; traz o SDK (@unbox-plus/sdk), as versões intermediárias, a edição de assinatura da 0.29 e deixa a loja antiga pronta para o editor (gate unbox:editavel em 80%). Use quando o usuário disser "migra a loja", "atualiza a loja para a CLI nova", "traz o SDK para a loja X", "faz a migração que você analisou", ou pedir qualquer bloco disso numa loja antiga (só o SDK, só o editor, só a 0.29). Não é para loja recém-gerada que só precisa subir a cobertura do editor, nem para mexer no template do CLI. Se ainda não houver análise, rode a migrar-loja-analisar antes: esta skill parte dos números dela.
---

# Executar a migração de uma loja antiga

Pré-requisito: o relatório da `migrar-loja-analisar` (versão-base, classificação dos arquivos, auditoria do
editor, referência visual, recomendação). Se não existir, rode-a primeiro. A skill cobre os dois caminhos: com
REFATORAR, os blocos são os merges da seção "A ordem dos blocos"; com REFAZER, são os de "Refazendo". Nos
dois, o Passo 1 (o plano, revisado antes de qualquer arquivo) e a regra de fidelidade valem igual, e
`references/editor.md` vale igual.

**Use quantos subagentes forem necessários para agilizar.** O que é paralelizável vai para `Agent`s
simultâneos, cada um com briefing próprio (a loja, o relatório da análise, as decisões do usuário, o bloco ou os
arquivos dele e o critério de pronto): a revisão adversarial do plano (sempre um agente que não escreveu o
plano); dentro de um bloco, os merges de arquivos que não dependem um do outro (as `reescrita`, os componentes do
editor que ganham primitivos, as rotas próprias); e a comparação visual contra a referência. O que não se
paraleliza: a ordem dos blocos (cada um compila antes do seguinte), dois agentes no mesmo arquivo, e as
verificações de fim de bloco (`tsc --noEmit`, build, gate), que rodam no fio principal sobre o resultado
somado. Agente que escreve na loja trabalha só nos arquivos que você lhe deu; você confere o diff de cada um
antes de seguir.

## Passo 0: antes de tocar em qualquer arquivo

- **Árvore limpa.** `git status --porcelain` na loja tem de vir vazio. Os lotes de `cp` abaixo (dezenas de
  arquivos, incluindo `CLAUDE.md`, `lib/config.ts`, `agents/`) são irreversíveis sem um ponto de retorno; com
  trabalho não commitado, pare e peça ao usuário para commitar ou guardar (`git stash`). Loja sem git: peça um
  `git init && git add -A && git commit` antes, ou uma cópia da pasta.
- **As decisões do relatório.** A lista numerada "O que precisa de decisão do usuário", que fecha a análise, é a
  pauta: cada item respondido antes de tocar nos arquivos dele. O bloco "Mudanças de comportamento" da análise lista escolhas (catálogo em
  JSON: migrar para a API ou manter; páginas institucionais e blog: virar páginas do lojista ou ficar em
  código; combos, preview fake, rótulos por índice). Cada uma tem de estar respondida pelo usuário antes de
  você tocar no arquivo correspondente; "manter" é uma resposta válida e muda o que o bloco Editor faz
  naquela página (primitivos no código, em vez de conteúdo no editor). Mais três perguntas, se o relatório não
  as respondeu: (1) os combos/kits da loja são kits da Unbox? (chave `kits`; muda o bloco de kits); (2) a
  publicação vai pela CLI (`unbox provision/env/deploy/publish`) ou fica como está?; (3) pode rodar `npm install`
  nesta loja? (chave `npmInstall`; é código de terceiros com `postinstall` possível; a análise não instalou nada
  de propósito). Se o usuário já respondeu, não pergunte de novo. Cada decisão da análise traz a chave dela
  (`catalogoJson`, `paginasInstitucionais`, `blog`, `textoFrequencias`, `modoPrevia`, `redirects`,
  `assinatura029`, `checkout`, `privacidade`, `caminho`); use o mesmo nome no plano.
- Esta skill não commita nem cria branch por conta própria: entrega no fim a lista de commits sugeridos
  (mensagem com até 50 caracteres e os arquivos de cada um), e o usuário decide. `package-lock.json` muda no
  bloco do SDK e vai no commit dele.

## A meta que vale para todo bloco: a loja sai igual à que entrou

A migração troca a fiação, não a loja. Ao fim de cada bloco de interface, a página tem de bater com a
referência visual da análise (`~/.config/unbox/upgrade/<pasta>/antes/`): mesmas seções na mesma ordem, mesma
copy, mesmas imagens, mesmo comportamento em 1440 e 390. "Igual" é comparado captura contra captura (`npm run
unbox:qa` com `QA_OUT` apontando para `depois/`), não lido no código.

- **O layout é restrição; o gate do editor é meta** (é regra, não decisão: a chave `layoutVsGate` só tem o valor
  `fidelidade`). Quando embrulhar em primitivo exigiria mudar a estrutura
  de um componente (quebrar um grid, tirar uma animação, trocar uma lista dinâmica por contagem fixa que muda
  a tela), o layout ganha: o componente fica como está e entra no relatório como "sem primitivo, por
  fidelidade". Os 80% se buscam nos componentes que aceitam primitivo sem mudar de forma.
- **Nunca "melhore" ao portar.** Refazendo, as seções próprias, a PDP própria e o funil próprio vão para a
  pasta nova como estão, com os mesmos nomes; a adaptação é só de imports e de primitivos. Simplificar um
  componente de 1.500 linhas porque "o template faz parecido" é uma mudança de comportamento que o cliente não
  escolheu.
- **A única aparência que muda é a que o cliente escolheu.** O bloco "Mudanças de comportamento" da análise,
  respondido com "migrar", é a lista fechada do que pode ficar diferente (a conta nova da 0.29, o banner pelo
  otimizador, o botão sem seta, uma página que virou página do lojista). Fora dessa lista, diferença entre
  `antes/` e `depois/` é defeito, e o bloco não está pronto. A única exceção sem escolha do cliente é a troca de
  travessão que o gate da marca exige (ver "Regras que nenhum bloco quebra"), sempre registrada.
- **Sem referência, sem prova.** Se a análise não conseguiu capturar uma rota, diga no plano como ela será
  conferida (a loja no ar, o dono da loja olhando) em vez de assumir que ficou igual.

## Passo 1: o plano de execução (e a revisão dele), antes de tocar em qualquer arquivo

O relatório da análise diz o que há; o plano diz o que será feito com cada coisa, e é ele que o usuário
aprova. Escreva-o neste formato e **pare**: nenhum arquivo da loja muda até o usuário dizer que o plano
está bom. Se ele já pediu para "não iniciar ainda", o plano é a entrega da sessão.

```
# <loja>: plano de execução (<REFATORAR | REFAZER>, base <versão> → <versão atual>)
## Decisões do cliente  (cada uma com o bloco que a cumpre; a que não tem resposta bloqueia o bloco dela)
## Blocos, na ordem  (por bloco: o que entra e de onde vem [template | loja tal qual | loja adaptada | recriado];
   o grupo da análise que justifica [copiar, reaplicar, reescrita, removido_no_template, novo_na_loja];
   o critério de pronto [tsc, build com N rotas, gate X%, antes/ = depois/ nas rotas tais];
   o que o bloco NÃO toca)
## Lógica própria que muda de lugar  (cada arquivo de removido_no_template com loja_alterou, e onde renasce)
## Fidelidade  (rotas com referência; rotas sem referência e como serão conferidas; o que pode ficar diferente, por decisão)
## Ambiente  (variáveis que entram e saem, quem as grava)
## Riscos e o que pede o usuário  (npm install, credenciais, ordem página do lojista × rota de código)
```

Regras do plano: referencie os grupos da análise pelo nome em vez de relistar arquivos (o plano expande só o
que é decisão ou lógica recriada); todo bloco tem um critério de pronto verificável por comando; a ordem
respeita as dependências da seção seguinte (SDK antes da 0.29; página do lojista publicada antes de a rota de
código sair; marca antes das seções, refazendo). Cada decisão do cliente aparece com a chave dela.

**A forma de máquina do plano** (quando o prompt pedir; o modo esteira sempre pede): a mesma lista de blocos em
JSON, um array na ordem do markdown:

```json
[{ "n": 1, "titulo": "upgrade-template e cópias", "tipo": "copias",
   "criterio": ["tsc", "build", "hashes"], "rotas": [], "dependeDe": [], "perguntas": [] }]
```

- `n`: 1, 2, 3... na ordem do array, sem pular. `titulo`: texto curto.
- `tipo`: `copias` (só cópias e merges mecânicos), `merge` (merges com decisão, SDK, 0.29, kits, infra),
  `primitivos` (embrulhar componentes em primitivos sem mudar o layout), `reescrita` (porte ou reescrita grande)
  ou `editor` (um item por rota, ou por grupo pequeno de rotas, do bloco do editor).
- `criterio`: subconjunto de `tsc`, `build`, `hashes` (os arquivos travados abaixo), `rotas` (as rotas do build
  iguais às de antes, menos as removidas por decisão), `editor` (gate do editor), `fidelidade` (capturas contra a
  referência), `draft` (`check-subscription-draft`). Todo bloco tem `tsc`; do bloco de infra em diante, `build` e
  `hashes`; `editor` e `fidelidade` exigem `build`.
- `rotas`: as rotas que o bloco promete deixar iguais à referência (rota dinâmica como padrão,
  `/produto/[productSlug]`, ou como um exemplo que a referência capturou). `dependeDe`: os `n` de que depende.
  `perguntas`: as decisões ainda sem resposta que bloqueiam o bloco.
- Opcionais, listas de rotas começando com `/`, cada uma com o motivo no markdown: `removeRotas` (rota que deixa
  de existir por decisão), `foraDoEditor` (rota que continua no build mas sai da lista de páginas do editor) e
  `soChrome` (rota que entra em `SO_CHROME` além das do template, só por `references/editor.md` §2: texto legal,
  formulário, mecânica de compra). Sem estar aqui, rota que some ou página só com cabeçalho e rodapé é defeito.

**A revisão adversarial.** Antes de entregar o plano ao usuário, passe-o por um subagente que não escreveu
nada dele (um `Agent` novo, com o relatório da análise, as decisões do cliente, o plano e o caminho das
capturas; nada da sua conversa). O papel dele é achar o que vai dar errado, não opinar sobre estilo, e ele
responde a estas perguntas, cada resposta com arquivo e linha ou com "não achei":

1. Há decisão do cliente sem bloco que a cumpra, ou bloco que contradiz uma decisão?
2. Há arquivo da loja com lógica própria (`removido_no_template` com `loja_alterou`, `novo_na_loja` em
   `lib/unbox/`) que o plano apaga, sobrescreve ou deixa de citar sem dizer onde a lógica renasce?
3. Há bloco sem critério de pronto, ou com critério que não é checável por comando?
4. Há ordem errada (0.29 antes do SDK, rota saindo antes da página do lojista existir, `lib/unbox/` ainda na
   pasta quando `lib/unbox.ts` entra)?
5. Há rota da referência visual que nenhum bloco promete comparar, ou mudança de aparência prevista que não
   está na lista de decisões do cliente?
6. Há "melhoria" disfarçada: componente próprio que o plano manda simplificar, substituir pelo do template ou
   reescrever sem decisão do cliente?

Uma rodada só: incorpore o que procede, registre no plano o que não procede e por quê (uma linha por
objeção), e entregue. O revisor não aprova nem reprova; quem aprova é o usuário.

## Refazendo: os blocos

Quando a recomendação (e a escolha do cliente) é REFAZER, a ordem é outra, e cada bloco também termina em
`tsc --noEmit` limpo:

1. **Scaffold**: `unbox create <pasta> --nome "<nome da marca>" --slug <slug>` numa pasta nova (pergunte onde).
   O `--slug` é o `slug` da análise (`analyze-version --json`, o STORE_SLUG da loja antiga): sem ele, a loja
   nova pede ao editor o publicado de outra loja. O `--nome` é o nome que o cliente vê: o `nome` da análise,
   ou a `marca` dela quando o `nome` é um slug (`casa-aurora`); sem nenhum dos dois, confirme com o usuário.
   Credenciais pelo `unbox provision`, ou as que o usuário passar. Nada da loja antiga entra ainda.
2. **Marca**: `public/brand/`, as fontes de `app/layout.tsx`, os tokens de cor de `app/globals.css` (só os
   tokens, não o CSS inteiro), `marca/` e o briefing, `lib/editable/tokens.ts`.
3. **Redirects e infra própria**: os `redirects()` e `rewrites()` do `next.config.ts` antigo, `app/robots.ts`,
   as variáveis próprias do `.env.example` (as da família antiga da Unbox saem).
4. **Seções, páginas, PDP e lógica própria, tal qual**: as pastas da marca (`components/<marca>/`,
   `components/product/pdp/<marca>/`, `lib/<marca>/`, as seções próprias dentro de `components/home/sections`),
   as rotas próprias em `app/(loja)/`, com os imports reapontados para `@unbox-plus/sdk` e `@/lib/unbox` e
   registradas no `registry.ts` e em `CONTAINERS_POR_ROTA`, e a família de layout de cada seção própria no
   `familias.json` ao lado do `registry.ts`. Lógica que morava em `lib/unbox/` renasce em
   `lib/unbox.ts`. Analytics próprio vai para o `dataLayer` e os IDs para a foundation (`<Rastreio/>`).
5. **Editor**: igual ao bloco 6 do refatorar, com a regra de fidelidade.
6. **Comparação final**: `antes/` contra `depois/` em todas as rotas da referência.

O que é do template novo (conta, assinaturas, checkout, carrinho, chrome) fica como o `create` gerou, a menos
que a análise tenha marcado uma `reescrita` ali que o cliente decidiu manter.

## A ordem dos blocos, e por quê

O template atual é um só, mas a loja chega nele por blocos, e a ordem importa porque cada bloco é verificável
sozinho (`tsc --noEmit` limpo entre um e outro) e porque o seguinte depende do anterior compilar:

1. **SDK** (se a base é < 0.25.0): tudo o que vem depois importa de `@unbox-plus/sdk` e de `@/lib/unbox`.
2. **Versões intermediárias** (0.22 → 0.24, conforme a base): home em `PaginaInicial`, público, LPs, moldura.
3. **0.29 assinaturas**: depende do SDK `^0.4.0` ou mais.
4. **Kits** (só se forem kits da Unbox).
5. **Infra e docs**: `next.config.ts`, `.env.example`, `env-check`, `DEPLOY.md`, agentes, `CLAUDE.md`, e o `.claude/` (settings, agentes e as skills `migrar-loja-*` que o template passou a levar: entram como qualquer arquivo do template; `.claude/settings.json` costuma ser da loja).
6. **Editor**: rotas, colisões, vitrine, primitivos; é o bloco mais longo e o único com decisão por seção.

O que cada bloco contém por versão está em `MIGRACAO.md` do repo da CLI (a análise já imprime as fichas; o
arquivo inteiro está em https://github.com/unbox-plus/unbox-cli/blob/main/MIGRACAO.md), nas seções a partir
da versão-base, inclusive "Armadilhas"; não repita aquela lista de memória, ela é a fonte. Versão que só mexeu
na CLI (comando novo, flag, código de erro) não entra em bloco nenhum e não vai para o relatório final: a loja
não copia nada dela. O que muda a loja é o que esta skill executa.

## O primeiro passo é o comando

`npx --yes --package=@unbox-plus/cli@latest unbox upgrade-template --dir <loja> --dry-run` (ou, dentro do repo
da CLI, `node bin/unbox.js upgrade-template ...`) mostra o plano; sem `--dry-run` (com
`--yes`) ele aplica a parte mecânica: copiar direto, novos sem colisão, foundation intacta, remoções seguras,
`package.json` por chave e o carimbo. O que sobra fica em `~/.config/unbox/upgrade/<pasta>/` com `RELATORIO.md` e
a cópia do template atual (`atual/`) e, para os personalizados, da base (`base/`). Os blocos abaixo valem para o
que o comando deixou: nunca refaça à mão o que ele já fez, e nunca copie por cima do que ele deixou de fora.

## Como mexer em cada grupo de arquivo (vem da classificação da análise)

- **COPIAR DIRETO** e **NOVO NO TEMPLATE sem `colide`**: `cp` do `template/` do CLI atual, em lote,
  sem ler um por um; o script já provou que a loja não tocou neles. Depois do lote, `tsc --noEmit`. Um NOVO NO
  TEMPLATE que colide (a loja já tem arquivo com esse nome) é uma REESCRITA: leia os dois antes.
- **REAPLICAR**: copie o do template e reaplique o diff da loja (a análise mostra as linhas; veja o quê com
  `git diff --no-index ~/.config/unbox/upgrade/<pasta>/atual/<arq> <loja>/<arq>`). Quase sempre é um hook de preview, um import, um
  redirect, a remoção de um bloco. Nunca o contrário (manter o da loja e reaplicar o do template): o diff do
  template é o maior e você perderia parte dele. Exceção: `package.json` se funde por chave (`name`, `scripts`,
  `dependencies`, `devDependencies`), nunca por `cp`; o `name` da loja e os scripts próprios dela ficam.
- **REESCRITA**: a loja substituiu o arquivo. Leia o que o template trouxe ali desde a base (`MIGRACAO.md` diz) e
  decida se importa para esta loja. Se não importa (kits numa loja sem kits), só reaponte os imports. Se importa,
  a mudança entra NA VERSÃO DA LOJA do arquivo. Registre a decisão no relatório final.
- **REMOVIDO NO TEMPLATE com `loja_alterou: true`**: a lógica da loja tem de sobreviver em outro arquivo antes de
  apagar este. Leia o diff e recrie no lugar certo (`lib/unbox.ts` para integração; `MIGRACAO.md`, armadilhas da
  0.25.0).
- **SÓ A LOJA MUDOU** e **NOVO NA LOJA**: não toque, com duas exceções: o que mora em `lib/unbox/` sai de lá no
  bloco do SDK (senão `@/lib/unbox` fica ambíguo entre `lib/unbox.ts` e a pasta), e o que o bloco Editor pedir.
- **`lib/editable/*` e os gates `scripts/check-*`**: cópia byte a byte do template, sempre (lista completa em
  "Regras que nenhum bloco quebra"). O editor e a loja têm de ler o mesmo documento, e a correção entra por
  versão; um "ajuste" à mão aqui desliga o editor sem erro de build.

## Regras que nenhum bloco quebra

- **Arquivos travados.** Saem iguais, byte a byte, ao template da versão-alvo: `lib/editable/*`, menos
  `tokens.ts` (as cores editáveis) e menos o literal do `STORE_SLUG` em `config.ts`, que o `create` carimbou e é
  a única diferença esperada entre lojas; todos os `scripts/check-*.mjs` e `scripts/check-*.ts` (as seções
  próprias entram no medidor de receita pelo `familias.json` da pasta das seções da home, ao lado do
  `registry.ts`, não pelo script); e, no
  `package.json`, o valor de cada chave de `scripts` que o template define (as chaves próprias da loja ficam).
- **Proibido** para passar no typecheck ou no build: `@ts-nocheck`, `@ts-ignore`, `@ts-expect-error`,
  `ignoreBuildErrors`, `ignoreDuringBuilds`, desligar `strict`, tirar `app/`, `components/` ou `lib/` do
  `tsconfig`. Erro de tipo se conserta no código.
- **Travessão na copy reprovado pelo gate da marca:** troque pelo sinal que a frase pede (vírgula, dois-pontos ou
  ponto) e registre cada troca no relatório, "onde · antes → depois". Nunca edite o gate. É a única mudança de
  copy que não passa pelo cliente, e por isso vai listada para ele.

## Ambiente

Variáveis que entraram desde a base, no `.env.local` da loja e na hospedagem: `UNBOX_PARTNER_API_KEY` (0.22.0,
no lugar de `UNBOX_API_KEY`/`UNBOX_AUTH_URL`/`UNBOX_GRAPHQL_URL`/`UNBOX_CAPTCHA_BYPASS`, que saem),
`NEXT_PUBLIC_EDITOR_ORIGIN` (0.20.0, variável de BUILD), `NEXT_PUBLIC_ADMIN_ORIGIN` (0.29.0, idem). O `.env.example`
copiado do template lista todas; o `.env.local` você não lê nem edita (é segredo do usuário): diga quais faltam e
deixe com ele. Para a hospedagem, `unbox env` (0.29) grava o `.env.local` no projeto, se a publicação for pela CLI.

## Verificação depois de cada bloco

```bash
npm install                      # só depois do bloco SDK, com o ok do usuário (`npmInstall`; traz @unbox-plus/sdk; o lock muda)
npx tsc --noEmit                 # limpo antes de passar ao próximo bloco
npm run build                    # no fim dos blocos 1 a 5: mesmas rotas de antes; o prebuild roda os gates da loja
npx tsx scripts/check-subscription-draft.ts   # depois do bloco 0.29
npm run unbox:editavel           # bloco 6, com o servidor no ar e NEXT_PUBLIC_EDITOR_ORIGIN; saída 2 = não rodou
```

Faça o `build` de verdade, não apenas o typecheck: o `prebuild` da loja roda gates (marca, travessão,
placeholder, medidores) que o `tsc` não roda, e o `import "server-only"` de `lib/unbox.ts` só acusa import indevido
no build. `npm run unbox:test` (contra a API real) só com credenciais e com o ok do usuário: ele cria carrinho e
pedido de teste. Sem credenciais, uma loja com modo preview/fake próprio serve para o gate do editor rodar,
porque o client falso entrega o catálogo.

## O bloco do editor

As regras do que vira primitivo, do que não vira, de como declarar rotas e de como tratar dado da API estão em
`references/editor.md`. Leia antes de abrir o primeiro componente. A ordem dentro do bloco é a ordem em que o
gate para: rotas sem declaração, coleção em colisão, vitrine ignorada, deriva da foundation, e só então os
componentes sem primitivo, um por um, do mais visto (home, header, footer) para o menos.

Para cada componente, a conta é simples: o gate mede texto visível e imagem dentro de `[data-editor-path]`. Um
componente de 80 linhas com 12 strings e 3 imagens precisa de ~15 primitivos, cada um com `path` próprio dentro
da seção e o valor atual como `fallback`. Não invente conteúdo e não mude a copy ao embrulhar: a loja tem de
sair da migração pixel a pixel igual, só que editável. Copy que hoje mora em JSON (`lib/brand/*.json`) continua lá
e vira o `fallback`.

## O relatório final

```
# <loja>: migrada de <base> para <versão atual>
## Feito, por bloco  (arquivos copiados, reaplicados, reescritas e a decisão de cada uma, lógica recriada)
## Verificação  (typecheck, build com N rotas, gates, unbox:editavel por página com a cobertura)
## Fidelidade  (rotas comparadas antes/ × depois/ e o resultado; diferenças, cada uma ligada à decisão do cliente que a autoriza; componentes deixados sem primitivo por fidelidade)
## Ambiente  (variáveis que faltam no .env.local e na hospedagem)
## O que ficou de fora e por quê  (kits, publicação pela CLI, o que depende do usuário)
## Commits sugeridos  (mensagem ≤ 50 caracteres + arquivos; nenhum feito)
```

Não escreva o histórico da migração no `CHANGELOG.md` do CLI nem no `CLAUDE.md` da loja; o relatório é o
registro. Se encontrar uma armadilha nova, acrescente-a em `MIGRACAO.md` do repo da CLI (um PR em
https://github.com/unbox-plus/unbox-cli), na versão em que ela nasce: é assim que a próxima loja não paga por ela
de novo.

## Modo esteira

Esta seção só vale quando o prompt diz que a sessão roda em modo esteira: sem humano na conversa, com um
orquestrador em volta que guarda as decisões padrão, roda os comandos, commita e verifica cada bloco. Fora disso,
ignore-a; o resto da skill vale igual nos dois modos, e quando os dois divergem, esta seção vence.

- **Decisão:** consulte a diretriz pela chave na ferramenta de decisão do orquestrador; se ela responde, siga e
  registre que a origem foi a diretriz. Se não responde, ou se o ponto não tem chave (layout próprio de PDP ou
  categoria, "duas leituras", campo do catálogo que talvez exista no painel), abra a pergunta pela mesma
  ferramenta; o bloco que depende dela fica com o id da pergunta em `perguntas`. Nunca decida sozinho o que tem
  chave. A publicação pela CLI não é pergunta: provision, deploy e publish são do orquestrador.
- **"Pare até o usuário aprovar o plano":** entregue o plano (markdown e a forma de máquina do Passo 1) nos
  arquivos que o prompt pedir e encerre a sessão; a aprovação acontece fora dela. A revisão adversarial é outra
  sessão, que o orquestrador abre.
- **Commits:** não commite nem crie branch. Descreva o que o bloco fez no documento do bloco, no arquivo de estado
  da fase; quem commita é o orquestrador. Do git, só leitura (status, diff, log, show); para apagar ou mover, `rm`
  e `mv` comuns.
- **A CLI:** não rode `npx ... unbox` nem `node bin/unbox.js`: o orquestrador roda a análise e o
  `upgrade-template` com a CLI pinada. A fonte dos `cp` é a pasta que o `upgrade-template` informou (a cópia do
  template atual fica ali, em `atual/`, só com os pendentes) ou o caminho do template da versão-alvo que o prompt
  der.
- **O que já vem pronto:** árvore limpa, `git init` e a pasta da loja nova ao refazer vêm garantidos ou no prompt.
- **`.env.local`:** não leia. O que faltar vai para a seção "Ambiente" do documento do bloco; o orquestrador
  preenche.
- **Comandos que só o orquestrador roda:** build, servidor, gate do editor (`unbox:editavel`), capturas
  (`unbox:qa`) e `check-subscription-draft`, pelos meios que ele oferecer. Nunca `unbox:test`, `unbox:order:*`,
  `unbox:webhook:*` nem `unbox:abandoned`.
- **Sem decisão possível na sessão:** rota sem referência visual é "sem prova", com o motivo; página que viraria
  página do lojista fica em código, com primitivos, e passa no gate (vira pendência do lojista); campo do
  catálogo sem par no painel vira primitivo com o JSON como `fallback` (pendência).
- **Armadilha nova:** registre pela ferramenta do orquestrador, dizendo se parece defeito da CLI ou do template
  (aí ela vai se repetir nas outras lojas da mesma versão-base), em vez de propor PR.
- **Relatório:** no arquivo que o prompt pedir, sem travessão, com as trocas de travessão e as pendências do
  lojista listadas.
- **Fim:** encerre a sessão pelo meio que o orquestrador indicar, dizendo se o trabalho ficou pronto ou
  bloqueado e por quê. Comando recusado pelo orquestrador é regra: não procure outro caminho para o mesmo efeito.
