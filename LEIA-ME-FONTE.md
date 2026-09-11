# create-unbox-store — código-fonte (v0.21.3)

Este repositório é o **repositório de trabalho**, não o artefato de uso. Quem só quer gerar loja
roda o pacote publicado: `npx --package=@unbox-plus/cli create-unbox-store`.

```bash
npm install          # só `prompts`; o resto é do template
node bin/cli.js      # roda o CLI daqui, sem empacotar
npm pack             # gera o tarball (o prepack roda o gate de neutralidade antes)
```

## O mapa

| pasta | o que é |
|---|---|
| `bin/cli.js` | o wizard: perguntas, cópia do template, `.env.local`, `.mcp.json`, briefing |
| `src/` | presets de estilo (`presets.js`), aplicação de tokens e receitas (`theme.js`), cor (`colors.js`) |
| `template/` | **a foundation**: o projeto Next.js que vira a loja. É o grosso do repositório |
| `tools/` | ferramentas do nosso lado, que NÃO vão para a loja gerada |

## `tools/`, que é o que faltava no zip anterior

| arquivo | o que faz |
|---|---|
| `check-template-neutro.mjs` | gate do `prepack`: bloqueia o empacotamento se a foundation tiver vocabulário de um ramo específico ou nome de cliente, comentário incluído. Também reprova travessão no texto que o wizard imprime |
| `notion-doc.mjs` | gera a página do Notion a partir do `CHANGELOG.md` e do `package.json` |
| `tokenize-neutrals.mjs`, `tokenize-radius.mjs` | varreduras usadas nas migrações de paleta e de raio |
| `workflow-storefront.legado.js` | legado da era anterior ao CLI, mantido só como referência |

Da v0.20.1 à v0.20.5 o `files` do `package.json` listava `tools`, então tudo desta pasta viajou no
tarball público, inclusive o gate com a lista de clientes e os caminhos da máquina de quem escreveu
o `workflow-storefront.legado.js`. Revertido na v0.21.3: o `files` voltou a `bin`, `src` e `template`.
Não há inconsistência com o `prepack`, que chama `tools/check-template-neutro.mjs`: o `prepack` roda
aqui, no repositório de trabalho, onde `tools/` existe. Quem instala do registro nunca roda `prepack`.

## Gates que rodam dentro da loja gerada

Vivem em `template/scripts/` e são copiados para cada loja:

| comando | o que mede | bloqueia? |
|---|---|---|
| `unbox:honestidade` | promessa comercial ou prova social sem lastro | sim, no `prebuild` |
| `prebuild` (check-unbox-brand) | selo Powered by, GTM central, `?id=&token=` do checkout, contrato do dataLayer, travessão na copy | sim |
| `unbox:editavel` | quanto do que a loja mostra o lojista consegue editar, página por página | sim, quando rodado |
| `unbox:placeholder` | `[NOME DA LOJA]`, `[CNPJ]`, `TODO:` no **HTML servido** | gate de publicação |
| `unbox:medir` | tamanhos de tipo, raios, hex fora de token, largura de container | não, é relatório |
| `unbox:qa` | capturas com emulação de dispositivo de verdade | não |
| `contraste.js` | contraste real e classificação de cor (colar no console) | não |

Todos usam a mesma convenção de saída: `0` aprovado, `1` reprovado, **`2` o gate não rodou** —
porque gate que varre o vazio e diz "limpo" aprova sem ter olhado.
