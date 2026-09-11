// Leitura do conteúdo PUBLICADO no servidor (layout/page, com ISR).
//
// Sem EDITOR_URL, nada é buscado e a loja renderiza o que está no código.
// Falha de rede/5xx devolve null com aviso: a loja nunca cai por causa do
// editor — no pior caso mostra o conteúdo do repositório até a próxima
// revalidação (ISR de 300 s, ou publicação que chama /api/revalidate).
//
// Quem só RENDERIZA usa `getPublishedContent()`: null = conteúdo do código, seja
// porque a loja nunca publicou, seja porque a leitura falhou. Quem DECIDE a partir
// do publicado usa `lerPublicado()`, que diz qual dos dois foi (`falhou`): é o caso
// da rota /api/capi, que não pode mandar conversão para o Pixel do cadastro só
// porque a leitura do que o lojista publicou falhou (Astra, segunda rodada, 1).
import { cache } from "react";
import { documentoUsavel, isHtmlPath, isRichPath, leituraDoPublicado, presencaNoAmbiente as presencaPura, recusaDeHtml, recusaDeTextoRico, type Ambiente, type ContentDocument, type LeituraDoPublicado, type ManifestApps } from "./document";
import { EDITOR_URL, STORE_SLUG } from "./config";

/**
 * APPS: RASTREIO E MARKETING (foundation 12). As funções moram em document.ts (puras, testadas no runner
 * do editor) e saem também por aqui porque é daqui que o app/layout.tsx da loja lê o que é do SERVIDOR:
 * `presencaNoAmbiente(process.env, { unboxGtmId })` vai no manifesto pelo `EditableProvider` (só presença,
 * nunca valor, o estado da CAPI e o contêiner contratual da Unbox). `rastreioEmVigor(doc, process.env)` é o
 * que o `<Rastreio>` de rastreio.tsx (a linha
 * única do layout) consulta para decidir o que dispara (documento vence ambiente, um script por
 * provedor). `capiDaLeitura(await lerPublicado(), process.env)` é o que a rota /api/capi da loja obedece: o
 * Pixel em vigor e se o token o atende, ou "leitura-falhou" quando não se conseguiu ler o publicado (aí a
 * rota não envia: não se sabe qual Pixel o lojista publicou). As variáveis são conhecidas pelo nome em
 * `VARIAVEIS_DE_RASTREIO`, então o layout não precisa listá-las uma a uma: ele passa
 * `ambienteDeRastreio(process.env)`, que é o ambiente com só elas dentro.
 */
export { rastreioEmVigor, capiEmVigor, capiDaLeitura, type RastreioEmVigor, type ManifestApps, type EstadoDoCapi, type EstadoDaRotaCapi, type LeituraDoPublicado } from "./document";

/**
 * SÓ AS VARIÁVEIS DE RASTREIO do ambiente, para o layout passar isto a `<Rastreio>` no lugar de
 * `process.env` inteiro. Em desenvolvimento o React serializa no HTML as props de componente de
 * servidor, e com o ambiente inteiro numa prop toda página levava junto os segredos do processo.
 */
export { ambienteDeRastreio } from "./document";

/**
 * PÁGINAS DO LOJISTA E COLEÇÕES (foundation 13). As funções são puras e moram em document.ts (testadas no runner
 * do editor); saem também por aqui porque é daqui que as rotas da loja leem o publicado, e a leitura de uma
 * página vem sempre com elas: `paginaDaRota(doc, caminho, prefixo)` acha o registro que responde por um caminho;
 * `visivelAgora(registro)` diz se ela está no ar (visível, e a data de publicação já passou); `artigosDaColecao`
 * é a listagem, na ordem do sitemap e do JSON-LD; `redirecionamentoDe(doc, caminho)` é o que a rota consulta
 * ANTES de renderizar, para responder 308; `tituloDaPagina` é o título em `values`, senão o endereço
 * capitalizado (a loja nunca renderiza `<h1>` vazio); `rotaDePagina`/`rotaDeColecao`/`colecaoDaRota` montam e
 * leem as URLs; `RESERVADOS_FIXOS` é a base de `reservadosDaLoja()` e `ARTIGOS_POR_PAGINA` o tamanho da
 * listagem. Sem lógica nova: reexports, para a loja importar de um lugar só, como no rastreio.
 */
