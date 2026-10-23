# unbox (@unbox-plus/cli) · código-fonte (v0.26.0)

Este repositório é o **repositório de trabalho**, não o artefato de uso. Quem só quer gerar loja
roda o pacote publicado: `npx --package=@unbox-plus/cli unbox create`.

```bash
npm install                 # prompts, @unbox-plus/sdk e @next/env; o resto é do template
node bin/unbox.js --help    # roda a CLI daqui, sem empacotar
npm test                    # node:test, sem dependência (ver "Os testes")
npm pack                    # gera o tarball (o prepack roda o gate de neutralidade antes)
```

## O mapa

| pasta | o que é |
|---|---|
| `bin/unbox.js` | o binário `unbox`: só chama `src/main.js` |
| `bin/cli.js` | o binário antigo, `create-unbox-store`: avisa em stderr que o padrão é `unbox create` e roda o mesmo create |
| `src/main.js` | o despachante: flags globais, registro de comandos, ajuda, códigos de saída |
| `src/commands/create.js` | o wizard: perguntas, cópia do template, `.env.local`, `.mcp.json`, briefing |
| `src/args.js` | o parser de argumentos (sem dependência); as globais saem de qualquer posição |
| `src/output.js` | texto x `--json` (um objeto em stdout) e o filtro que tira credencial da saída |
| `src/env.js` | o `.env` do projeto: `envValue` (quem escreve) e `loadProjectEnv` (quem lê, com o `@next/env`) |
| `src/partner-api.js` | a conexão com a Partners API: camada fina sobre o `@unbox-plus/sdk`, traduz a recusa num `code` e numa mensagem |
| `src/paths.js` | onde o pacote mora no disco (`TEMPLATE_DIR`) |
| `src/` (o resto) | presets de estilo (`presets.js`), aplicação de tokens e receitas (`theme.js`), cor (`colors.js`) |
| `test/` | `node:test`; fora do tarball, público no GitHub (o gate varre) |
| `template/` | **a foundation**: o projeto Next.js que vira a loja. É o grosso do repositório |
| `tools/` | ferramentas do nosso lado, que NÃO vão para a loja gerada |

