---
name: migrar-loja-analisar
description: Analisa UMA loja clonada localmente que foi gerada por uma versão antiga do @unbox-plus/cli (create-unbox-store / unbox create) e diz qual versão a gerou, o que falta para chegar ao template atual (SDK, assinaturas, editor) e se compensa refatorar ou refazer a loja com o CLI novo. Use sempre que o usuário apontar uma pasta ou repo de loja e pedir para "avaliar a migração", "ver o que falta para atualizar", "quanto custa atualizar a loja X", "a loja está desatualizada", "dá para usar o editor nessa loja", "compensa regerar?", ou perguntar o que mudou no CLI desde que a loja foi criada, mesmo sem dizer "migrar". Só analisa e recomenda; a execução é a skill migrar-loja-executar. Para listar a versão de TODAS as lojas de um token do GitHub sem clonar, o caminho é tools/cli-version-lojas.sh do repo da CLI, não esta skill.
---

# Analisar uma loja antiga da CLI

A loja gerada é uma CÓPIA do `template/` do CLI na versão que a criou, mais o que o time e os agentes escreveram
por cima. Não há `git merge` possível: a loja não tem o histórico do template. Então "migrar" é, arquivo a arquivo,
decidir entre copiar o do template atual, reaplicar a mudança da loja sobre ele, ou manter o da loja. Esta skill
faz o levantamento que torna essa decisão mecânica, e no fim diz se o trabalho cabe numa refatoração ou se é mais
barato gerar a loja de novo com `unbox create` e portar a marca.

## Passo 1: rodar o comando (sempre; nunca estime à mão)

```bash
npx --yes --package=@unbox-plus/cli@latest unbox analyze-version --dir <pasta-da-loja> [--base <versão>] [--base-template <pasta>] [--json]
```

(Se você estiver dentro do repositório da CLI, `node bin/unbox.js analyze-version ...` compara com o `template/`
desta árvore, o que permite analisar contra uma versão ainda não publicada; pelo `npx` o "atual" é a última
versão no npm.) O comando só lê, não instala nada na loja e não precisa de credenciais. O template da base
vem do npm e fica em cache em `~/.config/unbox/templates/`; para uma base sem pacote no npm (anterior a 0.21.3)
ou sem rede, extraia-o do git da CLI (`git archive <tag> template | tar -x -C <pasta>`) e passe
`--base-template <pasta>/template`. Loja ainda não clonada: clone num diretório vazio próprio; é código de
terceiros, nada de `npm install` ou build durante a análise.

Como ler cada bloco da saída (`--json` tem os mesmos dados, com estes nomes):

1. **Versão-base** (`base.versao`, `base.fonte`): o carimbo `unbox.templateVersion` do `package.json` (lojas da
   0.30.0 em diante) ou, antes dele, os marcadores de `src/version-markers.json`. "Lacunas" são marcadores
   anteriores que faltam. **Loja sincronizada à mão engana o marcador**: confira com o primeiro commit
   (`git log --reverse --format='%ad %s' | head -1`, "scaffold: create-unbox-store ..."); se ele disser outra
   versão, rode de novo com `--base <versão>`.
2. **Arquivos** (`grupos`), cada um contra template@base e template@atual, já com o nome da loja aplicado ao
   template (o que o `create` troca não vira conflito):
   - `copiar`: o template mudou, a loja não tocou. Zero decisão; o `upgrade-template` aplica.
   - `reaplicar`: os dois mudaram, e a mudança da loja é pequena (≤ 20 linhas ou < 1/4 da do template). O
     `upgrade-template` deixa a cópia do atual ao lado para você copiar e reaplicar o diff da loja.
   - `reescrita`: os dois mudaram, e a da loja é a maior. Decisão por arquivo: o que o template trouxe ali
     importa para esta loja? `MIGRACAO.md` diz o que entrou em cada versão.
   - `personalizado`: o `create` reescreveu (tokens, receitas, slug, segredo); o diff base→atual do template é o
     que se reaplica.
   - `removido_no_template` com `loja_alterou` ou `bloqueado`: lógica da loja num arquivo (ou pasta) que o
     template apagou. Recriar em outro lugar antes de apagar (o caso clássico é `lib/unbox/` no SDK).
   - `novo_no_template` com `colide`: a loja já tem o caminho ou uma pasta homônima (`lib/unbox.ts` × `lib/unbox/`).
3. **Editor** (`editor`): cada linha é um item do Passo 4.
4. **Mudanças de comportamento** (`editor.catalogo_duplicado_no_repo`, `editor.rotas_proprias`): Passo 5.
5. **Régua** (`regua`, `numeros`): Passo 3.
6. **Fichas** (`fichas`, `ambiente`): o que mudou no TEMPLATE entre a base e a atual, por versão. Versão que
   só mexeu na CLI não tem o que a loja copie, e a ficha dela diz isso em uma linha.

