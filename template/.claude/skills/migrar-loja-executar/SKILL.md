---
name: migrar-loja-executar
description: Executa a migração de uma loja ANTIGA (gerada por uma versão anterior do @unbox-plus/cli) para o template atual, a partir do relatório da skill migrar-loja-analisar; traz o SDK (@unbox-plus/sdk), as versões intermediárias, a edição de assinatura da 0.29 e deixa a loja antiga pronta para o editor (gate unbox:editavel em 80%). Use quando o usuário disser "migra a loja", "atualiza a loja para a CLI nova", "traz o SDK para a loja X", "faz a migração que você analisou", ou pedir qualquer bloco disso numa loja antiga (só o SDK, só o editor, só a 0.29). Não é para loja recém-gerada que só precisa subir a cobertura do editor, nem para mexer no template do CLI. Se ainda não houver análise, rode a migrar-loja-analisar antes: esta skill parte dos números dela.
---

# Executar a migração de uma loja antiga

Pré-requisito: o relatório da `migrar-loja-analisar` (versão-base, classificação dos arquivos, auditoria do
editor, recomendação). Se não existir, rode-a primeiro; se a recomendação for REFAZER, esta skill não se aplica
(o caminho é `unbox create` + portar a marca, e `references/editor.md` vale lá também).

## Passo 0: antes de tocar em qualquer arquivo

- **Árvore limpa.** `git status --porcelain` na loja tem de vir vazio. Os lotes de `cp` abaixo (dezenas de
  arquivos, incluindo `CLAUDE.md`, `lib/config.ts`, `agents/`) são irreversíveis sem um ponto de retorno; com
  trabalho não commitado, pare e peça ao usuário para commitar ou guardar (`git stash`). Loja sem git: peça um
  `git init && git add -A && git commit` antes, ou uma cópia da pasta.
- **As decisões do relatório.** O bloco "Mudanças de comportamento" da análise lista escolhas (catálogo em
  JSON: migrar para a API ou manter; páginas institucionais e blog: virar páginas do lojista ou ficar em
  código; combos, preview fake, rótulos por índice). Cada uma tem de estar respondida pelo usuário antes de
  você tocar no arquivo correspondente; "manter" é uma resposta válida e muda o que o bloco Editor faz
  naquela página (primitivos no código, em vez de conteúdo no editor). Mais três perguntas, se o relatório não
  as respondeu: (1) os combos/kits da loja são kits da Unbox? (muda o bloco de kits); (2) a publicação vai pela
  CLI (`unbox provision/env/deploy/publish`) ou fica como está?; (3) pode rodar `npm install` nesta loja? (é
  código de terceiros com `postinstall` possível; a análise não instalou nada de propósito). Se o usuário já
  respondeu, não pergunte de novo.
- Esta skill não commita nem cria branch por conta própria: entrega no fim a lista de commits sugeridos
  (mensagem com até 50 caracteres e os arquivos de cada um), e o usuário decide. `package-lock.json` muda no
  bloco do SDK e vai no commit dele.

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
da versão-base, inclusive "Armadilhas"; não repita aquela lista de memória, ela é a fonte.

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
- **`lib/editable/*` e `scripts/check-editable.mjs`**: cópia byte a byte do template, sempre. O editor e a loja
  têm de ler o mesmo documento, e a correção entra por versão; um "ajuste" à mão aqui desliga o editor sem erro
  de build. `lib/editable/tokens.ts` (as cores editáveis) é a única exceção; `lib/editable/config.ts` só carrega
  o slug carimbado e não muda na migração.

## Ambiente

Variáveis que entraram desde a base, no `.env.local` da loja e na hospedagem: `UNBOX_PARTNER_API_KEY` (0.22.0,
no lugar de `UNBOX_API_KEY`/`UNBOX_AUTH_URL`/`UNBOX_GRAPHQL_URL`/`UNBOX_CAPTCHA_BYPASS`, que saem),
`NEXT_PUBLIC_EDITOR_ORIGIN` (0.20.0, variável de BUILD), `NEXT_PUBLIC_ADMIN_ORIGIN` (0.29.0, idem). O `.env.example`
copiado do template lista todas; o `.env.local` você não lê nem edita (é segredo do usuário): diga quais faltam e
deixe com ele. Para a hospedagem, `unbox env` (0.29) grava o `.env.local` no projeto, se a publicação for pela CLI.

## Verificação depois de cada bloco

```bash
npm install                      # só depois do bloco SDK, com o ok do usuário (traz @unbox-plus/sdk; o lock muda)
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
## Ambiente  (variáveis que faltam no .env.local e na hospedagem)
## O que ficou de fora e por quê  (kits, publicação pela CLI, o que depende do usuário)
## Commits sugeridos  (mensagem ≤ 50 caracteres + arquivos; nenhum feito)
```

Não escreva o histórico da migração no `CHANGELOG.md` do CLI nem no `CLAUDE.md` da loja; o relatório é o
registro. Se encontrar uma armadilha nova, acrescente-a em `MIGRACAO.md` do repo da CLI (um PR em
https://github.com/unbox-plus/unbox-cli), na versão em que ela nasce: é assim que a próxima loja não paga por ela
de novo.