export { paginaDaRota, colecaoDaRota, artigosDaColecao, redirecionamentoDe, visivelAgora, tituloDaPagina, rotaDePagina, rotaDeColecao, RESERVADOS_FIXOS, ARTIGOS_POR_PAGINA, PREFIXO_DE_PAGINAS_PADRAO, PREFIXO_DA_PREVIA, type PaginaDoLojista, type ColecaoDePaginas, type ManifestPaginasDoLojista, type TipoDePagina, type Visibilidade, type SeoDaPagina } from "./document";

/**
 * O QUE VAI AO NAVEGADOR (os dois cortes de `document.ts`, puros; saem por aqui porque é daqui que a
 * loja lê o publicado). O documento viaja serializado no HTML de toda página, e as páginas do lojista
 * o fariam crescer sem teto: o layout raiz entrega `documentoSemPaginas(conteudo)` ao provider, e a
 * rota que renderiza uma página do lojista acrescenta `fatiaDoDocumento(doc, alvos)` com
 * `<EditableFatia>`. Rota nova que renderize container do lojista sem a fatia mostra o literal do
 * código no lugar do texto do lojista, sem erro nenhum na tela — e é isso que o gate de cobertura
 * editável passou a cobrar, pelo par (layout que corta, casca que junta).
 */
export { documentoSemPaginas, fatiaDoDocumento } from "./document";

/**
 * O DOCUMENTO PUBLICADO DESTE PEDIDO, para quem precisa dele sem o receber por parâmetro. `cache` do React
 * é por pedido: o layout faz `await getPublishedContent()` e, na mesma renderização, chama
 * `presencaNoAmbiente(process.env, { unboxGtmId })` sem passar o documento (é a linha que o CLI carimba em
 * toda loja). O
 * estado da CAPI depende do Pixel EM VIGOR, que pode ser o que o lojista publicou, então a presença tem de
 * ver o documento: ela o pega daqui. Fora de uma renderização (rota de API), `cache` não guarda nada e o
 * slot vem vazio: aí vale só o ambiente, e quem precisa do documento o passa (a rota /api/capi passa).
 */
const documentoDoPedido = cache((): { doc?: ContentDocument | null } => ({}));

/**
 * A presença no ambiente e o estado da CAPI para o manifesto, com o documento publicado que este pedido
 * já leu (ou o `doc` passado, quando quem chama o tem), e o contêiner contratual da Unbox (`unboxGtmId`, o
 * mesmo literal que o layout passa ao `<Rastreio>`), para o painel não anunciar supressão de Pixel que a
 * loja não executa. A linha do layout: `presencaNoAmbiente(process.env, { unboxGtmId: UNBOX_GTM_ID })`. A
 * regra está em `presencaNoAmbiente` de document.ts.
 */
export function presencaNoAmbiente(ambiente: Ambiente, opcoes?: { doc?: ContentDocument | null; unboxGtmId?: string }): ManifestApps {
  return presencaPura(ambiente, { doc: opcoes?.doc === undefined ? (documentoDoPedido().doc ?? null) : opcoes.doc, unboxGtmId: opcoes?.unboxGtmId });
}

