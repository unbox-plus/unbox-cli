# tools/ · utilitários de desenvolvimento do CLI

Nada aqui é publicado: o `files` do `package.json` empacota `bin`, `src` e `template`, e só.

Isso já esteve escrito aqui enquanto era mentira. Entre a v0.20.3 e a v0.21.2 o `files`
listava `tools` também, então tudo desta pasta viajou no tarball público, inclusive o gate
com a lista de clientes em texto aberto e os caminhos da máquina de quem escreveu o
`workflow-storefront.legado.js`. O `files` voltou a ter três entradas, e a frase acima
voltou a ser verdade.

- `tokenize-neutrals.mjs` / `tokenize-radius.mjs`: scripts de migração usados uma vez na
  tokenização da foundation (v0.6).
- `workflow-storefront.legado.js`: orquestrador multiagente da era "construir um storefront
  do zero, sem o CLI". **Saiu do `template/` na v0.15.0** por três motivos: o próprio
  `agents/MANAGER.md` já dizia que ele não se aplica a quem usa o CLI; ele custava ~11k tokens
  de contexto se o agente o abrisse por engano, com "Regras de Ouro" divergentes das do
  MANAGER; e as linhas 13-15 tinham caminhos absolutos da máquina do desenvolvedor, que
  viajavam para dentro do projeto de todo cliente. Esses caminhos agora vêm por argumento ou
  por variável de ambiente (`UNBOX_SDK_PATH`, `UNBOX_DOCS_PATH`).

  Fica aqui como referência: o padrão dele (agentes em paralelo que NÃO escrevem em disco,
  devolvem `{path, content}` por schema, e um passo serial grava) é o que a fase multiagente
  do briefing deve adotar.

## `check-template-neutro.mjs` · o gate do `prepack`

Bloqueia o empacotamento se achar nome de cliente, caminho pessoal, atribuição pessoal,
identificador interno, segredo de fábrica, documento ou telefone de uma pessoa, ou vocabulário de
um ramo específico. Também reprova travessão no texto que o wizard imprime, nos arquivos de `bin/`
e `src/` que o npm listar.

O escopo tem duas partes. A primeira é EXATAMENTE o que o `npm pack` levaria, com a lista
perguntada ao próprio npm. A segunda é uma lista fixa de arquivos que são públicos sem estar no
tarball: `CHANGELOG.md`, `LEIA-ME-FONTE.md` e este `tools/` inteiro, que estão todos no GitHub. A
segunda parte existe porque a primeira encolheu: a v0.21.3 tirou `tools` do `files`, e sem ela
tirar a pasta do tarball teria custado a cobertura dela justamente na versão que limpou, à mão,
cinco nomes de cliente do `CHANGELOG.md`, um caminho de máquina do `workflow-storefront.legado.js`
e o id de uma página interna daqui. O vocabulário de ramo continua cobrado só dentro de
`template/`: o changelog NARRA o defeito ("a loja dizia polvilhe") e proibir a palavra ali apagaria
a explicação. As outras réguas valem em tudo.

A unidade de medida da varredura de NOME é o arquivo, não a linha: um nome que já estava na
lista passou pelo gate na v0.21.2 porque caiu no fim de uma linha do README e continuou na
seguinte. Quem escreve o texto não escolhe onde a linha quebra.

Dado de uma pessoa não tem forma própria: um CPF é feito dos mesmos algarismos que qualquer
número. Então o gate CALCULA. **Documento** entra pelo dígito verificador (se fecha a conta, é
documento de alguém e não é enfeite), e a conta roda sobre CORRIDAS de algarismos, não sobre a
pontuação canônica: numa corrida colada ele testa toda subsequência de 11 e de 14 algarismos, e
numa corrida separada por ponto, hífen, barra ou espaço ele testa o valor inteiro. Antes só havia a
forma canônica, e o mesmo documento passava escrito com espaço ou embutido numa corrida maior.
**Telefone** entra pela repetição (fixture de verdade usa o mesmo algarismo várias vezes; número
copiado de relatório tem dígito espalhado), em três formas: celular com DDD, celular sem DDD e
fixo com DDD. No fixo a pontuação é obrigatória, porque sem o `9` de âncora dez algarismos seguidos
têm a cara de qualquer inteiro e um `z-index` do CSS viraria telefone.

