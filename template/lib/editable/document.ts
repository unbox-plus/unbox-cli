// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENTO DE CONTEÚDO — o que o editor (chat e CMS visual) edita.
//
// Funções puras, sem React e sem Node: o mesmo arquivo roda na loja, no editor
// e no gate. O documento guarda SÓ o que o lojista mudou; o conteúdo original
// continua no código (é o `fallback` de cada primitivo). Sem documento, a loja
// renderiza exatamente o que o construtor escreveu — é o que garante que ligar
// o editor numa loja existente não muda um pixel.
// ═══════════════════════════════════════════════════════════════════════════

export type EditableType = "text" | "image" | "link" | "color" | "vitrine" | "video" | "html" | "richtext";

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
/**
 * As entidades NOMEADAS que mudam o SENTIDO de um endereço: as que escrevem um esquema
 * (`javascript&colon;`), uma barra (`&sol;`), uma CONTRABARRA (`&bsol;`, que o navegador lê como barra em
 * `/\evil.com` e leva para fora da loja) ou pontuação de URL. A tabela do HTML5 tem milhares de nomes; aqui
 * entram os que abrem porta, e o que não está nela fica COMO ESTÁ — devolver string vazia era o que colava
 * o resto do endereço e escondia o defeito.
 */
const NOMEADAS: Record<string, string> = {
  colon: ":", tab: "\t", newline: "\n", sol: "/", bsol: "\\", lpar: "(", rpar: ")", period: ".", num: "#",
  quest: "?", semi: ";", commat: "@", excl: "!", ast: "*", plus: "+", equals: "=", lowbar: "_", amp: "&",
  lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0",
};
/**
 * SEM TETO DE DÍGITOS, porque o navegador não tem: `&#00000047;` é a barra `/` para ele, e a régua antiga
 * (`\d{1,7}`) lia só os sete primeiros dígitos, devolvia um caractere de controle e deixava o resto do
 * endereço passar — `<a href="/&#00000047;evil.com">` era aprovado e o navegador ia para `//evil.com`.
 * Um número fora do intervalo do Unicode vira string vazia: o navegador põe U+FFFD ali, que não forma
 * esquema nenhum, então recusar a mais nunca deixa passar a menos.
 */
function decodificaEntidades(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);?/gi, (_m, h: string) => umCodigo(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_m, d: string) => umCodigo(Number(d)))
    .replace(/&([a-z]+);?/gi, (m: string, nome: string) => NOMEADAS[nome.toLowerCase()] ?? m);
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

// ── TEXTO RICO: o corpo de um artigo (parágrafo, negrito, itálico, link, lista, subtítulo, citação)
//
// `Editable.Text multiline` só quebra linha e o bloco de HTML exige HTML na mão. Um artigo precisa do
// meio-termo: marcação de texto, produzida pelo editor de texto do painel ou pelo markdown do chat, e
// NADA além dela. Por isso este tipo é uma allowlist FECHADA, ao contrário do bloco de HTML (lista de
// recusa): aqui ninguém cola snippet de fornecedor, e tudo que não está na lista é, por definição, coisa
// que o editor não produziu.

/**
 * Sufixo RESERVADO do caminho de um texto rico (`artigo-blog-x.novo-texto-1.corpo.rico`), pelo mesmo
 * motivo do `.html`: a loja lê o publicado sem manifesto, e sem a marca NO CAMINHO ela não teria como
 * saber que este valor é marcação a passar pela lista fechada, e não um texto comum a escapar. Quem
 * carimba o sufixo é o primitivo (`Editable.RichText`): o construtor escreve `path="corpo"`.
 */
export const SUFIXO_RICO = ".rico";
export function isRichPath(path: string) {
  return path.endsWith(SUFIXO_RICO);
}

/** Teto de UM texto rico (decisão do dono). Acima disso o texto inteiro é recusado. */
export const RICO_MAX = 30000;

/**
 * A LISTA FECHADA: o que um artigo precisa e nada mais. Sem atributo nenhum fora `href` em `a`: não há
 * `class` para pegar estilo da loja, `style` para esconder texto, `id` para roubar âncora nem `on…` para
 * rodar código. Imagem e tabela ficam de fora de propósito: imagem entra como seção (com upload e alt), e
 * tabela não tem editor no painel.
 */
export const TAGS_DO_TEXTO_RICO = ["p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "hr"] as const;

/** as tags que separam BLOCOS de texto: é entre elas que `frasesDoTextoRico` corta as frases */
const BLOCOS_DO_TEXTO_RICO = /<\/?(?:p|li|h2|h3|h4|blockquote|br|hr|ul|ol)\b[^>]*>/gi;

interface TagLida {
  nome: string;
  fecha: boolean;
  atributos: { nome: string; valor: string }[];
  /** índice logo depois do `>` */
  fim: number;
}
const NOME_DE_TAG = /[a-zA-Z][a-zA-Z0-9-]*/y;
const ATRIBUTO = /([^\s=\/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*)))?/y;
const ESPACO = /\s*/y;

/**
 * Lê UMA tag a partir de um `<`, com as regras do tokenizador do navegador: `<` seguido de letra abre tag,
 * `</` fecha, `<!` e `<?` são comentário/declaração, e qualquer outro `<` ("a < b", "<3") é texto. Devolve
 * `null` para "isto é texto", `"declaracao"` para comentário/declaração e `"incompleta"` para uma tag que
 * não fecha o `>` antes do fim. As aspas são respeitadas de propósito: um `href="a>b"` não termina a tag.
 */
function lerTag(html: string, i: number): TagLida | "incompleta" | "declaracao" | null {
  let j = i + 1;
  const c = html[j];
  if (c === "!" || c === "?") return "declaracao";
  let fecha = false;
  if (c === "/") {
    fecha = true;
    j++;
  }
  NOME_DE_TAG.lastIndex = j;
  const nome = NOME_DE_TAG.exec(html)?.[0];
  if (!nome) return null;
  j += nome.length;
  const atributos: TagLida["atributos"] = [];
  while (j < html.length) {
    ESPACO.lastIndex = j;
    j += ESPACO.exec(html)?.[0].length ?? 0;
    if (j >= html.length) break;
    if (html[j] === ">") return { nome: nome.toLowerCase(), fecha, atributos, fim: j + 1 };
    // a barra de `<br/>` e `<hr />` não é atributo
    if (html[j] === "/") {
      j++;
      continue;
    }
    ATRIBUTO.lastIndex = j;
    const a = ATRIBUTO.exec(html);
    if (!a || a[0].length === 0) return "incompleta";
    atributos.push({ nome: a[1].toLowerCase(), valor: a[2] ?? a[3] ?? a[4] ?? "" });
    j += a[0].length;
  }
  return "incompleta";
}

/**
 * O `href` de um link do texto, pela MESMA régua dos links da loja (`isSafeHref`: http(s), mailto, tel, `#`
 * e caminho da loja), sobre o valor DECODIFICADO. O navegador decodifica entidade no valor do atributo, e
 * `jav&#97;script:` navega igual a `javascript:`; depois de decodificar, qualquer coisa que não seja um dos
 * começos permitidos é recusada, e isso cobre TAB, quebra de linha e nome de entidade que não conhecemos.
 */
function hrefSeguroNoTextoRico(valor: string): boolean {
  // LISTA FECHADA, e não "decodifique e veja": perseguir a tabela de entidades do navegador é uma corrida
  // que se perde uma vez só (`&bsol;`, `&#00000047;`), e aqui o texto é escrito pelo painel, que escapa o
  // `&` como `&amp;`. Então só `&amp;` (o separador de parâmetro, `?a=1&amp;b=2`) atravessa; qualquer outra
  // entidade no endereço é recusada antes de decodificar. `decodificaEntidades` continua valendo depois,
  // como segunda porta, para o `&amp;` que sobrou não esconder nada.
  if (/&(?!amp;)/i.test(valor)) return false;
  return isSafeHref(decodificaEntidades(valor.replace(/&amp;/gi, "&")).trim());
}

/**
 * O que impede este texto rico de ser usado, na frase que o LOJISTA lê, ou `null` quando passa. Recusa o
 * texto INTEIRO, como o bloco de HTML: quem limpa e relata é o editor (`limparTextoRico`), antes de chegar
 * aqui; esta régua é a que roda nas três camadas (editor ao gravar, loja ao ler o publicado, primitivo na
 * prévia) e por isso só sabe dizer "não" e por quê.
 */
export function recusaDeTextoRico(html: string): string | null {
  if (typeof html !== "string") return "o texto precisa ser texto";
  if (html.length > RICO_MAX) return `texto com ${html.length} caracteres: o teto é ${RICO_MAX}`;
  const permitidas = new Set<string>(TAGS_DO_TEXTO_RICO);
  let i = html.indexOf("<");
  while (i >= 0) {
    const tag = lerTag(html, i);
    if (tag === null) {
      i = html.indexOf("<", i + 1);
      continue;
    }
    if (tag === "declaracao") return "comentário e declaração de HTML (<!-- -->, <!DOCTYPE>) não entram no texto";
    if (tag === "incompleta") return `há uma tag sem fechar o sinal > no texto: «${trechoDaTag(html, i)}»`;
    if (!permitidas.has(tag.nome)) return `não dá para usar <${tag.nome}> no texto: só entram parágrafo, negrito, itálico, sublinhado, riscado, link, lista, subtítulo, citação e linha`;
    // atributo de tag de fechamento o navegador ignora; o que importa é o da abertura
    if (!tag.fecha) {
      // ATRIBUTO REPETIDO é recusado: o navegador fica com o PRIMEIRO `href`, e `linksExternosEmNovaAba`
      // (que remonta a tag por regex, esperando um atributo só) não casa com a tag e devolve o link de fora
      // sem `target`/`rel`. Duas leituras diferentes da mesma tag é exatamente o que não pode existir aqui.
      const vistos = new Set<string>();
      for (const a of tag.atributos) {
        if (vistos.has(a.nome)) return `o atributo ${a.nome} está repetido em <${tag.nome}>`;
        vistos.add(a.nome);
        if (tag.nome === "a" && a.nome === "href") {
          if (!hrefSeguroNoTextoRico(a.valor)) return "link inválido no texto: o endereço precisa começar com https://, http://, /, #, mailto: ou tel:";
          continue;
        }
        return `o atributo ${a.nome} não entra no texto${tag.nome === "a" ? " (no link, só href)" : ""}`;
      }
    }
    i = html.indexOf("<", tag.fim);
  }
  return null;
}

/** as entidades que o editor de texto escreve, de volta a caractere (para ler o texto, nunca para renderizar) */
function decodificaTexto(s: string): string {
  return decodificaEntidades(s.replace(/&nbsp;/gi, " ").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")).replace(/&amp;/gi, "&");
}

/**
 * As FRASES de um texto rico, sem marcação: um item por bloco (parágrafo, item de lista, subtítulo,
 * citação), como o visitante as lê. É o que a honestidade confere e o que o painel mostra como trecho: a
 * pergunta ao lojista cita um texto que existe na tela dele, não `<strong>` nem `&amp;`. Em pedaços porque
 * é assim que o "isto eu já aceitei" continua valendo depois de mexer numa palavra em outro parágrafo.
 */
export function frasesDoTextoRico(html: string): string[] {
  return decodificaTexto(html.replace(BLOCOS_DO_TEXTO_RICO, "\n").replace(/<[^>]*>/g, ""))
    .split("\n")
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 0);
}

/** o texto rico numa linha só, sem marcação: o que o modelo do chat e o trecho da seção recebem no lugar do HTML */
export function textoDoTextoRico(html: string): string {
  return frasesDoTextoRico(html).join(" ");
}

/**
 * Um `<a href=…>` do texto rico, inteiro, com o `href` em qualquer grafia (aspas duplas, simples ou sem aspas).
 * Só enxerga o que a lista fechada deixa passar: no link do texto rico não existe outro atributo, e as aspas
 * foram respeitadas por `lerTag`, então a tag termina no primeiro `>` depois do valor. O grupo 1 é o
 * `<a ` como foi escrito e o grupo 2 é o `href=…` como foi escrito, para a tag ser remontada sem tocar em nada.
 */
const LINK_DO_TEXTO_RICO = /(<a\s+)(href\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))\s*\/?>/gi;
const VALOR_DO_HREF = /=\s*(?:"([^"]*)"|'([^']*)'|([\s\S]*))$/;

/**
 * Os links de FORA do texto abrem em aba nova sem entregar a janela da loja ao destino: `target="_blank"` e
 * `rel="noopener noreferrer"` entram na RENDERIZAÇÃO, nunca no documento (o texto guardado continua só com
 * o `href`, e a lista fechada continua valendo para ele). Transformação de string, sem DOM, porque roda no
 * servidor e no cliente por igual, e só sobre texto que JÁ passou por `recusaDeTextoRico`: é essa passagem
 * que garante que o `<a>` tem só o `href` e que a regex vê a tag inteira. Link interno (`/`, `#`,
 * `mailto:`, `tel:`) fica como está: abrir a própria loja em outra aba é o que ninguém pede. O `href` é
 * decodificado só para DECIDIR (uma entidade no começo esconderia o `https://`); o atributo sai como estava.
 */