/**
 * BLOCO DE HTML E TEXTO FORMATADO, CAMADA 2 DE 3 — a conferência da LOJA, na porta de entrada do documento
 * publicado. Vale para os dois tipos que carregam marcação, cada um pela régua dele: o bloco de HTML
 * (`.html`, lista de recusa) e o texto formatado (`.rico`, lista fechada, foundation 13). O texto que se segue
 * fala do bloco de HTML; o texto formatado passa pela MESMA porta pelos mesmos três motivos.
 *
 * As outras duas: o EDITOR ao gravar (limpa e RELATA ao lojista o que tirou — é a única que tem alguém
 * na tela para avisar) e o PRIMITIVO no cliente (a única que existe na PRÉVIA, onde o rascunho chega
 * por postMessage sem ver servidor). Esta aqui não tem a quem relatar: ela só derruba, e escreve o
 * motivo no log da loja — silêncio total seria a loja mudando de conteúdo sem ninguém saber por quê.
 *
 * ── POR QUE ELA EXISTE, se `resolveValue` já recusa HTML no caminho `.html` ────────────────────────
 * 1. REGRA NOVA VALE PARA QUEM JÁ PUBLICOU. A lista de recusa (`recusaDeHtml`) mora no código da loja.
 *    No dia em que uma tag entrar nela, o documento publicado há seis meses continua o mesmo — é este
 *    varrimento, na leitura, que aplica a regra nova sem ninguém precisar republicar. Cobre também
 *    "voltar para uma versão antiga do documento", que é justamente um documento escrito sob a lista
 *    antiga.
 * 2. O QUE É RECUSADO NÃO CHEGA AO NAVEGADOR. O documento INTEIRO é entregue ao `EditableProvider`
 *    (app/layout.tsx) e viaja serializado dentro do HTML da página. `resolveValue` defende o RENDER —
 *    o bloco não é injetado —, mas o texto do `<script>` recusado ainda sairia impresso no payload da
 *    página, para qualquer um ler ou copiar. Derrubando na porta, ele não sai do servidor.
 *    MEDIDO em `next build` + `next start`: o HTML recusado não aparece nenhuma vez na página
 *    servida (nem escapado como `\u003cscript\u003e`). Em `next dev` ele AINDA aparece, e não é esta
 *    função falhando: o modo de desenvolvimento serializa a resposta crua do `fetch` e ecoa o
 *    `console.warn` do servidor no fluxo da página, tudo isso ANTES de o documento chegar aqui. Quem
 *    for conferir, confira no build de produção.
 * 3. CAMINHO SEM PRIMITIVO NUNCA PASSA POR `resolveValue`. Um `.html` de seção que saiu do código, ou
 *    de uma seção criada cujo tipo deixou o catálogo, não é lido por primitivo nenhum — e mesmo assim
 *    viajaria no documento pelo motivo 2.
 *
 * Não depende do editor: `recusaDeHtml` é função pura do `document.ts` desta loja, sem rede e sem
 * biblioteca. A loja não pede opinião a ninguém para decidir o que renderiza.
 *
 * O que ela NÃO faz: a LIMPEZA por allowlist (tirar uma tag fora da lista, um atributo que não serve)
 * continua só no editor, e de propósito — ela roda no momento da colagem, com o relatório do que saiu
 * na tela. Repeti-la aqui, muda, faria a página publicada divergir em silêncio da prévia que o lojista
 * aprovou. Aqui vale a RECUSA, que é a decisão do dono: o bloco inteiro entra ou não entra.
 */
/** o que a régua de cada tipo recusa: `[caminho, motivo, o nome do tipo para o log]` */
function blocosRecusadosDoDocumento(doc: ContentDocument): [string, string, string][] {
  const recusados: [string, string, string][] = [];
  for (const [path, v] of Object.entries(doc.values)) {
    // é o SUFIXO do caminho que diz a régua (a loja lê o publicado sem manifesto): `.html` ou `.rico`
    const html = isHtmlPath(path);
    if (!html && !isRichPath(path)) continue;
    // valor que nem sequer é texto já é lixo neste caminho: as réguas só sabem ler string
    const motivo = typeof v === "string" ? (html ? recusaDeHtml(v) : recusaDeTextoRico(v)) : "o valor gravado não é texto";
    if (motivo) recusados.push([path, motivo, html ? "bloco de HTML" : "texto formatado"]);
  }
  return recusados;
}

function semBlocosRecusados(doc: ContentDocument): ContentDocument {
  const recusados = blocosRecusadosDoDocumento(doc);
  if (recusados.length === 0) return doc; // o caso normal: nada é copiado à toa
  const values = { ...doc.values };
  for (const [path, motivo, tipo] of recusados) {
    delete values[path];
    // apagar o caminho = a loja cai no `fallback` do código (os dois nascem vazios, então somem).
    console.warn(`[editable] ${tipo} recusado na leitura do publicado (${path}): ${motivo}`);
  }
  return { ...doc, values };
}

/**
 * A LEITURA do publicado deste pedido, dizendo qual dos dois casos foi: AUSÊNCIA (`doc: null`, `falhou:
 * false`: 404, a loja nunca publicou, ou loja desligada do editor) ou FALHA DE LEITURA (`falhou: true`: rede,
 * 5xx, JSON inválido, documento malformado ou de outra loja). A classificação é `leituraDoPublicado` de
 * document.ts (pura, testada no runner do editor); aqui entram o `fetch` com ISR, o aviso no log e a
 * conferência dos blocos de HTML. É o que a rota /api/capi lê (`capiDaLeitura`).
 */
export const lerPublicado = cache(async (): Promise<LeituraDoPublicado> => {
  const leitura = await lerDoEditor();
  documentoDoPedido().doc = leitura.doc; // o que o `presencaNoAmbiente` deste arquivo vê no mesmo pedido
  return leitura;
});