O que o comando não vê, e você lê: por que a loja reescreveu (`git diff --no-index` entre o template da base e a
loja), se há um modo "fake/preview/mock" próprio (`previewEnabled`, `mockupOr`, `UNBOX_PREVIEW`), e se os
combos da loja são kits da Unbox (pergunte ao usuário; muda o bloco de kits).

**A referência visual.** A meta da migração, nos dois caminhos, é a loja sair igual à que entrou: mesmas
seções na mesma ordem, mesma copy, mesmas imagens, mesmo comportamento nos dois breakpoints. Isso só é
checável se a loja de antes estiver registrada, e o registro tem de ser feito AGORA, antes de qualquer
mudança. Rode a loja antiga como ela está (sem `npm install` novo; se precisar de credenciais e não houver, a
loja no ar serve de base) e capture as rotas principais em 1440 e 390: a loja tem `npm run unbox:qa`
(`scripts/qa-screenshots.mjs`, com `QA_PDP=/produto/<slug>` para a PDP) e você acrescenta ao plano dele as
rotas próprias (`rotas_proprias` do comando). Guarde as capturas fora da loja (`~/.config/unbox/upgrade/<pasta>/antes/`)
e liste no relatório o que foi capturado e o que não deu para capturar. Sem essa referência, a `executar` não
tem como provar fidelidade, e o revisor dela não tem contra o que comparar.

## Passo 2: o que mudou entre a versão-base e o template atual

