// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENTO DE CONTEÚDO — o que o editor (chat e CMS visual) edita.
//
// Funções puras, sem React e sem Node: o mesmo arquivo roda na loja, no editor
// e no gate. O documento guarda SÓ o que o lojista mudou; o conteúdo original
// continua no código (é o `fallback` de cada primitivo). Sem documento, a loja
// renderiza exatamente o que o construtor escreveu — é o que garante que ligar
// o editor numa loja existente não muda um pixel.
// ═══════════════════════════════════════════════════════════════════════════

export type EditableType = "text" | "image" | "link" | "color" | "vitrine" | "video" | "html";

/**
 * Vale para IMAGEM e para VÍDEO: os dois guardam `{ src, alt? }`, e por isso o upload, o `isSafeUrl` e o
 * inspector do painel são os mesmos. O que separa os dois é só o TIPO declarado no manifesto — é ele que
 * diz ao painel se a prévia é um `<img>` ou um `<video>`, e é ele que sabe o limite de arquivo (8 MB de
 * imagem contra 32 MB de vídeo). Consequência: `typeOfValue` não distingue os dois, quem valida precisa
 * olhar o tipo da entrada (ver a exceção em `validateOp`).
 */
export interface ImageValue {
  src: string;
  alt?: string;
}
export interface LinkValue {
  href: string;
  label?: string;
}
/**
 * VITRINE: quais produtos uma seção mostra. O documento guarda só a ESCOLHA (categoria da Unbox, lista de
 * produtos ou busca); quem resolve isso em produtos de verdade é a LOJA, no servidor, com o cliente da Unbox
 * que ela já usa. Assim o editor nunca vê credencial nem catálogo, e preço/estoque continuam vindo do painel.
 */
export type VitrineValue =
  | { modo: "categoria"; tagId: string; nome?: string; limite?: number }
  | { modo: "produtos"; produtos: string[]; limite?: number }
  | { modo: "busca"; texto: string; limite?: number };

export type EditableValue = string | ImageValue | LinkValue | StyleValue | VitrineValue;

/** Limite de produtos que uma vitrine pode pedir (a loja pode mostrar menos). */
export const VITRINE_MAX = 24;

/** A escolha da vitrine é bem formada? (usado na validação e ao resolver o valor) */
export function vitrineValida(v: unknown): v is VitrineValue {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  const limiteOk = o.limite === undefined || (typeof o.limite === "number" && Number.isInteger(o.limite) && o.limite >= 1 && o.limite <= VITRINE_MAX);
  if (!limiteOk) return false;
  // ids da Unbox podem ser OPACOS (base64: +, /, =). Recusá-los deixaria o seletor de categorias vazio em
  // toda loja. Continuam sendo só ids — vão em `values`, nunca em caminho.
  const id = (x: unknown) => typeof x === "string" && x.length > 0 && x.length <= 200 && /^[\w:.@+/=-]+$/.test(x);
  if (o.modo === "categoria") return id(o.tagId) && (o.nome === undefined || (typeof o.nome === "string" && o.nome.length <= 120)) && Object.keys(o).every((k) => ["modo", "tagId", "nome", "limite"].includes(k));
  if (o.modo === "produtos") return Array.isArray(o.produtos) && o.produtos.length > 0 && o.produtos.length <= VITRINE_MAX && o.produtos.every(id) && Object.keys(o).every((k) => ["modo", "produtos", "limite"].includes(k));
  if (o.modo === "busca") return typeof o.texto === "string" && o.texto.trim().length > 0 && o.texto.length <= 120 && Object.keys(o).every((k) => ["modo", "texto", "limite"].includes(k));
  return false;
}

/**
 * Um produto JÁ RESOLVIDO por uma escolha de vitrine — o mesmo contrato, campo por campo, que a
 * loja devolve ao seletor do editor (`/api/unbox/catalogo`) e à prévia (`/api/unbox/vitrine`).
 *
 * `imagem` e `preco` podem ser `null`: é ausência HONESTA (o painel não tem foto, o produto não
 * tem variante com preço). Quem renderiza mostra "—" em vez de inventar zero ou foto genérica.
 */
export interface VitrineProdutoResolvido {
  /** `productId` da Unbox — é o que o carrinho e o `getProductById` usam. */
  id: string;
  titulo: string;
  slug: string;
  imagem: string | null;
  preco: number | null;
  esgotado: boolean;
}

/**
 * O estado da resolução da vitrine NA PRÉVIA.
 *
 * Em produção quem resolve a escolha em produtos é o SERVIDOR da loja, a partir do documento
 * PUBLICADO, e este objeto não existe (o primitivo passa `undefined` ao render-prop). Na prévia o
 * rascunho vive no CLIENTE — chega por `postMessage` e nunca passou pelo servidor —, então quem
 * pergunta à loja "o que esta escolha vira" é o próprio primitivo, e o resultado chega aqui.
 *
 * `produtos: null` com `erro: null` e `carregando: false` significa "não há nada resolvido daqui":
 * o lojista ainda não escolheu, e a seção continua mostrando o que o CÓDIGO mostra.
 *
 * ⚠️ `erro` NUNCA vira lista vazia. Vitrine vazia lê como "essa escolha não tem produto", e
 * confundir isso com "não consegui ler o catálogo" é o jeito de o lojista publicar às cegas.
 */
export interface PreviaDaVitrine {
  /** produtos resolvidos AGORA, a partir do rascunho; `null` = nada resolvido pela prévia */
  produtos: VitrineProdutoResolvido[] | null;
  carregando: boolean;
  /** motivo em língua de lojista quando a loja não respondeu; `null` quando não houve falha */
  erro: string | null;
}

/**
 * Lê a resposta da loja (`{ produtos: [...] }`) no contrato acima.
 *
 * Devolve `null` quando a resposta não tem a forma esperada — e `null` é ERRO, não lista vazia:
 * quem chama mostra "a loja respondeu algo que não entendi" em vez de uma grade sem produto.
 * Um ITEM sem id ou sem slug é descartado (não dá para linkar nem para identificar), mas isso não
 * invalida a resposta inteira.
 */
export function produtosDaVitrine(bruto: unknown): VitrineProdutoResolvido[] | null {
  if (!bruto || typeof bruto !== "object") return null;
  const lista = (bruto as { produtos?: unknown }).produtos;
  if (!Array.isArray(lista)) return null;
  const out: VitrineProdutoResolvido[] = [];
  for (const item of lista) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const slug = typeof o.slug === "string" ? o.slug : "";
    if (!id || !slug) continue;
    out.push({
      id,
      slug,
      titulo: typeof o.titulo === "string" ? o.titulo : "",
      imagem: typeof o.imagem === "string" && o.imagem ? o.imagem : null,
      preco: typeof o.preco === "number" && Number.isFinite(o.preco) ? o.preco : null,
      esgotado: o.esgotado === true,
    });
  }
  return out;
}

/**
 * O ÚLTIMO segmento do caminho de TODA vitrine e de todo vínculo de produto
 * (`<container>.<id da seção>.vitrine`).
 *
 * Mora aqui, e não no lado servidor da loja, porque os DOIS lados precisam da mesma string: o
 * cliente a monta a partir do escopo da seção (`joinPath(ctx.scope, CAMPO_VITRINE)`) e o servidor
 * DESCOBRE quais vitrines a página tem varrendo o documento atrás deste sufixo. Enquanto ela vivia
 * só em `lib/vitrine.ts` (que é `server-only`, e portanto invisível para um componente de cliente),
 * cada seção repetia o literal com um comentário pedindo "se mexer aqui, mexa lá" — e mexer nos dois
 * é exatamente o que ninguém lembra de fazer. Trocá-la em UM lugar só descolaria loja e painel EM
 * SILÊNCIO: a loja leria uma caixa e o editor escreveria em outra, sem erro nenhum na tela.
 */
export const CAMPO_VITRINE = "vitrine";

/**
 * VÍNCULO DE UM PRODUTO — a seção presa a UM SKU (o bloco de um variante, um card da grade, o combo).
 *
 * NÃO é um tipo novo: é a MESMA vitrine, no modo `produtos`, com um item e `limite: 1`. O seletor do
 * painel é o mesmo, a rota que resolve é a mesma (`POST /api/unbox/vitrine`) e a seção lê o PRIMEIRO
 * produto que voltar. Um tipo próprio significaria outro seletor, outra rota e outro caminho de
 * falha para manter — tudo para guardar exatamente a mesma informação.
 *
 * `idOuSlug` é o que o CÓDIGO já usa para achar o produto (nas receitas, o slug da receita). É ele
 * que a seção mostra enquanto o lojista não escolher nada, e é para ele que o painel volta quando o
 * lojista clica em "voltar ao original".
 *
 * ⚠️ Só chame com um id/slug de verdade. `vitrineValida` recusa lista vazia, então uma seção que o
 * código NÃO amarrou a produto nenhum não tem vínculo para oferecer — e não deve renderizar o
 * primitivo com um id inventado só para ter um.
 */
export function vinculoDeProduto(idOuSlug: string): VitrineValue {
  return { modo: "produtos", produtos: [idOuSlug], limite: 1 };
}

/**
 * O produto de um vínculo de UM produto — a regra de precedência, num lugar só, para toda seção
 * presa a um SKU não inventar a sua.
 *
 * `previa` (só existe em modo edição) é o RASCUNHO de agora e ganha do `doServidor`, que é o que a
 * página resolveu a partir do documento PUBLICADO quando foi renderizada. Em produção `previa` é
 * `undefined` e sobra o servidor — que é como sempre foi.
 *
 * Devolve `null` em três situações, e todas as três significam a MESMA coisa para quem renderiza —
 * "mostre o produto do CÓDIGO":
 *   · o lojista ainda não escolheu nada (nem prévia nem servidor têm o que dizer);
 *   · a escolha dele não achou produto nenhum hoje (produto despublicado, categoria esvaziada);
 *   · a loja não respondeu à prévia (o primitivo já põe a tarja vermelha em cima da seção).
 *
 * Cair no produto do código é a única saída aceitável na página do cliente: a seção é copy da marca
 * com um produto dentro, e fazê-la SUMIR levaria junto o texto que o lojista escreveu. Quem precisa
 * saber que a escolha não resolveu é o LOJISTA, e ele é avisado onde dá para consertar: a tarja da
 * prévia, que não existe em produção.
 */
export function produtoDoVinculo(
  previa: PreviaDaVitrine | undefined,
  doServidor: VitrineProdutoResolvido[] | null | undefined,
): VitrineProdutoResolvido | null {
  // lista vazia é resposta LEGÍTIMA ("essa escolha não mostra nada hoje") e vira `null` aqui de
  // propósito; `produtos: null` é erro ou "nada escolhido", e aí ainda vale o que o servidor trouxe
  if (previa?.produtos) return previa.produtos[0] ?? null;
  return doServidor?.[0] ?? null;
}

export const ESTILO = ".estilo";
export function isStylePath(path: string) {
  return path.endsWith(ESTILO);
}

// ── BLOCO DE HTML: o lojista cola HTML pronto (um selo, uma tabela, o embed que o fornecedor mandou)

/**
 * Sufixo RESERVADO do caminho de um bloco de HTML (`home.bloco-1.conteudo.html`) — o mesmo truque do
 * `.estilo`. É ele que permite ao SERVIDOR DA LOJA saber que um valor é HTML: a loja lê o documento
 * publicado sem manifesto nenhum, então sem uma marca NO CAMINHO ela não teria como distinguir um
 * bloco de HTML de um texto qualquer, e publicaria HTML cru sem passar pela lista de recusa.
 * Quem carimba o sufixo é o primitivo (`Editable.Html`): o construtor escreve `path="conteudo"`.
 */
export const SUFIXO_HTML = ".html";
export function isHtmlPath(path: string) {
  return path.endsWith(SUFIXO_HTML);
}

/** Teto de UM bloco de HTML (decisão do dono). Acima disso o bloco inteiro é recusado. */
export const HTML_MAX = 20000;

