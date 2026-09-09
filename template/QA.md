# QA — Checklist pré-go-live

> **Pré-requisito:** `.env.local` preenchido com credenciais reais e `npm run unbox:test` passando.
> Sem credenciais, os fluxos abaixo não funcionam — complete o `.env.local` (guia no `.env.example`).

> **OBRIGATÓRIO (contrato Unbox):** o GTM central `GTM-PZLT336` deve estar ativo em toda
> página (`UNBOX_GTM_ID` em `app/layout.tsx` — nunca removido/trocado). Verificar: aba
> Network com requisição a `googletagmanager.com/gtm.js?id=GTM-PZLT336` em qualquer página.
>
> **OBRIGATÓRIO (contrato Unbox):** selo **"Powered by Unbox"** no rodapé
> (`<PoweredByUnbox />` em `components/site-footer.tsx` + asset `/unbox/powered-by.png`).
> O `prebuild` (`scripts/check-unbox-brand.mjs`) BLOQUEIA o build/deploy sem os dois itens.

> **Pré-requisitos de back-end (configurar no painel Unbox antes de ir ao ar):**
> - **Frete grátis** (módulo CRO 4): regra de valor mínimo e CEPs elegíveis configurada
> - **Brindes** (módulo CRO 10): regra de brinde ativa, SKU do brinde com estoque

---

## Layout e navegação

- [ ] Favicon aparece na aba do browser (substituir `app/icon.svg` pela marca real)
- [ ] Apple touch icon aparece ao salvar na tela inicial do iPhone (`app/apple-icon.svg`)
- [ ] PWA: loja aparece com nome e `theme-color` corretos ao "Adicionar à tela inicial" (`app/manifest.ts`)
- [ ] Header renderiza com logo, navegação e ícone de carrinho
- [ ] Footer renderiza com CNPJ, endereço e links corretos
- [ ] Footer tem links para `/privacidade`, `/termos` e `/devolucoes`
- [ ] Menu de categorias carrega (via `getTags`)
- [ ] Página 404 customizada aparece em rotas inexistentes
- [ ] Links de navegação não quebram (404, 500)

## Páginas legais (obrigatório antes do go-live)

- [ ] `/privacidade` — substituídos todos os `[PLACEHOLDERS]` com dados reais da empresa
- [ ] `/termos` — substituídos todos os `[PLACEHOLDERS]`, incluindo foro e CNPJ
- [ ] `/devolucoes` — canal de contato atualizado com o e-mail/WhatsApp real da loja
- [ ] `/llms.txt` — é ROTA (`app/llms.txt/route.ts`), montada do catálogo real: confira que lista os produtos com preço, marca os esgotados e traz links absolutos (precisa de `NEXT_PUBLIC_SITE_URL`). Nada em `public/llms.txt`, que esconderia a rota

## Catálogo

- [ ] Homepage carrega produtos em destaque
- [ ] Listagem de categoria abre e pagina corretamente
- [ ] Busca retorna resultados relevantes
- [ ] Produto esgotado exibe "Indisponível" e desabilita o botão

## PDP (Página de produto)

- [ ] Galeria de imagens carrega e troca corretamente
- [ ] Seleção de variante atualiza preço e disponibilidade
- [ ] Botão "Adicionar ao carrinho" funciona
- [ ] Preço com desconto Pix exibido quando aplicável

## Carrinho

- [ ] Mini-cart abre ao adicionar produto
- [ ] Quantidade atualiza e preço recalcula
- [ ] Remover item funciona sem recarregar a página
- [ ] Frete grátis acima do limiar exibido corretamente

## Checkout

- [ ] CEP calcula frete e exibe opções
- [ ] Endereço preenchido e salvo corretamente
- [ ] **PIX:** QR code gerado, pedido criado na Unbox
- [ ] **Cartão aprovado:** pedido confirmado, redireciona para /pedido
- [ ] **Cartão recusado:** mensagem de erro clara (não genérica)
- [ ] Duplo clique no botão de pagar não cria dois pedidos

## Login e área do cliente

- [ ] OTP request envia e-mail real
- [ ] Código inválido exibe erro claro
- [ ] Login OK redireciona para `/conta`
- [ ] `/conta` sem login redireciona para `/conta/entrar`
- [ ] Lista de pedidos carrega com status correto
- [ ] Logout limpa sessão e redireciona

## Pós-pedido

- [ ] Página `/pedido/[referenceId]` carrega com número e status
- [ ] Webhook de pedido recebido (checar logs Vercel → Functions)
- [ ] E-mail de confirmação da Unbox chegou ao comprador

## Honestidade (bloqueante)

- [ ] `npm run unbox:honestidade` sai LIMPO (nada fabricado SEM decisão do lojista; o que ele mandou manter está no allowlist)
- [ ] JSON-LD da PDP sem `aggregateRating` quando não há avaliações reais
- [ ] QA visual do agente 16 executado (build de produção + screenshots desktop/mobile avaliados contra `marca/DESIGN-<MARCA>.md`)

## SEO e infra

- [ ] `/sitemap.xml` retorna produtos e categorias
- [ ] `/robots.txt` bloqueia `/conta`, `/api`, `/checkout`
- [ ] OG tags preenchidas na PDP (checar com og:debugger)
- [ ] `noindex` ativo na página de confirmação de pedido
- [ ] `app/icon.svg` e `app/apple-icon.svg` trocados pelo ícone da marca (o `npm run build` avisa enquanto forem placeholder)
- [ ] `apple-icon` com fundo OPACO — iOS pinta transparência de preto na tela inicial
- [ ] Ícone maskable (se adicionar PNGs no manifest) com ~20% de margem de segurança ao redor do símbolo
- [ ] Nome e `theme_color` reais em `app/manifest.ts` (o CLI preenche; confira se sobrou "Minha Loja")

## Performance

- [ ] Lighthouse Mobile score ≥ 80 na homepage
- [ ] Imagens carregam com `next/image` (sem CLS visível)
- [ ] Primeira renderização da home < 3s em rede 4G simulada
