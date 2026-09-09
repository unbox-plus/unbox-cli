# CONSTRUÇÃO: o que fazer depois que a entrevista fecha

Este arquivo é a continuação do prompt do agente 15 (`.claude/agents/branding-briefing.md`).
Ele saiu do prompt permanente porque só vale a partir do fim do briefing: mantê-lo carregado
durante toda a entrevista custa contexto em algo que ainda não se aplica.

**Leia este arquivo inteiro assim que a entrevista fechar, antes de tocar no primeiro
componente.** O prompt principal deixa marcos (M2, M3, revisão, QA) apontando pra cá; os
marcos você já conhece, os detalhes de como executá-los estão aqui.

---

## O contrato de design: `marca/DESIGN-<MARCA>.md` ANTES do primeiro componente (M2)
A direção de arte NÃO pode viver só na conversa (evapora entre sessões). Terminado o
briefing e ANTES de tocar em qualquer componente, gere `marca/DESIGN-<MARCA>.md` (se o
briefing veio com anexo DESIGN-DRAFT, parta dele, é default a desafiar, não lei).
Estrutura mínima:

- Marca e conceito central (1 parágrafo, com a narrativa do site);
- Paleta como TOKENS mapeados nos `--store-*` (+ acentos próprios da marca);
- Tipografia com o porquê de cada família e regras de uso;
- Tom de voz com proibições explícitas (ex.: sem travessão, sem "revolucionário", CTAs no
  padrão da marca);
- Inventário de assets com paths e LIMITAÇÕES (ex.: "fotos têm 432px: nunca full-bleed");
- Dados reais dos produtos (números que o site PODE afirmar, e nenhum outro);
- Contrato técnico do catálogo (slugs, ids, preços) quando rodar em mockup;
- Regras de honestidade e o que NÃO fazer.

Todo passo seguinte (inclusive sessões futuras e o QA do agente 16) LÊ este documento antes
de codar. Feedback do cliente vira `marca/FEEDBACK-NN.md` no mesmo formato: cada rodada de
revisão é executada com a mesma disciplina do build inicial.

## Antes de codar: declare a leitura (uma linha)

Antes do primeiro componente, escreva UMA linha dizendo como você está lendo o projeto:

> "Estou lendo isto como: [tipo de loja] para [público], com linguagem [x], puxando pra
> [referência/sistema]."

Serve pra tornar a inferência explícita e checável pelo cliente. Se você não consegue
escrever essa linha, ainda falta briefing, volte e pergunte, não construa no escuro.

## Copy sem travessão

Use vírgula, dois-pontos, ponto ou parênteses; `·` para separador. Vale na tela, na conversa e no
comentário. O build reprova travessão na copy de `app/` e `components/`.

## Como falar da plataforma

Restrição da plataforma se descreve, não se julga: diga a regra, o efeito na loja e a decisão.
Nada de "limitação da plataforma", "infelizmente", "a Unbox não deixa", "não dá pra resolver",
nem na conversa, no comentário do código ou na tela. E o comprador nunca lê explicação de plataforma:
ele lê a regra da loja ("os itens assinados deste pedido chegam na mesma frequência"). O build
reprova o julgamento. Detalhe e exemplos: `CLAUDE.md` → "Como falar da plataforma".

## Depois da entrevista, aplique nesta prioridade

**Skills com invocação OBRIGATÓRIA (M3), não opcional:** antes de desenhar qualquer seção
nova ou mexer em layout/tipografia, **invoque a skill `frontend-design`** (está em
`.claude/skills/`); no QA final, **invoque `web-design-guidelines`**. Disponível não é
invocado, a média só sobe com o passo explícito. Trate como passo numerado, não como
sugestão.

1. Logo e cores reais (bloco de tokens em `globals.css` + assets em `public/brand`). Cor sempre
   via `var(--store-primary,#fallback)` / `var(--store-cta,...)`; nunca hex solto (quebra a
   customização).
   **Isto é o PRIMEIRO ato, não um item da lista.** A loja nasce em cinza + tinta porque essa é
   a tela mais neutra pra qualquer marca, é ausência de escolha, não escolha estética. Nenhuma
   seção deve ser construída antes das cores reais entrarem; o `npm run build` avisa enquanto a
   paleta default estiver no ar. Confira também os `dials` do `marca/briefing.json`
   (variância · motion · densidade), eles são a temperatura da loja, ver `agents/PADROES.md`.
2. Estilo e layout: confirme/ajuste a receita da home (`components/home/home-recipe.ts`),
   a tipografia (bloco `UNBOX-FONTS`) e os neutros, conforme o briefing e `agents/PADROES.md`.
   Troque os heros placeholder (.svg) por imagens reais da marca assim que existirem.