/** `&#106;`, `&#x6a;`, `&colon;` — o navegador decodifica isto no VALOR de um atributo. */
function umCodigo(n: number): string {
  return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
}
const NOMEADAS: Record<string, string> = { colon: ":", tab: "\t", newline: "\n", sol: "/", lpar: "(", rpar: ")" };
function decodificaEntidades(s: string): string {
  return s
    .replace(/&#x([0-9a-f]{1,6});?/gi, (_m, h: string) => umCodigo(parseInt(h, 16)))
    .replace(/&#(\d{1,7});?/g, (_m, d: string) => umCodigo(Number(d)))
    .replace(/&(colon|tab|newline|sol|lpar|rpar);?/gi, (_m, nome: string) => NOMEADAS[nome.toLowerCase()] ?? "");
}

/**
 * Tags recusadas: a regex que ACHA, o nome que aparece na tela e o porquê que o lojista lê.
 *
 * A busca é no HTML CRU de propósito: uma tag de verdade precisa de um `<` literal, e `&lt;script&gt;`
 * é justamente como se MOSTRA a palavra sem executá-la — decodificar antes desta busca recusaria um
 * bloco legítimo que só quer exibir um trecho de código.
 *
 * O PORQUÊ é escrito para todas as formas da tag, não só para a pior. As duas primeiras linhas de um
 * snippet de fornecedor costumam ser `<meta charset="utf-8">` e `<link rel="preconnect" …>`: dizer a
 * quem colou isso que a tag "redireciona a loja inteira" ou que é "folha de estilo de fora" é uma
 * acusação que não corresponde ao que ele tem na mão — ele procura o redirecionamento, não acha, e
 * conclui que o editor está quebrado. A RECUSA continua a mesma (as duas ficam fora do bloco, em
 * qualquer grafia); o que muda é a frase ser verdadeira nos dois casos e o trecho achado ir junto,
 * porque é ele que diz QUAL linha tirar.
 */
const TAGS_RECUSADAS: ReadonlyArray<readonly [RegExp, string, string]> = [
  // as quatro DECLARADAS pelo dono
  [/<\s*\/?\s*script\b/i, "<script>", "código que roda dentro da sua loja"],
  [/<\s*\/?\s*iframe\b/i, "<iframe>", "página de outro site embutida na sua"],
  [/<\s*\/?\s*form\b/i, "<form>", "formulário que manda dados para fora da loja"],
  [/<\s*\/?\s*style\b/i, "<style>", "CSS que vazaria para o resto da loja"],
  // as quatro seguintes são a MESMA decisão dita por extenso, não uma regra nova: fazem exatamente o
  // que as declaradas fazem, por outra tag. Sem elas a recusa do <style> e do <iframe> é contornável
  // com um copiar-colar, e a promessa "sem <style>, não existe seletor global para vazar" fica falsa.
  [/<\s*\/?\s*(?:object|embed)\b/i, "<object>/<embed>", "carregam página de fora, igual ao <iframe>"],
  [/<\s*\/?\s*link\b/i, "<link>", 'essa tag é de configuração da página, não conteúdo do bloco, e em algumas formas ela mexe na loja inteira (com rel="stylesheet" ela traz CSS de fora, o mesmo vazamento do <style>)'],
  [/<\s*\/?\s*base\b/i, "<base>", "muda o destino de TODOS os links da página"],
  [/<\s*\/?\s*meta\b/i, "<meta>", 'essa tag é de configuração da página, não conteúdo do bloco, e em algumas formas ela mexe na loja inteira (com http-equiv="refresh" ela troca a loja de endereço)'],
];

/**
 * Quanto do trecho achado cabe na frase da recusa. O bloco tem até 20.000 caracteres e a mensagem vai
 * para a tela: mostrar a tag encontrada é o que responde "qual linha eu tiro?", mostrar o bloco todo
 * seria despejar o que a pessoa colou de volta na cara dela.
 */
const TRECHO_MAX = 90;

/** A tag achada, do `<` até o `>` dela, numa linha só — o que o lojista precisa procurar e apagar. */
function trechoDaTag(html: string, inicio: number): string {
  const fecha = html.indexOf(">", inicio);
  const inteira = fecha >= 0 && fecha - inicio < TRECHO_MAX;
  const pedaco = html.slice(inicio, inteira ? fecha + 1 : inicio + TRECHO_MAX).replace(/\s+/g, " ").trim();
  return inteira ? pedaco : `${pedaco}…`;
}

/**
 * Atributo de evento (`onclick=`, `onerror=`). O nome do atributo NÃO é decodificado pelo navegador
 * (`&#111;nclick` não vira `onclick`), então a busca é no cru. O que precede é espaço, `/` ou a aspa
 * que fecha o atributo anterior — `<img src="x"onerror=alert(1)>` não tem espaço nenhum e funciona.
 */
const ATRIBUTO_ON = /["'\/\s]on[a-z][a-z0-9]*\s*=/i;

/**
 * O MESMO atributo de evento escrito de outro jeito: `<svg><set attributeName="onload" to="…">` monta
 * um `onload` sem nunca escrever `on…=`. Medido: passava pela lista acima. A regra continua sendo a
 * declarada (nada de atributo de evento), só que dita para esta grafia.
 */
const ATRIBUTO_ON_POR_SVG = /attributename\s*=\s*["']?\s*on/i;

/**
 * O que impede este HTML de ser usado — a frase que o LOJISTA lê —, ou `null` quando o bloco passa.
 *
 * Decisão do dono: recusa o BLOCO INTEIRO, não limpa pedaço. Um bloco que volta "quase igual" é pior
 * que um recusado com o motivo na tela: o lojista publica sem perceber o que sumiu. E limpar tem um
 * modo de falha próprio — tirar o `<script>` do meio de `<scr<script>ipt>` MONTA um `<script>` novo.
 *
 * Pura e sem dependência porque roda em TRÊS lugares, cada um com um trabalho: no editor ao gravar
 * (a única camada que RELATA ao lojista), na loja ao ler o publicado (é o que faz uma regra nova
 * valer para quem já publicou, e cobre "voltar para uma versão antiga") e no primitivo, no cliente —
 * a única camada que existe na PRÉVIA, onde o rascunho chega por postMessage sem ver servidor.
 */
export function recusaDeHtml(html: string): string | null {
  if (typeof html !== "string") return "bloco de HTML precisa ser texto";
  if (html.length > HTML_MAX) return `bloco com ${html.length} caracteres: o teto é ${HTML_MAX}`;
  for (const [re, tag, porque] of TAGS_RECUSADAS) {
    const achado = re.exec(html);
    if (!achado) continue;
    // o trecho só entra quando diz algo que o nome da tag já não disse: para `<script>alert(1)</script>`
    // ele é `<script>` e repetir seria ruído; para `<meta charset="utf-8">` ele É a resposta
    const trecho = trechoDaTag(html, achado.index);
    const semEspaco = (s: string) => s.replace(/\s+/g, "").toLowerCase();
    const onde = semEspaco(trecho) === semEspaco(tag) ? "" : `. O trecho é «${trecho}»`;
    return `não dá para usar ${tag}: ${porque}${onde}`;
  }
  if (ATRIBUTO_ON.test(html) || ATRIBUTO_ON_POR_SVG.test(html)) return "não dá para usar atributo on… (onclick, onerror): é código que roda no clique ou ao carregar";
  // esquema `javascript:`: aqui SIM decodificando, e sem espaço nenhum. O navegador ignora TAB/LF/CR
  // dentro de uma URL e decodifica entidades no valor do atributo, então `java&#115;cri\tpt:` navega
  // igual a `javascript:` — procurar só o literal deixaria a recusa contornável no copiar-colar.
  const compacto = decodificaEntidades(html).replace(/[\s\u0000-\u0020\u00a0\u1680\u2000-\u200f\u2028\u2029\u202f\u205f\u3000\ufeff]/g, "").toLowerCase();
  if (compacto.includes("javascript:")) return "link javascript: não entra, porque é código que executa ao clicar";
  // `vbscript:` e `data:text/html` são o MESMO `javascript:` com outro nome: um link que abre código
  // em vez de conteúdo. Medido: `data:text/html;base64,…` passava. `data:image/…` continua passando —
  // imagem embutida é uso legítimo e não executa nada.
  if (compacto.includes("vbscript:")) return "link vbscript: não entra, porque é código que executa ao clicar";
  if (compacto.includes("data:text/html")) return "link data:text/html não entra, porque abre uma página inteira no lugar do conteúdo";
  return null;
}

export interface SectionState {
  /** Ordem completa dos ids do container. Ids fora da lista vão pro fim, na ordem do código. */
  order?: string[];
  hidden?: string[];
  /** cópias feitas pelo lojista: id da cópia → id da seção de origem (a cópia renderiza o
   *  mesmo componente com outro escopo, então nasce com todos os textos editáveis). */
  clones?: Record<string, string>;
  /** seções ADICIONADAS pelo lojista: id da criada → TIPO do catálogo que a loja declara saber
   *  instanciar. Gêmeo de `clones`, com a diferença que custa caro: a cópia tem origem no código (dá
   *  para re-derivar caminho por caminho a partir dela), a criada NÃO tem — ela nasce com os literais
   *  do componente e nada é escrito em `values`. O id começa sempre em `novo-` (ver `PREFIXO_CRIADA`). */
  criadas?: Record<string, string>;
}

/**
 * Prefixo RESERVADO do id de uma seção criada (`novo-faq-1`). É o que torna impossível POR CONSTRUÇÃO
 * a colisão com um id que o construtor venha a escrever no código depois — e não existe renomear.
 * Também é o que deixa a projeção do manifesto se curar sozinha: uma linha de seção com este prefixo
 * nunca é seção do código, mesmo que o manifesto postado tenha perdido a marca `criada`.
 */
export const PREFIXO_CRIADA = "novo-";
export function ehIdDeCriada(id: string): boolean {
  return id.startsWith(PREFIXO_CRIADA);
}

/** Cor/fundo de UM elemento, por cima do token (o "desacoplar do mapa de cores"). Fica em `<caminho>.estilo`. */
export interface StyleValue {
  color?: string;
  background?: string;
}

/** registro de honestidade: quem declarou, quando, e (numa cópia) de qual caminho veio */
export interface DeclaredEntry {
  by: string;
  at: string;
  note?: string;
  from?: string;
}

// ── APPS: RASTREIO E MARKETING (foundation 12) ───────────────────────────────────────────────────
//
// O que o lojista configura na aba "Apps" do painel: os IDs de rastreio DELE (Google Tag Manager,
// Google Analytics 4, Meta Pixel, TikTok Pixel, Pinterest Tag) e o botão flutuante de WhatsApp. Ele
// digita, publica, e a loja passa a disparar. Antes disso tudo vivia só em variável de ambiente.
//
// SÓ IDs ENTRAM NO DOCUMENTO. O documento publicado é público (`GET /api/content/<loja>/published`
// serve sem autenticação), e cada ID daqui já aparece no HTML da página de qualquer jeito. Segredo
// NUNCA entra: o token da Conversions API do Meta fica no ambiente da loja (`META_CAPI_TOKEN`, só
// servidor), e o painel só diz o ESTADO dela (`EstadoDoCapi`, ver `capiEmVigor`), nunca o valor.
//
// PRECEDÊNCIA, a mesma da copy (`resolveValue`): o valor do documento vence o do ambiente, e o
// ambiente é o "literal do código". Um provedor dispara UMA vez: com valor no documento E no
// ambiente, só o do documento entra na página, senão a conversão conta em dobro (`rastreioEmVigor`).
//
// O contêiner GTM CONTRATUAL da Unbox não mora aqui: é contrato, não configuração do lojista. Ele
// continua no código da loja (o literal do app/layout.tsx, que o `<Rastreio>` de rastreio.tsx recebe),
// sempre ligado, e o `gtm` daqui é o contêiner PRÓPRIO do lojista, que convive com o da Unbox lendo o
// mesmo dataLayer.
//
// QUEM RENDERIZA é a foundation (rastreio.tsx, servidor): o layout da loja chama `<Rastreio>` numa
// linha e não conhece provedor nenhum. O próximo provedor entra por versão da foundation.

export interface Rastreio {
  /** contêiner do Google Tag Manager PRÓPRIO da loja (GTM-XXXXXXX) */
  gtm?: string;
  /** Google Analytics 4: o ID de medição (G-XXXXXXXXXX) */
  ga4?: string;
  /** Meta Pixel: o ID numérico (15 ou 16 dígitos) */
  metaPixel?: string;
  /** TikTok Pixel: o ID que começa com C (cerca de 20 letras e números) */
  tiktok?: string;
  /** Pinterest Tag: o ID numérico (13 dígitos) */
  pinterest?: string;
  /**
   * botão flutuante de WhatsApp: número só dígitos com o código do país, e a mensagem inicial (opcional).
   * `numero` vazio = sem botão; a mensagem fica guardada para quando o número voltar.
   */
  whatsapp?: { numero: string; mensagem?: string };
}
export interface Apps {
  rastreio?: Rastreio;
}
export type ProvedorDeRastreio = keyof Rastreio;
export const PROVEDORES_DE_RASTREIO: readonly ProvedorDeRastreio[] = ["gtm", "ga4", "metaPixel", "tiktok", "pinterest", "whatsapp"];
/** O que o lojista edita, campo a campo: os cinco IDs e as duas partes do WhatsApp. */
export type CampoDeRastreio = Exclude<ProvedorDeRastreio, "whatsapp"> | "whatsapp.numero" | "whatsapp.mensagem";
export const CAMPOS_DE_RASTREIO: readonly CampoDeRastreio[] = ["gtm", "ga4", "metaPixel", "tiktok", "pinterest", "whatsapp.numero", "whatsapp.mensagem"];
/** o nome que o lojista lê, por provedor */
export const RASTREIO_NOME: Record<ProvedorDeRastreio, string> = {
  gtm: "Google Tag Manager",
  ga4: "Google Analytics",
  metaPixel: "Meta Pixel",
  tiktok: "TikTok Pixel",
  pinterest: "Pinterest Tag",
  whatsapp: "WhatsApp",
};
export const WHATSAPP_MENSAGEM_MAX = 300;
/** teto de qualquer ID ANTES de olhar o formato: um ID tem dezenas de caracteres, não milhares */
const RASTREIO_VALOR_MAX = 400;

/**
 * Um exemplo copiado da documentação ("GTM-XXXXXXX", "todo", "x", zeros) não é ID. Placeholder passa em
 * `if (id)`, o script carrega, inicializa com lixo e não reporta em lugar nenhum: sem sinal no painel do
 * provedor nem no DevTools. Vazio quebra visível; "x" quebra calado.
 */
const PLACEHOLDER_DE_ID = /^(x+|todo|placeholder|seu[-_]?id|sua[-_]?id|G-X+|GTM-X+|AW-X+|0+)$/i;
/** caractere de controle (fora de quebra de linha e tab): não tem o que fazer numa mensagem */
const CARACTERE_DE_CONTROLE = /[\u0000-\u0008\u000b-\u001f\u007f]/;

/**
 * O QUE NÃO CABE NUMA URL. Metade de um caractere (um substituto UTF-16 sem o par, o `"\ud800"` de um
 * JSON) passa por `typeof === "string"`, `Array.from` o conta como um caractere, e `encodeURIComponent`
 * LANÇA ao encontrá-lo. A mensagem do WhatsApp vai numa URL montada pelo `<Rastreio>`, que o layout de
 * TODA página da loja chama: uma mensagem dessas gravada no documento derrubava a loja inteira (Astra,
 * B1). A régua pergunta ao próprio `encodeURIComponent`, que é quem vai ler o valor depois: o que ele
 * recusa, a régua recusa, dos dois lados (ao gravar no editor e ao ler o publicado na loja).
 */
function cabeNumaUrl(valor: string): boolean {
  try {
    encodeURIComponent(valor);
    return true;
  } catch {
    return false;
  }
}

/**
 * O valor como ele é GUARDADO: sem espaço em volta; ID do Google e do TikTok em maiúsculas (é como
 * eles são emitidos, e é o que a URL do script espera); telefone sem a formatação que se digita
 * ("+55 (11) 99999-8888" vira "5511999998888"). A mensagem do WhatsApp só perde o espaço em volta.
 */
export function normalizaRastreio(campo: CampoDeRastreio, valor: string): string {
  const v = valor.trim();
  if (campo === "gtm" || campo === "ga4" || campo === "tiktok") return v.toUpperCase();
  if (campo === "whatsapp.numero") return v.replace(/[\s().+-]/g, "");
  return v;
}

/**
 * O motivo de recusa, na frase que o LOJISTA lê, ou `null` quando o valor serve. Espera o valor já
 * normalizado (`normalizaRastreio`). A régua é UMA e roda dos dois lados: no editor ao gravar (onde
 * recusa com motivo) e na loja ao ler o publicado (onde um valor que não bate é simplesmente ignorado
 * e vale o do ambiente, para a loja nunca carregar script com ID quebrado).
 */
export function recusaDeRastreio(campo: CampoDeRastreio, valor: string): string | null {
  if (typeof valor !== "string") return "o valor precisa ser texto";
  // caracteres como o lojista os conta (um emoji é um, não dois): o teto é em pontos de código, não em
  // unidades UTF-16, senão "até 300 caracteres" na tela seria mentira para uma mensagem com emoji
  const caracteres = Array.from(valor).length;
  if (campo === "whatsapp.mensagem") {
    if (caracteres > WHATSAPP_MENSAGEM_MAX) return `a mensagem do WhatsApp tem até ${WHATSAPP_MENSAGEM_MAX} caracteres (esta tem ${caracteres})`;
    if (CARACTERE_DE_CONTROLE.test(valor)) return "a mensagem do WhatsApp tem caracteres de controle que não dá para usar";
    if (!cabeNumaUrl(valor)) return "a mensagem do WhatsApp tem um caractere quebrado (metade de um emoji ou de um símbolo) que não dá para usar";
    return null;
  }
  if (caracteres > RASTREIO_VALOR_MAX) return `valor grande demais (${caracteres} caracteres)`;
  if (!cabeNumaUrl(valor)) return "o valor tem um caractere quebrado (metade de um emoji ou de um símbolo) que não dá para usar";
  if (PLACEHOLDER_DE_ID.test(valor)) return "isso parece um exemplo, não um ID de verdade";
  switch (campo) {
    case "gtm":
      return /^GTM-[A-Z0-9]{5,10}$/.test(valor) ? null : "o ID do Google Tag Manager tem a forma GTM-XXXXXXX: GTM- seguido de 7 letras ou números";
    case "ga4":
      return /^G-[A-Z0-9]{8,12}$/.test(valor) ? null : "o ID do Google Analytics tem a forma G-XXXXXXXXXX: G- seguido de 10 letras ou números (é o ID de medição do fluxo de dados)";
    case "metaPixel":
      return /^\d{15,16}$/.test(valor) ? null : "o ID do Meta Pixel é um número de 15 ou 16 dígitos";
    case "tiktok":
      return /^C[A-Z0-9]{15,30}$/.test(valor) ? null : "o ID do TikTok Pixel começa com C e tem cerca de 20 letras e números";
    case "pinterest":
      return /^\d{13}$/.test(valor) ? null : "o ID da Pinterest Tag é um número de 13 dígitos";
    case "whatsapp.numero":
      return /^\d{10,15}$/.test(valor) ? null : "o número do WhatsApp é só dígitos, com o código do país na frente (55 para o Brasil), de 10 a 15 dígitos, como 5511999998888";
    default:
      return `campo de rastreio desconhecido: ${String(campo)}`;
  }
}

/** um campo do documento, como está gravado; `""` conta como ausente */
export function campoDeRastreio(r: Rastreio | undefined, campo: CampoDeRastreio): string | undefined {
  if (!r) return undefined;
  const v = campo === "whatsapp.numero" ? r.whatsapp?.numero : campo === "whatsapp.mensagem" ? r.whatsapp?.mensagem : r[campo];
  return typeof v === "string" && v !== "" ? v : undefined;
}

/**
 * `apps` com UM campo trocado (`null` ou vazio = removido). Mapa que ficou vazio SOME: um `apps: {}`
 * no documento seria uma diferença inventada, e a barra passaria a dizer "não publicado" à toa.
 */
function comCampoDeRastreio(apps: Apps | undefined, campo: CampoDeRastreio, valor: string | null): Apps | undefined {
  const r: Rastreio = { ...(apps?.rastreio ?? {}) };
  const v = valor === null || valor === "" ? null : valor;
  if (campo === "whatsapp.numero" || campo === "whatsapp.mensagem") {
    const w = { ...(r.whatsapp ?? { numero: "" }) };
    if (campo === "whatsapp.numero") w.numero = v ?? "";
    else if (v === null) delete w.mensagem;
    else w.mensagem = v;
    if (!w.numero && !w.mensagem) delete r.whatsapp;
    else r.whatsapp = w;
  } else if (v === null) delete r[campo];
  else r[campo] = v;
  const resto: Apps = { ...(apps ?? {}) };
  if (Object.keys(r).length) resto.rastreio = r;
  else delete resto.rastreio;
  return Object.keys(resto).length ? resto : undefined;
}

export type OrigemDoRastreio = "documento" | "ambiente";
/**
 * Um valor que HAVIA e deixou de valer. Hoje só o Meta Pixel do ambiente tem isso: com um Tag Manager
 * próprio em vigor (do documento ou do ambiente), o Pixel do cadastro entra pelo contêiner, não pelo
 * código, senão PageView e conversão contam em dobro. A origem vai junto para o painel poder dizer "o do
 * cadastro deixa de valer porque há um Tag Manager".
 */
export interface SupressaoDeRastreio {
  origem: OrigemDoRastreio;
  por: "gtm";
}
export interface ValorDeRastreio<T> {
  valor: T | null;
  /** de onde veio o valor em vigor; `null` = nem o documento nem o ambiente têm */
  origem: OrigemDoRastreio | null;
  /** o valor que havia e não entra (ver `SupressaoDeRastreio`); ausente = nada foi suprimido */
  suprimido?: SupressaoDeRastreio;
}
export interface RastreioEmVigor {
  gtm: ValorDeRastreio<string>;
  ga4: ValorDeRastreio<string>;
  metaPixel: ValorDeRastreio<string>;
  tiktok: ValorDeRastreio<string>;
  pinterest: ValorDeRastreio<string>;
  whatsapp: ValorDeRastreio<{ numero: string; mensagem?: string }>;
}
/**
 * O ESTADO DA CONVERSIONS API DO META: o que a loja realmente faz com o token. É o que o manifesto leva ao
 * painel E o que a rota /api/capi da loja obedece; os dois saem de `capiEmVigor`, para nunca discordarem.
 * - "ativa": há token no servidor da loja, há um Meta Pixel em vigor, e ele é o Pixel do cadastro da loja,
 *   o mesmo para o qual o token foi emitido. A rota envia.
 * - "sem-token": não há token no servidor da loja. A rota não envia.
 * - "sem-pixel": há token, mas nenhum Meta Pixel em vigor (nem publicado, nem no cadastro). Não há o que
 *   espelhar; a rota não envia. Era o caso que o painel chamava de "configurada" (Astra, B5).
 * - "pixel-diferente-do-token": há token e há um Pixel em vigor, mas ele não é o do cadastro da loja (o
 *   lojista publicou outro, ou o cadastro não declara nenhum). Um token do Meta vale para UM Pixel: a rota
 *   não envia, para não mandar conversão de um Pixel com o token de outro (Astra, B4).
 */
export type EstadoDoCapi = "ativa" | "sem-token" | "sem-pixel" | "pixel-diferente-do-token";
/** o que a loja tem no AMBIENTE, só presença (nunca o valor), e o estado da CAPI: é o que o manifesto leva ao painel */
export interface ManifestApps {
  rastreio: {
    ambiente: Partial<Record<ProvedorDeRastreio, true>>;
    /** o estado da Conversions API do Meta (`EstadoDoCapi`). Só o estado: o token nunca sai do servidor. */
    capi: EstadoDoCapi;
    /**
     * o contêiner GTM CONTRATUAL da Unbox: o literal do app/layout.tsx, o mesmo que vai ao `<Rastreio>`. É
     * público (está no HTML de toda página), e o painel precisa dele para não anunciar supressão que a loja
     * não executa: um `gtm` publicado IGUAL a ele não é Tag Manager próprio (`rastreioEmVigor` o descarta e
     * MANTÉM o Pixel do cadastro), então o painel não pode dizer que o Pixel do cadastro deixou de valer
     * (Astra, segunda rodada, 4). Ausente = loja que ainda não o declara; o painel volta a inferir só pela
     * presença.
     */
    unboxGtmId?: string;
  };
}

/** As variáveis de ambiente que a loja lê para cada provedor: o "literal do código" do rastreio. */
export const VARIAVEIS_DE_RASTREIO = {
  gtm: "NEXT_PUBLIC_GTM_ID",
  ga4: "NEXT_PUBLIC_GA_ID",
  metaPixel: "NEXT_PUBLIC_META_PIXEL_ID",
  tiktok: "NEXT_PUBLIC_TIKTOK_PIXEL_ID",
  pinterest: "NEXT_PUBLIC_PINTEREST_TAG_ID",
  whatsappNumero: "NEXT_PUBLIC_WHATSAPP_NUMERO",
  whatsappMensagem: "NEXT_PUBLIC_WHATSAPP_MENSAGEM",
  capi: "META_CAPI_TOKEN",
  /** o Pixel para o qual o token da CAPI foi emitido; sem ele vale o Pixel do navegador (o cadastro documenta os dois como o mesmo ID) */
  capiPixel: "META_PIXEL_ID",
} as const;
export type Ambiente = Record<string, string | undefined>;

/** valor aceito pela régua (já normalizado), ou `undefined` */
function valorAceito(campo: CampoDeRastreio, bruto: unknown): string | undefined {
  if (typeof bruto !== "string") return undefined;
  const v = normalizaRastreio(campo, bruto);
  return v !== "" && !recusaDeRastreio(campo, v) ? v : undefined;
}
const IDS_DE_RASTREIO = ["gtm", "ga4", "metaPixel", "tiktok", "pinterest"] as const;

function whatsappAceito(numeroBruto: unknown, mensagemBruta: unknown): Rastreio["whatsapp"] | undefined {
  const numero = valorAceito("whatsapp.numero", numeroBruto);
  if (!numero) return undefined;
  const mensagem = valorAceito("whatsapp.mensagem", mensagemBruta);
  return mensagem ? { numero, mensagem } : { numero };
}

/**
 * O LINK DO BOTÃO DE WHATSAPP: wa.me com o número, e a mensagem inicial quando há uma. Mora aqui, e não em
 * rastreio.tsx, para ser testado no runner do editor. Protegido contra documento JÁ GRAVADO com mensagem que
 * `encodeURIComponent` recusa (metade de um caractere, gravada antes de a régua recusá-la): o botão sai
 * sem mensagem, nunca uma exceção, porque este link é montado no layout de toda página da loja (Astra, B1).
 * A régua (`recusaDeRastreio`) já derruba essa mensagem na leitura do publicado; esta é a segunda porta.
 */
export function linkDoWhatsapp(numero: string, mensagem?: string): string {
  const base = `https://wa.me/${numero}`;
  if (!mensagem) return base;
  try {
    return `${base}?text=${encodeURIComponent(mensagem)}`;
  } catch {
    return base;
  }
}

/**
 * O rastreio que o AMBIENTE oferece, lido com a MESMA régua do documento: placeholder e formato errado
 * são ausência (o script não carrega com ID quebrado). É a OFERTA inteira: o Meta Pixel do ambiente sai
 * daqui mesmo quando há GTM. Quem decide se ele entra na página é `rastreioEmVigor`, porque a regra ("o
 * Pixel do cadastro não entra pelo código quando há um Tag Manager próprio em vigor") depende do Tag
 * Manager EFETIVO, que pode ser o que o lojista publicou, não só o do ambiente (Astra, B2). Decidir aqui,
 * antes da precedência, deixava GTM publicado e Pixel herdado mandarem os dois o mesmo PageView.
 */
export function rastreioDoAmbiente(ambiente: Ambiente): Rastreio {
  const r: Rastreio = {};
  const V = VARIAVEIS_DE_RASTREIO;
  for (const p of IDS_DE_RASTREIO) {
    const v = valorAceito(p, ambiente[V[p]]);
    if (v) r[p] = v;
  }
  const w = whatsappAceito(ambiente[V.whatsappNumero], ambiente[V.whatsappMensagem]);
  if (w) r.whatsapp = w;
  return r;
}

/** o rastreio que o DOCUMENTO traz, campo a campo pela régua: a loja não confia cegamente no JSON publicado */
export function rastreioDoDocumento(doc: ContentDocument | null | undefined): Rastreio {
  const bruto = doc?.apps?.rastreio as unknown;
  const r: Rastreio = {};
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return r;
  const o = bruto as Record<string, unknown>;
  for (const p of IDS_DE_RASTREIO) {
    const v = valorAceito(p, o[p]);
    if (v) r[p] = v;
  }
  const wo = o.whatsapp;
  if (wo && typeof wo === "object" && !Array.isArray(wo)) {
    const w = whatsappAceito((wo as Record<string, unknown>).numero, (wo as Record<string, unknown>).mensagem);
    if (w) r.whatsapp = w;
  }
  return r;
}

/**
 * O QUE DISPARA NA LOJA, por provedor, e de onde veio. Documento vence ambiente, provedor a provedor:
 * quem tem os dois recebe SÓ o do documento, nunca os dois. É esta função que o `<Rastreio>` da
 * foundation (rastreio.tsx) consulta antes de injetar cada script; o layout da loja só o chama. O
 * contêiner da Unbox fica fora dela: é sempre ligado. `unboxGtmId` diz qual é ele, para um `gtm` igual (o
 * lojista digitou o contêiner da Unbox como se fosse o dele) não contar como contêiner próprio: seria o
 * MESMO contêiner carregado duas vezes, e não é um Tag Manager que dispare o Pixel da marca.
 *
 * A SUPRESSÃO DO PIXEL HERDADO vem DEPOIS da precedência, de propósito: o Meta Pixel do AMBIENTE só entra
 * quando NÃO há Tag Manager próprio em vigor, seja ele do documento ou do ambiente (Pixel no contêiner E no
 * código conta PageView e conversão em dobro, em silêncio). Antes ela olhava só o GTM do ambiente, e um GTM
 * publicado no painel convivia com o Pixel herdado (Astra, B2). O Pixel que o lojista DIGITA no painel não
 * passa por ela: é escolha explícita dele. O que foi suprimido sai em `suprimido`, para o painel dizer.
 */
export function rastreioEmVigor(doc: ContentDocument | null | undefined, ambiente: Ambiente, opcoes?: { unboxGtmId?: string }): RastreioEmVigor {
  const d = rastreioDoDocumento(doc);
  const a = rastreioDoAmbiente(ambiente);
  const unbox = opcoes?.unboxGtmId;
  if (unbox) {
    if (d.gtm === unbox) delete d.gtm;
    if (a.gtm === unbox) delete a.gtm;
  }
  const escolhe = <T,>(p: ProvedorDeRastreio): ValorDeRastreio<T> => {
    if (d[p] !== undefined) return { valor: d[p] as T, origem: "documento" };
    if (a[p] !== undefined) return { valor: a[p] as T, origem: "ambiente" };
    return { valor: null, origem: null };
  };
  const r: RastreioEmVigor = { gtm: escolhe("gtm"), ga4: escolhe("ga4"), metaPixel: escolhe("metaPixel"), tiktok: escolhe("tiktok"), pinterest: escolhe("pinterest"), whatsapp: escolhe("whatsapp") };
  if (r.gtm.valor && r.metaPixel.origem === "ambiente") r.metaPixel = { valor: null, origem: null, suprimido: { origem: "ambiente", por: "gtm" } };
  return r;
}

/**
 * A CONVERSIONS API DO META, decidida em UM lugar: o estado (`EstadoDoCapi`) e, quando "ativa", o Pixel
 * para o qual a rota /api/capi da loja envia. O manifesto leva o mesmo estado ao painel.
 *
 * O Pixel EM VIGOR aqui é o que a loja TEM: o publicado no painel, senão o do cadastro (o do navegador,
 * `NEXT_PUBLIC_META_PIXEL_ID`, senão o declarado ao lado do token, `META_PIXEL_ID`). Ele NÃO passa pela
 * supressão por Tag Manager de `rastreioEmVigor`: um Pixel do cadastro que entra pelo contêiner continua
 * sendo o Pixel da loja, e é ele que a CAPI espelha (é como as lojas já rodavam). O Pixel DO TOKEN é o do
 * cadastro (`META_PIXEL_ID`, senão o do navegador): o token do Meta vale para um Pixel só. Quando o lojista
 * publica outro Pixel, o navegador passa a mandar para o novo e a CAPI para, dizendo por quê, em vez de
 * continuar mandando para o antigo (Astra, B4). Trocar o Pixel no painel não é bloqueado: bloquear é pior
 * que dizer.
 */
export function capiEmVigor(doc: ContentDocument | null | undefined, ambiente: Ambiente): { estado: EstadoDoCapi; pixel: string | null } {
  const V = VARIAVEIS_DE_RASTREIO;
  if (!ambiente[V.capi]?.trim()) return { estado: "sem-token", pixel: null };
  const doNavegador = valorAceito("metaPixel", ambiente[V.metaPixel]);
  const aoLadoDoToken = valorAceito("metaPixel", ambiente[V.capiPixel]);
  const emVigor = rastreioDoDocumento(doc).metaPixel ?? doNavegador ?? aoLadoDoToken;
  if (!emVigor) return { estado: "sem-pixel", pixel: null };
  const doToken = aoLadoDoToken ?? doNavegador;
  if (emVigor !== doToken) return { estado: "pixel-diferente-do-token", pixel: null };
  return { estado: "ativa", pixel: emVigor };
}

/**
 * A LEITURA DO PUBLICADO, em dois casos que NÃO se confundem (Astra, segunda rodada, 1):
 * - AUSÊNCIA (`falhou: false`, `doc: null`): o editor respondeu 404, a loja nunca publicou. Não há documento,
 *   e o que vale é o código, com o rastreio do cadastro.
 * - FALHA DE LEITURA (`falhou: true`): rede, 5xx, corpo que não é JSON, documento malformado ou de outra loja.
 *   PODE haver um documento publicado que não se conseguiu ler, e não se sabe o que ele diz.
 * Quem só RENDERIZA trata os dois igual (`doc`; null = conteúdo do código): mostrar o código é o certo lá, e é
 * o contrato de `getPublishedContent` (server.ts). Quem DECIDE a partir do publicado tem de olhar `falhou`: a
 * rota /api/capi escolhe para qual Pixel enviar, e com a leitura falhada "não há documento" viraria "vale o
 * Pixel do cadastro", que o lojista pode ter trocado (ver `capiDaLeitura`).
 *
 * Função pura: recebe a busca (o `fetch` da loja, ou um de mentira no teste) e classifica o que ela devolveu.
 * A conferência dos blocos de HTML (`semHtmlRecusado`, server.ts) roda DEPOIS, sobre o `doc` que sai daqui.
 */
export type LeituraDoPublicado = { doc: ContentDocument | null; falhou: false } | { doc: null; falhou: true; motivo: string };
/** o que a leitura usa de uma resposta HTTP: o status e o corpo em JSON (um `Response` serve) */
export interface RespostaDoPublicado {
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
}
export async function leituraDoPublicado(buscar: () => Promise<RespostaDoPublicado>, slug: string): Promise<LeituraDoPublicado> {
  let res: RespostaDoPublicado;
  try {
    res = await buscar();
  } catch (err) {
    return { doc: null, falhou: true, motivo: `editor inacessível (${err instanceof Error ? err.message : String(err)})` };
  }
  if (res.status === 404) return { doc: null, falhou: false };
  if (!res.ok) return { doc: null, falhou: true, motivo: `o editor respondeu ${res.status}` };
  let corpo: unknown;
  try {
    corpo = await res.json();
  } catch {
    return { doc: null, falhou: true, motivo: "o conteúdo publicado não é JSON" };
  }
  if (!documentoUsavel(corpo)) return { doc: null, falhou: true, motivo: "o conteúdo publicado veio malformado" };
  if (corpo.shop !== slug) return { doc: null, falhou: true, motivo: `o conteúdo publicado é de outra loja (${corpo.shop})` };
  return { doc: corpo, falhou: false };
}

/**
 * O QUE A ROTA /api/capi OBEDECE, a partir da LEITURA (não do documento). Com a leitura falhada não há como
 * saber qual Pixel o lojista publicou, e `capiEmVigor(null, ambiente)` diria "ativa" com o Pixel do cadastro:
 * a rota mandaria conversão para um Pixel que ele pode ter trocado. Então a leitura falhada é um estado
 * próprio da rota, "leitura-falhou": ela aceita o evento e NÃO envia (o Pixel do navegador segue sozinho), e
 * volta ao normal na primeira leitura que der certo. Não entra em `EstadoDoCapi` (o estado do manifesto): o
 * manifesto nasce de uma renderização, e este é o estado de UMA resposta da rota.
 */
export type EstadoDaRotaCapi = EstadoDoCapi | "leitura-falhou";
export function capiDaLeitura(leitura: LeituraDoPublicado, ambiente: Ambiente): { estado: EstadoDaRotaCapi; pixel: string | null } {
  if (leitura.falhou) return { estado: "leitura-falhou", pixel: null };
  return capiEmVigor(leitura.doc, ambiente);
}

/**
 * SÓ PRESENÇA: o que a loja tem no ambiente, provedor a provedor (nunca o valor), e o estado da Conversions
 * API. É o que o `EditableProvider` leva no manifesto (`apps.rastreio`) para o painel poder dizer "veio do
 * cadastro da loja" e o que a CAPI está fazendo. A presença é a OFERTA do ambiente: o Meta Pixel do cadastro
 * aparece mesmo quando um Tag Manager o suprime na página (ver `rastreioEmVigor`); o painel tem o documento
 * e a presença, e diz "deixa de valer porque há um Tag Manager" com a mesma regra (há `gtm` no documento ou
 * no ambiente, o lojista não digitou Pixel, e o ambiente tem um).
 *
 * `doc` é o documento PUBLICADO: o estado da CAPI depende do Pixel em vigor, e o Pixel em vigor pode ser o
 * que o lojista publicou. Sem `doc`, o estado sai só do ambiente (o `presencaNoAmbiente` de server.ts
 * completa com o documento que `getPublishedContent` leu no mesmo pedido).
 *
 * `unboxGtmId` é o contêiner contratual da Unbox, o mesmo literal que o layout passa ao `<Rastreio>`. Sobe ao
 * manifesto pela MESMA régua dos IDs (`valorAceito`): um literal fora do formato não é contêiner e não sobe.
 * É o que deixa o painel reconhecer um `gtm` publicado igual ao da Unbox, que a loja descarta SEM suprimir o
 * Pixel do cadastro (ver `rastreioEmVigor`), em vez de anunciar uma supressão que não acontece.
 */
export function presencaNoAmbiente(ambiente: Ambiente, opcoes?: { doc?: ContentDocument | null; unboxGtmId?: string }): ManifestApps {
  const a = rastreioDoAmbiente(ambiente);
  const presentes: Partial<Record<ProvedorDeRastreio, true>> = {};
  for (const p of PROVEDORES_DE_RASTREIO) if (a[p] !== undefined) presentes[p] = true;
  const unboxGtmId = valorAceito("gtm", opcoes?.unboxGtmId);
  return { rastreio: { ambiente: presentes, capi: capiEmVigor(opcoes?.doc, ambiente).estado, ...(unboxGtmId ? { unboxGtmId } : {}) } };
}

export interface ContentDocument {
  schema: 1;
  shop: string;
  updatedAt?: string;
  /** caminho → valor. Só o que foi editado. */
  values: Record<string, EditableValue>;
  /** container (ex.: "home") → ordem/ocultas. */
  sections: Record<string, SectionState>;
  /** token CSS (ex.: "--store-primary") → cor. Só tokens da allowlist da loja. */
  tokens: Record<string, string>;
  /** Registro de honestidade: edições que o lojista declarou sem fonte (nota, prazo, depoimento). */
  declared?: Record<string, DeclaredEntry>;
  /**
   * APPS (foundation 12): a configuração de rastreio e marketing que o lojista fez na aba Apps. OPCIONAL
   * e aditivo: documento antigo sem `apps` continua usável (`documentoUsavel` não o exige), sem migração.
   * Só IDs, nunca segredo: o documento publicado é público.
   */
  apps?: Apps;
}

export function emptyDocument(shop: string): ContentDocument {
  return { schema: 1, shop, values: {}, sections: {}, tokens: {} };
}

export type PatchOp =
  | { op: "set"; path: string; value: EditableValue; /** interno (inverso de desfazer): declaração anterior a devolver */ declaredAnterior?: DeclaredEntry | null }
  | { op: "unset"; path: string; declaredAnterior?: DeclaredEntry | null }
  | { op: "set_token"; token: string; value: string }
  | { op: "unset_token"; token: string }
  | { op: "set_order"; container: string; order: string[] }
  | { op: "unset_order"; container: string }
  | { op: "hide_section"; container: string; id: string }
  | { op: "show_section"; container: string; id: string }
  /** `ordemSemeada` (interno): a cópia entra logo abaixo da origem, então quem duplica num container SEM ordem
   *  gravada manda a ordem atual junto — e o inverso devolve a ausência dela (Astra v3.14, achado 2). */
  | { op: "duplicate_section"; container: string; id: string; cloneId: string; ordemSemeada?: string[] }
  /**
   * ADICIONAR seção (o "+" do painel): a loja declara no manifesto os TIPOS que sabe instanciar, e a
   * seção nasce com os literais do componente — nada vai para `values`. O inverso é `remove_section`.
   * `indice` = posição na ordem do container. `ordemSemeada` (interno) tem o mesmo papel que na
   * duplicação: sem ordem gravada, `indice` não teria sobre o que operar e a seção nova cairia no FIM.
   */
  | { op: "add_section"; container: string; id: string; tipo: string; indice?: number; ordemSemeada?: string[] }
  /** `ordemAnterior` (interno, vem do inverso): `null` = o container não tinha ordem antes. */
  | { op: "remove_section"; container: string; id: string; ordemAnterior?: string[] | null }
  /** só como INVERSO de remove_section (desfazer): devolve a cópia (com `source`) ou a seção criada
   *  (com `tipo`) — valores, posição e visibilidade juntos. Sem o `tipo`, desfazer a remoção de uma
   *  criada devolveria um id sem tipo nenhum, e a loja não saberia o que renderizar ali. */
  | { op: "restore_section"; container: string; id: string; source?: string; tipo?: string; values: Record<string, EditableValue>; index: number | null; hidden: boolean; declared?: Record<string, DeclaredEntry>; cloneIndex?: number; sections?: ContentDocument["sections"] }
  /**
   * APPS (foundation 12): UM campo de rastreio (`gtm`, `ga4`, `metaPixel`, `tiktok`, `pinterest`,
   * `whatsapp.numero`, `whatsapp.mensagem`). `null` ou vazio = remover. O inverso é o mesmo `set_app` com
   * o valor anterior (ou `null`), então desfazer funciona como em tudo. O valor entra NORMALIZADO
   * (`normalizaRastreio`) e só depois de passar em `recusaDeRastreio` (a régua de formato por provedor).
   */
  | { op: "set_app"; app: "rastreio"; campo: CampoDeRastreio; value: string | null }
  /**
   * interno: troca o documento inteiro (usar uma versão publicada como rascunho); inverso = o documento anterior.
   * `apps` (foundation 12): presente troca junto (`null` = a versão não tinha apps); AUSENTE mantém o do
   * rascunho atual, para um cliente que ainda não o manda não apagar a configuração do lojista.
   */
  | { op: "replace_doc"; values: ContentDocument["values"]; sections: ContentDocument["sections"]; tokens: ContentDocument["tokens"]; declared?: ContentDocument["declared"]; apps?: Apps | null };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Aplica UMA operação e devolve o documento novo + a operação inversa (pra desfazer). */
export function applyOp(doc: ContentDocument, op: PatchOp): { doc: ContentDocument; inverse: PatchOp } {
  const next = clone(doc);
  let inverse: PatchOp;
  switch (op.op) {
    // a declaração de honestidade é DO VALOR: valor novo (ou removido) apaga a declaração antiga;
    // quem grava um valor declarado registra a declaração de novo depois de aplicar
    case "set": {
      const prev = doc.values[op.path];
      const declPrev = doc.declared?.[op.path] ?? null;
      // o inverso leva a declaração anterior: desfazer devolve valor E proveniência
      inverse = prev === undefined ? { op: "unset", path: op.path, declaredAnterior: declPrev } : { op: "set", path: op.path, value: prev, declaredAnterior: declPrev };
      next.values[op.path] = op.value;
      if (next.declared) delete next.declared[op.path];
      if (op.declaredAnterior) next.declared = { ...(next.declared ?? {}), [op.path]: op.declaredAnterior };
      break;
    }
    case "unset": {
      const prev = doc.values[op.path];
      const declPrev = doc.declared?.[op.path] ?? null;
      inverse = prev === undefined ? { op: "unset", path: op.path, declaredAnterior: declPrev } : { op: "set", path: op.path, value: prev, declaredAnterior: declPrev };
      delete next.values[op.path];
      if (next.declared) delete next.declared[op.path];
      if (op.declaredAnterior) next.declared = { ...(next.declared ?? {}), [op.path]: op.declaredAnterior };
      break;
    }
    case "set_token": {
      const prev = doc.tokens[op.token];
      inverse = prev === undefined ? { op: "unset_token", token: op.token } : { op: "set_token", token: op.token, value: prev };
      next.tokens[op.token] = op.value;
      if (next.declared) delete next.declared[op.token];
      break;
    }
    case "unset_token": {
      const prev = doc.tokens[op.token];
      inverse = prev === undefined ? { op: "unset_token", token: op.token } : { op: "set_token", token: op.token, value: prev };
      delete next.tokens[op.token];
      if (next.declared) delete next.declared[op.token];
      break;
    }
    case "set_order": {
      const prev = doc.sections[op.container]?.order;
      inverse = prev ? { op: "set_order", container: op.container, order: prev } : { op: "unset_order", container: op.container };
      next.sections[op.container] = { ...(next.sections[op.container] ?? {}), order: [...op.order] };
      break;
    }
    case "unset_order": {
      const prev = doc.sections[op.container]?.order;
      inverse = prev ? { op: "set_order", container: op.container, order: prev } : { op: "unset_order", container: op.container };
      if (next.sections[op.container]) delete next.sections[op.container].order;
      break;
    }
    case "hide_section": {
      const hidden = new Set(doc.sections[op.container]?.hidden ?? []);
      inverse = hidden.has(op.id) ? { op: "hide_section", container: op.container, id: op.id } : { op: "show_section", container: op.container, id: op.id };
      hidden.add(op.id);
      next.sections[op.container] = { ...(next.sections[op.container] ?? {}), hidden: [...hidden] };
      break;
    }
    case "show_section": {
      const hidden = new Set(doc.sections[op.container]?.hidden ?? []);
      inverse = hidden.has(op.id) ? { op: "hide_section", container: op.container, id: op.id } : { op: "show_section", container: op.container, id: op.id };
      hidden.delete(op.id);
      next.sections[op.container] = { ...(next.sections[op.container] ?? {}), hidden: [...hidden] };
      break;
    }
    case "duplicate_section": {
      const st = next.sections[op.container] ?? {};
      // semeadura reversível da ordem: sem ordem gravada, a cópia iria para o fim
      const semeia = op.ordemSemeada && !st.order?.length ? op.ordemSemeada : null;
      const ordemAntesDaSemeadura = semeia ? (st.order ? [...st.order] : null) : undefined;
      if (semeia) st.order = [...semeia];
      const clones = { ...(st.clones ?? {}), [op.cloneId]: st.clones?.[op.id] ?? op.id };
      // a cópia entra logo depois da origem na ordem
      const base = st.order ?? [];
      const order = base.includes(op.id) ? base.flatMap((x) => (x === op.id ? [x, op.cloneId] : [x])) : undefined;
      next.sections[op.container] = { ...st, clones, ...(order ? { order } : {}) };
      // a cópia nasce com o que o lojista está VENDO (valores do escopo de origem), não com o código
      const de = `${op.container}.${op.id}.`;
      const para = `${op.container}.${op.cloneId}.`;
      for (const [k, v] of Object.entries(doc.values)) if (k.startsWith(de)) next.values[para + k.slice(de.length)] = clone(v);
      // a proveniência acompanha o texto: um dado declarado na original continua declarado na cópia
      for (const [k, d] of Object.entries(doc.declared ?? {})) if (k.startsWith(de)) next.declared = { ...(next.declared ?? {}), [para + k.slice(de.length)]: { ...d, from: d.from ?? k } };
      // os ESTADOS das listas de dentro (itens ocultos, reordenados, adicionados) também vão na cópia —
      // senão a cópia do FAQ volta às perguntas do código (revisão v3 do Astra, achado 3)
      const raizDe = `${op.container}.${op.id}`;
      const raizPara = `${op.container}.${op.cloneId}`;
      for (const [c, estado] of Object.entries(doc.sections)) if (c === raizDe || c.startsWith(raizDe + ".")) next.sections[raizPara + c.slice(raizDe.length)] = clone(estado);
      inverse = { op: "remove_section", container: op.container, id: op.cloneId, ...(ordemAntesDaSemeadura !== undefined ? { ordemAnterior: ordemAntesDaSemeadura } : {}) };
      break;
    }
    case "add_section": {
      const st = next.sections[op.container] ?? {};
      // semeadura reversível da ordem, igual à da duplicação: sem ordem gravada não há onde encaixar
      // `indice`, e a seção nova iria para o fim do container (armadilha medida 4)
      const semeia = op.ordemSemeada && !st.order?.length ? op.ordemSemeada : null;
      const ordemAntesDaSemeadura = semeia ? (st.order ? [...st.order] : null) : undefined;
      if (semeia) st.order = [...semeia];
      const criadas = { ...(st.criadas ?? {}), [op.id]: op.tipo };
      const base = st.order ?? [];
      // com ordem (própria ou semeada), `indice` posiciona; sem ordem nenhuma, a criada renderiza no fim
      let order: string[] | undefined;
      if (base.length) {
        const semId = base.filter((x) => x !== op.id);
        const pos = op.indice != null ? Math.max(0, Math.min(op.indice, semId.length)) : semId.length;
        order = [...semId.slice(0, pos), op.id, ...semId.slice(pos)];
      }
      next.sections[op.container] = { ...st, criadas, ...(order ? { order } : {}) };
      // NADA em `values`: a seção criada mostra os literais do componente (os `fallback` dos primitivos)
      inverse = { op: "remove_section", container: op.container, id: op.id, ...(ordemAntesDaSemeadura !== undefined ? { ordemAnterior: ordemAntesDaSemeadura } : {}) };
      break;
    }
    case "remove_section": {
      const st = next.sections[op.container] ?? {};
      const origem = st.clones?.[op.id];
      // cópia OU seção criada: as duas saem do documento do mesmo jeito, e o inverso devolve
      // `source` (cópia) ou `tipo` (criada) — é o tipo que diz à loja o que renderizar de volta
      const tipoCriada = st.criadas?.[op.id];
      if (!origem && !tipoCriada) {
        inverse = { op: "remove_section", container: op.container, id: op.id };
        break;
      }
      const clones = { ...(st.clones ?? {}) };
      const criadas = { ...(st.criadas ?? {}) };
      // posição no MAPA a que a seção pertence (cópias ou criadas): fora da ordem explícita as duas
      // renderizam na ordem de criação, então desfazer precisa devolvê-la ao mesmo lugar da fila
      const cloneIndex = Object.keys(origem ? clones : criadas).indexOf(op.id);
      if (origem) delete clones[op.id];
      else delete criadas[op.id];
      const prefixo = `${op.container}.${op.id}.`;
      const values: Record<string, EditableValue> = {};
      for (const k of Object.keys(next.values)) if (k.startsWith(prefixo)) {
        values[k] = clone(next.values[k]);
        delete next.values[k];
      }
      const declared: Record<string, DeclaredEntry> = {};
      for (const k of Object.keys(next.declared ?? {})) if (k.startsWith(prefixo)) {
        declared[k] = { ...next.declared![k] };
        delete next.declared![k];
      }
      // `index` null = a cópia NÃO estava na ordem explícita (renderizava depois das ordenadas); desfazer respeita isso
      const index = st.order ? st.order.indexOf(op.id) : null;
      // sem criar chaves `undefined`: um estado com `order: undefined` não é o mesmo objeto que um sem `order`
      // depois de passar por JSON, e fazia "duplicar → desfazer" parecer que ainda havia mudança para publicar
      // (verificação v3.13 do Astra, achado 2)
      // só o mapa que MUDOU entra no estado novo: pendurar um `criadas: {}` num container que nunca
      // teve criadas (ou vice-versa) inventa uma diferença, e a barra passa a dizer "não publicado" à toa
      const estadoLimpo: SectionState = origem ? { clones } : { criadas };
      const ordemSemId = st.order?.filter((x) => x !== op.id);
      if (ordemSemId) estadoLimpo.order = ordemSemId;
      const ocultasSemId = st.hidden?.filter((x) => x !== op.id);
      if (ocultasSemId) estadoLimpo.hidden = ocultasSemId;
      next.sections[op.container] = { ...st, ...estadoLimpo };
      // desfazendo uma duplicação que semeou a ordem: a ordem volta a ser o que era (inclusive não existir)
      if (op.ordemAnterior !== undefined) {
        if (op.ordemAnterior === null) delete next.sections[op.container].order;
        else next.sections[op.container].order = [...op.ordemAnterior];
      }
      // os estados das listas de dentro da cópia saem com ela (e voltam no desfazer)
      const raiz = `${op.container}.${op.id}`;
      const aninhados: ContentDocument["sections"] = {};
      for (const c of Object.keys(next.sections)) if (c === raiz || c.startsWith(raiz + ".")) { aninhados[c] = clone(next.sections[c]); delete next.sections[c]; }
      // desfazer devolve a cópia inteira: valores, proveniência, posição, visibilidade e listas de dentro
      inverse = { op: "restore_section", container: op.container, id: op.id, ...(origem ? { source: origem } : { tipo: tipoCriada }), values, index: index != null && index >= 0 ? index : null, hidden: (st.hidden ?? []).includes(op.id), ...(Object.keys(declared).length ? { declared } : {}), ...(cloneIndex >= 0 ? { cloneIndex } : {}), ...(Object.keys(aninhados).length ? { sections: aninhados } : {}) };
      break;
    }
    case "set_app": {
      // o inverso é o valor anterior do MESMO campo (ou `null`): um campo por operação, e desfazer devolve
      // exatamente aquele campo, sem tocar nos outros provedores
      const anterior = campoDeRastreio(doc.apps?.rastreio, op.campo);
      inverse = { op: "set_app", app: "rastreio", campo: op.campo, value: anterior ?? null };
      const novo = comCampoDeRastreio(doc.apps, op.campo, op.value === null ? null : normalizaRastreio(op.campo, op.value));
      // sem chave `apps: undefined` no documento: depois de passar por JSON ela some, e antes disso seria
      // uma diferença inventada entre rascunho e publicado
      if (novo) next.apps = novo;
      else delete next.apps;
      break;
    }
    case "replace_doc": {
      // o inverso leva `apps` EXPLÍCITO (`null` quando não havia): é ele que faz desfazer devolver a configuração
      inverse = { op: "replace_doc", values: clone(doc.values), sections: clone(doc.sections), tokens: clone(doc.tokens), declared: doc.declared ? clone(doc.declared) : undefined, apps: doc.apps ? clone(doc.apps) : null };
      next.values = clone(op.values);
      next.sections = clone(op.sections);
      next.tokens = clone(op.tokens);
      next.declared = op.declared ? clone(op.declared) : undefined;
      // `undefined` (ausente, inclusive depois de JSON) = mantém; `null` = remove; objeto = troca
      if (op.apps !== undefined) {
        if (op.apps) next.apps = clone(op.apps);
        else delete next.apps;
      }
      break;
    }
    case "restore_section": {
      const st = next.sections[op.container] ?? {};
      // `tipo` = seção criada (volta para `criadas`); `source` = cópia (volta para `clones`)
      const ehCriada = op.tipo !== undefined;
      const mapa = ehCriada ? (st.criadas ?? {}) : (st.clones ?? {});
      // volta para a MESMA posição da fila (o objeto preserva a ordem de inserção)
      const pares = Object.entries(mapa).filter(([k]) => k !== op.id);
      pares.splice(op.cloneIndex != null ? Math.min(op.cloneIndex, pares.length) : pares.length, 0, [op.id, (ehCriada ? op.tipo : op.source) ?? ""]);
      const refeito = Object.fromEntries(pares);
      // só volta para a ordem explícita se estava nela; ausente da ordem, continua ausente
      const order = st.order ? st.order.filter((x) => x !== op.id) : undefined;
      if (order && op.index != null) order.splice(Math.min(op.index, order.length), 0, op.id);
      const hidden = op.hidden ? [...new Set([...(st.hidden ?? []), op.id])] : st.hidden;
      next.sections[op.container] = { ...st, ...(ehCriada ? { criadas: refeito } : { clones: refeito }), ...(order ? { order } : {}), ...(hidden ? { hidden } : {}) };
      for (const [k, v] of Object.entries(op.values)) next.values[k] = clone(v);
      if (op.declared) next.declared = { ...(next.declared ?? {}), ...op.declared };
      if (op.sections) for (const [c, estado] of Object.entries(op.sections)) next.sections[c] = clone(estado);
      inverse = { op: "remove_section", container: op.container, id: op.id };
      break;
    }
  }
  next.updatedAt = new Date().toISOString();
  return { doc: next, inverse };
}

/**
 * Valor do documento, ou o fallback. A loja NÃO confia cegamente no JSON publicado:
 * tipo diferente do fallback, `src`/`href` fora do formato → fallback (achado 12 da
 * revisão adversarial: um valor errado derrubava o SSR da home).
 */
export function resolveValue<T extends EditableValue>(doc: ContentDocument | null | undefined, path: string, fallback: T): T {
  const v = doc?.values[path];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== typeof fallback) return fallback;
  // BLOCO DE HTML: é o SUFIXO do caminho que diz à loja que este valor é HTML — ela lê o publicado
  // sem manifesto. Esta é a camada que faz uma regra NOVA valer para quem já publicou, e a que cobre
  // "voltar para uma versão antiga do documento": o bloco recusado some e a loja mostra o do código.
  if (typeof v === "string" && isHtmlPath(path) && recusaDeHtml(v)) return fallback;
  if (typeof v === "object") {
    // vitrine: o valor só vale se a ESCOLHA for bem formada; senão a loja mostra o que o código traz
    if ("modo" in (fallback as object) || "modo" in (v as object)) return vitrineValida(v) && "modo" in (fallback as object) ? (v as T) : fallback;
    if (("src" in v) !== ("src" in (fallback as object))) return fallback;
    if ("src" in v && (typeof v.src !== "string" || !isSafeUrl(v.src))) return fallback;
    if ("href" in v && (typeof v.href !== "string" || !isSafeHref(v.href))) return fallback;
    // campos opcionais só como texto: um objeto em `label`/`alt` viraria filho React inválido
    const o = v as Record<string, unknown>;
    if ("alt" in o && o.alt !== undefined && typeof o.alt !== "string") return fallback;
    if ("label" in o && o.label !== undefined && typeof o.label !== "string") return fallback;
  }
  return v as T;
}

/**
 * O documento vindo do editor é USÁVEL? A loja renderiza com ele; um `tokens`/`sections`/`values` ausente ou
 * de outro tipo derrubava a página inteira (500) na primeira leitura — e a promessa deste pacote é a
 * contrária: a loja nunca cai por causa do editor, no pior caso mostra o conteúdo do código.
 */
export function documentoUsavel(d: unknown): d is ContentDocument {
  const mapa = (v: unknown) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
  const o = d as { schema?: unknown; shop?: unknown; values?: unknown; sections?: unknown; tokens?: unknown } | null;
  return Boolean(o) && o!.schema === 1 && typeof o!.shop === "string" && mapa(o!.values) && mapa(o!.sections) && mapa(o!.tokens);
}

/**
 * A escolha de vitrine que vale para um caminho (documento publicado ou rascunho), com o fallback do código.
 * É o que a LOJA usa no servidor antes de buscar os produtos na Unbox.
 */
export function escolhaDaVitrine(doc: ContentDocument | null | undefined, path: string, fallback: VitrineValue): VitrineValue {
  return resolveValue(doc, path, fallback);
}

/**
 * Ordena/filtra ids conforme o estado do container.
 *
 * `tiposRenderizaveis` = os tipos do CATÁLOGO que quem chama sabe instanciar (o catálogo é de cada
 * loja). Sem ele, as seções criadas ficam de fora — e é o padrão certo: uma lista que não recebeu
 * catálogo (o eco de uma faixa, por exemplo) só sabe mapear os ids que ela própria renderizou, e
 * devolver um id sem elemento correspondente produziria um buraco na tela.
 */
export function orderSections(ids: string[], state: SectionState | undefined, tiposRenderizaveis?: Iterable<string>): { visible: string[]; hidden: string[] } {
  const hidden = new Set(state?.hidden ?? []);
  const order = state?.order ?? [];
  // cópias cuja origem existe no código contam como presentes
  const clones = Object.entries(state?.clones ?? {}).filter(([, src]) => ids.includes(src)).map(([id]) => id);
  const tipos = tiposRenderizaveis ? new Set(tiposRenderizaveis) : null;
  const criadas = tipos ? Object.entries(state?.criadas ?? {}).filter(([, tipo]) => tipos.has(tipo)).map(([id]) => id) : [];
  ids = [...ids, ...clones.filter((c) => !ids.includes(c)), ...criadas.filter((c) => !ids.includes(c) && !clones.includes(c))];
  const present = new Set(ids);
  const ordered = [...order.filter((id) => present.has(id)), ...ids.filter((id) => !order.includes(id))];
  return { visible: ordered.filter((id) => !hidden.has(id)), hidden: ordered.filter((id) => hidden.has(id)) };
}

// ── Manifesto: o que a loja declara como editável (nasce dos primitivos, não de um catálogo)
export interface ManifestEntry {
  path: string;
  type: EditableType;
  label?: string;
  section?: string;
  container?: string;
  /**
   * A PÁGINA em que esta linha foi capturada (o pathname normalizado por `normalizarPagina`:
   * "/", "/sobre", "/produto/produto"). O editor guarda um manifesto por página e FUNDE manifestos de
   * páginas diferentes; sem isto, uma linha fundida não sabe mais de onde veio. Ausente = manifesto
   * de loja anterior à foundation 11.
   */
  pagina?: string;
  fallback: EditableValue;
  current?: EditableValue;
  /** cores em uso no elemento (computadas no navegador na seleção): o inspector parte delas */
  computed?: { color?: string; background?: string };
  /** false = o elemento existe mas não tem caixa visível agora (resposta fechada, slide escondido, gaveta): a ficha da seção o lista e abre o inspector direto */
  visible?: boolean;
}
/**
 * TIPO DE SEÇÃO — vocabulário fechado, comum a todas as lojas (pedido do Bruno, 07/09): o nome
 * que qualquer pessoa entende ("banner", "faixa de anúncio", "texto rolante"), ao lado do rótulo
 * e do trecho de conteúdo daquela loja. Não é catálogo de componentes: a seção continua sendo
 * escrita livremente; o tipo só nomeia a família para quem edita (e para o chat).
 */
export const SECTION_KINDS = [
  "cabecalho", "faixa-de-anuncio", "banner", "texto-rolante", "vitrine-de-produtos", "produto-em-destaque",
  "beneficios", "como-funciona", "depoimentos", "perguntas-frequentes", "galeria", "video", "sobre-a-marca",
  "comparacao", "newsletter", "contato", "lojas-fisicas", "botao-flutuante", "rodape", "outro",
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];
export const SECTION_KIND_LABEL: Record<SectionKind, string> = {
  cabecalho: "Cabeçalho", "faixa-de-anuncio": "Faixa de anúncio", banner: "Banner", "texto-rolante": "Texto rolante",
  "vitrine-de-produtos": "Vitrine de produtos", "produto-em-destaque": "Produto em destaque", beneficios: "Benefícios",
  "como-funciona": "Como funciona", depoimentos: "Depoimentos", "perguntas-frequentes": "Perguntas frequentes", galeria: "Galeria",
  video: "Vídeo", "sobre-a-marca": "Sobre a marca", comparacao: "Comparação", newsletter: "Newsletter", contato: "Contato",
  "lojas-fisicas": "Lojas físicas", "botao-flutuante": "Botão flutuante", rodape: "Rodapé", outro: "Seção",
};

export interface ManifestSection {
  /** posição da seção no CÓDIGO da loja (foundation 5+): não muda quando o lojista reordena */
  ordemNoCodigo?: number;
  /**
   * A PÁGINA em que esta linha foi capturada (pathname normalizado, ver `normalizarPagina`). A mesma
   * seção pode aparecer no manifesto de várias páginas (o rodapé aparece em todas); ao fundir
   * manifestos, é este campo que diz de onde cada linha veio. Ausente = manifesto anterior à foundation 11.
   */
  pagina?: string;
  /**
   * A página onde esta linha foi capturada REAPROVEITA o container sem mandar nele
   * (`Editable.Sections layout={false}`): a linha serve para achar a seção e editar a copy, nunca para
   * ordenar nem para ocultar. É por isso que ela vem sem `ordemNoCodigo`, e é o que permite dizer o
   * motivo VERDADEIRO quando uma reordenação é recusada (ver `recusaDeOrdem`).
   */
  semLayout?: boolean;
  container: string;
  id: string;
  label?: string;
  /** tipo da seção (vocabulário fechado `SECTION_KINDS`) */
  kind?: SectionKind;
  /** trecho do conteúdo da seção (primeiro texto que ela mostra, ~60 caracteres): a linha do painel fala o conteúdo, não o id */
  excerpt?: string;
  hidden: boolean;
  /** Seção fixa (cabeçalho, rodapé): não move nem oculta. */
  fixed?: boolean;
  /** cópia feita pelo lojista (pode ser removida) */
  clone?: boolean;
  /** seção ADICIONADA pelo lojista (não existe no código; pode ser removida) */
  criada?: boolean;
  /** tipo do catálogo que a loja instanciou — só faz sentido em `criada` */
  tipo?: string;
  /** item de uma LISTA dentro de uma seção (pergunta do FAQ, aviso da faixa): o container é a própria seção */
  item?: boolean;
  /** cor de fundo em uso (computada no navegador): o editor parte dela ao trocar o fundo da seção */
  background?: string;
}
/**
 * TIPO DE SEÇÃO QUE A LOJA SABE ADICIONAR — o catálogo CURADO daquela loja (6 a 8 tipos), declarado
 * por `Editable.Sections catalogo={...}`. O editor NUNCA tem lista própria: 100 lojas, 100 catálogos.
 * Isto não fura a regra das "4 latas" (não existe catálogo de EDITABILIDADE): o que a loja declara aqui
 * é o catálogo de COMPONENTES dela, que ela já tem no `registry.ts` — só a fatia que renderiza bem sem
 * props de receita. O `container` importa: o catálogo é por container (a home tem o dela).
 */
export interface ManifestSectionType {
  container: string;
  tipo: string;
  /** rótulo que o lojista lê no "+" ("Perguntas frequentes") */
  label: string;
  /** UMA frase dizendo o que a seção mostra (sem imagem de prévia no v1) */
  descricao?: string;
  kind?: SectionKind;
}
export interface ManifestToken {
  token: string;
  label: string;
  /** valor computado no navegador (cor de fato em uso, com o rascunho aplicado) */
  current?: string;
  /** valor do código, sem o rascunho: é o que vale depois de um "reset" */
  original?: string;
}
/**
 * UM EDITÁVEL QUE A LOJA RECUSOU PORQUE ELE CAIU NA RAIZ DO DOCUMENTO (foundation 11+).
 *
 * `doc.values` é um mapa PLANO caminho→valor. Um primitivo renderizado fora de qualquer container
 * (uma seção solta numa página nova, sem `Editable.Sections`/`Editable.Section` em volta) grava um
 * caminho PELADO: o FAQ grava `titulo`, a newsletter grava `titulo`, e editar um muda o outro em
 * todas as páginas. Como caminho gravado não tem renomear, a loja não registra esses primitivos: ela
 * renderiza o literal do código, ignora o documento naquele caminho e os DECLARA aqui. Não é lista
 * para o lojista: é defeito de quem construiu a loja, e o gate reprova por ela.
 */
export interface ManifestSemContainer {
  /** o caminho que ele TERIA gravado */
  path: string;
  type: EditableType;
  label?: string;
  /** a página onde ele foi encontrado (pathname normalizado) */
  pagina?: string;
}
export interface Manifest {
  shop: string;
  capturedAt: string;
  url?: string;
  /** versão da foundation que gerou o manifesto (2 = inline, estilo por elemento, cópias, Icon) */
  foundation?: number;
  entries: ManifestEntry[];
  sections: ManifestSection[];
  /** tipos que ESTA loja sabe instanciar, por container (foundation 8+). Ausente/vazio = a loja não
   *  oferece "adicionar seção", e `validateOp` recusa todo `add_section`. */
  tipos?: ManifestSectionType[];
  /**
   * DEFEITO DE CONSTRUÇÃO (foundation 11+): os editáveis que esta página tem fora de qualquer
   * container e que por isso NÃO são editáveis. Lista vazia (ou ausente) = nenhuma porta aberta.
   */
  semContainer?: ManifestSemContainer[];
  tokens: ManifestToken[];
  /**
   * APPS (foundation 12): o que a loja tem no AMBIENTE para rastreio, só presença, e o estado da
   * Conversions API (`EstadoDoCapi`). É o que deixa o painel dizer "veio do cadastro da loja" e o que a
   * CAPI está fazendo, sem nunca ver o valor. Ausente = loja anterior à 12 (o painel não oferece a
   * configuração de rastreio para ela).
   */
  apps?: ManifestApps;
}

/**
 * Manifesto + CÓPIAS do documento: uma seção duplicada (ou um item novo de lista) ainda não
 * repostou o manifesto, mas os caminhos dela são os da origem com o id trocado. Sem isto,
 * "adicione uma pergunta e escreva X" falhava na segunda ferramenta do mesmo turno.
 */
export function manifestWithClones(manifest: Manifest, doc: ContentDocument): Manifest {
  const sections: ManifestSection[] = [...manifest.sections];
  const entries: ManifestEntry[] = [...manifest.entries];
  const temSecao = (container: string, id: string) => sections.some((x) => x.container === container && x.id === id);
  const temPath = new Set(entries.map((e) => e.path));
  // SEÇÕES CRIADAS, antes das cópias. Gêmeas das cópias na projeção, com uma diferença que é a
  // armadilha 2: não há origem de onde re-derivar. A LINHA da seção nasce aqui, do rascunho (a
  // verdade sobre o que existe); as ENTRADAS dela chegam quando a loja renderiza a criada e reposta
  // o manifesto. E a linha postada é RE-CARIMBADA a partir do rascunho: sem isso ela chegaria aqui
  // parecendo seção do CÓDIGO sem `ordemNoCodigo`, e `ordemPreservaFixas` passaria a recusar TODO
  // `set_order` daquele container, em silêncio, para sempre (armadilha 1).
  for (const [container, st] of Object.entries(doc.sections)) {
    for (const [id, tipo] of Object.entries(st.criadas ?? {})) {
      const i = sections.findIndex((x) => x.container === container && x.id === id);
      if (i >= 0) sections[i] = { ...sections[i], criada: true, tipo, clone: undefined, fixed: undefined, ordemNoCodigo: undefined };
      // a linha nasce do RASCUNHO, não de uma página: a página é a de quem declara aquele container
      else sections.push({ container, id, hidden: false, criada: true, tipo, pagina: sections.find((x) => x.container === container)?.pagina ?? manifest.url });
    }
  }
  // RECURSIVO (verificação v3.2 do Astra, R1): a cópia de uma seção-mãe (FAQ) leva a SUBÁRVORE inteira —
  // as seções dos itens (com item/kind/fixed) e os caminhos deles, com container e section remapeados — e as
  // cópias de dentro dela (pergunta adicionada na cópia) resolvem sobre a base já expandida. Repete até
  // não haver cópia nova, porque a ordem dos containers no documento é arbitrária.
  const feitas = new Set<string>();
  // o laço é limitado pelo NÚMERO DE CÓPIAS (cada volta expande ao menos uma): nunca trunca em silêncio
  const totalClones = Object.values(doc.sections).reduce((n, st) => n + Object.keys(st.clones ?? {}).length, 0);
  for (let volta = 0; volta <= totalClones; volta++) {
    let mudou = false;
    for (const [container, st] of Object.entries(doc.sections)) {
      for (const [cloneId, source] of Object.entries(st.clones ?? {})) {
        const chave = `${container}/${cloneId}`;
        if (feitas.has(chave)) continue;
        // a origem tem de ser uma seção que a LOJA renderiza naquele escopo: `Editable.Sections` só aceita
        // cópia cuja origem está entre os filhos do código (`byId.has(src)`), então cópia-de-cópia encadeada
        // (b → a → faq) não existe na tela e não pode existir no manifesto (Astra v3.3, achado D).
        // `duplicate_section` já achata a origem, então documento legítimo nunca encadeia.
        // `!x.criada` pelo mesmo motivo: a loja não renderiza cópia de seção criada (o filho não está
        // no JSX), e `validateOp` recusa duplicá-la — então ela também não pode existir aqui.
        const base = sections.find((x) => x.container === container && x.id === source && !x.clone && !x.criada);
        if (!base) continue; // origem inexistente, de outra página, ou ela própria uma cópia/criada
        feitas.add(chave);
        mudou = true;
        if (!temSecao(container, cloneId)) sections.push({ container, id: cloneId, label: base.label ? `${base.label} (cópia)` : undefined, hidden: false, clone: true, item: base.item, kind: base.kind, pagina: base.pagina });
        const raizDe = `${container}.${source}`;
        const raizPara = `${container}.${cloneId}`;
        // seções descendentes da origem → mesmas seções sob a cópia (item, kind, fixed, clone preservados)
        for (const x of [...sections]) {
          if (x.container !== raizDe && !x.container.startsWith(raizDe + ".")) continue;
          const novoContainer = raizPara + x.container.slice(raizDe.length);
          if (!temSecao(novoContainer, x.id)) sections.push({ ...x, container: novoContainer, hidden: false });
        }
        // caminhos: prefixo trocado; section/container apontam para a cópia
        const de = raizDe + ".";
        const para = raizPara + ".";
        for (const e of [...entries]) {
          if (!e.path.startsWith(de)) continue;
          const path = para + e.path.slice(de.length);
          if (temPath.has(path)) continue;
          temPath.add(path);
          const direto = e.section === source && e.container === container;
          const containerNovo = !direto && e.container && (e.container === raizDe || e.container.startsWith(raizDe + ".")) ? raizPara + e.container.slice(raizDe.length) : e.container;
          entries.push({ ...e, path, section: direto ? cloneId : e.section, container: containerNovo, current: doc.values[path] });
        }
      }
    }
    if (!mudou) break;
  }
  // PROJEÇÃO pelo rascunho ATUAL (revisão v3 do Astra, achados 5 e 6; R2): cópia que o rascunho não tem mais
  // some COM a subárvore (itens e caminhos dela); visibilidade e ordem vêm do documento, não do último
  // manifesto postado — "oculte o último item e adicione outro" no mesmo turno escolhe o último VISÍVEL
  // morta = cópia ou criada que o rascunho não tem mais. O prefixo reservado entra na conta para o
  // caso de a linha ter chegado sem a marca `criada`: id `novo-…` nunca é seção do código.
  const mortas = sections.filter((x) =>
    (x.clone && !doc.sections[x.container]?.clones?.[x.id]) ||
    ((x.criada || ehIdDeCriada(x.id)) && !doc.sections[x.container]?.criadas?.[x.id]),
  );
  const raizesMortas = mortas.map((x) => `${x.container}.${x.id}`);
  const semAncestral = (container: string) => raizesMortas.some((r) => container === r || container.startsWith(r + "."));
  const vivas = sections
    .filter((x) => !mortas.includes(x) && !semAncestral(x.container))
    .map((x) => ({ ...x, hidden: (doc.sections[x.container]?.hidden ?? []).includes(x.id) }));
  const porContainer = new Map<string, ManifestSection[]>();
  for (const x of vivas) porContainer.set(x.container, [...(porContainer.get(x.container) ?? []), x]);
  const ordenadas: ManifestSection[] = [];
  for (const [container, lista] of porContainer) {
    const ordem = doc.sections[container]?.order ?? [];
    const explicitas = ordem.map((id) => lista.find((y) => y.id === id)).filter((y): y is ManifestSection => Boolean(y));
    ordenadas.push(...explicitas, ...lista.filter((y) => !ordem.includes(y.id)));
  }
  const prefixosMortos = raizesMortas.map((r) => r + ".");
  const entradas = prefixosMortos.length ? entries.filter((e) => !prefixosMortos.some((p) => e.path.startsWith(p))) : entries;
  return { ...manifest, sections: ordenadas, entries: entradas };
}

/**
 * A ordem pedida mantém cada seção FIXA no lugar? A conta é sobre a sequência EFETIVA que a loja renderiza
 * (`orderSections`: o que a ordem cita primeiro, depois o que ela omite, na ordem do código) e sobre a
 * posição entre as seções do CÓDIGO — adicionar ou mover cópias continua livre.
 */
export function ordemPreservaFixas(order: string[], secoesDoContainer: ManifestSection[]): boolean {
  return recusaDeOrdem(order, secoesDoContainer) === null;
}

/**
 * POR QUE esta ordem não vale? `null` = vale. Existe porque a recusa era MUDA em dois casos e o
 * lojista via só o arrasto voltar para o lugar:
 *
 *  · a página REAPROVEITA o container sem mandar nele (`Editable.Sections layout={false}`): as linhas
 *    chegam sem `ordemNoCodigo` de propósito, porque a ordem daquela página não é a do container;
 *  · o container não tem lista nenhuma no código (seções soltas, como o cabeçalho e o rodapé em
 *    `chrome`): não existe ordem original contra a qual conferir a posição da seção fixa.
 *
 * As frases saem daqui e vão para a tela como estão: são o motivo VERDADEIRO, sem contar encanamento.
 */
export function recusaDeOrdem(order: string[], linhasDoContainer: ManifestSection[]): string | null {
  // UMA LINHA POR SEÇÃO (foundation 11). O editor funde manifestos de páginas diferentes, e a mesma
  // seção chega duas vezes quando outra página reaproveita o container (`layout={false}`): uma linha
  // COM `ordemNoCodigo`, da página que manda na ordem, e uma sem, da página que só reaproveita. Vale
  // a que manda; sem esta escolha, a linha sem ordem faria a conta abaixo recusar toda reordenação da
  // home só porque a página de produto também foi aberta.
  const porId = new Map<string, ManifestSection>();
  for (const s of linhasDoContainer) {
    const atual = porId.get(s.id);
    if (!atual || (typeof atual.ordemNoCodigo !== "number" && typeof s.ordemNoCodigo === "number")) porId.set(s.id, s);
  }
  const secoesDoContainer = [...porId.values()];
  // A sequência de ORIGEM é a do CÓDIGO, não a que o manifesto traz (que já vem reordenada pelo rascunho):
  // é ela que a loja usa para completar o que a ordem omite, e comparar contra a reordenada deixava passar
  // ordem parcial que empurra a fixa — e recusava ordem parcial legítima (Astra v3.18, achado 3).
  // ARMADILHA 1: "não é cópia" NÃO quer dizer "é do código". Uma seção CRIADA não tem posição no
  // código, e tratá-la como original fazia `every(ordemNoCodigo)` falhar e RECUSAR, em silêncio, todo
  // `set_order` do container. Criada anda com as cópias — livre para ir a qualquer lugar.
  const criada = (s: ManifestSection) => Boolean(s.criada) || ehIdDeCriada(s.id);
  const originaisDoCodigo = secoesDoContainer.filter((s) => !s.clone && !criada(s));
  const fixas = secoesDoContainer.filter((s) => s.fixed);
  if (!fixas.length) return null; // nada a proteger neste container
  // sem a ordem DECLARADA pelo código não dá para validar: a sequência do manifesto já vem reordenada pelo
  // rascunho, e usá-la deixava passar ordem parcial que empurra a fixa (Astra v3.19, achado 3). Sem
  // procedência, a operação é RECUSADA — a loja recaptura o manifesto e ela passa a valer.
  if (!originaisDoCodigo.every((s) => typeof s.ordemNoCodigo === "number")) {
    // tudo que o código traz aqui é fixo (o `chrome`: cabeçalho e rodapé): não há ordem a mudar
    if (originaisDoCodigo.every((s) => s.fixed)) return "estas seções ficam onde estão";
    // a página só reaproveita a lista; quem manda na ordem é a página que a renderiza por inteiro
    if (secoesDoContainer.some((s) => s.semLayout)) return "esta página reaproveita estas seções; a ordem delas se edita na página de origem";
    return "não dá para mudar a ordem destas seções por aqui";
  }
  const originais = [...originaisDoCodigo].sort((a, b) => (a.ordemNoCodigo as number) - (b.ordemNoCodigo as number)).map((s) => s.id);
  const copias = secoesDoContainer.filter((s) => s.clone || criada(s)).map((s) => s.id);
  const base = [...originais, ...copias]; // mesma regra de `orderSections`: código primeiro, cópias e criadas depois
  const efetiva = [...order.filter((id) => base.includes(id)), ...base.filter((id) => !order.includes(id))];
  const depois = efetiva.filter((id) => originais.includes(id));
  return fixas.every((f) => originais.indexOf(f.id) === depois.indexOf(f.id)) ? null : "seção fixa não muda de lugar";
}

/** Valida uma operação contra o manifesto: caminho existe, tipo bate, token permitido. */
/**
 * Teto de UM texto (título, parágrafo, `alt`, rótulo de link). É EXPORTADO porque o painel mostra o
 * contador de caracteres do campo com este número, e uma cópia dele lá viraria, no primeiro ajuste
 * feito aqui, um contador que promete o que o servidor recusa.
 */
export const TEXTO_MAX = 4000;
/**
 * Valor bem-formado: string curta, ou objeto SÓ com os campos esperados, todos string.
 * Não olha o TIPO da entrada de propósito — `{src, alt}` serve tanto a imagem quanto a vídeo;
 * quem cobra que o tipo bate com o caminho é `validateOp`.
 *
 * O `tipo` é a ÚNICA exceção, e existe por causa do HTML: ele é string como o texto, mas tem teto
 * próprio (20.000 contra 4.000) e lista de recusa própria. Sem receber o tipo, um bloco legítimo de
 * 6.000 caracteres seria recusado como "texto grande demais" — a mensagem errada para o lojista.
 */
export function validateValueShape(v: unknown, tipo?: EditableType): { ok: true; value: EditableValue } | { ok: false; reason: string } {
  if (tipo === "html") {
    if (typeof v !== "string") return { ok: false, reason: "bloco de HTML precisa ser texto" };
    const recusa = recusaDeHtml(v);
    return recusa ? { ok: false, reason: recusa } : { ok: true, value: v };
  }
  if (typeof v === "string") return v.length <= TEXTO_MAX ? { ok: true, value: v } : { ok: false, reason: `texto acima de ${TEXTO_MAX} caracteres` };
  if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, reason: "valor precisa ser texto ou objeto" };
  const o = v as Record<string, unknown>;
  if ("modo" in o) return vitrineValida(o) ? { ok: true, value: o as unknown as EditableValue } : { ok: false, reason: "escolha de vitrine inválida (modo, categoria/produtos/busca, limite)" };
  const chaves = Object.keys(o);
  const permitidas = "src" in o ? ["src", "alt"] : "href" in o ? ["href", "label"] : ["color", "background"];
  for (const k of chaves) {
    if (!permitidas.includes(k)) return { ok: false, reason: `campo inesperado: ${k}` };
    if (o[k] !== undefined && (typeof o[k] !== "string" || (o[k] as string).length > TEXTO_MAX)) return { ok: false, reason: `${k} precisa ser texto` };
  }
  if ("src" in o && typeof o.src !== "string") return { ok: false, reason: "src precisa ser texto" };
  if ("href" in o && typeof o.href !== "string") return { ok: false, reason: "href precisa ser texto" };
  return { ok: true, value: o as unknown as EditableValue };
}

export function validateOp(op: PatchOp, manifest: Manifest): { ok: true } | { ok: false; reason: string } {
  const byPath = new Map(manifest.entries.map((e) => [e.path, e]));
  const tokens = new Set(manifest.tokens.map((t) => t.token));
  const sectionIds = new Set(manifest.sections.map((s) => `${s.container}/${s.id}`));
  // os containers que este manifesto CONHECE: é contra eles que um editável SEM seção em volta prova que
  // nasceu de um container. `useEditable` (valor sem elemento) chega sem `container` e é legítimo
  // (`home.hero.cor`); o `texto.1` de uma newsletter solta, num manifesto anterior à foundation 11,
  // chega igualzinho (sem container, com ponto) e é raiz. A diferença é o começo do caminho.
  const containers = new Set<string>([...manifest.sections.map((s) => s.container), ...manifest.entries.map((e) => e.container ?? "")].filter(Boolean));
  const nasceDeContainer = (path: string) => [...containers].some((c) => path.startsWith(`${c}.`));
  const foraDeSecao = (e: ManifestEntry | undefined, path: string) => Boolean(e) && !e?.container && !nasceDeContainer(path);
  const RAIZ = (path: string) => ({ ok: false as const, reason: `este campo está fora de qualquer seção e não pode ser gravado: ${path}` });
  // campos internos (só o inverso de desfazer os carrega) não vêm do cliente
  if ((op.op === "set" || op.op === "unset") && "declaredAnterior" in op && op.declaredAnterior !== undefined) return { ok: false, reason: "campo interno (declaredAnterior) não é aceito" };
  // A RAIZ DO DOCUMENTO NÃO SE GRAVA (foundation 11). `values` é plano e cego a página: um caminho sem
  // container valeria para o site inteiro e bateria com o de outra página, e caminho gravado não tem
  // renomear. A loja já não registra esses caminhos; aqui é a porta de quem GRAVA, e ela vale mesmo
  // contra um manifesto de loja antiga que ainda os liste. Seção sem container é a mesma porta.
  if ((op.op === "set" || op.op === "unset") && caminhoNaRaiz(op.path)) return { ok: false, reason: `este campo está fora de qualquer seção e não pode ser gravado: ${op.path}` };
  if ("container" in op && !op.container) return { ok: false, reason: "operação de seção sem container" };
  switch (op.op) {
    case "set": {
      // estilo por elemento: `<caminho>.estilo` existe se o caminho base existe; e por SEÇÃO:
      // `<container>.<id>.estilo` (só `background`) pinta o fundo da seção inteira
      if (isStylePath(op.path)) {
        const base = op.path.slice(0, -ESTILO.length);
        const be = byPath.get(base);
        const secao = !be && manifest.sections.find((x) => `${x.container}.${x.id}` === base);
        if (!be && !secao) return { ok: false, reason: `caminho inexistente: ${base}` };
        if (foraDeSecao(be, base)) return RAIZ(op.path);
        if (be && be.type !== "text" && be.type !== "link") return { ok: false, reason: `estilo só em texto e link (${base} é ${be.type})` };
        if (secao && typeof op.value === "object" && op.value !== null && "color" in op.value) return { ok: false, reason: "em seção, o estilo é só o fundo (background)" };
        if (typeof op.value !== "object" || op.value === null) return { ok: false, reason: "estilo precisa ser um objeto {color, background}" };
        const st = op.value as Record<string, unknown>;
        for (const k of Object.keys(st)) {
          if (k !== "color" && k !== "background") return { ok: false, reason: `estilo não aceita ${k}` };
          if (typeof st[k] !== "string" || !isColor(st[k] as string)) return { ok: false, reason: `cor inválida em ${k}` };
        }
        return { ok: true };
      }
      const e = byPath.get(op.path);
      if (!e) return { ok: false, reason: `caminho inexistente: ${op.path}` };
      // manifesto de loja anterior à foundation 11 ainda lista o editável de uma lista solta (`item-3.texto`,
      // container "") ou de uma seção solta (`texto.1`, sem container nenhum): têm ponto, e são raiz do
      // mesmo jeito, porque não começam em container que o manifesto conheça
      if (foraDeSecao(e, op.path)) return RAIZ(op.path);
      // BLOCO DE HTML — esta é a camada que LIMPA e RELATA: é aqui que o lojista fica sabendo por que
      // o bloco não entrou. Tipo e sufixo andam JUNTOS, e a coerência é obrigatória, não cosmética:
      // a loja lê o publicado sem manifesto, então um caminho de tipo html SEM o sufixo `.html`
      // publicaria HTML que `resolveValue` não reconheceria como HTML — e a defesa da loja e a do
      // primitivo não valeriam para ele. Na direção inversa, o sufixo em caminho de outro tipo faria
      // a loja rodar a lista de recusa sobre um texto comum e trocá-lo pelo literal do código.
      if (e.type === "html" || isHtmlPath(op.path)) {
        if (e.type !== "html") return { ok: false, reason: `o sufixo "${SUFIXO_HTML}" é reservado ao bloco de HTML: ${op.path}` };
        if (!isHtmlPath(op.path)) return { ok: false, reason: `caminho de bloco de HTML precisa terminar em "${SUFIXO_HTML}": ${op.path}` };
        const html = validateValueShape(op.value, "html");
        return html.ok ? { ok: true } : html;
      }
      const forma = validateValueShape(op.value);
      if (!forma.ok) return forma;
      const tv = typeOfValue(op.value);
      // duas exceções, pelo mesmo motivo: a FORMA não carrega o tipo. Cor é uma string como qualquer texto,
      // e vídeo é `{src, alt}` como qualquer imagem — `typeOfValue` devolve "text"/"image" nos dois casos e
      // recusaria o valor legítimo do caminho.
      if (tv !== e.type && !(e.type === "color" && tv === "text") && !(e.type === "video" && tv === "image")) return { ok: false, reason: `tipo ${tv} não serve em ${op.path} (${e.type})` };
      if (e.type === "color" && typeof op.value === "string" && !isColor(op.value)) return { ok: false, reason: `cor inválida: ${op.value}` };
      if ((e.type === "image" || e.type === "video") && typeof op.value === "object" && "src" in op.value && !isSafeUrl(op.value.src)) return { ok: false, reason: `${e.type === "video" ? "vídeo" : "imagem"} com URL inválida` };
      if (e.type === "link" && typeof op.value === "object" && "href" in op.value && !isSafeHref(op.value.href)) return { ok: false, reason: `link inválido` };
      return { ok: true };
    }
    case "unset": {
      const base = isStylePath(op.path) ? op.path.slice(0, -ESTILO.length) : op.path;
      if (foraDeSecao(byPath.get(base), base)) return RAIZ(op.path);
      return byPath.has(op.path) || (isStylePath(op.path) && (byPath.has(base) || manifest.sections.some((x) => `${x.container}.${x.id}` === base))) ? { ok: true } : { ok: false, reason: `caminho inexistente: ${op.path}` };
    }
    case "set_token":
      if (!tokens.has(op.token)) return { ok: false, reason: `token não editável: ${op.token}` };
      if (!isColor(op.value)) return { ok: false, reason: `cor inválida: ${op.value}` };
      return { ok: true };
    case "unset_token":
      return tokens.has(op.token) ? { ok: true } : { ok: false, reason: `token não editável: ${op.token}` };
    case "set_order": {
      const doContainer = manifest.sections.filter((s) => s.container === op.container);
      const known = doContainer.map((s) => s.id);
      const bad = op.order.filter((id) => !known.includes(id));
      if (bad.length) return { ok: false, reason: `seções desconhecidas: ${bad.join(", ")}` };
      if (new Set(op.order).size !== op.order.length) return { ok: false, reason: "ordem com id repetido" };
      // seção FIXA não muda de lugar (v3.16, achado 3) — e a conta é sobre a sequência EFETIVA: o que a ordem
      // OMITE não fica parado, vai para o fim, e era assim que se empurrava o cabeçalho (v3.17, achado 4).
      const recusa = recusaDeOrdem(op.order, doContainer);
      if (recusa) return { ok: false, reason: recusa };
      return { ok: true };
    }
    case "unset_order":
      return { ok: true };
    case "hide_section": {
      const sec = manifest.sections.find((x) => x.container === op.container && x.id === op.id);
      if (!sec) return { ok: false, reason: `seção inexistente: ${op.id}` };
      if (sec.fixed) return { ok: false, reason: `seção fixa não se oculta: ${op.id}` };
      return { ok: true };
    }
    case "show_section":
      return sectionIds.has(`${op.container}/${op.id}`) ? { ok: true } : { ok: false, reason: `seção inexistente: ${op.id}` };
    case "set_app": {
      if (op.app !== "rastreio") return { ok: false, reason: `app desconhecido: ${String(op.app)}` };
      if (!CAMPOS_DE_RASTREIO.includes(op.campo)) return { ok: false, reason: `campo de rastreio desconhecido: ${String(op.campo)}` };
      // a loja precisa LER `apps` para o valor ter efeito: abaixo da foundation 12 ele entraria no documento
      // e não mudaria nada na página, e o lojista publicaria achando que o rastreio está no ar
      if ((manifest.foundation ?? 0) < 12) return { ok: false, reason: "esta loja ainda não aceita a configuração de rastreio pelo painel" };
      if (op.value === null) return { ok: true };
      if (typeof op.value !== "string") return { ok: false, reason: "o valor precisa ser texto" };
      const v = normalizaRastreio(op.campo, op.value);
      if (v === "") return { ok: true }; // vazio = remover
      const recusa = recusaDeRastreio(op.campo, v);
      return recusa ? { ok: false, reason: recusa } : { ok: true };
    }
    case "restore_section":
    case "replace_doc":
      return { ok: false, reason: "operação interna (só como inverso de desfazer)" };
    case "duplicate_section": {
      // campo interno: quem semeia a ordem é o servidor, DEPOIS desta validação (Astra v3.15, achado 1)
      if (op.ordemSemeada !== undefined) return { ok: false, reason: "campo interno não aceito do cliente: ordemSemeada" };
      const sec = manifest.sections.find((x) => x.container === op.container && x.id === op.id);
      if (!sec) return { ok: false, reason: `seção inexistente: ${op.id}` };
      if (sec.fixed) return { ok: false, reason: `seção fixa não se duplica: ${op.id}` };
      // duplicar uma seção CRIADA fica fora do v1: a cópia renderiza o componente da ORIGEM, e a loja só
      // acha a origem entre os filhos do JSX — uma criada não está lá, então a cópia não apareceria na tela
      if (sec.criada || ehIdDeCriada(op.id)) return { ok: false, reason: `esta seção foi adicionada por você; para ter outra igual, adicione outra do mesmo tipo` };
      if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(op.cloneId)) return { ok: false, reason: `id de cópia inválido: ${op.cloneId}` };
      // o prefixo `novo-` é reservado às seções adicionadas: uma cópia com esse id seria lida como criada
      if (ehIdDeCriada(op.cloneId)) return { ok: false, reason: `id de cópia não pode começar com "${PREFIXO_CRIADA}"` };
      if (sectionIds.has(`${op.container}/${op.cloneId}`)) return { ok: false, reason: `já existe uma seção ${op.cloneId}` };
      return { ok: true };
    }
    case "add_section": {
      // campo interno: quem semeia a ordem é o servidor, DEPOIS desta validação (como na duplicação)
      if (op.ordemSemeada !== undefined) return { ok: false, reason: "campo interno não aceito do cliente: ordemSemeada" };
      // o catálogo é da LOJA — o editor não tem lista própria. Sem tipos declarados, a loja não oferece
      // adicionar seção (foundation antiga, ou container sem catálogo), e a operação não existe ali.
      const doCatalogo = (manifest.tipos ?? []).filter((t) => t.container === op.container);
      if (!doCatalogo.length) return { ok: false, reason: `esta loja não declara seções para adicionar em ${op.container}` };
      if (!doCatalogo.some((t) => t.tipo === op.tipo)) return { ok: false, reason: `tipo de seção indisponível: ${op.tipo}` };
      // id RESERVADO: `novo-<tipo>-<n>`. É o que impede a colisão com um id que o construtor escreva no
      // código depois — e é por ele que a projeção reconhece uma criada mesmo sem a marca no manifesto.
      if (!ehIdDeCriada(op.id)) return { ok: false, reason: `id de seção adicionada precisa começar com "${PREFIXO_CRIADA}": ${op.id}` };
      if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(op.id)) return { ok: false, reason: `id inválido: ${op.id}` };
      if (sectionIds.has(`${op.container}/${op.id}`)) return { ok: false, reason: `já existe uma seção ${op.id}` };
      if (op.indice !== undefined && (!Number.isInteger(op.indice) || op.indice < 0)) return { ok: false, reason: `posição inválida: ${op.indice}` };
      return { ok: true };
    }
    case "remove_section": {
      // campo interno: só o inverso de duplicar o carrega — vindo do cliente, uma ordem forjada quebra o
      // desfazer e escreve uma ordem inválida (verificação v3.15 do Astra, achado 1)
      if (op.ordemAnterior !== undefined) return { ok: false, reason: "campo interno não aceito do cliente: ordemAnterior" };
      const sec = manifest.sections.find((x) => x.container === op.container && x.id === op.id);
      if (!sec) return { ok: false, reason: `seção inexistente: ${op.id}` };
      // criada entra aqui junto com a cópia: as duas são do lojista, então saem; a do código se oculta
      if (!sec.clone && !sec.criada) return { ok: false, reason: `só cópias e seções adicionadas podem ser removidas; a original se oculta` };
      return { ok: true };
    }
  }
}

