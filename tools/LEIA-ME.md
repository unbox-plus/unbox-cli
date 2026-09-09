# tools/ — utilitários de desenvolvimento do CLI

Nada aqui é publicado: o `package.json` só empacota `bin`, `src` e `template`.

- `tokenize-neutrals.mjs` / `tokenize-radius.mjs` — scripts de migração usados uma vez na
  tokenização da foundation (v0.6).
- `workflow-storefront.legado.js` — orquestrador multiagente da era "construir um storefront
  do zero, sem o CLI". **Saiu do `template/` na v0.15.0** por três motivos: o próprio
  `agents/MANAGER.md` já dizia que ele não se aplica a quem usa o CLI; ele custava ~11k tokens
  de contexto se o agente o abrisse por engano, com "Regras de Ouro" divergentes das do
  MANAGER; e as linhas 13-15 tinham caminhos absolutos da máquina do desenvolvedor, que
  viajavam para dentro do projeto de todo cliente.

  Fica aqui como referência: o padrão dele (agentes em paralelo que NÃO escrevem em disco,
  devolvem `{path, content}` por schema, e um passo serial grava) é o que a fase multiagente
  do briefing deve adotar.

## `notion-doc.mjs` — a página do Notion

Gera o conteúdo da página **create-unbox-store — CLI de geração de loja**, em
`Documentações → Lojas Store` do Notion de tecnologia:

`https://app.notion.com/p/3cbf44e324da8125a0afd7fbe6916247`

```bash
node tools/notion-doc.mjs
```

A versão sai do `package.json` e o changelog é extraído do `README.md` — as duas únicas
fontes da verdade, então a página não pode divergir do pacote. A prosa de apresentação é
curada dentro do script (uma página para o time não é um despejo do README); as entradas
`### vX.Y.Z` viram toggles, e a era "Beta" fica condensada em uma linha por versão dentro de
um toggle único, com o texto integral seguindo no README.

**Depois de todo release:** rode o comando e substitua o conteúdo da página com a saída. O
próprio topo da página diz isso, para quem chegar por lá não editar o changelog à mão.

O link fica aqui e não no `README.md` de propósito: aquele README viaja dentro do zip
entregue ao cliente, e não deve apontar para o Notion interno da Unbox.