E um repositório a mais, fora deste: **[`unbox-sdk`](https://github.com/unbox-plus/unbox-sdk)**, o
pacote `@unbox-plus/sdk`, que é toda a conversa com a API de parceiros. Da v0.25.0 em diante o
template não tem mais `lib/unbox/*.ts`: ele declara o pacote como dependência e amarra o ambiente
a ele em `lib/unbox.ts`, um arquivo só. É o que faz a atualização de uma loja no ar caber num bump
de versão do `package.json` dela. Da v0.26.0 em diante a própria CLI também depende dele
(`src/partner-api.js`): signIn, cabeçalhos e renovação de token moram num lugar só.

## Comando novo no `unbox`

1. `src/commands/<nome>.js` exportando `help` (texto) e uma função que recebe
   `(args, globals, { out })`. `globals` traz `json`, `yes`, `dir` e `env-file`; `out` é a saída
   (`progress`, `warn`, `result`, `fail`).
2. Uma linha no `COMMANDS` de `src/main.js`. Só o que está no registro aparece no `--help`.
3. Credencial: `loadProjectEnv` + `requireCredentials` + `describeOrigins` (src/env.js), e só
   depois `createPartnerApi` (src/partner-api.js). Nessa ordem, a falta de credencial nunca chega
   ao SDK, que diria "modo mockup".
4. Erro de uso é `UsageError` (sai com 2), falha da operação é `CliError` (sai com 1). Nada de
   `process.exit` no comando: o despachante usa `process.exitCode`, que não corta o JSON num pipe.
5. Texto impresso sem travessão (o `test/sem-travessao.test.js` cobra os arquivos novos).

## Os testes

`npm test` roda `node --test test/*.test.js`.

- `create.test.js` é a regressão do scaffold: gera a loja com o código ANTERIOR (tirado do git,
  `git merge-base HEAD develop`, ou `UNBOX_BASE_REF=<ref>`) e com o atual, pelas duas entradas, e
  compara a árvore byte a byte. O wizard é respondido por `test/helpers/inject.mjs`
  (`prompts.inject`), então credenciais, `.mcp.json` e checkout hospedado também são comparados.
  Sem git ou sem `develop` (um checkout raso de CI, por exemplo), ele é pulado dizendo o motivo.
- `partner-api.test.js` usa o SDK de verdade com um `fetch` falso, e as respostas de erro são as
  medidas no stage (api key recusada, `INVALID_CREDENTIALS_ERROR`, 403 do gateway).

## Mexer na CLI contra um SDK que ainda não foi publicado

```bash
npm install ../unbox-sdk        # grava file:../unbox-sdk no package.json e no lock
npm test
npm install @unbox-plus/sdk@^X.Y.Z   # volta para a versão publicada ANTES de commitar
```

O `prepack` recusa empacotar com `file:` ou `"link": true` no `package.json` ou no lock: publicado
assim, o `npx` de quem gera loja procuraria uma pasta da máquina de quem empacotou.

## Mexer no template contra um SDK que ainda não foi publicado

O `template/package.json` aponta para a versão publicada (`^0.4.0`), então rodar `npm install`
dentro de `template/` só funciona depois que o pacote está no registro. Para testar a foundation
contra um SDK local, enquanto ele ainda está em desenvolvimento:

```bash
cd template
npm install @unbox-plus/sdk    # grava @unbox-plus/sdk no package.json
npm run typecheck && npm run build
git checkout package.json      # devolve o ^0.4.0 ANTES de commitar
rm -rf node_modules            # ver abaixo
```

**Apague o `template/node_modules` antes de empacotar.** O `files` do `package.json` leva
`template` inteiro, e o npm só ignora o `node_modules` da RAIZ: um install feito ali dentro
viajaria no tarball público, com as dependências da sua máquina dentro da loja de quem gera. O
gate do `prepack` recusa dizendo isso, mas é mais barato não chegar lá.

## `tools/`, que é o que faltava no zip anterior

| arquivo | o que faz |
|---|---|
| `check-template-neutro.mjs` | gate do `prepack`: bloqueia o empacotamento se a foundation tiver vocabulário de um ramo específico ou nome de cliente, comentário incluído. Também reprova travessão no texto que o wizard imprime e dependência local (`file:`) no `package.json` |
| `partner-api-smoke.mjs` | smoke test da conexão com a Partners API contra um ambiente real (ver `tools/LEIA-ME.md`) |
| `notion-doc.mjs` | gera a página do Notion a partir do `CHANGELOG.md` e do `package.json` |
| `tokenize-neutrals.mjs`, `tokenize-radius.mjs` | varreduras usadas nas migrações de paleta e de raio |
| `workflow-storefront.legado.js` | legado da era anterior ao CLI, mantido só como referência |

Da v0.20.1 à v0.20.5 o `files` do `package.json` listava `tools`, então tudo desta pasta viajou no
tarball público, inclusive o gate com a lista de clientes e os caminhos da máquina de quem escreveu
o `workflow-storefront.legado.js`. Revertido na v0.21.3: o `files` voltou a `bin`, `src` e `template`.
Não há inconsistência com o `prepack`, que chama `tools/check-template-neutro.mjs`: o `prepack` roda
aqui, no repositório de trabalho, onde `tools/` existe. Quem instala do registro nunca roda `prepack`.

## A prévia de página do lojista, e a chave do editor

A rota `/previa-do-editor` da loja gerada só abre uma página que ainda não existe na loja se a
assinatura que vem do editor conferir, e para conferir ela precisa que o editor assine sempre com a
MESMA chave: `EDITOR_PRIVATE_KEY_JWK`, no ambiente do **editor**, não no da loja. Sem a variável o
editor sorteia um par novo a cada arranque, a assinatura deixa de conferir e toda prévia de página
do lojista responde 404, com uma linha no log da loja dizendo isso.

Isto mora aqui, e não no `README.md`, porque aquele README é público (vai ao npm e ao GitHub) e é
documento de quem GERA loja: quem instala o `@unbox-plus/cli` não configura o ambiente do editor da
Unbox. Lá ficou só o efeito que essa pessoa consegue ver.

## Gates que rodam dentro da loja gerada

Vivem em `template/scripts/` e são copiados para cada loja:

| comando | o que mede | bloqueia? |
|---|---|---|
| `unbox:honestidade` | promessa comercial ou prova social sem lastro | sim, no `prebuild` |
| `prebuild` (check-unbox-brand) | selo Powered by, GTM central, `?id=&token=` do checkout, contrato do dataLayer, travessão na copy, formulário sem destino, variável do id da loja fora de `$shopId`, data formatada sem fuso | sim |
| `unbox:editavel` | quanto do que a loja mostra o lojista consegue editar, página por página | sim, quando rodado |
| `unbox:placeholder` | `[NOME DA LOJA]`, `[CNPJ]`, `TODO:` no **HTML servido** | gate de publicação |
| `unbox:medir` | tamanhos de tipo, raios, hex fora de token, largura de container | não, é relatório |
| `unbox:qa` | capturas com emulação de dispositivo de verdade | não |
| `contraste.js` | contraste real e classificação de cor (colar no console) | não |

Todos usam a mesma convenção de saída: `0` aprovado, `1` reprovado, **`2` o gate não rodou** —
porque gate que varre o vazio e diz "limpo" aprova sem ter olhado.