/**
 * Tipo DEDUZIDO da forma do valor. Não sabe dizer "video" (mesma forma da imagem), "color" nem "html"
 * (mesma forma do texto): quem sabe o tipo é o manifesto. `validateOp` abre exceção para os três — a
 * do html vem antes, no ramo próprio, porque ali o TETO e a lista de recusa também mudam.
 */
export function typeOfValue(v: EditableValue): EditableType {
  if (typeof v === "string") return "text"; // html e cor caem aqui também — o tipo real vem do manifesto
  if ("src" in v) return "image"; // vídeo cai aqui também — o tipo real vem da entrada do manifesto
  if ("href" in v) return "link";
  if ("modo" in v) return "vitrine"; // escolha de produtos; sem isto o patch do seletor era lido como cor
  return "color";
}

/** Todo texto visível dentro de um valor (texto, rótulo de link, alt de imagem) — para a verificação de honestidade. */
export function textsOfValue(v: EditableValue): string[] {
  if (typeof v === "string") return [v];
  const o = v as Record<string, unknown>;
  return ["label", "alt"].map((k) => o[k]).filter((x): x is string => typeof x === "string" && x.length > 0);
}

/** Estilo de um elemento (só cores válidas passam; o resto é ignorado). */
export function resolveStyle(doc: ContentDocument | null | undefined, path: string): { color?: string; background?: string } | undefined {
  const v = doc?.values[path + ESTILO];
  if (!v || typeof v !== "object") return undefined;
  const st = v as Record<string, unknown>;
  const out: { color?: string; background?: string } = {};
  if (typeof st.color === "string" && isColor(st.color)) out.color = st.color;
  if (typeof st.background === "string" && isColor(st.background)) out.background = st.background;
  return out.color || out.background ? out : undefined;
}

