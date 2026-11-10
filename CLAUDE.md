# unbox-cli: o que todo agente precisa saber antes de mexer

Este é o repositório de trabalho do `@unbox-plus/cli`. O mapa das pastas, como rodar e como publicar estão em
`LEIA-ME-FONTE.md`; leia-o antes de qualquer mudança. O que fica aqui é o que não pode ser esquecido.

## `template/` é copiado para cada loja, e a loja não recebe atualização sozinha

Toda mudança em `template/` chega às lojas novas no próximo `unbox create` e NÃO chega às lojas já no ar. É por
isso que fechar uma versão tem cinco passos, e não um:

1. bump da versão em `package.json`;
2. o bloco `### vX.Y.Z` no topo do `CHANGELOG.md` (é o texto do release no GitHub; `tools/github-release.mjs` o lê);
3. **a ficha `## X.Y.Z` em `MIGRACAO.md`**, no formato fixo do topo do arquivo: o que entrou/saiu do template, o
   que uma loja já gerada tem de copiar, reaplicar ou recriar, variáveis de ambiente, mudanças de comportamento e
   armadilhas. Quem fecha a versão é quem sabe o que mudou; reconstruir isso depois custa uma sessão por loja.
   Mudança que entra em `develop` sem bump escreve a ficha dela desde já numa seção `## próxima` no topo; fechar a
   versão é renomear essa seção para `## X.Y.Z` (o gate do passo 5 recusa enquanto ela existir);
4. se a mudança renomeia ou apaga um arquivo usado como marcador em `src/version-markers.json`, trocar o
   marcador (o gate acusa). Marcador novo só para versão anterior a `carimbo.desde`; da 0.30.0 em diante o
   `unbox create` carimba `unbox.templateVersion` no `package.json` da loja e é ele que diz a versão;
5. `node tools/check-migracao.mjs` verde. Ele roda no `prepack` e no `github-release.mjs`: sem a ficha, não há
   pacote nem release;
6. `npm run release` (em `main`, árvore limpa): cria a tag e o release no GitHub, e é o release que dispara a
   publicação no npm (`.github/workflows/npm-publish.yml`). Nunca `npm publish` à mão.

Mudança de comportamento (o lojista ou o cliente passa a ver algo diferente) vai na ficha como uma escolha com
dois lados, migrar × manter, porque quem decide é o dono da loja.

## Migração de loja já gerada

- `unbox analyze-version` (src/commands/analyze-version.js): a versão-base, a classificação de cada arquivo
  contra o template da base e o atual, a auditoria do editor, a régua (refatorar × refazer, em `MIGRACAO.md`) e
  as fichas entre as duas versões. `unbox upgrade-template` aplica a parte mecânica. O `status` e o `deploy`
  sugerem os dois quando o carimbo da loja está atrás da CLI publicada.
- Skills `migrar-loja-analisar` e `migrar-loja-executar` (`.claude/skills/`): o roteiro para um agente usar os
  comandos e fazer o que eles não fazem (o merge dos pendentes, o editor até 80%, as decisões de comportamento).
  Elas também vão para cada loja em `template/.claude/skills/`, e essa cópia é gerada: **edite só a fonte em
  `.claude/skills/` e rode `npm run sync:skills`**. `npm run check:skills` (no `prepack` e no `npm test`) reprova
  qualquer diferença entre as duas e qualquer caminho que só exista nesta máquina (a skill chama a CLI pelo `npx`).

## Regras que valem no repositório inteiro

- Sem travessão na copy (`test/sem-travessao.test.js` reprova).
- Nenhuma dependência nova com dependências próprias; o template é "neutro" (`tools/check-template-neutro.mjs`).
- O `@unbox-plus/sdk` instalado localmente por `file:` nunca vai para o commit (o gate do `prepack` recusa).
