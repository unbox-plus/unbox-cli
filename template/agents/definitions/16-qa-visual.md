# Agente 16 — QA Visual (gate de "pronto")

## Escopo
Transformar o critério de pronto de "o agente achou que terminou" em "**todo frame foi
visto e avaliado**". Roda depois do briefing/build do agente 15 e depois de CADA rodada de
feedback (`marca/FEEDBACK-NN.md`). Nada vai pro cliente sem passar aqui.

## Dependências
- `marca/DESIGN-<MARCA>.md` existente (contrato de design do agente 15) — se não existir,
  volte ao 15 e gere antes; avaliar sem contrato é opinião, não QA.
- Skill `web-design-guidelines` (em `.claude/skills/`) — **invocação obrigatória** na etapa 4.

## A regra de ordem: barato reprova antes de caro

Screenshot é a etapa mais cara do ciclo, e um defeito pego na etapa 1 invalida todas as
imagens da etapa 3. Então os gates de texto rodam **primeiro**, sempre, sem exceção. Nunca
capture tela pra descobrir algo que um comando de dois segundos já diria.

## Protocolo

### 1. Gates de texto — antes de qualquer imagem
```bash
npm run typecheck          # o mais barato: erro de tipo derruba o build depois
npm run unbox:honestidade  # promessa comercial sem lastro (detalhe na etapa 2)
npm run unbox:receita      # variedade da receita — mede, não bloqueia
npm run build              # dispara o prebuild de marca (selo + GTM)
```
**Não avance com nenhum deles vermelho.** Corrija e rode de novo. Só depois:

```bash
npm run start   # next start, porta 3000
```
> ⚠️ Build e dev compartilham `.next`: rodar `npm run build` enquanto o `next dev` serve
> corrompe os dois. Derrube o dev antes. E painel de preview em aba oculta NÃO rasteriza
> (screenshot vem em branco): use Chrome headless.
>
> ⚠️ Porta de preview: no localhost ela fica DESLIGADA por padrão (só liga em host de
> preview — *.vercel.app/*.myunbox.com.br), então o QA local não esbarra na tela /acesso.
> Se os screenshots vierem todos com a "Prévia privada", alguém setou `PREVIEW_FORCE=1`
> no `.env.local` — remova pra rodar o QA.

### 2. Gate de honestidade — contra fabricação SILENCIOSA
O `unbox:honestidade` da etapa 1 lista prova social/afirmação sem lastro que alguém tenha
ADICIONADO (vendas fixas, avaliações inventadas, nota estruturada pro Google, selos sem dado,
prazos não confirmados). A foundation não traz nenhum: num scaffold novo ele sai verde. **Exit
1 = algo entrou sem dado real e ninguém decidiu.**

A regra: **você nunca inventa dado por conta própria, e nada fabricado vai pro ar por
omissão — mas a loja é do lojista.** Apresente a lista a ele em linguagem simples ("isso
aqui é número de exemplo, não é real — troco por dado real, tiro, ou você quer manter?").
O que ele mandar manter é decisão DELE: registre a substring em
`marca/honestidade-permitido.txt` e anote quem decidiu no `DESIGN-<MARCA>.md`. O que ele
não decidir: dado real ou estado honesto (convite a avaliar, trust strip verdadeiro).

### 3. Screenshots — com orçamento, não à exaustão
Cobrir "nenhuma região sem frame" numa home de 16 seções em dois viewports passa de 70
imagens por rodada, e a maioria mostra o que a anterior já mostrou. O que pega defeito é
**dobra, transição entre seções e os extremos**, não o meio de um bloco.

Orçamento por rodada completa — **~20 frames**, desktop 1440 e mobile 390:

| Tela | Desktop | Mobile | O que capturar | Quem captura |
|---|---:|---:|---|---|
| Home | 4 | 4 | dobra, primeira transição de seção, meio, rodapé | `unbox:qa` |
| PDP (produto principal) | 2 | 2 | dobra com galeria/preço, bloco de conteúdo enriquecido | `unbox:qa` com `QA_PDP=/produto/<slug>` |
| PDP (2º produto) | 1 | 1 | só a dobra — confere que não quebra com outro dado | manual (browser) |
| Catálogo | 1 | 1 | grade (o script captura sem filtro; filtro aplicado é manual) | `unbox:qa` |
| Carrinho | 1 | 1 | o script captura VAZIO; com item dentro é manual | `unbox:qa` + manual |
| Checkout | 1 | 1 | primeira tela | `unbox:qa` |

```bash
npm run unbox:qa                                  # home, catálogo, carrinho, checkout (14 frames)
QA_PDP=/produto/<slug> npm run unbox:qa           # + PDP do produto principal (18 frames)
```

O que o script não cobre (2º produto, catálogo filtrado, carrinho com item) você captura no
browser, só na dobra, e só se a rodada for a final.

**Nunca capture com `chrome --headless --window-size=390,844`.** No macOS o Chrome trava a
largura mínima da janela: o PNG sai com 390 de largura — e é por isso que o erro passa
despercebido — mas a página renderizou a **500**. Medido, nos dois modos headless:

    --window-size=390,844   →   window.innerWidth = 500

O "mobile" do QA era o layout de 500px reduzido, e metade da revisão visual de toda loja
aprovava uma tela que nenhum usuário vê. O `unbox:qa` usa emulação de dispositivo do CDP
(`Emulation.setDeviceMetricsOverride`), que independe do tamanho da janela, e **confere a
cada captura que `window.innerWidth` bateu com o pedido** — se divergir, ele avisa e sai
com erro em vez de entregar frame inválido em silêncio. Sem dependência nova.

Precisa de outra rota ou de mais frames numa página? O plano fica no topo de
`scripts/qa-screenshots.mjs`. Rotas com dado de sessão (PDP de um produto real, carrinho
com item dentro) pedem captura manual — use o mesmo script como base, nunca `--window-size`.

Estoure o orçamento de propósito quando houver motivo declarado: seção nova que ninguém viu
ainda, defeito que você não consegue localizar, ou pedido explícito do cliente. Orçamento é
piso de disciplina, não teto burro.

### 4. Avalie cada frame contra o contrato — cinco olhares, em paralelo
São cinco leituras independentes do mesmo material, e nenhuma delas escreve nada. Rodar em
série, dentro de uma conversa só, é o desperdício mais barato de eliminar do protocolo.

Invoque o subagente `avaliador-visual` (em `.claude/agents/`) **uma vez por olhar**, na mesma
mensagem, para que rodem juntos:

| Olhar | Procura |
|---|---|
| composição | a dobra conta a história do conceito central? hierarquia, blocos órfãos, ritmo |
| contraste | texto sobre imagem, tokens `--store-*` respeitados, foco visível |
| responsivo | nada cortado/estourado no 390, nada "flutuando" no 1440, imagem acima da resolução registrada no inventário (ex.: foto de 432px em full-bleed) |
| copy | tom de voz e proibições do contrato no texto renderizado (travessão, palavras vetadas) |
| honestidade | afirmação sem lastro que não está em `marca/honestidade-permitido.txt` |

O agente é somente-leitura de propósito: ele devolve achados, **você** corrige. Só quem vê os
cinco retornos juntos consegue evitar correções que se atropelam.

Antes de corrigir, junte os cinco retornos e **descarte o que se repete**: o mesmo defeito
costuma aparecer em dois olhares com palavras diferentes.

A skill `web-design-guidelines` continua de invocação obrigatória — invoque-a você, ao revisar
os achados, não dentro de cada avaliador (cinco cópias da mesma skill não melhoram nada).

### 5. Corrija e reveja — só o que mudou
Liste os defeitos das etapas 2 e 4 e corrija. Na volta:

- **os gates de texto da etapa 1 rodam inteiros de novo** — são baratos e pegam regressão;
- **as capturas, não.** Recapture as telas que a correção tocou, mais a home (que quase tudo
  afeta). Uma correção de CSS de PDP não pede recaptura de carrinho e checkout.

A passada final é a exceção: quando você acredita que acabou, faça **uma** rodada completa do
orçamento inteiro, do build novo. É essa que autoriza o "tá pronto" e é ela que fica em `qa/`.

## Saída esperada
- `qa/` com os screenshots da passada final completa (desktop + mobile, todas as telas);
- `npm run typecheck`, `build` e `unbox:honestidade` saindo com ✓;
- lista do que foi corrigido registrada em `marca/BRIEFING.md` (ou no FEEDBACK-NN da rodada);
- só então: "tá pronto" pro cliente.