/** o documento publicado, ou null: a loja nunca publicou OU a leitura falhou. Para RENDERIZAR, os dois são "vale o código". */
export const getPublishedContent = cache(async (): Promise<ContentDocument | null> => (await lerPublicado()).doc);

async function lerDoEditor(): Promise<LeituraDoPublicado> {
  // loja desligada do editor: AUSÊNCIA, não falha (não há o que ler)
  if (!EDITOR_URL || !STORE_SLUG) return { doc: null, falhou: false };
  const leitura = await leituraDoPublicado(
    () => fetch(`${EDITOR_URL}/api/content/${encodeURIComponent(STORE_SLUG)}/published`, {
      next: { revalidate: 300, tags: ["unbox-editor-content"] },
      headers: { accept: "application/json" },
    }),
    STORE_SLUG,
  );
  // A loja não cai por causa do editor: é a promessa do topo deste arquivo. Falhou = conteúdo do código, com
  // o motivo no log (e `falhou: true` para quem decide a partir do publicado).
  if (leitura.falhou) {
    console.warn(`[editable] ${leitura.motivo}; usando conteúdo do código`);
    return leitura;
  }
  // o documento só sai daqui depois da conferência dos blocos de HTML e dos textos formatados (ver `semBlocosRecusados`)
  return { doc: leitura.doc && semBlocosRecusados(leitura.doc), falhou: false };
}

/**
 * O RECIBO DA REVALIDAÇÃO — o que esta loja está servindo AGORA, para o editor poder (ou não) dizer
 * "a loja já está no ar com a versão N".
 *
 * O editor publica e chama `/api/revalidate` daqui. Até hoje ele concluía "está no ar" porque a
 * resposta trazia a palavra "revalidated" — e isso não prova nada: purgar o cache diz que a PRÓXIMA
 * leitura vai buscar de novo, não que ela aconteceu nem que deu certo. Uma loja sem `EDITOR_URL` (que
 * nunca lê o editor), uma loja que responde 401, ou um documento de outra loja no meio do caminho
 * davam a MESMA frase de sucesso para o lojista.
 *
 * Então esta função vai ver: lê o conteúdo publicado SEM CACHE e devolve o `updatedAt` do documento
 * que passou por todas as portas que a loja usa para renderizar (`documentoUsavel`, a conferência do
 * slug e a dos blocos de HTML e textos formatados). O editor compara com o que acabou de publicar. Se bater, "no ar" é
 * afirmação verificada; se não bater, ele diz o que sabe (atualização pedida).
 *
 * Não substitui `getPublishedContent` nem aquece o cache dele: é uma leitura à parte, curta, feita
 * DEPOIS do `revalidateTag`. O que ela garante é que o conteúdo novo chegou até aqui e é utilizável,
 * e que a próxima renderização vai buscar do mesmo lugar.
 */
export type ConteudoAgora = { ok: true; updatedAt?: string; blocosRecusados: number } | { ok: false; motivo: string };

export async function conteudoPublicadoAgora(): Promise<ConteudoAgora> {
  if (!EDITOR_URL || !STORE_SLUG) return { ok: false, motivo: "esta loja não está ligada ao editor (sem EDITOR_URL)" };
  try {
    const res = await fetch(`${EDITOR_URL}/api/content/${encodeURIComponent(STORE_SLUG)}/published`, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      redirect: "manual",
    });
    if (res.status === 404) return { ok: false, motivo: "o editor ainda não tem conteúdo publicado para esta loja" };
    if (!res.ok) return { ok: false, motivo: `o editor respondeu ${res.status}` };
    const doc = (await res.json()) as ContentDocument;
    if (!documentoUsavel(doc)) return { ok: false, motivo: "o conteúdo publicado veio malformado" };
    if (doc.shop !== STORE_SLUG) return { ok: false, motivo: `o conteúdo publicado é de outra loja (${String(doc.shop)})` };
    // blocos recusados (de HTML ou de texto formatado) NÃO derrubam o recibo: o resto do documento está no
    // ar, e é isso que o editor afirma. O número sobe junto para o editor poder avisar o lojista do pedaço
    // que ficou de fora.
    return { ok: true, updatedAt: typeof doc.updatedAt === "string" ? doc.updatedAt : undefined, blocosRecusados: blocosRecusadosDoDocumento(doc).length };
  } catch (err) {
    return { ok: false, motivo: err instanceof Error ? err.message : String(err) };
  }
}