O comando já imprime as fichas de `MIGRACAO.md` entre a base e a atual; quando precisar do detalhe, abra o arquivo
(raiz do repo da CLI, ou https://github.com/unbox-plus/unbox-cli/blob/main/MIGRACAO.md). Cada versão lista o que entrou no
template, o que a loja já gerada tem de fazer e as armadilhas que não estão no CHANGELOG. É isso que transforma
`REESCRITA` em decisão informada. Para confirmar um detalhe, o `CHANGELOG.md` do CLI é a fonte;
`git diff --stat <tag> HEAD -- template` mostra o tamanho por arquivo, e
`git log --format='%h %ad %s' --date=short <tag>..HEAD -- template/<arquivo>` diz em que versão cada mudança entrou.

**Só entra no relatório o que chega na loja**: arquivo do template, variável de ambiente, dependência e o que o
lojista ou o cliente passa a ver. O `CHANGELOG.md` mistura isso com o que é só da CLI (comando novo, flag nova,
código de erro, saída `--json`, refatoração interna), e essa parte não é migração: uma loja no ar não copia nada
dela e ela vale igual antes e depois. Se uma versão entre a base e a atual for só de CLI, não abra um item para
ela no relatório, nem a cite como pendência; `MIGRACAO.md` é o filtro pronto (a ficha de uma versão assim diz
"nada" em "Loja já gerada"), e `git diff --name-only <tag> HEAD -- template` confirma em caso de dúvida. A
exceção é o comando que muda COMO a migração é feita (`unbox analyze-version`, `unbox upgrade-template`): ele
aparece no passo em que se usa, nunca como coisa a migrar.

## Passo 3: refatorar ou refazer (a régua de corte)

Refazer = `unbox create` numa pasta nova com a versão atual, e portar: `public/brand/`, as fontes, os tokens de
cor do `globals.css`, `marca/` e o briefing, os redirects do `next.config.ts`, e as seções próprias, reescritas
com primitivos desde o início. Refatorar = o merge arquivo a arquivo do Passo 2. Os dois caminhos terminam no
mesmo lugar (template atual + marca + editor passando no gate); a régua escolhe o mais barato, e existe para que
duas pessoas cheguem à mesma resposta na mesma loja.

**Corte duro, pela versão-base: abaixo de 0.22.0, refazer.** Três razões, todas medidas no CLI:

- A 0.22.0 trocou a API inteira: três endereços viraram um, 13 arquivos de integração, variáveis de ambiente com
  outro nome, o captcha saiu, dez chamadas mudaram de assinatura. O que a loja escreveu contra `lib/unbox/*`
  antigo está contra uma API que não existe mais.
- Entre 0.21.0 e 0.22.0 há dez versões de conserto, cada uma trocando de 1 a 20 arquivos, nos mesmos arquivos.
  Abaixo de 0.21.0 o próprio CHANGELOG diz: "dá para trazer os arquivos, mas é mais barato regerar". Abaixo de
  0.20.0 não existe editor: a fiação são 21 pontos, nenhum no código da loja.
- Distância até o template atual, medida pelo script (`fracao_do_template_mudada` de um template puro de cada
  versão): 0.22.0 = 0,44; 0.21.3 = 0,50; 0.20.1 = 0,64; 0.17.1 = 0,74. Esse número mede o salto de versão, não a
  loja; é por isso que ele entra só aqui, no corte duro, e não na tabela abaixo.

**De 0.22.0 em diante, refatorar por padrão**, a menos que a loja some **três ou mais** destes sinais (os nomes
são os de `numeros`, e todos medem a LOJA, não a versão; `regua.sinais` já traz cada um avaliado):

| Sinal | Por que empurra para refazer |
|---|---|
| `reescrita` ≥ 10 | a loja reescreveu dez arquivos que o template também mudou; cada um é um merge manual |
| `fracao_em_conflito` ≥ 0,4 | de tudo o que o template mudou, 40% ou mais tem mudança da loja por cima: o "copiar em lote" deixou de ser a maior parte |
| `foundation_editada_a_mao` > 0 | alguém editou `lib/editable/` ou o gate à mão (difere do template da própria base); o documento publicado pode não bater com a foundation, e o editor falha em silêncio |
| `integracao_com_logica_propria` ≥ 1 e base < 0.25.0 | arquivo novo ou mais de 20 linhas da loja em `lib/unbox/`, que o SDK apaga; recriar é reescrever |
| `sem_primitivo` ≥ 30 e `rotas_sem_declaracao` ≥ 8 | embrulhar tudo em primitivos e declarar rotas é o mesmo trabalho que escrever as seções sobre o template novo |

Dois sinais ou menos: refatorar. Quando der 3 por pouco (um sinal no limite), diga isso ao usuário com os
números em vez de decidir sozinho. Ponha o custo estimado dos dois caminhos ao lado da recomendação
(`MIGRACAO.md` do repo da CLI, "Custo por salto").

**Os dois caminhos têm a mesma meta de layout.** "Refazer" não é licença para a loja ficar com a cara do
template: a marca, as seções próprias, a PDP própria e o funil próprio são portados como estão, e o resultado
tem de bater com a referência visual do Passo 1. O que muda de aparência de propósito é só o que o cliente
escolheu migrar no Passo 5 (a conta nova da 0.29, o banner pelo otimizador, o botão sem seta). Diga isso na
recomendação, com a lista do que será portado tal qual (nomes das pastas: `components/<marca>/`,
`components/product/pdp/<marca>/`, `lib/<marca>/`), para o custo de "refazer" incluir o porte e não só o
scaffold.

## Passo 4: editor (meta de 80% do `unbox:editavel`)

As regras do gate, do que vira primitivo e do dado que vem da API estão em
`../migrar-loja-executar/references/editor.md`; leia a seção 1 antes de escrever esta parte do relatório. O que
o script entrega, na ordem em que o gate para (e que o relatório deve seguir):

1. `rotas_sem_declaracao`: cada uma entra em `CONTAINERS_POR_ROTA` ou em `SO_CHROME` (editor.md §2). Se
   `lib/rotas-editaveis.ts` está "ausente", a loja é anterior ao editor ou o apagou: tudo o que vem depois
   depende de ele voltar.
2. `colecoes_em_colisao`: coleção do lojista com o nome de um segmento que o código ocupa (editor.md §2).
3. `vitrine_ignorada`: a escolha de produto do lojista não chega à home (editor.md §4).
4. `foundation_editada_a_mao`: copiar o do template atual, nunca corrigir à mão. `foundation_desatualizada` é só
   cópia (já está em COPIAR DIRETO).
5. `sem_primitivo`: a lista é o trabalho. Para cada arquivo, o que vira e o que não vira (editor.md §3). Copy em
   JSON do repositório vira o `fallback` do primitivo.
6. `html_cru_sem_sanitize`: `dangerouslySetInnerHTML` fora de `lib/sanitize.ts`. O script diz a origem provável;
   com HTML de JSON do repositório é má prática, com HTML da API é XSS (editor.md §4).

A confusão mais comum nesta etapa é o dado que vem da API: embrulhar o título do produto num `Editable.Text`
"sobe a cobertura" e cria duas fontes para o mesmo dado (editor e painel da Unbox). O gate não conta dado de
catálogo como falta. Na migração, dado de produto volta para a API; a prosa da marca em volta dele é o que vira
primitivo.

## Passo 5: mudanças de comportamento (a escolha é do dono da loja, não sua)

Migrar não é só trocar arquivo: em alguns pontos a loja antiga FAZ algo diferente do template, de propósito ou
por atalho, e trazê-la ao template muda o que o lojista e o cliente veem. Cada um desses pontos entra no
relatório como uma escolha com dois lados escritos, porque quem decide é quem conhece o negócio, e ele só decide
bem se souber o que perde em cada caminho. O comando levanta os dois casos mais comuns (bloco "Mudanças de comportamento"); os outros você acha lendo as
`reescrita`.

**Catálogo duplicado no repositório** (`catalogo_duplicado_no_repo`): um JSON com título, descrição, variantes,
preço ou ingredientes de produto, misturado com o dado da API nas páginas (um `catalogProduct()` que faz
`{...jsonProduct, price: api.price}` é a assinatura). Hoje a página de produto é, na prática, hard-coded: muda a
descrição no painel da Unbox e a loja não muda; produto novo no painel não aparece até alguém editar o JSON.
Escreva as duas opções:
- *Migrar*: dado de produto passa a vir da API (sanitizado por `lib/sanitize.ts`, nunca em primitivo). O que se
  perde: todo campo do JSON que a API não tem (ingredientes, tabela nutricional, alérgenos, texto de conservação,
  `imageKinds`, ordem de fotos) some da página, a menos que vire prosa da marca em primitivo (com o JSON como
  `fallback`) ou vá para o painel como campo do produto. Liste esses campos, um a um; é o custo real.
- *Manter*: a página continua lendo o JSON, o painel segue sem ser a fonte, e o produto novo exige deploy.
  Funciona, mas o relatório tem de dizer que o editor e o painel não alcançam esse conteúdo.
Não recomende um lado por padrão; diga o que cada um implica e pergunte.

**Rotas próprias de prosa** (`rotas_proprias` com "candidata a página do lojista"): páginas institucionais em
código (sobre, sustentabilidade, imprensa, parceiros, onde encontrar) e blog em código (lista + artigo). O
template serve exatamente isso pelo editor (`/paginas/<endereço>`, coleções e artigos), 100% editável e sem
deploy. As duas opções:
- *Migrar*: a página vira página do lojista (ou o blog vira coleção), o código sai, o conteúdo é portado uma vez
  para o documento do editor. O que se perde: layout próprio que não exista como seção do catálogo (grid
  específico, animação, quiz), e qualquer dado que a página lia de JSON. A vitrine de produtos se mantém como
  seção `vitrine-de-produtos`.
- *Manter*: a página fica em código, entra em `CONTAINERS_POR_ROTA` com um container próprio e precisa de
  primitivos em cada texto e foto para passar no gate; novo texto continua exigindo deploy.
Para o blog em código, há um terceiro dado que força a decisão: se a coleção do lojista colide com a rota
(`colecoes_em_colisao`), "manter" obriga a renomear a coleção.

Outros pontos que costumam aparecer e entram do mesmo jeito (os dois lados escritos): rótulos de frequência de
assinatura por índice em vez de `title` da API; combos próprios (um produto com N unidades repartidas no front)
que não são kits da Unbox; modo "preview/fake" que liga sem credenciais; redirects antigos; página de produto
ou categoria com layout próprio que substitui `pdp-view`/`catalog-client` (se perde o espelho da categoria e o
"+ Adicionar seção" do editor nessas páginas).

## O relatório

Entregue em texto, nesta ordem, com os números do script ao lado de cada afirmação. A versão exata e os nomes
de arquivo importam porque o relatório é a entrada da `migrar-loja-executar` e da decisão do dono da loja;
"0.2x" ou "muitos arquivos" não servem para nenhum dos dois.

```
# <loja>: migração para <versão atual da CLI>
## Versão-base: <versão> (scaffold em <data do primeiro commit>; lacunas: <...>; --base usado? por quê)
## O que mudou no template desde então  (tabela por versão: o que entrou, arquivos, importa para esta loja?; versão só de CLI fica de fora)
## O que a loja mudou  (REAPLICAR com os diffs; REESCRITA com o motivo de cada reescrita; lógica própria em arquivo removido)
## Recomendação: REFATORAR | REFAZER  (corte duro; os sinais somados com os números; custo estimado dos dois caminhos)
## Referência visual  (rotas capturadas em 1440 e 390 e onde estão; o que não deu para capturar e por quê; o que será portado tal qual)
## Plano por bloco  (SDK / versões intermediárias / 0.29 assinaturas / kits se houver / infra e docs / editor; refazendo: create / marca / redirects / seções e PDP próprias / editor)
## Editor: o que o gate reprova hoje, na ordem em que para; depois os componentes sem primitivo com o que vira e o que não vira
## Mudanças de comportamento  (uma por item: o que a loja faz hoje · Migrar: o que muda e o que se perde · Manter: o que não se ganha)
## O que precisa de decisão do usuário  (cada mudança de comportamento acima, mais: kits? publicação pela CLI?)
```

O bloco "Mudanças de comportamento" é o que o dono da loja lê; escreva-o sem jargão de arquivo (o nome do JSON
pode aparecer, o nome da função não) e com o que se perde em termos de página: "a tabela nutricional de cada
produto deixa de aparecer até existir no painel", não "o campo `nutritionHtml` sai do `BrandProduct`".

Esta skill não executa nada da migração, não cria branch nem commita. Se o usuário quiser seguir, a
`migrar-loja-executar` parte deste relatório (e começa pelo `unbox upgrade-template`).
