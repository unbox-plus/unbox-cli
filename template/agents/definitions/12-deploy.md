# Agente 12: Deploy (Unbox)

## Escopo
Levar a loja ao ar pela hospedagem da Unbox, com a CLI `unbox`: provisionar, enviar as variáveis,
gerar o preview, conferir e publicar em produção. O passo a passo completo, com o que cada comando
faz e os erros comuns, está em `DEPLOY.md`; este agente segue aquele arquivo.

**REGRA DE OURO: nada de conta em serviço de hospedagem, nem de GitHub.** A Unbox cria o
repositório git e a chave de deploy da loja. NUNCA peça pro lojista criar conta em outro serviço
nem configurar repositório para ver a loja no ar.

## Dependências
- Todos os outros agentes concluídos (16, QA Visual, inclusive)
- `.env.local` com as credenciais reais da loja (`UNBOX_PARTNER_API_KEY`, `UNBOX_USER`, `UNBOX_PASS`)
- git instalado
- A CLI: `npm install -g @unbox-plus/cli`, ou cada comando como
  `npx --package=@unbox-plus/cli unbox <comando>`

## O que este agente faz

1. Garante Node 22 LTS e valida a conexão com a API
2. `unbox provision`: cria o repositório e a hospedagem da loja (uma vez)
3. `unbox env`: envia as variáveis do `.env.local`
4. `unbox deploy`: envia o código e gera o preview
5. Confere o preview (porta de preview, QA com credenciais reais, `unbox:placeholder`)
6. `unbox publish`: põe em produção, **só com o ok do lojista**

Use `--json` nos comandos `unbox`: a saída é um único objeto em stdout, mais fácil de ler que o
texto, e o andamento vai para stderr.

---

## Passo a passo

### 1. Ambiente local

```bash
nvm install 22 && nvm use 22   # Node 22 LTS (v26 causa startup lento)
rm -f ~/package-lock.json      # evita conflito com npm install
npm install
npm run unbox:test             # valida credenciais antes de qualquer coisa
npm run build                  # o que não compila aqui não compila na Unbox
```

### 2. Provisionar (uma vez por loja)

```bash
unbox provision --json
```

Leva alguns minutos. Cria o repositório git e a hospedagem, liga o projeto à branch `deploy`,
gera a chave de deploy em `~/.config/unbox/keys/` e envia as variáveis. Rodar de novo é seguro.

- Se o projeto tiver `.github/`, `.gitea/` ou `.forgejo/`, o comando para pedindo confirmação.
  Explique ao lojista que essas pastas não vão para a Unbox (continuam na branch dele) e rode com
  `--yes` só depois do ok.
- `CUSTOM_STOREFRONT_HOSTING_DOMAIN_IN_USE_ERROR`: o endereço da loja está em uso ou é reservado
  pela Unbox. **Não repita.** Diga ao lojista para falar com a Unbox informando o `_id` que o
  comando mostrou.

### 3. Variáveis

O `provision` já enviou o `.env.local`. Rode `unbox env` de novo sempre que o arquivo mudar.
Os valores nunca aparecem na saída, e não os imprima você também (nada de `cat .env.local` na
conversa). `NEXT_PUBLIC_SITE_URL` é gerenciada pela Unbox: o comando pula essa chave, e está certo.

### 4. Preview

```bash
unbox deploy --build --json
```

Commita tudo, envia a branch `deploy` e acompanha o build. Devolve a URL do preview do commit e,
quando a loja tem, o preview estável (`https://preview.<slug>.myunbox.com.br`). Produção não muda.

- Só roda na branch `deploy`. Não mexa em `.forgejo/`: é o workflow de deploy da Unbox, e o
  comando recusa mudanças ali.
- `FAILURE` com o build local passando: quase sempre variável faltando (`unbox env --list`).
- Se o projeto tiver `vercel.json`, ele precisa ser um objeto JSON válido com `headers`/`routes`
  em lista; a Unbox acrescenta um header nele antes de cada deploy.

### 5. Conferir o preview

- Aba anônima no preview: deve cair em `/acesso` (porta de preview). Passe com
  `?chave=<PREVIEW_PASSWORD>` para navegar.
- Rodar o checklist do `QA.md` **com credenciais reais**.
- `npm run unbox:placeholder` (depois do `npm run build`; ele mede o build local, porque o preview
  está atrás da porta): reprova com `[NOME DA LOJA]`, `[CNPJ]` ou logo provisório.
- O preview é público para quem tem o link. Não o divulgue fora do time e do lojista.

### 6. Publicar

Mostre ao lojista o preview conferido e **peça o ok antes de publicar**. Publicar muda o que o
público vê. Com o ok:

```bash
unbox publish --yes --json
```

A Unbox refaz o build com a configuração de produção (1 a 2 min) e troca o endereço
`https://<slug>.myunbox.com.br`. Preview ok não garante produção ok: se o build de produção falhar
(`CUSTOM_STOREFRONT_PRODUCTION_BUILD_ERROR`), a produção segue como estava; revise o que muda entre
os ambientes (`VERCEL_ENV`, variáveis) e envie de novo.

### Se der errado em produção

`unbox status --json` mostra o que está no ar. `unbox rollback` volta para a publicação anterior,
mas **não é idempotente**: cada execução é um rollback novo, a partir do que estiver no ar. Rode uma vez, confira com `unbox status` e
só repita com o ok do lojista.

---

## Variável mudou

Variável nova só vale num build novo:

```bash
unbox env --json
git commit --allow-empty -m "variáveis"   # se não houver mudança de código
unbox deploy --json
unbox publish --yes --json                # com o ok do lojista
```

Os erros comuns e o que fazer em cada um estão na tabela do `DEPLOY.md`.

## Saída esperada

- Loja provisionada, com as variáveis na hospedagem (`unbox env --list` sem pendências)
- Preview conferido: porta de preview, QA e `unbox:placeholder` sem itens pendentes
- Produção publicada com o ok do lojista, em `https://<slug>.myunbox.com.br`
- `unbox status` mostrando o commit no ar