O que estas réguas NÃO cobrem, e é melhor estar escrito do que descoberto depois: **e-mail pessoal
e endereço residencial**. Um e-mail de pessoa não tem forma que o separe do e-mail de contato de
uma loja, e um endereço de rua não tem conta que feche. Quem revisa continua tendo de olhar.

```bash
npm run check:neutro                                   # varredura
node tools/check-template-neutro.mjs --hash "Marca X"  # nome novo para a lista, já digerido
```

A lista de nomes proibidos é de HASHES, não de nomes: o gate precisa saber quem são os
clientes para cobrar a régua, mas escrever a carteira num arquivo seria o próprio vazamento
que ele existe para impedir. `--hash` gera a linha a colar, sem que o nome apareça no
repositório.

## `github-release.mjs` · o release no GitHub

Lê o primeiro bloco do `CHANGELOG.md` da branch `main` e publica o release no repositório
declarado no `package.json`, com o mesmo mapeamento que vinha sendo feito à mão: o `### vX.Y.Z
— título` vira a tag `X.Y.Z` (sem o `v`) e o título do release, e o corpo do bloco vira a
descrição, verbatim.

```bash
npm run release                            # prévia + confirmação
node tools/github-release.mjs --previa     # só mostra o que faria
node tools/github-release.mjs --sim        # sem perguntar (CI)
node tools/github-release.mjs --rascunho   # cria como draft
node tools/github-release.mjs --local      # lê do main local, sem fetch
```

Precisa do `gh` autenticado: o release é criado por ele, e não por token escrito em lugar nenhum.

O texto vem do `origin/main`, não da cópia de trabalho, e a tag aponta para o **SHA** do topo
de `main`, não para o nome `main`. As duas coisas são a mesma no instante em que se lê, e
deixam de ser se alguém empurrar um commit no meio: a tag ficaria sobre um texto que o script
não leu, e o release descreveria outra coisa.

Publicar é irreversível na prática, então a conferência é toda antes e qualquer uma aborta:
versão do bloco diferente da do `package.json` **do mesmo commit** (uma das duas ficou para
trás, e adivinhar qual é o que não se deve fazer aqui), tag já existente no remoto, release já
existente, título fora do formato. A prévia sai inteira na tela e nada é criado antes do "sim".

## `notion-doc.mjs` · a página interna do CLI

Gera o conteúdo da página **create-unbox-store — CLI de geração de loja**, em
`Documentações → Lojas Store` do Notion de tecnologia. O link e o id da página ficam fora
deste repositório de propósito: identificador de página interna não é informação de produto,
e este arquivo já viajou uma vez num pacote público. Quem precisa da página a acha pelo
título na busca do Notion.

```bash
node tools/notion-doc.mjs
```

A versão sai do `package.json` e o changelog é extraído do `CHANGELOG.md`, as duas únicas
fontes da verdade, então a página não pode divergir do pacote. A prosa de apresentação é
curada dentro do script (uma página para o time não é um despejo do README); as entradas
`### vX.Y.Z` viram toggles, e a era "Beta" fica condensada em uma linha por versão dentro de
um toggle único, com o texto integral seguindo no `CHANGELOG.md`.

**Depois de todo release:** rode o comando e substitua o conteúdo da página com a saída. O
próprio topo da página diz isso, para quem chegar por lá não editar o changelog à mão.

O link ficava aqui e não no `README.md` porque aquele README é público: viaja no pacote do npm
e está no repositório do GitHub. Agora não fica em lugar nenhum dos dois.