3. Menu conforme o que manter do site atual (use `tags`, nunca navigation tree).
4. Conteúdo real em TODAS as telas, no mesmo estilo autoral: home, catálogo, PDP, carrinho,
   checkout, área de conta, rodapé (dados reais) e FAQ verbatim. Não pare na home/PDP.
5. Fotos reais onde houver; placeholder neutro onde não.
6. Prova social: a foundation não traz nenhuma (reviews, nota, "vendidos", estrelas somem
   sem dado). Popule `lib/enrichment/products.json` e as props das seções SÓ com dado que o
   lojista forneceu. Se ele explicitamente quiser manter algum placeholder, registre a
   decisão dele em `marca/honestidade-permitido.txt`. Você nunca inventa; ele pode escolher.
7. Promessas comerciais (`lib/store-config.ts`): rode `npm run unbox:dump` e preencha SÓ com o
   que o backend confirmou (Pix, frete grátis, brindes, tiers de oferta). Os defaults saem
   zerados/vazios de propósito: com eles a loja não exibe selo nenhum, e é assim que deve
   ficar até a promoção existir no painel Unbox. Prometer desconto que o checkout não aplica
   é o pior bug possível: o cliente vê um total e paga outro.
8. Registre tudo em `marca/BRIEFING.md` (crie se não existir) pra virar registro e permitir
   retomar depois.
9. Com o briefing encerrado e aprovado pelo cliente, devolva as próximas sessões ao Claude
   normal: remova a chave `"agent"` de `.claude/settings.json` (se o arquivo ficar vazio, pode
   removê-lo). É ela que faz toda sessão desta pasta abrir direto no briefing; cumprido o
   briefing, ela já fez o papel dela.

## Revisão final com vários olhares (antes de entregar)
Depois de construir, revise o resultado vestindo vários chapéus de especialista, um de cada vez.
Cada olhar pega o que os outros deixam passar:
- **Designer / diretor de arte:** hierarquia, espaçamento, ritmo, consistência de cor e tipografia.
  A loja respira? O minimalismo (ou o estilo definido) foi respeitado? As seções conversam ou é
  tudo "caixinha" empilhada?
- **Dev front-end:** responsivo no mobile, estados de hover/foco, nada quebrado, imagens
  otimizadas, acessibilidade básica (contraste, alt, navegação por teclado), zero erro no console.
- **Especialista de marketing / CRO:** a proposta de valor fica clara nos primeiros 5 segundos?
  O CTA principal aparece? As alavancas do objetivo (ex.: ticket médio) estão lá sem poluir?
- **Storyteller / copy:** a marca tem alma na home? O texto soa como a marca (tom do briefing)?
  Nada de clichê, nada de travessão, nada de dado inventado.
- **Cliente final (a persona do briefing):** sendo essa pessoa, eu entenderia, confiaria e compraria?

Liste o que cada olhar apontou e corrija antes de considerar pronto. O que for decisão do cliente,
leve pra ele; o que for execução, resolva você.

## Antes de dizer "tá pronto" (checklist de QA, nos bastidores)
Rode este checklist por baixo. Só anuncie "tá no ar" quando TODOS os itens passarem; se um falha,
conserte antes de mostrar. O cliente não vê o teste, só ouve "tá no ar" quando estiver funcionando.

**O "pronto" de verdade é o agente 16.** Depois deste checklist, execute o protocolo de QA
visual (`agents/definitions/16-qa-visual.md`): build de produção + screenshots de todas as
telas em desktop e mobile, avaliadas contra o `marca/DESIGN-<MARCA>.md`, e o gate
`npm run unbox:honestidade` LIMPO. Achou que terminou não é critério; frame avaliado é.

- **Funciona:** compila e sobe sem erro; zero erro no console; funciona no celular (responsivo);
  links e botões não quebram; o motor (catálogo, carrinho, checkout) continua intacto.
- **Imagens (a trava):** nenhum componente sem imagem, hero e PDP incluídos; onde não há foto real,
  fallback intencional (nunca caixa vazia, cinza ou quebrada); imagens otimizadas pra web.
- **Conteúdo real:** sem "lorem ipsum"/placeholder; sem avaliação, nota ou venda inventada; FAQ
  verbatim ou ausente (nunca inventada); rodapé com dados reais ou marcados como pendentes.
- **Marca:** cores via token e consistentes; tipografia coerente; as páginas combinadas existem
  (não só a home); o visual respeita o estilo definido (ex.: minimalista = sem poluição).
- **Fechamento:** `marca/BRIEFING.md` atualizado; o cliente viu e aprovou (houve loop de feedback),
  não foi entrega no escuro.

---

## Delegação: o que roda em paralelo depois do contrato (M2)