export function linksExternosEmNovaAba(html: string): string {
  return html.replace(LINK_DO_TEXTO_RICO, (tag: string, abre: string, atributo: string) => {
    const m = VALOR_DO_HREF.exec(atributo);
    const href = decodificaEntidades(m?.[1] ?? m?.[2] ?? m?.[3] ?? "").trim();
    if (!/^https?:\/\//i.test(href)) return tag;
    // a abertura e o `href` saem como foram escritos (caixa, aspas): só os dois atributos entram
    return `${abre}${atributo} target="_blank" rel="noopener noreferrer">`;
  });
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

/**
 * SÓ AS VARIÁVEIS DE RASTREIO, uma cópia com nada mais dentro. É o que se passa a `<Rastreio>`, no
 * lugar do ambiente inteiro.
 *
 * O motivo é o modo de desenvolvimento: ali o React serializa no HTML as props de todo componente de
 * servidor, para a ferramenta de depuração do navegador. Com o ambiente inteiro numa prop, cada
 * página servida em desenvolvimento levava junto TODA variável do processo, segredo incluído — e a
 * prévia local que se compartilha para revisão é servida assim. Em build de produção isso não
 * acontece, mas a defesa não pode depender do modo em que a loja está rodando.
 *
 * A leitura continua igual: `rastreioEmVigor` lê estas mesmas variáveis pelo nome.
 */
export function ambienteDeRastreio(ambiente: Ambiente): Ambiente {
  const so: Ambiente = {};
  for (const nome of Object.values(VARIAVEIS_DE_RASTREIO)) if (ambiente[nome] !== undefined) so[nome] = ambiente[nome];
  return so;
}

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
 * sem mensagem, nunca uma exceção, porque este link é montado no layout de toda página da loja.
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
 * A conferência dos blocos de HTML e dos textos formatados (`semBlocosRecusados`, server.ts) roda DEPOIS, sobre o `doc` que sai daqui.
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

// ── PÁGINAS DO LOJISTA, COLEÇÕES E REDIRECIONAMENTOS (foundation 13) ─────────────────────────────
//
// O que o lojista cria sem programador: páginas avulsas (`/paginas/<endereço>`), coleções de artigos
// (`/blog`, `/receitas`) e os artigos delas (`/blog/<endereço>`). O modelo é o das plataformas de loja
// que ele já conhece: endereço gerado do título e independente dele depois, visibilidade por página,
// agendamento por data, SEO por página e redirecionamento ao renomear.
//
// O REGISTRO (`paginas[id]`) guarda só o que não é copy: tipo, endereço, visibilidade, datas, autor,
// tags, SEO. Título, resumo e imagem de destaque vivem em `values` (`<id>.cabecalho.titulo`…), como
// qualquer texto da loja, para serem editáveis inline, pelo chat, sob honestidade e sob o aviso de
// texto em branco. O CORPO são seções criadas em `sections[<id>].criadas`, com o catálogo que a casca
// declara. Copy no registro seria uma segunda porta de escrita, sem nada disso.
//
// ADITIVO: os três mapas são opcionais e nunca existem vazios (mapa que esvaziou some, como `apps`);
// documento antigo continua usável e `documentoUsavel` não muda.

export type TipoDePagina = "pagina" | "artigo";
export type Visibilidade = "visivel" | "oculta";
export interface SeoDaPagina {
  /** o `<title>` (até 70; o painel avisa em 60); ausente = o título da página */
  title?: string;
  /** a meta description (até 200; o painel avisa em 155); ausente = o resumo */
  description?: string;
  /** a imagem do compartilhamento; ausente = a imagem de destaque, senão a social da loja */
  image?: ImageValue;
  /** `noindex` e fora do sitemap, sem tirar a página do ar */
  ocultarDeBuscadores?: boolean;
}
export interface PaginaDoLojista {
  tipo: TipoDePagina;
  handle: string;
  /** handle da coleção; obrigatório em "artigo", proibido em "pagina" */
  colecao?: string;
  /** página nasce "visivel", artigo nasce "oculta" (como nas plataformas que o lojista conhece); oculta = 404 */
  visibilidade: Visibilidade;
  /** ISO com fuso; a data visível e a do JSON-LD; no futuro = agendada (`visivelAgora` a segura) */
  publicadoEm?: string;
  criadoEm: string;
  /** muda com QUALQUER edição de conteúdo da página (é o `lastmod` do sitemap); ver o carimbo em `applyOp` */
  atualizadoEm: string;
  /** nome de exibição, nunca e-mail (o publicado é público) */
  autor?: string;
  /** até 20, cada uma até 40, só exibidas (sem página de tag) */
  tags?: string[];
  seo?: SeoDaPagina;
}
export interface ColecaoDePaginas {
  handle: string;
  criadoEm: string;
  atualizadoEm: string;
  seo?: Pick<SeoDaPagina, "title" | "description">;
}

/**
 * Prefixos RESERVADOS dos ids de container do lojista, como `novo-` é o das seções criadas: `pagina-<h>`,
 * `artigo-<colecao>-<h>`, `colecao-<h>`. É o que torna impossível por construção a colisão com um container
 * que o construtor escreva no código (o gate reprova código que os declare) e o que deixa `applyOp` saber,
 * pelo caminho, que uma edição é de página do lojista. Nunca ponto no id: o editor lê `a.b` como lista
 * dentro de seção. Um id de artigo NÃO se decompõe (coleção e handle têm hífen): quem precisa de coleção
 * e handle lê o registro.
 */
export const PREFIXOS_DO_LOJISTA = ["pagina-", "artigo-", "colecao-"] as const;
/** este container (ou a raiz deste caminho de container, `pagina-x.novo-faq-1`) é de página do lojista? */
export function ehContainerDoLojista(id: string): boolean {
  const raiz = id.split(".")[0];
  return PREFIXOS_DO_LOJISTA.some((p) => raiz.startsWith(p));
}

/**
 * A seção FIXA que toda casca de página e de coleção renderiza: título, resumo e imagem de destaque
 * (na coleção, título e descrição). Os caminhos são `<id>.cabecalho.<campo>`. As constantes existem para
 * a casca, o painel e `manifestComPaginas` montarem o MESMO caminho: um literal repetido em três lugares
 * descola em silêncio (a loja leria uma caixa e o editor escreveria em outra).
 */
export const SECAO_CABECALHO = "cabecalho";
export interface CampoDoCabecalho {
  campo: string;
  tipo: EditableType;
  /** o rótulo que o lojista lê na ficha */
  label: string;
}
export const CAMPOS_DO_CABECALHO: Record<"pagina" | "colecao", readonly CampoDoCabecalho[]> = {
  pagina: [
    { campo: "titulo", tipo: "text", label: "Título" },
    { campo: "resumo", tipo: "text", label: "Resumo" },
    { campo: "imagem", tipo: "image", label: "Imagem de destaque" },
  ],
  colecao: [
    { campo: "titulo", tipo: "text", label: "Título" },
    { campo: "descricao", tipo: "text", label: "Descrição" },
  ],
};

/**
 * Primeiros segmentos de URL que uma coleção NUNCA pode ocupar. A rota dinâmica da coleção (`/[colecao]`)
 * perde para toda rota estática do código por precedência do roteador, e para todo arquivo de `public/`
 * pelo servidor de estáticos: uma coleção `produtos` existiria no documento e nunca abriria. A loja
 * completa esta lista com as rotas DELA e as entradas de `public/` (`reservadosDaLoja()`), e a lista
 * inteira viaja no manifesto (`paginasDoLojista.reservados`): o editor nunca a digita.
 */
export const RESERVADOS_FIXOS = [
  "api", "_next", "paginas", "previa-do-editor", "acesso", "admin", "editor", "unbox", "brand", "static", "assets",
  "images", "img", "fonts", "sitemap.xml", "robots.txt", "llms.txt", "manifest.webmanifest", "opengraph-image",
  "icon.png", "apple-icon.png", "favicon.ico", "p", "c", "s", "a", "apps", "pagina",
] as const;
/** o segmento da paginação da coleção (`/<colecao>/pagina/2`): um artigo com esse endereço nunca abriria */
export const HANDLE_DE_ARTIGO_RESERVADO = "pagina";

/** Tetos (decisão do dono; ver o desenho, §8). Acima disso a operação é recusada com o número na frase. */
export const PAGINAS_MAX = 500;
export const COLECOES_MAX = 20;
export const REDIRECIONAMENTOS_MAX = 1000;
/** artigos por página da listagem de uma coleção (`/<colecao>/pagina/N`) */
export const ARTIGOS_POR_PAGINA = 12;

/**
 * O prefixo das páginas avulsas quando a loja não declara outro (`manifest.paginasDoLojista.prefixoDePaginas`).
 * O servidor do editor carimba o da loja nas operações que montam rotas (`prefixoDePaginas`, campo interno);
 * sem ele vale este, que é o de toda loja do CLI.
 */
export const PREFIXO_DE_PAGINAS_PADRAO = "/paginas";
/**
 * A CASCA em modo edição: o editor abre as páginas do lojista em `/previa-do-editor/<rota>` (publicadas ou
 * não). `normalizarPagina` tira este prefixo para a página do manifesto ser a ROTA (`/blog/titulo`), a mesma
 * de produção, senão cada linha capturada na prévia pareceria de outra página.
 */
export const PREFIXO_DA_PREVIA = "/previa-do-editor";

/**
 * A RÉGUA DO ENDEREÇO: minúsculas ASCII e dígitos separados por UM hífen, de 2 a 80 caracteres. É a
 * grafia documentada das plataformas de onde o lojista migra, e é o que uma URL aguenta sem codificar.
 */
export const HANDLE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const HANDLE_MIN = 2;
export const HANDLE_MAX = 80;
export function handleValido(h: unknown): h is string {
  return typeof h === "string" && h.length >= HANDLE_MIN && h.length <= HANDLE_MAX && HANDLE.test(h);
}

/**
 * O endereço SUGERIDO a partir do título ("Receita de Pão" → `receita-de-pao`): decompõe (NFD), tira os
 * diacríticos, minúsculas, toda sequência que não é letra ou dígito vira UM hífen, sem hífen nas pontas,
 * até 80. Vazio (título só de símbolos) vira o TIPO (`pagina`, `artigo`, `colecao`), para o campo nunca
 * nascer em branco. O endereço NÃO acompanha o título depois: trocar o título não muda a URL publicada.
 */
export function handleize(titulo: string, tipo: TipoDePagina | "colecao" = "pagina"): string {
  const h = String(titulo ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, HANDLE_MAX)
    .replace(/-+$/, "");
  // abaixo do mínimo a própria régua recusaria a sugestão, e o campo do diálogo nasceria inválido: um
  // título de uma letra ("A") vira `a-artigo`, e um título só de símbolos vira o tipo
  if (h.length >= HANDLE_MIN) return h;
  return h ? `${h}-${tipo}` : tipo;
}

/**
 * Este endereço é reservado neste escopo? Coleção: `RESERVADOS_FIXOS` mais os `reservados` que a loja
 * declarou no manifesto (rotas do código e arquivos públicos). Artigo: só `pagina` (a paginação). Página
 * avulsa: nada além da régua, porque ela vive sob o prefixo e não disputa com o código.
 */
export function handleReservado(tipo: TipoDePagina | "colecao", handle: string, reservados?: readonly string[]): boolean {
  if (tipo === "colecao") return (RESERVADOS_FIXOS as readonly string[]).includes(handle) || Boolean(reservados?.includes(handle));
  if (tipo === "artigo") return handle === HANDLE_DE_ARTIGO_RESERVADO;
  return false;
}

/**
 * O SEPARADOR entre coleção e endereço no id de um artigo é DUPLO, e a régua do endereço proíbe hífen
 * duplo: é o que torna o id impossível de confundir. Com um hífen só, `artigo-aa-bb-cc` era ao mesmo tempo
 * (coleção `aa`, endereço `bb-cc`) e (coleção `aa-bb`, endereço `cc`): duas páginas diferentes caíam no
 * MESMO container, e como a copy mora no container, a segunda herdava o texto da primeira e a primeira
 * sumia do ar — sem erro, e o desfazer apagava as duas.
 */
export const SEPARADOR_DE_ARTIGO = "--";

export function idDePagina(tipo: TipoDePagina, handle: string, colecao?: string): string {
  return tipo === "artigo" ? `artigo-${colecao}${SEPARADOR_DE_ARTIGO}${handle}` : `pagina-${handle}`;
}
export function idDeColecao(handle: string): string {
  return `colecao-${handle}`;
}

/**
 * O id de volta em (tipo, endereço, coleção), ou `null` quando não é id de página do lojista. Serve de
 * RÉGUA: `validateOp` confere a forma antes de procurar o registro, senão um id como `__proto__` ou
 * `constructor` chegava ao documento (gravando um registro sem tipo que a loja lia como página válida) ou
 * estourava dentro de `applyOp`.
 */
export function decomporIdDePagina(id: unknown): { tipo: TipoDePagina | "colecao"; handle: string; colecao?: string } | null {
  if (typeof id !== "string") return null;
  if (id.startsWith("pagina-")) {
    const handle = id.slice("pagina-".length);
    return handleValido(handle) ? { tipo: "pagina", handle } : null;
  }
  if (id.startsWith("colecao-")) {
    const handle = id.slice("colecao-".length);
    return handleValido(handle) ? { tipo: "colecao", handle } : null;
  }
  if (id.startsWith("artigo-")) {
    const resto = id.slice("artigo-".length);
    const corte = resto.indexOf(SEPARADOR_DE_ARTIGO);
    if (corte < 0) return null;
    const colecao = resto.slice(0, corte);
    const handle = resto.slice(corte + SEPARADOR_DE_ARTIGO.length);
    return handleValido(colecao) && handleValido(handle) ? { tipo: "artigo", handle, colecao } : null;
  }
  return null;
}

/** a ROTA pública de uma página: `<prefixo>/<handle>` na avulsa, `/<colecao>/<handle>` no artigo */
export function rotaDePagina(p: Pick<PaginaDoLojista, "tipo" | "handle" | "colecao">, prefixoDePaginas: string = PREFIXO_DE_PAGINAS_PADRAO): string {
  if (p.tipo === "artigo") return `/${p.colecao}/${p.handle}`;
  const base = normalizarPagina(prefixoDePaginas);
  return base === "/" ? `/${p.handle}` : `${base}/${p.handle}`;
}
/** a rota da listagem de uma coleção (página 1); as demais são `/<colecao>/pagina/N` */
export function rotaDeColecao(handle: string): string {
  return `/${handle}`;
}

/** a página do rascunho (ou do publicado) que responde por este caminho, ou `null` */
export function paginaDaRota(doc: ContentDocument | null | undefined, caminho: string, prefixoDePaginas: string = PREFIXO_DE_PAGINAS_PADRAO): { id: string; registro: PaginaDoLojista } | null {
  const alvo = normalizarPagina(caminho);
  for (const [id, registro] of Object.entries(doc?.paginas ?? {})) if (rotaDePagina(registro, prefixoDePaginas) === alvo) return { id, registro };
  return null;
}

/**
 * O handle da coleção que responde por este caminho (`/blog` → `blog`), ou `null`. A coleção pode ser do
 * lojista (`doc.colecoes`) ou do CÓDIGO (`colecoesDoCodigo`, a que a loja declara no manifesto); a do
 * código não tem registro no documento e ainda assim tem listagem e artigos.
 */
export function colecaoDaRota(doc: ContentDocument | null | undefined, caminho: string, colecoesDoCodigo?: readonly { handle: string }[]): string | null {
  const alvo = normalizarPagina(caminho);
  const h = alvo.slice(1);
  if (!h || h.includes("/")) return null;
  if (doc?.colecoes?.[h] || colecoesDoCodigo?.some((c) => c.handle === h)) return h;
  return null;
}

/** visível, e `publicadoEm` ausente ou já passado. Data que não se lê nunca chega: agendada para sempre, não visível por engano. */
export function visivelAgora(p: Pick<PaginaDoLojista, "visibilidade" | "publicadoEm">, agora: Date | number = Date.now()): boolean {
  if (p.visibilidade !== "visivel") return false;
  if (!p.publicadoEm) return true;
  const quando = Date.parse(p.publicadoEm);
  return Number.isFinite(quando) && quando <= (agora instanceof Date ? agora.getTime() : agora);
}

/**
 * Os artigos VISÍVEIS de uma coleção, do mais novo ao mais antigo: por `publicadoEm` (sem ele, `criadoEm`
 * faz as vezes: um artigo sem data marcada é do dia em que nasceu), depois `criadoEm`, depois o id, para a
 * ordem ser a mesma em toda renderização. É a ordem da listagem, do sitemap e do JSON-LD.
 */
export function artigosDaColecao(doc: ContentDocument | null | undefined, handle: string, agora: Date | number = Date.now()): { id: string; registro: PaginaDoLojista }[] {
  const lista: { id: string; registro: PaginaDoLojista }[] = [];
  for (const [id, registro] of Object.entries(doc?.paginas ?? {})) {
    if (registro.tipo === "artigo" && registro.colecao === handle && visivelAgora(registro, agora)) lista.push({ id, registro });
  }
  const data = (p: PaginaDoLojista) => Date.parse(p.publicadoEm ?? p.criadoEm) || 0;
  return lista.sort((a, b) => data(b.registro) - data(a.registro) || (Date.parse(b.registro.criadoEm) || 0) - (Date.parse(a.registro.criadoEm) || 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Para onde este caminho redireciona, ou `null`. UM salto só, de propósito: o mapa é mantido sem cadeia por
 * quem escreve (`applyOp` reaponta as entradas antigas ao renomear), então seguir cadeia aqui esconderia um
 * mapa com defeito em vez de mostrá-lo. Um caminho que aponta para si mesmo não redireciona.
 */
export function redirecionamentoDe(doc: ContentDocument | null | undefined, caminho: string): string | null {
  const de = normalizarPagina(caminho);
  const para = doc?.redirecionamentos?.[de];
  // o destino é conferido AQUI, e não só na hora de gravar: quem lê é a loja, com o JSON publicado, e um
  // destino de fora (`https://…`, `//host`, `/\host`) viraria um redirecionamento permanente da loja para
  // outro site. A régua é a mesma dos links: caminho absoluto da própria loja.
  return typeof para === "string" && para !== de && /^\/(?![/\\])[^\s"'<>\\]{0,2000}$/.test(para) ? para : null;
}

/**
 * ESTA PÁGINA ESTÁ NO AR? A pergunta se responde no documento PUBLICADO, e em lugar nenhum mais: é ela que
 * decide se apagar ou trocar o endereço exige confirmação, e se um redirecionamento tem para quem servir.
 * O rascunho não serve (a página pode estar visível nele e nunca ter sido publicada), e o cliente muito
 * menos: mandar "não está no ar" era o suficiente para apagar uma URL indexada sem confirmar nada.
 */
export function estaNoAr(publicado: ContentDocument | null | undefined, id: string, agora: Date | number = Date.now()): boolean {
  const p = publicado?.paginas?.[id];
  return Boolean(p && visivelAgora(p, agora));
}
/** a listagem desta coleção está no ar? (coleção do código está sempre; a do lojista, depois de publicada) */
export function colecaoNoAr(publicado: ContentDocument | null | undefined, handle: string, colecoesDoCodigo?: readonly { handle: string }[]): boolean {
  return Object.hasOwn(publicado?.colecoes ?? {}, handle) || Boolean(colecoesDoCodigo?.some((c) => c.handle === handle));
}
/** os ids dos artigos desta coleção que estão no ar (os endereços que um renomear de coleção deixa para trás) */
export function artigosNoAr(publicado: ContentDocument | null | undefined, colecao: string, agora: Date | number = Date.now()): string[] {
  return artigosDaColecao(publicado, colecao, agora).map((a) => a.id);
}

/** o handle como título de emergência: `receita-de-pao` → "Receita de pao" */
function handleCapitalizado(h: string): string {
  const s = h.replace(/-+/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * O título que o lojista deu (`<id>.cabecalho.titulo` em `values`), senão o endereço capitalizado. Serve
 * para o painel nomear a página na lista e para a loja nunca renderizar `<h1>` vazio. Aceita o id de uma
 * página (`pagina-x`, `artigo-c-x`) ou de uma coleção (`colecao-c`).
 */
export function tituloDaPagina(doc: ContentDocument | null | undefined, id: string): string {
  const v = doc?.values[`${id}.${SECAO_CABECALHO}.titulo`];
  if (typeof v === "string" && v.trim()) return v.trim();
  const registro = doc?.paginas?.[id];
  if (registro) return handleCapitalizado(registro.handle);
  if (id.startsWith("colecao-")) return handleCapitalizado(id.slice("colecao-".length));
  return id;
}

/** este endereço já está em uso no escopo? (páginas entre si; artigos dentro da mesma coleção; coleções entre si) */
export function enderecoEmUso(doc: ContentDocument | null | undefined, tipo: TipoDePagina | "colecao", handle: string, colecao?: string): boolean {
  if (tipo === "colecao") return Object.hasOwn(doc?.colecoes ?? {}, handle);
  // pelo ID derivado TAMBÉM, e não só pelo par (endereço, coleção): o container é onde a copy mora, e duas
  // páginas no mesmo container é uma apagando a outra. Com o separador duplo isto é redundante de
  // propósito — continua valendo para um documento gravado por fora, com id de outra origem.
  if (Object.hasOwn(doc?.paginas ?? {}, idDePagina(tipo, handle, colecao))) return true;
  for (const p of Object.values(doc?.paginas ?? {})) {
    if (p.tipo !== tipo || p.handle !== handle) continue;
    if (tipo === "pagina" || p.colecao === colecao) return true;
  }
  return false;
}

/**
 * O endereço LIVRE mais próximo do pedido: o próprio, senão `-1`, `-2`… (a regra documentada das plataformas
 * de origem, previsível para quem migra). Só na CRIAÇÃO: ao editar o endereço à mão, colisão é recusada com
 * "já está em uso", porque trocar por baixo o que a pessoa digitou é pior que dizer. O sufixo cabe no teto
 * de 80: a base é cortada para ele entrar. `reservados` e `colecoesDoCodigo` contam como ocupados, senão a
 * sugestão nasceria recusada.
 */
export function proximoHandleLivre(
  doc: ContentDocument | null | undefined,
  tipo: TipoDePagina | "colecao",
  handle: string,
  opcoes?: { colecao?: string; reservados?: readonly string[]; colecoesDoCodigo?: readonly { handle: string }[] },
): string {
  const ocupado = (h: string) =>
    enderecoEmUso(doc, tipo, h, opcoes?.colecao) ||
    handleReservado(tipo, h, opcoes?.reservados) ||
    (tipo === "colecao" && Boolean(opcoes?.colecoesDoCodigo?.some((c) => c.handle === h)));
  if (!ocupado(handle)) return handle;
  for (let n = 1; ; n++) {
    const sufixo = `-${n}`;
    const candidato = handle.slice(0, HANDLE_MAX - sufixo.length).replace(/-+$/, "") + sufixo;
    if (!ocupado(candidato)) return candidato;
  }
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
  /**
   * PÁGINAS DO LOJISTA (foundation 13): chave = id do container (`pagina-<h>` | `artigo-<c>-<h>`). Copy
   * fica em `values`; aqui é só o registro (ver o bloco acima). Opcional e nunca vazio.
   */
  paginas?: Record<string, PaginaDoLojista>;
  /** coleções criadas pelo lojista, chave = handle (as do código não têm registro; ver `colecaoDaRota`) */
  colecoes?: Record<string, ColecaoDePaginas>;
  /**
   * caminho antigo → caminho novo, os dois absolutos e internos (nunca URL de fora). Sem cadeia: quem
   * escreve reaponta as entradas antigas para o destino final (`applyOp`). A loja responde 308 por ele.
   */
  redirecionamentos?: Record<string, string>;
}

export function emptyDocument(shop: string): ContentDocument {
  return { schema: 1, shop, values: {}, sections: {}, tokens: {} };
}

// ── O QUE VAI AO NAVEGADOR: OS DOIS CORTES ───────────────────────────────────────────────────────
//
// O documento publicado viaja SERIALIZADO no HTML de toda página, porque quem o distribui é um
// componente de cliente (o provider, chamado pelo layout raiz). Enquanto o documento guardava só o
// que foi EDITADO por cima do código, isso era pequeno. As páginas que o lojista cria mudam a conta:
// cada uma delas é 100% documento, e com cem artigos publicados a página de um produto passaria a
// carregar o texto de todos eles. Peso de HTML é tempo de carregamento, e tempo de carregamento
// conta na posição em que a busca coloca a loja.
//
// Então o layout raiz entrega o documento SEM NADA das páginas do lojista, e a rota que renderiza
// uma delas ACRESCENTA a fatia que ela usa (`EditableFatia`, no provider). Os dois cortes e a junção
// são puros e moram aqui porque a mesma régua roda na loja e nos testes.

/**
 * Esta chave está sob este alvo? O alvo é um PREFIXO DE CAMINHO no vocabulário do próprio documento,
 * que é separado por ponto: `pagina-sobre` casa o container inteiro (`pagina-sobre`,
 * `pagina-sobre.cabecalho.titulo`, `pagina-sobre.novo-texto-1.corpo.rico`) e nunca casa
 * `pagina-sobre-nos`; um alvo terminado em ponto (`artigo-x.cabecalho.`) casa só o que está sob
 * aquele ponto do caminho.
 */
function sobOAlvo(chave: string, alvo: string): boolean {
  return chave === alvo || chave.startsWith(alvo.endsWith(".") ? alvo : `${alvo}.`);
}

/**
 * O documento projetado nas chaves que `mantem` aprova. Sai, nos dois cortes e sempre:
 *
 * - os três mapas de página (`paginas`, `colecoes`, `redirecionamentos`), porque quem os lê é o SERVIDOR;
 * - `declared`, o registro de quem declarou cada promessa comercial. Quem o lê e escreve é `applyOp`,
 *   que roda no editor sobre o rascunho; no navegador de quem visita a loja não há um leitor sequer.
 *   Ele viajava em todo HTML de toda página sem ninguém pedir. Se um dia um primitivo precisar da
 *   proveniência na tela, ela volta por uma fatia própria.
 *
 * Os valores NÃO são clonados. Isto roda a cada renderização de página e o documento pode ter
 * centenas de milhares de caracteres; clonar seria pagar o peso que este corte existe para tirar.
 * Ninguém escreve num valor lido do documento (quem muda o documento é `applyOp`, que clona antes),
 * então a cópia rasa das duas caixas basta para o corte não tocar no original.
 */
function projetarDocumento(doc: ContentDocument, mantem: (chave: string) => boolean): ContentDocument {
  const values: Record<string, EditableValue> = {};
  for (const [k, v] of Object.entries(doc.values)) if (mantem(k)) values[k] = v;
  const sections: ContentDocument["sections"] = {};
  for (const [k, v] of Object.entries(doc.sections)) if (mantem(k)) sections[k] = v;
  const projetado: ContentDocument = { ...doc, values, sections };
  delete projetado.declared;
  delete projetado.paginas;
  delete projetado.colecoes;
  delete projetado.redirecionamentos;
  return projetado;
}

/**
 * O DOCUMENTO SEM AS PÁGINAS DO LOJISTA — o que o layout raiz entrega ao provider, e portanto o que
 * viaja no HTML de TODA página da loja.
 *
 * Saem os `values` e as `sections` cuja raiz é container do lojista (`ehContainerDoLojista`), e saem
 * os mapas `paginas`, `colecoes` e `redirecionamentos` inteiros. Ficam `tokens` e `apps`, que são do
 * site inteiro e minúsculos, e a copy das páginas do CÓDIGO.
 *
 * POR QUE OS TRÊS MAPAS NÃO PRECISAM IR: quem os lê é o SERVIDOR, sempre. Os metadados e o dado
 * estruturado saem de `generateMetadata` e das metades de servidor das cascas; o sitemap e a tira de
 * links do rodapé leem o publicado direto; o redirecionamento acontece na rota, antes de renderizar.
 * O que a casca (cliente) precisa do REGISTRO de uma página chega por prop, e o que ela precisa da
 * COPY chega pela fatia. Uma rota nova que renderize container do lojista sem passar a fatia não
 * quebra: ela mostra o literal do código no lugar do texto do lojista, calada — e é por isso que o
 * gate de cobertura editável cobra o par (layout que corta, casca que junta).
 */
export function documentoSemPaginas(doc: ContentDocument | null | undefined): ContentDocument | null {
  if (!doc) return null;
  return projetarDocumento(doc, (chave) => !ehContainerDoLojista(chave));
}

/**
 * A FATIA de um punhado de alvos: só os `values` e as `sections` que estão sob algum deles, mais
 * `tokens` e `apps`. É o que cada rota do lojista acrescenta ao que o layout mandou.
 *
 * Um alvo é o CONTAINER inteiro (`pagina-sobre`, `colecao-blog`), e aí leva junto tudo que está sob
 * ele — as seções criadas, as listas aninhadas —, OU um ponto mais fundo do caminho, terminado em
 * ponto (`artigo-blog--um.cabecalho.`), e aí leva só o que está sob aquele ponto.
 *
 * A LISTAGEM É O CASO DO CORTE FUNDO: ela mostra doze cards, e de cada artigo o card lê três
 * caminhos (título, resumo e imagem do cabeçalho). Pedindo o container inteiro de cada artigo, o
 * corpo de todos eles viajava no HTML sem ninguém ler — numa medição, 39,7% da página.
 */
export function fatiaDoDocumento(doc: ContentDocument | null | undefined, alvos: readonly string[]): ContentDocument | null {
  if (!doc) return null;
  // container inteiro é o caso comum e é o que a chave tem de casar primeiro: `Set` resolve num passo
  // e só os alvos mais fundos pagam a varredura da lista
  const inteiros = new Set(alvos.filter((a) => !a.includes(".")));
  const fundos = alvos.filter((a) => a.includes("."));
  return projetarDocumento(doc, (chave) => inteiros.has(chave.split(".")[0]) || fundos.some((a) => sobOAlvo(chave, a)));
}

/**
 * O DOCUMENTO QUE A ROTA DO LOJISTA MOSTRA: o que o layout mandou, preenchido pela fatia. É o que
 * `EditableFatia` (provider) faz, extraído para cá porque é uma regra, e regra se prende com teste.
 *
 * Fora de edição a fatia PREENCHE o que o layout não mandou, e o que veio do contexto vence em caso
 * de chave repetida.
 *
 * `rascunhoChegou` é a única coisa que desliga a fatia: dali em diante o rascunho INTEIRO está no
 * contexto e ele é a autoridade — juntar a fatia faria um valor APAGADO no rascunho reaparecer na
 * tela, porque a fatia é do PUBLICADO e ainda o teria. A régua NÃO é "está em modo edição": o modo
 * edição começa quadros antes do rascunho chegar (e pode nunca chegar, se o editor falhar em
 * carregá-lo), e nessa janela desligar a fatia apagava da tela a página inteira do lojista.
 *
 * Devolve o MESMO documento, por referência, quando não há o que juntar: quem chama compara e evita
 * um contexto novo por renderização.
 */
export function juntarFatia(doc: ContentDocument, fatia: ContentDocument | null | undefined, rascunhoChegou: boolean): ContentDocument {
  if (!fatia || rascunhoChegou) return doc;
  return { ...doc, values: { ...fatia.values, ...doc.values }, sections: { ...fatia.sections, ...doc.sections } };
}

/**
 * Os campos EDITÁVEIS do registro de uma página (`update_page`): merge raso, chave a chave; `null` = remover
 * o campo. `colecao` só em artigo, e mover de coleção troca o id do container (é um renomear interno).
 */
export interface CamposDaPagina {
  visibilidade?: Visibilidade;
  publicadoEm?: string | null;
  autor?: string | null;
  tags?: string[] | null;
  seo?: SeoDaPagina | null;
  colecao?: string;
}
/** os campos editáveis de uma coleção (`update_collection`): só o SEO da listagem; o título vai em `values` */
export interface CamposDaColecao {
  seo?: ColecaoDePaginas["seo"] | null;
}
/**
 * O que um inverso precisa devolver ao mapa de redirecionamentos: caminho → valor ANTERIOR (`null` = a
 * entrada não existia). Interno: só o inverso de desfazer o carrega. É mais que "remover o que a
 * operação criou": renomear REAPONTA as entradas que miravam o caminho antigo (para não haver cadeia) e
 * apaga a entrada que partia do caminho novo (a página viva vence), e desfazer tem de devolver as duas.
 */
export type RedirecionamentosAnteriores = Record<string, string | null>;

type OpDoDocumento =
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
  | { op: "replace_doc"; values: ContentDocument["values"]; sections: ContentDocument["sections"]; tokens: ContentDocument["tokens"]; declared?: ContentDocument["declared"]; apps?: Apps | null;
      /** PÁGINAS (foundation 13): a mesma regra de `apps`, campo a campo: presente troca (`null` = a versão não tinha); ausente mantém */
      paginas?: ContentDocument["paginas"] | null; colecoes?: ContentDocument["colecoes"] | null; redirecionamentos?: ContentDocument["redirecionamentos"] | null }
  // ── PÁGINAS DO LOJISTA (foundation 13). Campos internos, que só o inverso de desfazer (ou o servidor)
  // carrega e que `validateOp` RECUSA vindos do cliente: `redirecionamentosAnteriores`, `registroAnterior`,
  // `prefixoDePaginas`, `visivelNoPublicado`, `artigosVisiveisNoPublicado` e o `em` comum a todas.
  // "O que está no ar" a régua deriva do documento PUBLICADO (`estaNoAr`, `colecaoNoAr`, `artigosNoAr`), e
  // o servidor preenche os dois campos na operação DEPOIS de validar, porque quem precisa deles em seguida
  // é `applyOp` (só grava redirecionamento de endereço que existiu para alguém).
  /**
   * cria o registro (datas = `em`, visibilidade padrão por tipo) e o título em `values`. `id` é opcional e,
   * quando vem, tem de ser o derivado (`idDePagina`): existe para o chamador poder nomear o container que
   * vai editar em seguida no mesmo turno. O inverso é `delete_page`.
   */
  | { op: "create_page"; tipo: TipoDePagina; handle: string; colecao?: string; titulo: string; id?: string; prefixoDePaginas?: string }
  /**
   * apaga registro, `values`/`declared` com prefixo `<id>.`, `sections[<id>]` e os aninhados `<id>.*`. Com
   * `redirecionar`, o endereço dela passa a levar à listagem (artigo) ou à página inicial (página), e as
   * entradas que apontavam para ela vão para o mesmo lugar. `confirmado` ou `redirecionar` é exigido quando
   * a página está no ar (`visivelNoPublicado`, que o servidor preenche). O inverso é `restore_page`.
   */
  | { op: "delete_page"; id: string; confirmado?: boolean; redirecionar?: boolean; visivelNoPublicado?: boolean; prefixoDePaginas?: string; redirecionamentosAnteriores?: RedirecionamentosAnteriores }
  /** interno (inverso de `delete_page`): devolve registro, valores, seções, proveniência e o mapa de redirecionamentos como estavam */
  | { op: "restore_page"; id: string; registro: PaginaDoLojista; values: Record<string, EditableValue>; sections: ContentDocument["sections"]; declared?: Record<string, DeclaredEntry>; redirecionamentosAnteriores?: RedirecionamentosAnteriores }
  /**
   * merge raso dos campos (`null` = remover). Mover de coleção (`campos.colecao` num artigo) troca o id e
   * reescreve os caminhos, como um renomear: por isso aceita `redirecionar`/`confirmado` com a mesma regra.
   * O inverso é `update_page` com os valores anteriores (`null` = não havia) e o `em` de antes.
   */
  | { op: "update_page"; id: string; campos: CamposDaPagina; redirecionar?: boolean; confirmado?: boolean; visivelNoPublicado?: boolean; redirecionamentosAnteriores?: RedirecionamentosAnteriores }
  /**
   * novo id; reescreve as chaves em `values`, `sections` (inclusive aninhados) e `declared`; grava o
   * redirecionamento quando `redirecionar` E a página estava visível no PUBLICADO (sem isso a URL antiga
   * nunca existiu para ninguém). O inverso é o renomear de volta com os redirecionamentos anteriores.
   */
  | { op: "rename_page"; id: string; novoHandle: string; redirecionar?: boolean; confirmado?: boolean; visivelNoPublicado?: boolean; prefixoDePaginas?: string; redirecionamentosAnteriores?: RedirecionamentosAnteriores }
  /** registro em `colecoes` e o título em `values[colecao-<h>.cabecalho.titulo]`; inverso `delete_collection` */
  | { op: "create_collection"; handle: string; titulo: string }
  /** só coleção SEM artigos; apaga o registro e o container `colecao-<h>`; inverso `restore_collection` */
  | { op: "delete_collection"; handle: string; redirecionamentosAnteriores?: RedirecionamentosAnteriores }
  /** interno (inverso de `delete_collection`) */
  | { op: "restore_collection"; handle: string; registro: ColecaoDePaginas; values: Record<string, EditableValue>; sections: ContentDocument["sections"]; declared?: Record<string, DeclaredEntry>; redirecionamentosAnteriores?: RedirecionamentosAnteriores }
  /**
   * o SEO da listagem. Numa coleção do CÓDIGO (sem registro) o registro nasce aqui; `registroAnterior: null`
   * (interno, no inverso) é o que o faz sumir de novo ao desfazer.
   */
  | { op: "update_collection"; handle: string; campos: CamposDaColecao; registroAnterior?: null }
  /**
   * reescreve `colecoes`, os ids `artigo-<h>-*` com os containers deles e o `colecao` dos registros; com
   * `redirecionar`, a listagem (se `visivelNoPublicado`) e cada artigo em `artigosVisiveisNoPublicado`
   * (ids, como estavam no publicado) ganham redirecionamento. Inverso simétrico.
   */
  | { op: "rename_collection"; handle: string; novoHandle: string; redirecionar?: boolean; confirmado?: boolean; visivelNoPublicado?: boolean; artigosVisiveisNoPublicado?: string[]; redirecionamentosAnteriores?: RedirecionamentosAnteriores }
  /** apaga UMA entrada do mapa; inverso `set_redirect` (interno). Não há criação manual no v1. */
  | { op: "unset_redirect"; de: string }
  /** interno (inverso de `unset_redirect`) */
  | { op: "set_redirect"; de: string; para: string };

/**
 * `em` (interno, em toda operação): o instante ISO que o SERVIDOR carimba nas operações que criam ou
 * atualizam, e que `applyOp` usa em `criadoEm`/`atualizadoEm` (`op.em ?? agora`). Vai na operação, e não
 * num parâmetro, para o INVERSO poder carregá-lo: desfazer devolve o `atualizadoEm` de antes, senão a barra
 * diria "não publicado" depois de desfazer, com a loja igual à publicada. Vindo do cliente é recusado.
 */
export type PatchOp = OpDoDocumento & { em?: string };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** o instante de uma operação: o que o servidor carimbou, senão agora */
function instanteDa(op: PatchOp): string {
  return op.em ?? new Date().toISOString();
}

/**
 * O container RAIZ que uma operação de CONTEÚDO toca: o primeiro segmento do caminho (`set`/`unset`) ou
 * do container (as de seção). É por ele que `applyOp` sabe se a edição é de página do lojista e carimba o
 * `atualizadoEm` dela (o `lastmod` do sitemap). As operações de página cuidam do próprio carimbo.
 */
function raizDaOp(op: PatchOp): string | null {
  if (op.op === "set" || op.op === "unset") return op.path.split(".")[0];
  if ("container" in op && typeof op.container === "string") return op.container.split(".")[0];
  return null;
}

/** move TUDO que está sob um container para outro id: `values`, `declared` e os estados de seção (inclusive aninhados) */
function reescreverContainer(next: ContentDocument, de: string, para: string): void {
  const prefixo = `${de}.`;
  for (const k of Object.keys(next.values)) if (k.startsWith(prefixo)) {
    next.values[para + k.slice(de.length)] = next.values[k];
    delete next.values[k];
  }
  for (const k of Object.keys(next.declared ?? {})) if (k.startsWith(prefixo)) {
    next.declared![para + k.slice(de.length)] = next.declared![k];
    delete next.declared![k];
  }
  for (const c of Object.keys(next.sections)) if (c === de || c.startsWith(prefixo)) {
    next.sections[para + c.slice(de.length)] = next.sections[c];
    delete next.sections[c];
  }
}

/** tira do documento tudo que está sob um container, devolvendo o que saiu (é o que o inverso restaura) */
function retirarContainer(next: ContentDocument, id: string): { values: Record<string, EditableValue>; sections: ContentDocument["sections"]; declared: Record<string, DeclaredEntry> } {
  const prefixo = `${id}.`;
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
  const sections: ContentDocument["sections"] = {};
  for (const c of Object.keys(next.sections)) if (c === id || c.startsWith(prefixo)) {
    sections[c] = clone(next.sections[c]);
    delete next.sections[c];
  }
  return { values, sections, declared };
}

/**
 * Grava `de → para` SEM CADEIA: as entradas que apontavam para `de` passam a apontar para `para` (o
 * destino final), e a entrada que partia de `para` some, porque `para` é uma página VIVA e um
 * redirecionamento a partir dela a esconderia (a loja consulta o mapa antes de renderizar). Tudo que muda
 * é lembrado em `anteriores`, uma vez por caminho, para o inverso devolver o mapa como estava.
 */
function gravarRedirecionamento(next: ContentDocument, de: string, para: string, anteriores: RedirecionamentosAnteriores): void {
  if (de === para) return;
  const mapa = { ...(next.redirecionamentos ?? {}) };
  const lembra = (k: string) => {
    if (!(k in anteriores)) anteriores[k] = mapa[k] ?? null;
  };
  for (const [k, v] of Object.entries(mapa)) if (v === de) {
    lembra(k);
    if (k === para) delete mapa[k];
    else mapa[k] = para;
  }
  lembra(de);
  mapa[de] = para;
  lembra(para);
  delete mapa[para];
  next.redirecionamentos = mapa;
}

/**
 * A rota SUMIU e não há para onde mandar: as entradas que apontavam para ela saem. Um desvio permanente
 * para um endereço que responde 404 é pior que o 404 direto — para quem chega, é o mesmo lugar; para o
 * buscador, é um salto a mais numa cadeia que não termina em página nenhuma. Tudo lembrado, para o desfazer.
 */
function limparRedirecionamentosPara(next: ContentDocument, rota: string, anteriores: RedirecionamentosAnteriores): void {
  const mapa = { ...(next.redirecionamentos ?? {}) };
  let mexeu = false;
  for (const [k, v] of Object.entries(mapa)) {
    if (v !== rota) continue;
    if (!(k in anteriores)) anteriores[k] = mapa[k] ?? null;
    delete mapa[k];
    mexeu = true;
  }
  if (mexeu) next.redirecionamentos = mapa;
}

/** uma rota que passa a ter página viva não pode continuar redirecionando: a entrada que partia dela sai (lembrada) */
function assumirRota(next: ContentDocument, rota: string, anteriores: RedirecionamentosAnteriores): void {
  if (next.redirecionamentos?.[rota] === undefined) return;
  if (!(rota in anteriores)) anteriores[rota] = next.redirecionamentos[rota];
  const mapa = { ...next.redirecionamentos };
  delete mapa[rota];
  next.redirecionamentos = mapa;
}

/** devolve ao mapa o que um inverso trouxe (`null` = a entrada não existia) */
function devolverRedirecionamentos(next: ContentDocument, anteriores: RedirecionamentosAnteriores | undefined): void {
  if (!anteriores) return;
  const mapa = { ...(next.redirecionamentos ?? {}) };
  for (const [k, v] of Object.entries(anteriores)) {
    if (v === null) delete mapa[k];
    else mapa[k] = v;
  }
  next.redirecionamentos = mapa;
}

/** os três mapas nunca existem vazios: `{}` seria uma diferença inventada entre rascunho e publicado */
function semMapasVazios(next: ContentDocument): void {
  if (next.paginas && !Object.keys(next.paginas).length) delete next.paginas;
  if (next.colecoes && !Object.keys(next.colecoes).length) delete next.colecoes;
  if (next.redirecionamentos && !Object.keys(next.redirecionamentos).length) delete next.redirecionamentos;
}

/** só as entradas de `anteriores` que existem: o inverso não carrega um mapa vazio */
function seHouver(anteriores: RedirecionamentosAnteriores): { redirecionamentosAnteriores?: RedirecionamentosAnteriores } {
  return Object.keys(anteriores).length ? { redirecionamentosAnteriores: anteriores } : {};
}

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
      // (e o mesmo para páginas, coleções e redirecionamentos, pelo mesmo motivo)
      inverse = {
        op: "replace_doc", values: clone(doc.values), sections: clone(doc.sections), tokens: clone(doc.tokens), declared: doc.declared ? clone(doc.declared) : undefined, apps: doc.apps ? clone(doc.apps) : null,
        paginas: doc.paginas ? clone(doc.paginas) : null, colecoes: doc.colecoes ? clone(doc.colecoes) : null, redirecionamentos: doc.redirecionamentos ? clone(doc.redirecionamentos) : null,
      };
      next.values = clone(op.values);
      next.sections = clone(op.sections);
      next.tokens = clone(op.tokens);
      next.declared = op.declared ? clone(op.declared) : undefined;
      // `undefined` (ausente, inclusive depois de JSON) = mantém; `null` = remove; objeto = troca
      if (op.apps !== undefined) {
        if (op.apps) next.apps = clone(op.apps);
        else delete next.apps;
      }
      if (op.paginas !== undefined) {
        if (op.paginas) next.paginas = clone(op.paginas);
        else delete next.paginas;
      }
      if (op.colecoes !== undefined) {
        if (op.colecoes) next.colecoes = clone(op.colecoes);
        else delete next.colecoes;
      }
      if (op.redirecionamentos !== undefined) {
        if (op.redirecionamentos) next.redirecionamentos = clone(op.redirecionamentos);
        else delete next.redirecionamentos;
      }
      break;
    }
    // ── PÁGINAS DO LOJISTA (foundation 13) ─────────────────────────────────────────────────────────
    case "create_page": {
      const em = instanteDa(op);
      const id = op.id ?? idDePagina(op.tipo, op.handle, op.colecao);
      // página nasce visível e artigo nasce oculto, como nas plataformas de onde o lojista vem: a página
      // avulsa costuma ser institucional e pronta; o artigo se escreve antes de sair
      const registro: PaginaDoLojista = { tipo: op.tipo, handle: op.handle, ...(op.tipo === "artigo" ? { colecao: op.colecao } : {}), visibilidade: op.tipo === "pagina" ? "visivel" : "oculta", criadoEm: em, atualizadoEm: em };
      next.paginas = { ...(next.paginas ?? {}), [id]: registro };
      next.values[`${id}.${SECAO_CABECALHO}.titulo`] = op.titulo;
      // a rota passa a ter página viva: um redirecionamento antigo a partir dela (de uma página excluída com
      // o mesmo endereço) a esconderia
      const anteriores: RedirecionamentosAnteriores = {};
      assumirRota(next, rotaDePagina(registro, op.prefixoDePaginas), anteriores);
      inverse = { op: "delete_page", id, ...seHouver(anteriores) };
      break;
    }
    case "delete_page": {
      const registro = doc.paginas?.[op.id];
      if (!registro) {
        // nada a apagar (id desconhecido): a operação é inerte e o inverso também, como `remove_section`
        devolverRedirecionamentos(next, op.redirecionamentosAnteriores);
        inverse = { op: "delete_page", id: op.id };
        break;
      }
      const { values, sections, declared } = retirarContainer(next, op.id);
      delete next.paginas![op.id];
      const anteriores: RedirecionamentosAnteriores = {};
      const rota = rotaDePagina(registro, op.prefixoDePaginas);
      if (op.redirecionar) {
        // quem chegar pelo endereço antigo cai na listagem (artigo) ou na página inicial (página), e as
        // entradas que já apontavam para ela vão para o mesmo lugar (sem cadeia)
        gravarRedirecionamento(next, rota, registro.tipo === "artigo" ? rotaDeColecao(registro.colecao as string) : "/", anteriores);
      } else {
        // `redirecionar` decide o destino do endereço DELA, e nada mais: os desvios que já existiam para
        // este endereço ficariam apontando para um 404, e não há porta no painel que os alcance
        limparRedirecionamentosPara(next, rota, anteriores);
      }
      // como inverso de `create_page`: devolve a entrada que a criação tirou
      devolverRedirecionamentos(next, op.redirecionamentosAnteriores);
      inverse = { op: "restore_page", id: op.id, registro: clone(registro), values, sections, ...(Object.keys(declared).length ? { declared } : {}), ...seHouver(anteriores) };
      break;
    }
    case "restore_page": {
      next.paginas = { ...(next.paginas ?? {}), [op.id]: clone(op.registro) };
      for (const [k, v] of Object.entries(op.values)) next.values[k] = clone(v);
      if (op.declared && Object.keys(op.declared).length) next.declared = { ...(next.declared ?? {}), ...clone(op.declared) };
      for (const [c, estado] of Object.entries(op.sections)) next.sections[c] = clone(estado);
      devolverRedirecionamentos(next, op.redirecionamentosAnteriores);
      inverse = { op: "delete_page", id: op.id };
      break;
    }
    case "update_page": {
      const registro = doc.paginas?.[op.id];
      if (!registro) {
        inverse = { op: "update_page", id: op.id, campos: {} };
        break;
      }
      const em = instanteDa(op);
      const anteriores: CamposDaPagina = {};
      const novo: PaginaDoLojista = { ...registro, atualizadoEm: em };
      for (const k of ["visibilidade", "publicadoEm", "autor", "tags", "seo"] as const) {
        const v = op.campos[k];
        if (v === undefined) continue;
        // o inverso leva o valor anterior de CADA campo tocado (`null` = não havia): desfazer devolve só o que mudou
        (anteriores as Record<string, unknown>)[k] = registro[k] === undefined ? null : clone(registro[k]);
        if (v === null) delete novo[k];
        else (novo as unknown as Record<string, unknown>)[k] = clone(v);
      }
      let id = op.id;
      const redirs: RedirecionamentosAnteriores = {};
      const move = op.campos.colecao !== undefined && registro.tipo === "artigo" && op.campos.colecao !== registro.colecao;
      if (move) {
        // mover de coleção é renomear por dentro: o id carrega a coleção, então os caminhos mudam com ele
        anteriores.colecao = registro.colecao;
        novo.colecao = op.campos.colecao;
        id = idDePagina("artigo", registro.handle, novo.colecao);
        reescreverContainer(next, op.id, id);
        delete next.paginas![op.id];
        if (op.redirecionar && op.visivelNoPublicado) gravarRedirecionamento(next, rotaDePagina(registro), rotaDePagina(novo), redirs);
        assumirRota(next, rotaDePagina(novo), redirs);
      }
      // o mesmo motivo do carimbo lá embaixo: mandar o campo com o valor que ele já tinha não é mudança
      if (!move && JSON.stringify({ ...registro, atualizadoEm: "" }) === JSON.stringify({ ...novo, atualizadoEm: "" })) novo.atualizadoEm = registro.atualizadoEm;
      next.paginas = { ...(next.paginas ?? {}), [id]: novo };
      devolverRedirecionamentos(next, op.redirecionamentosAnteriores);
      inverse = { op: "update_page", id, campos: anteriores, em: registro.atualizadoEm, ...seHouver(redirs) };
      break;
    }
    case "rename_page": {
      const registro = doc.paginas?.[op.id];
      if (!registro || registro.handle === op.novoHandle) {
        devolverRedirecionamentos(next, op.redirecionamentosAnteriores);
        inverse = { op: "rename_page", id: op.id, novoHandle: registro?.handle ?? op.novoHandle };
        break;
      }
      const em = instanteDa(op);
      const novo: PaginaDoLojista = { ...registro, handle: op.novoHandle, atualizadoEm: em };
      const novoId = idDePagina(registro.tipo, op.novoHandle, registro.colecao);
      reescreverContainer(next, op.id, novoId);
      delete next.paginas![op.id];
      next.paginas = { ...(next.paginas ?? {}), [novoId]: novo };
      const anteriores: RedirecionamentosAnteriores = {};
      const rotaNova = rotaDePagina(novo, op.prefixoDePaginas);
      // só uma página que ESTAVA NO AR tem URL a preservar: para uma nunca publicada, o redirecionamento
      // seria uma entrada morta ocupando o teto
      if (op.redirecionar && op.visivelNoPublicado) gravarRedirecionamento(next, rotaDePagina(registro, op.prefixoDePaginas), rotaNova, anteriores);
      assumirRota(next, rotaNova, anteriores);
      devolverRedirecionamentos(next, op.redirecionamentosAnteriores);
      inverse = { op: "rename_page", id: novoId, novoHandle: registro.handle, em: registro.atualizadoEm, ...(op.prefixoDePaginas !== undefined ? { prefixoDePaginas: op.prefixoDePaginas } : {}), ...seHouver(anteriores) };
      break;
    }
    case "create_collection": {
      const em = instanteDa(op);
      next.colecoes = { ...(next.colecoes ?? {}), [op.handle]: { handle: op.handle, criadoEm: em, atualizadoEm: em } };
      next.values[`${idDeColecao(op.handle)}.${SECAO_CABECALHO}.titulo`] = op.titulo;
      const anteriores: RedirecionamentosAnteriores = {};
      assumirRota(next, rotaDeColecao(op.handle), anteriores);
      inverse = { op: "delete_collection", handle: op.handle, ...seHouver(anteriores) };
      break;
    }
    case "delete_collection": {
      const registro = doc.colecoes?.[op.handle];
      if (!registro) {
        devolverRedirecionamentos(next, op.redirecionamentosAnteriores);
        inverse = { op: "delete_collection", handle: op.handle };
        break;
      }
      const { values, sections, declared } = retirarContainer(next, idDeColecao(op.handle));
      delete next.colecoes![op.handle];
      devolverRedirecionamentos(next, op.redirecionamentosAnteriores);
      inverse = { op: "restore_collection", handle: op.handle, registro: clone(registro), values, sections, ...(Object.keys(declared).length ? { declared } : {}) };
      break;
    }
    case "restore_collection": {
      next.colecoes = { ...(next.colecoes ?? {}), [op.handle]: clone(op.registro) };
      for (const [k, v] of Object.entries(op.values)) next.values[k] = clone(v);
      if (op.declared && Object.keys(op.declared).length) next.declared = { ...(next.declared ?? {}), ...clone(op.declared) };
      for (const [c, estado] of Object.entries(op.sections)) next.sections[c] = clone(estado);
      devolverRedirecionamentos(next, op.redirecionamentosAnteriores);
      inverse = { op: "delete_collection", handle: op.handle };
      break;
    }
    case "update_collection": {
      if (op.registroAnterior === null) {
        // desfazendo o primeiro SEO de uma coleção do código: o registro que nasceu ali some de novo
        if (next.colecoes) delete next.colecoes[op.handle];
        inverse = { op: "update_collection", handle: op.handle, campos: {} };
        break;
      }
      const em = instanteDa(op);
      const registro = doc.colecoes?.[op.handle];
      const novo: ColecaoDePaginas = { ...(registro ?? { handle: op.handle, criadoEm: em }), atualizadoEm: em };
      const anteriores: CamposDaColecao = {};
      if (op.campos.seo !== undefined) {
        anteriores.seo = registro?.seo === undefined ? null : clone(registro.seo);
        if (op.campos.seo === null) delete novo.seo;
        else novo.seo = clone(op.campos.seo);
      }
      next.colecoes = { ...(next.colecoes ?? {}), [op.handle]: novo };
      inverse = registro ? { op: "update_collection", handle: op.handle, campos: anteriores, em: registro.atualizadoEm } : { op: "update_collection", handle: op.handle, campos: {}, registroAnterior: null };
      break;
    }
    case "rename_collection": {
      const registro = doc.colecoes?.[op.handle];
      if (!registro || op.handle === op.novoHandle) {
        devolverRedirecionamentos(next, op.redirecionamentosAnteriores);
        inverse = { op: "rename_collection", handle: op.handle, novoHandle: op.handle };
        break;
      }
      const em = instanteDa(op);
      delete next.colecoes![op.handle];
      next.colecoes = { ...(next.colecoes ?? {}), [op.novoHandle]: { ...registro, handle: op.novoHandle, atualizadoEm: em } };
      reescreverContainer(next, idDeColecao(op.handle), idDeColecao(op.novoHandle));
      const anteriores: RedirecionamentosAnteriores = {};
      const quer = op.redirecionar === true;
      const noAr = new Set(op.artigosVisiveisNoPublicado ?? []);
      // cada artigo muda de id (a coleção está nele) e de URL; o conteúdo não mudou, então o `atualizadoEm`
      // dele fica: é o `lastmod` do sitemap, e mentir nele é o que faz o buscador parar de acreditar
      for (const [id, p] of Object.entries(doc.paginas ?? {})) {
        if (p.tipo !== "artigo" || p.colecao !== op.handle) continue;
        const movido: PaginaDoLojista = { ...p, colecao: op.novoHandle };
        const novoId = idDePagina("artigo", p.handle, op.novoHandle);
        reescreverContainer(next, id, novoId);
        delete next.paginas![id];
        next.paginas = { ...(next.paginas ?? {}), [novoId]: movido };
        if (quer && noAr.has(id)) gravarRedirecionamento(next, rotaDePagina(p), rotaDePagina(movido), anteriores);
        assumirRota(next, rotaDePagina(movido), anteriores);
      }
      if (quer && op.visivelNoPublicado) gravarRedirecionamento(next, rotaDeColecao(op.handle), rotaDeColecao(op.novoHandle), anteriores);
      assumirRota(next, rotaDeColecao(op.novoHandle), anteriores);
      devolverRedirecionamentos(next, op.redirecionamentosAnteriores);
      inverse = { op: "rename_collection", handle: op.novoHandle, novoHandle: op.handle, em: registro.atualizadoEm, ...seHouver(anteriores) };
      break;
    }
    case "unset_redirect": {
      const de = normalizarPagina(op.de);
      const para = doc.redirecionamentos?.[de];
      if (para === undefined) {
        inverse = { op: "unset_redirect", de };
        break;
      }
      const mapa = { ...next.redirecionamentos };
      delete mapa[de];
      next.redirecionamentos = mapa;
      inverse = { op: "set_redirect", de, para };
      break;
    }
    case "set_redirect": {
      // só como inverso: devolve UMA entrada como estava, sem reapontar nada (o mapa já era o de antes)
      const anterior = doc.redirecionamentos?.[op.de];
      next.redirecionamentos = { ...(next.redirecionamentos ?? {}), [op.de]: op.para };
      inverse = anterior === undefined ? { op: "unset_redirect", de: op.de } : { op: "set_redirect", de: op.de, para: anterior };
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
  // `atualizadoEm` HONESTO (foundation 13): toda operação de CONTEÚDO cujo container é de página do lojista
  // carimba o registro dela (ou da coleção), porque é isso que o sitemap publica como `lastmod`. O inverso
  // leva o instante de antes em `em`: desfazer devolve o carimbo, e a barra não diz "não publicado" por
  // causa de uma data que ninguém vê.
  const raiz = raizDaOp(op);
  // gravar o MESMO valor não é mudança: o painel manda um `set` sempre que o campo perde o foco, e carimbar
  // ali faria o `lastmod` do sitemap dizer que a página mudou. O Google só usa `lastmod` enquanto ele for
  // verdadeiro; uma data que anda sozinha é uma data que ele passa a ignorar.
  const semEfeito = (op.op === "set" || op.op === "unset") && JSON.stringify(doc.values[op.path] ?? null) === JSON.stringify((op.op === "set" ? op.value : undefined) ?? null);
  if (raiz && ehContainerDoLojista(raiz) && !semEfeito) {
    const em = instanteDa(op);
    const pagina = next.paginas?.[raiz];
    const colecao = raiz.startsWith("colecao-") ? next.colecoes?.[raiz.slice("colecao-".length)] : undefined;
    if (pagina) {
      inverse = { ...inverse, em: doc.paginas![raiz].atualizadoEm };
      pagina.atualizadoEm = em;
    } else if (colecao) {
      inverse = { ...inverse, em: doc.colecoes![raiz.slice("colecao-".length)].atualizadoEm };
      colecao.atualizadoEm = em;
    }
  }
  semMapasVazios(next);
  // ESTRITAMENTE CRESCENTE. Este carimbo é a identidade do rascunho: é ele que a publicação compara para
  // recusar com 409 ("alguém mexeu enquanto você lia") e que o painel usa para dizer o que ainda não foi
  // publicado. Duas gravações no mesmo milissegundo (uma sequência do chat, duas abas) davam a mesma
  // string, e aí a segunda passava por cima da primeira sem ninguém ver. Empate anda um milissegundo.
  const agora = new Date().toISOString();
  next.updatedAt = doc.updatedAt && agora <= doc.updatedAt ? new Date(Date.parse(doc.updatedAt) + 1).toISOString() : agora;
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
  // TEXTO RICO: a mesma porta, pela lista fechada. É a camada que vale para quem JÁ publicou.
  if (typeof v === "string" && isRichPath(path) && recusaDeTextoRico(v)) return fallback;
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
 * TIPO DE SEÇÃO — vocabulário fechado, comum a todas as lojas (decidido em 07/09): o nome
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
  /**
   * PÁGINAS DO LOJISTA (foundation 13): a loja declara que sabe renderizar páginas, artigos e coleções do
   * documento, com o prefixo das páginas avulsas, as coleções que já existem no código e os primeiros
   * segmentos de URL que uma coleção não pode ocupar. Ausente = loja anterior à 13: `validateOp` recusa
   * toda operação de página com a frase do painel.
   */
  paginasDoLojista?: ManifestPaginasDoLojista;
}
export interface ManifestPaginasDoLojista {
  foundation: 13;
  /** o prefixo das páginas avulsas (`/paginas`) */
  prefixoDePaginas: string;
  /** coleções declaradas no CÓDIGO da loja (`blog`): existem sem registro no documento */
  colecoesDoCodigo: { handle: string; titulo: string }[];
  /** `RESERVADOS_FIXOS` mais as rotas da loja e as entradas de `public/` (calculado pela loja, nunca digitado) */
  reservados: string[];
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
 * Manifesto + PÁGINAS do documento (foundation 13), irmã de `manifestWithClones`: uma página recém-criada
 * ainda não foi renderizada pela loja, então o manifesto não tem linha nenhuma dela, e `set_text` no
 * título logo depois de `create_page` (o mesmo turno do chat) seria "caminho inexistente". Para cada
 * página e coleção do rascunho, e para cada coleção do CÓDIGO (a listagem dela existe do mesmo jeito),
 * sintetiza a seção fixa `<id>/cabecalho` e as entradas dela (`CAMPOS_DO_CABECALHO`), com `pagina` = a
 * rota, e copia os `tipos` de qualquer container da mesma família (páginas e artigos usam uma casca só;
 * coleções, outra) para os que ainda não renderizaram. Linhas de container do lojista que o rascunho NÃO
 * tem mais (página excluída) saem: o manifesto postado envelhece e o rascunho é a verdade.
 *
 * Chame ANTES de `manifestWithClones`: as seções criadas no corpo da página herdam o `pagina` da linha do
 * cabeçalho sintetizada aqui.
 */
export function manifestComPaginas(manifest: Manifest, doc: ContentDocument): Manifest {
  const decl = manifest.paginasDoLojista;
  const prefixo = decl?.prefixoDePaginas ?? PREFIXO_DE_PAGINAS_PADRAO;
  type Familia = "pagina" | "colecao";
  const vivos = new Map<string, { familia: Familia; rota: string }>();
  for (const [id, p] of Object.entries(doc.paginas ?? {})) vivos.set(id, { familia: "pagina", rota: rotaDePagina(p, prefixo) });
  for (const h of Object.keys(doc.colecoes ?? {})) vivos.set(idDeColecao(h), { familia: "colecao", rota: rotaDeColecao(h) });
  for (const c of decl?.colecoesDoCodigo ?? []) if (!vivos.has(idDeColecao(c.handle))) vivos.set(idDeColecao(c.handle), { familia: "colecao", rota: rotaDeColecao(c.handle) });
  const raiz = (c: string) => c.split(".")[0];
  const morto = (c: string) => ehContainerDoLojista(c) && !vivos.has(raiz(c));
  const sections = manifest.sections.filter((s) => !morto(s.container));
  const entries = manifest.entries.filter((e) => !morto(e.container ?? raiz(e.path)));
  const tiposDoManifesto = manifest.tipos ?? [];
  const tipos = tiposDoManifesto.filter((t) => !morto(t.container));
  for (const [id, { familia, rota }] of vivos) {
    if (!sections.some((s) => s.container === id && s.id === SECAO_CABECALHO)) {
      sections.push({ container: id, id: SECAO_CABECALHO, label: familia === "pagina" ? "Cabeçalho da página" : "Cabeçalho da coleção", kind: "banner", hidden: false, fixed: true, pagina: rota });
    }
    for (const c of CAMPOS_DO_CABECALHO[familia]) {
      const path = `${id}.${SECAO_CABECALHO}.${c.campo}`;
      if (entries.some((e) => e.path === path)) continue;
      const fallback: EditableValue = c.tipo === "image" ? { src: "", alt: "" } : "";
      const current = doc.values[path];
      entries.push({ path, type: c.tipo, label: c.label, section: SECAO_CABECALHO, container: id, pagina: rota, fallback, ...(current !== undefined ? { current } : {}) });
    }
  }
  // o catálogo de UMA casca vale para toda casca da mesma família: a loja declara os tipos no container que
  // renderizou, e a página criada agora renderiza a mesma casca. O molde sai do manifesto INTEIRO, antes de
  // tirar os mortos: o catálogo é da casca, não da página, e continua valendo depois que aquela página saiu.
  const modelo = new Map<Familia, ManifestSectionType[]>();
  for (const t of tiposDoManifesto) {
    if (raiz(t.container) !== t.container || !ehContainerDoLojista(t.container)) continue;
    const familia: Familia = t.container.startsWith("colecao-") ? "colecao" : "pagina";
    if (!modelo.has(familia)) modelo.set(familia, tiposDoManifesto.filter((x) => x.container === t.container));
  }
  for (const [id, { familia }] of vivos) {
    if (tipos.some((t) => t.container === id)) continue;
    for (const t of modelo.get(familia) ?? []) tipos.push({ ...t, container: id });
  }
  return { ...manifest, sections, entries, ...(manifest.tipos || tipos.length ? { tipos } : {}) };
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
  // TEXTO RICO: a segunda exceção, pelo mesmo motivo do HTML (teto e lista próprios)
  if (tipo === "richtext") {
    if (typeof v !== "string") return { ok: false, reason: "o texto precisa ser texto" };
    const recusa = recusaDeTextoRico(v);
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

/**
 * `doc` (foundation 13) é OPCIONAL e só as operações de página o usam: é contra o rascunho que se confere
 * endereço em uso, coleção existente, artigos de uma coleção e os tetos. O servidor do editor o passa;
 * sem ele, essas conferências rodam contra um documento vazio, e `create_page` de um endereço já usado
 * passaria e sobrescreveria o registro. Quem chama com página, chama com `doc`.
 */
export function validateOp(op: PatchOp, manifest: Manifest, doc?: ContentDocument, publicado?: ContentDocument | null): { ok: true } | { ok: false; reason: string } {
  // o instante é carimbo do SERVIDOR (ver `PatchOp`): vindo do cliente, uma data forjada viraria `lastmod`
  if (op.em !== undefined) return { ok: false, reason: "campo interno (em) não é aceito" };
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
      // TEXTO RICO: a mesma coerência entre tipo e sufixo, pelo mesmo motivo (a loja lê o publicado sem
      // manifesto, e é o sufixo que a faz passar o valor pela lista fechada)
      if (e.type === "richtext" || isRichPath(op.path)) {
        if (e.type !== "richtext") return { ok: false, reason: `o sufixo "${SUFIXO_RICO}" é reservado ao texto formatado: ${op.path}` };
        if (!isRichPath(op.path)) return { ok: false, reason: `caminho de texto formatado precisa terminar em "${SUFIXO_RICO}": ${op.path}` };
        const rico = validateValueShape(op.value, "richtext");
        return rico.ok ? { ok: true } : rico;
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
    case "restore_page":
    case "restore_collection":
    case "set_redirect":
      return { ok: false, reason: "operação interna (só como inverso de desfazer)" };
    case "create_page":
    case "delete_page":
    case "update_page":
    case "rename_page":
    case "create_collection":
    case "delete_collection":
    case "update_collection":
    case "rename_collection":
    case "unset_redirect":
      return validarOpDePagina(op, manifest, doc ?? emptyDocument(manifest.shop), publicado);
  }
}

// ── VALIDAÇÃO DAS PÁGINAS DO LOJISTA (foundation 13) ──────────────────────────────────────────────
// As frases saem daqui para a tela e para o modelo do chat como estão: dizem o que impede e o que fazer,
// em vocabulário do lojista (página, artigo, coleção, endereço), sem contar encanamento.

/** a MESMA frase do painel quando a loja não declara páginas: sem versão, sem engrenagem, com a quem pedir */
export const FRASE_SEM_PAGINAS = "Nesta loja ainda não dá para criar páginas. Fale com a Unbox para liberar.";
export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 200;
export const AUTOR_MAX = 80;
export const TAGS_MAX = 20;
export const TAG_MAX = 40;
/** data completa com hora e fuso: `2026-09-09T10:00:00-03:00` ou `…Z`. Sem fuso, cada servidor leria uma hora. */
const DATA_COM_FUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/;

type Resultado = { ok: true } | { ok: false; reason: string };
const nao = (reason: string): Resultado => ({ ok: false, reason });
const SIM: Resultado = { ok: true };
const tamanho = (s: string) => Array.from(s).length;

/** o SEO de uma página (ou o de uma coleção, que só tem título e descrição), campo a campo */
function recusaDeSeo(seo: unknown, deColecao: boolean): string | null {
  if (!seo || typeof seo !== "object" || Array.isArray(seo)) return "o SEO precisa ser um objeto com título e descrição";
  const o = seo as Record<string, unknown>;
  const permitidos = deColecao ? ["title", "description"] : ["title", "description", "image", "ocultarDeBuscadores"];
  for (const k of Object.keys(o)) if (!permitidos.includes(k)) return `campo desconhecido no SEO: ${k}`;
  if (o.title !== undefined && (typeof o.title !== "string" || tamanho(o.title) > SEO_TITLE_MAX)) return `O título para buscadores tem até ${SEO_TITLE_MAX} caracteres.`;
  if (o.description !== undefined && (typeof o.description !== "string" || tamanho(o.description) > SEO_DESCRIPTION_MAX)) return `A descrição para buscadores tem até ${SEO_DESCRIPTION_MAX} caracteres.`;
  if (o.image !== undefined) {
    const forma = validateValueShape(o.image);
    if (!forma.ok || typeof o.image !== "object" || !("src" in (o.image as object))) return "A imagem para buscadores precisa ser uma imagem (endereço e texto alternativo).";
    if (!isSafeUrl((o.image as ImageValue).src)) return "A imagem para buscadores tem um endereço inválido.";
  }
  if (o.ocultarDeBuscadores !== undefined && typeof o.ocultarDeBuscadores !== "boolean") return "«Ocultar de buscadores» é sim ou não.";
  return null;
}

/** os campos editáveis do registro de uma página, um a um */
function recusaDeCampos(campos: unknown): string | null {
  if (!campos || typeof campos !== "object" || Array.isArray(campos)) return "campos da página precisam ser um objeto";
  const o = campos as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!["visibilidade", "publicadoEm", "autor", "tags", "seo", "colecao"].includes(k)) return `campo desconhecido: ${k}`;
  if (o.visibilidade !== undefined && o.visibilidade !== "visivel" && o.visibilidade !== "oculta") return "A visibilidade é «visível» ou «oculta».";
  if (o.publicadoEm !== undefined && o.publicadoEm !== null && (typeof o.publicadoEm !== "string" || !DATA_COM_FUSO.test(o.publicadoEm) || !Number.isFinite(Date.parse(o.publicadoEm)))) return "A data de publicação precisa vir completa, com hora e fuso (como 2026-09-09T10:00:00-03:00).";
  if (o.autor !== undefined && o.autor !== null && (typeof o.autor !== "string" || tamanho(o.autor) > AUTOR_MAX)) return `O nome do autor tem até ${AUTOR_MAX} caracteres.`;
  // o autor sai no documento PÚBLICO, na assinatura do artigo e no JSON-LD: e-mail ali vira endereço
  // colhido por robô, e não é o que o desenho promete guardar
  if (typeof o.autor === "string" && /\S+@\S+\.\S/.test(o.autor)) return "O autor é o nome que aparece no site, não um e-mail.";
  if (o.tags !== undefined && o.tags !== null) {
    // kebab como o endereço (decisão do desenho): uma tag é um rótulo curto, e assim ela já serve de
    // endereço no dia em que tag virar página
    if (!Array.isArray(o.tags) || o.tags.length > TAGS_MAX || o.tags.some((t) => typeof t !== "string" || t.length < 1 || t.length > TAG_MAX || !HANDLE.test(t))) return `São até ${TAGS_MAX} tags, cada uma com até ${TAG_MAX} caracteres, só letras minúsculas sem acento, números e hífen.`;
    if (new Set(o.tags).size !== o.tags.length) return "Há uma tag repetida.";
  }
  if (o.seo !== undefined && o.seo !== null) {
    const r = recusaDeSeo(o.seo, false);
    if (r) return r;
  }
  if (o.colecao !== undefined && typeof o.colecao !== "string") return "A coleção precisa ser um endereço de coleção.";
  return null;
}

const FRASE_ENDERECO = `O endereço precisa ter de ${HANDLE_MIN} a ${HANDLE_MAX} caracteres, só letras minúsculas sem acento, números e hífen (como receita-de-pao).`;
const FRASE_EM_USO = "Esse endereço já está em uso.";
const FRASE_RESERVADO = "Esse endereço é reservado pela loja.";
const FRASE_DO_CODIGO = "Essa coleção faz parte da loja: não dá para excluí-la nem mudar o endereço dela.";

/**
 * `publicado` tem TRÊS estados, e a diferença decide se uma exclusão pede confirmação:
 *   - um documento: a régua olha nele quem está no ar;
 *   - `null`: a loja nunca publicou, então nada está no ar;
 *   - AUSENTE: quem chamou não sabe dizer. A régua fecha e trata como se estivesse no ar — pedir uma
 *     confirmação a mais não apaga endereço de ninguém; deixar de pedir apaga.
 */
function validarOpDePagina(op: PatchOp, manifest: Manifest, doc: ContentDocument, publicado?: ContentDocument | null): Resultado {
  const decl = manifest.paginasDoLojista;
  // a loja precisa RENDERIZAR páginas do documento para a operação ter efeito: abaixo da 13 o registro
  // entraria no rascunho e a loja responderia 404, com a barra dizendo "não publicado" para sempre
  if (!decl || (manifest.foundation ?? 0) < 13) return nao(FRASE_SEM_PAGINAS);
  // campos internos: só o inverso de desfazer os carrega; vindos do cliente forjariam o mapa de
  // redirecionamentos, o registro anterior ou "o que está no ar" (que só o servidor sabe)
  if ("redirecionamentosAnteriores" in op && op.redirecionamentosAnteriores !== undefined) return nao("campo interno não aceito do cliente: redirecionamentosAnteriores");
  if ("registroAnterior" in op && op.registroAnterior !== undefined) return nao("campo interno não aceito do cliente: registroAnterior");
  if ("prefixoDePaginas" in op && op.prefixoDePaginas !== undefined && op.prefixoDePaginas !== decl.prefixoDePaginas) return nao("campo interno não aceito do cliente: prefixoDePaginas");
  // "o que está no ar" é DERIVADO do publicado, nunca aceito de quem manda a operação: o servidor o
  // preenche depois desta porta (é `applyOp` que precisa dele), e aqui ele é calculado de novo
  if ("visivelNoPublicado" in op && op.visivelNoPublicado !== undefined) return nao("campo interno não aceito do cliente: visivelNoPublicado");
  if ("artigosVisiveisNoPublicado" in op && op.artigosVisiveisNoPublicado !== undefined) return nao("campo interno não aceito do cliente: artigosVisiveisNoPublicado");
  const noAr = (id: string) => (publicado === undefined ? true : estaNoAr(publicado, id));
  const doCodigo = (h: string) => decl.colecoesDoCodigo.some((c) => c.handle === h);
  const colecaoExiste = (h: string) => (handleValido(h) && Object.hasOwn(doc.colecoes ?? {}, h)) || doCodigo(h);
  const redirecionamentos = Object.keys(doc.redirecionamentos ?? {}).length;
  const cabemRedirecionamentos = (novos: number) => (redirecionamentos + novos <= REDIRECIONAMENTOS_MAX ? null : `A loja chegou ao limite de ${REDIRECIONAMENTOS_MAX} redirecionamentos. Apague algum antes.`);
  const titulo = (t: unknown, de: string) => (typeof t !== "string" || !t.trim() ? `Dê um título ${de}.` : tamanho(t) > TEXTO_MAX ? `O título tem até ${TEXTO_MAX} caracteres.` : null);
  /**
   * O registro que a operação toca, com a FORMA do id conferida antes: `doc.paginas?.[id]` sozinho aceitava
   * `constructor` (que existe em todo objeto e fazia `applyOp` estourar) e `__proto__` (que gravava um
   * registro sem tipo, lido pela loja como página em `/paginas/undefined`).
   */
  const paginaDaOp = (id: unknown): PaginaDoLojista | null => {
    const partes = decomporIdDePagina(id);
    if (!partes || partes.tipo === "colecao") return null;
    return Object.hasOwn(doc.paginas ?? {}, id as string) ? (doc.paginas as Record<string, PaginaDoLojista>)[id as string] : null;
  };
  const bool = (v: unknown, nome: string) => (v !== undefined && typeof v !== "boolean" ? `${nome} é sim ou não` : null);
  switch (op.op) {
    case "create_page": {
      if (op.tipo !== "pagina" && op.tipo !== "artigo") return nao("tipo de página desconhecido");
      const t = titulo(op.titulo, op.tipo === "artigo" ? "ao artigo" : "à página");
      if (t) return nao(t);
      if (!handleValido(op.handle)) return nao(FRASE_ENDERECO);
      if (handleReservado(op.tipo, op.handle)) return nao(FRASE_RESERVADO);
      if (op.tipo === "pagina" && op.colecao !== undefined) return nao("Uma página avulsa não fica em coleção.");
      if (op.tipo === "artigo") {
        if (typeof op.colecao !== "string" || !op.colecao) return nao("Um artigo precisa de uma coleção.");
        if (!colecaoExiste(op.colecao)) return nao(`A coleção «${op.colecao}» não existe.`);
      }
      if (op.id !== undefined && op.id !== idDePagina(op.tipo, op.handle, op.colecao)) return nao("o id não corresponde ao endereço");
      if (enderecoEmUso(doc, op.tipo, op.handle, op.colecao)) return nao(FRASE_EM_USO);
      if (Object.keys(doc.paginas ?? {}).length >= PAGINAS_MAX) return nao(`A loja chegou ao limite de ${PAGINAS_MAX} páginas.`);
      return SIM;
    }
    case "delete_page": {
      const registro = paginaDaOp(op.id);
      if (!registro) return nao("Essa página não existe mais.");
      const b = bool(op.confirmado, "«confirmado»") ?? bool(op.redirecionar, "«redirecionar»");
      if (b) return nao(b);
      if (noAr(op.id) && !op.confirmado && !op.redirecionar) return nao("Essa página está no ar. Confirme a exclusão ou crie um redirecionamento para quem chegar pelo endereço dela.");
      if (op.redirecionar) {
        const c = cabemRedirecionamentos(doc.redirecionamentos?.[rotaDePagina(registro, decl.prefixoDePaginas)] === undefined ? 1 : 0);
        if (c) return nao(c);
      }
      return SIM;
    }
    case "update_page": {
      const registro = paginaDaOp(op.id);
      if (!registro) return nao("Essa página não existe mais.");
      const r = recusaDeCampos(op.campos);
      if (r) return nao(r);
      const b = bool(op.confirmado, "«confirmado»") ?? bool(op.redirecionar, "«redirecionar»");
      if (b) return nao(b);
      if (op.campos.colecao !== undefined) {
        if (registro.tipo !== "artigo") return nao("Uma página avulsa não fica em coleção.");
        if (!colecaoExiste(op.campos.colecao)) return nao(`A coleção «${op.campos.colecao}» não existe.`);
        if (op.campos.colecao !== registro.colecao) {
          if (enderecoEmUso(doc, "artigo", registro.handle, op.campos.colecao)) return nao("Já existe um artigo com esse endereço na coleção de destino.");
          if (noAr(op.id) && !op.confirmado && !op.redirecionar) return nao("Esse artigo está no ar. Confirme a mudança de coleção ou crie um redirecionamento para quem chegar pelo endereço antigo.");
          if (op.redirecionar && noAr(op.id)) {
            const c = cabemRedirecionamentos(1);
            if (c) return nao(c);
          }
        }
      }
      return SIM;
    }
    case "rename_page": {
      const registro = paginaDaOp(op.id);
      if (!registro) return nao("Essa página não existe mais.");
      if (!handleValido(op.novoHandle)) return nao(FRASE_ENDERECO);
      if (handleReservado(registro.tipo, op.novoHandle)) return nao(FRASE_RESERVADO);
      if (op.novoHandle === registro.handle) return nao("Esse já é o endereço da página.");
      if (enderecoEmUso(doc, registro.tipo, op.novoHandle, registro.colecao)) return nao(FRASE_EM_USO);
      const b = bool(op.confirmado, "«confirmado»") ?? bool(op.redirecionar, "«redirecionar»");
      if (b) return nao(b);
      if (noAr(op.id) && !op.confirmado && !op.redirecionar) return nao("Essa página está no ar. Confirme a troca de endereço ou crie um redirecionamento do endereço antigo para o novo.");
      if (op.redirecionar && noAr(op.id)) {
        const c = cabemRedirecionamentos(1);
        if (c) return nao(c);
      }
      return SIM;
    }
    case "create_collection": {
      const t = titulo(op.titulo, "à coleção");
      if (t) return nao(t);
      if (!handleValido(op.handle)) return nao(FRASE_ENDERECO);
      if (handleReservado("colecao", op.handle, decl.reservados)) return nao(FRASE_RESERVADO);
      if (colecaoExiste(op.handle)) return nao(FRASE_EM_USO);
      if (Object.keys(doc.colecoes ?? {}).length >= COLECOES_MAX) return nao(`A loja chegou ao limite de ${COLECOES_MAX} coleções.`);
      return SIM;
    }
    case "delete_collection": {
      if (doCodigo(op.handle)) return nao(FRASE_DO_CODIGO);
      if (!Object.hasOwn(doc.colecoes ?? {}, op.handle)) return nao("Essa coleção não existe mais.");
      if (Object.values(doc.paginas ?? {}).some((p) => p.tipo === "artigo" && p.colecao === op.handle)) return nao("Mova ou exclua os artigos antes.");
      return SIM;
    }
    case "update_collection": {
      if (!colecaoExiste(op.handle)) return nao("Essa coleção não existe mais.");
      if (!op.campos || typeof op.campos !== "object" || Array.isArray(op.campos)) return nao("campos da coleção precisam ser um objeto");
      for (const k of Object.keys(op.campos)) if (k !== "seo") return nao(`campo desconhecido: ${k}`);
      if (op.campos.seo !== undefined && op.campos.seo !== null) {
        const r = recusaDeSeo(op.campos.seo, true);
        if (r) return nao(r);
      }
      return SIM;
    }
    case "rename_collection": {
      if (doCodigo(op.handle)) return nao(FRASE_DO_CODIGO);
      if (!Object.hasOwn(doc.colecoes ?? {}, op.handle)) return nao("Essa coleção não existe mais.");
      if (!handleValido(op.novoHandle)) return nao(FRASE_ENDERECO);
      if (handleReservado("colecao", op.novoHandle, decl.reservados)) return nao(FRASE_RESERVADO);
      if (op.novoHandle === op.handle) return nao("Esse já é o endereço da coleção.");
      if (colecaoExiste(op.novoHandle)) return nao(FRASE_EM_USO);
      const b = bool(op.confirmado, "«confirmado»") ?? bool(op.redirecionar, "«redirecionar»");
      if (b) return nao(b);
      const listagemNoAr = publicado === undefined ? true : colecaoNoAr(publicado, op.handle, decl.colecoesDoCodigo);
      const artigos = publicado === undefined ? Object.values(doc.paginas ?? {}).filter((x) => x.tipo === "artigo" && x.colecao === op.handle).length : artigosNoAr(publicado, op.handle).length;
      if (listagemNoAr && !op.confirmado && !op.redirecionar) return nao("Essa coleção está no ar. Confirme a troca de endereço ou crie os redirecionamentos dos endereços antigos.");
      if (op.redirecionar) {
        const c = cabemRedirecionamentos((listagemNoAr ? 1 : 0) + artigos);
        if (c) return nao(c);
      }
      return SIM;
    }
    case "unset_redirect": {
      if (typeof op.de !== "string" || doc.redirecionamentos?.[normalizarPagina(op.de)] === undefined) return nao("Esse redirecionamento não existe.");
      return SIM;
    }
    default:
      return nao(`operação desconhecida: ${String((op as { op: unknown }).op)}`);
  }
}

/**
 * Tipo DEDUZIDO da forma do valor. Não sabe dizer "video" (mesma forma da imagem), "color", "html" nem
 * "richtext" (mesma forma do texto): quem sabe o tipo é o manifesto. `validateOp` abre exceção para os
 * quatro — a do html e a do texto rico vêm antes, em ramo próprio, porque ali o TETO e a lista também mudam.
 */
export function typeOfValue(v: EditableValue): EditableType {
  if (typeof v === "string") return "text"; // html, texto rico e cor caem aqui também — o tipo real vem do manifesto
  if ("src" in v) return "image"; // vídeo cai aqui também — o tipo real vem da entrada do manifesto
  if ("href" in v) return "link";
  if ("modo" in v) return "vitrine"; // escolha de produtos; sem isto o patch do seletor era lido como cor
  return "color";
}

/**
 * Todo texto visível dentro de um valor (texto, rótulo de link, alt de imagem) — para a verificação de
 * honestidade. `tipo` (foundation 13) só importa para o texto rico: a forma é string como um texto comum,
 * mas o que o visitante lê é o texto SEM as tags, em pedaços (ver `frasesDoTextoRico`); sem o tipo, a
 * pergunta de honestidade citaria `<strong>` para o lojista.
 */
export function textsOfValue(v: EditableValue, tipo?: EditableType): string[] {
  if (typeof v === "string") return tipo === "richtext" ? frasesDoTextoRico(v) : [v];
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
 *
 * A CASCA EM PRÉVIA (foundation 13) tira o prefixo `/previa-do-editor`: o editor abre as páginas do
 * lojista por ele, e a página do manifesto tem de ser a ROTA (`/blog/titulo`), a mesma de produção,
 * senão cada linha capturada na prévia pareceria de uma página que não existe.
 */
export function normalizarPagina(u: string | null | undefined): string {
  const bruto = (u ?? "/").split("?")[0].split("#")[0];
  const comBarra = bruto.startsWith("/") ? bruto : `/${bruto}`;
  const semPrevia = comBarra === PREFIXO_DA_PREVIA || comBarra.startsWith(`${PREFIXO_DA_PREVIA}/`) ? comBarra.slice(PREFIXO_DA_PREVIA.length) || "/" : comBarra;
  const semFim = semPrevia.length > 1 ? semPrevia.replace(/\/+$/, "") : semPrevia;
  return semFim || "/";
}