/**
 * Cor em formato FECHADO. O valor vai parar dentro de um `<style>` (tokens) — por isso
 * dentro dos parênteses só entram dígitos, letras, ponto, vírgula, %, espaço, barra e
 * hífen. Nada de `<`, `>`, `;`, `}` ou aspas: `rgb(</style><script>…)` passava por um
 * `[^)]` e viraria XSS.
 */
export function isColor(v: string): boolean {
  const t = v.trim();
  if (t.length > 64) return false;
  return /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(t) || /^(rgb|hsl|oklch|oklab)a?\([0-9a-z.,%\s\/-]{1,48}\)$/i.test(t);
}
/** `https://…` ou caminho absoluto. `\` fica fora: `/\evil.com` é lido pelo navegador como `//evil.com`. */
export function isSafeUrl(v: string): boolean {
  return /^(https:\/\/|\/(?![\/\\]))[^\s"'<>\\]{1,2000}$/.test(v);
}
export function isSafeHref(v: string): boolean {
  return /^(https?:\/\/|\/(?![\/\\])|#|mailto:|tel:)[^\s"'<>\\]{0,2000}$/.test(v);
}

/** Junta escopo + caminho relativo. Caminho começando com "/" é absoluto. */
export function joinPath(scope: string[], path: string): string {
  if (path.startsWith("/")) return path.slice(1);
  return [...scope, path].filter(Boolean).join(".");
}

/**
 * ESTE EDITÁVEL TEM CONTAINER? A porta que esta função fecha (foundation 11):
 *
 * `doc.values` é um mapa PLANO caminho→valor, cego a página DE PROPÓSITO (é o que faz o `chrome`
 * valer no site inteiro com um valor só). O preço disso é que um caminho PELADO, na raiz, também vale
 * no site inteiro: uma seção renderizada solta numa página nova grava `titulo`, e a seção solta da
 * página do lado grava `titulo` também. Editar uma muda a outra. E caminho gravado não tem renomear.
 *
 * Então a regra é: só é editável o caminho que NASCE de um container em vigor.
 *  · relativo: precisa de um container em vigor (`Editable.Section` dentro de `Editable.Sections
 *    container=…`, ou `Editable.Section container=…`) e o caminho inteiro tem de começar nele. Não
 *    basta "ter ponto": um `Editable.Scope` solto na raiz produz `atributos.titulo`, que parece
 *    endereçado e é raiz do mesmo jeito (medido na /oferta de uma loja piloto: a faixa de atributos solta
 *    gravaria `item-N.texto` com container vazio);
 *  · absoluto (`path="/home.faq.titulo"`): o construtor escreveu o endereço inteiro de propósito → sim,
 *    desde que tenha um container na frente;
 *  · um segmento só (`"titulo"`) = raiz, venha de onde vier → não.
 */
export function caminhoTemContainer(container: string | undefined, scope: string[], path: string): boolean {
  const full = joinPath(scope, path);
  if (!full.includes(".")) return false; // chave pelada na raiz do documento
  if (path.startsWith("/")) return true;
  return Boolean(container) && full.startsWith(`${container}.`);
}

/**
 * Caminho de VALOR que cairia na raiz do documento (`titulo`, `titulo.estilo`): sem container na
 * frente. É a mesma pergunta de `caminhoTemContainer`, feita do lado de quem GRAVA (`validateOp`),
 * que não tem escopo nem container em mãos, só o caminho.
 */
export function caminhoNaRaiz(path: string): boolean {
  const base = isStylePath(path) ? path.slice(0, -ESTILO.length) : path;
  return !base.includes(".");
}

/**
 * A PÁGINA de um manifesto, na forma em que ela entra em `Manifest.url` e em cada linha (`pagina`):
 * só o caminho, sempre com "/" na frente, sem query, sem hash e sem barra no fim (a raiz é "/").
 * Sem isto "/sobre" e "/sobre/" seriam duas páginas diferentes para o editor.
 */
export function normalizarPagina(u: string | null | undefined): string {
  const bruto = (u ?? "/").split("?")[0].split("#")[0];
  const comBarra = bruto.startsWith("/") ? bruto : `/${bruto}`;
  const semFim = comBarra.length > 1 ? comBarra.replace(/\/+$/, "") : comBarra;
  return semFim || "/";
}