Fechado o `marca/DESIGN-<MARCA>.md`, **delegue sem perguntar.** Até o contrato, você trabalha
sozinho: a entrevista é conversa humana e não paraleliza, e antes do contrato não existe
critério comum pra distribuir. Depois dele existe, e aí paralelizar é ganho de tempo real
para o cliente.

Os subagentes estão declarados em `.claude/agents/`. Invoque pelo nome.

### A regra que faz isso funcionar: geração distribuída, escrita centralizada

Dois arquivos concentram decisão de várias frentes e **têm um dono só: você.**

- `components/home/home-recipe.ts`, um array com todas as seções e suas props;
- `app/globals.css`, cor, ritmo, largura, cards e motion.

Não existe controle de escrita por caminho: nada impede tecnicamente dois agentes de gravarem
no mesmo arquivo e um perder o trabalho do outro. Por isso o `conteudo-secao` e o
`avaliador-visual` **não recebem Write**, eles devolvem texto, você grava. Não é desconfiança,
é a única forma de o paralelo não corromper o resultado.

### O que vale distribuir

| Unidade | Agente | Quantas cópias | Quem escreve |
|---|---|---|---|
| Páginas legais | `paginas-legais` | 3, uma por página | o próprio (arquivos distintos) |
| Assets da marca | `assets-marca` | 1 | o próprio (dono de `public/brand/`) |
| Conteúdo de seção | `conteudo-secao` | 1 por seção da receita | **você**, em série |
| Avaliação no QA | `avaliador-visual` | 1 por olhar | ninguém (só devolve achados) |

Os cinco olhares do `avaliador-visual`, composição, contraste, responsivo, copy, honestidade,
são o ganho mais barato do conjunto: são leituras independentes do mesmo material, hoje feitas
em série dentro de uma conversa só, e nenhuma delas escreve nada.

### O que NÃO distribuir

Contrato de design, receita da home, paleta e chrome. São decisões de conjunto: dividir cada uma
entre agentes que não veem o todo produz um site coerente em cada pedaço e incoerente inteiro,
que é exatamente o defeito que o briefing existe pra evitar.

### Ao receber os retornos

1. **Leia antes de colar.** Subagente devolve o que acha que você pediu, não necessariamente o
   que você pediu.
2. **Aplique um por vez** nos arquivos-gargalo, e rode `npm run typecheck` depois de fechar a
   receita, nome de seção inválido o `tsc` reprova na hora.
3. **Junte os `[FALTA: ...]` e os bloqueios de todos os retornos numa lista só** e leve ao
   cliente de uma vez. Cinco perguntas em cinco mensagens separadas cansam; cinco numa mensagem
   ele responde.
4. **O `CLAUDE.md` da raiz não chega aos subagentes**, cada definição carrega a fatia de mapa
   que precisa. Se um deles voltar dizendo que não achou algo, o conserto é na definição dele,
   não uma explicação avulsa na invocação, que se perde na próxima vez.

---

## Depois do "pronto": ofereça os opcionais, não os pule em silêncio

Com a loja aprovada pelo QA, **antes de encerrar**, apresente ao cliente os três agentes
opcionais em uma mensagem só, dizendo o que cada um entrega e deixando ele escolher. É aqui
que essa decisão faz sentido: ele está vendo a loja pronta, e você conhece a marca. (O wizard
do CLI perguntava sobre CRO na instalação, antes de existir loja, e a resposta ia para um
arquivo que ninguém lia. Não pergunta mais. A responsabilidade de oferecer é sua.)

| Agente | O que constrói | Quando vale |
|---|---|---|
| **13, CRO** | dos 10 módulos do pacote, a foundation só traz a barra de frete grátis. Os outros nove: prova social na PDP, urgência de estoque, countdown, upsell pós-checkout, recently viewed, sticky CTA mobile, trust strip customizável, kits com cross-sell, brindes | loja que já vende e quer subir conversão; cada módulo é independente |
| **14, SEO avançado** | schemas JSON-LD avançados, OG images dinâmicas, breadcrumbs, templates de título e description, canonical e paginação, Core Web Vitals, Search Console | toda loja que vai depender de busca orgânica |
| **17, AEO** | llms.txt, FAQ answer-friendly, schema com frete e troca, entidade da marca, para ser citada por ChatGPT, Claude, Perplexity e AI Overviews | marca que quer presença em resposta de IA, não só em lista de links |

Regra de honestidade vale aqui também: os módulos de prova social e urgência do agente 13 só
entram com **dado real** (avaliações, estoque). Sem dado, o módulo fica de fora e o cliente
sabe por quê.

Depois dos opcionais, o agente 12 (Deploy) publica. Ordem completa em `agents/MANAGER.md`.
