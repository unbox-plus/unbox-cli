// ═══════════════════════════════════════════════════════════════════════════
// VITRINE — de ESCOLHA do lojista para PRODUTOS de verdade.
//
// O editor guarda só a ESCOLHA (`VitrineValue`: uma categoria da Unbox, uma
// lista de produtos ou uma busca). Quem transforma isso em produto com preço e
// estoque é a LOJA, aqui, no servidor, com o mesmo cliente da Unbox que a home
// e a PDP já usam. O editor nunca vê credencial nem catálogo — ele só pergunta
// o que existe pelo endpoint de leitura (app/api/unbox/catalogo/route.ts).
//
// ⚠️ A LOJA NÃO PODE CAIR POR CAUSA DISSO. Toda falha (Unbox fora, id que não
// existe mais, categoria vazia) devolve lista vazia; quem chama volta para o
// que o CÓDIGO mostra — a mesma regra de `getPublishedContent`.
//
// (A honestidade do 502 vale para a ROTA do seletor, não para cá: lá o editor
// precisa distinguir "categoria vazia" de "não consegui ler"; aqui, na página
// do cliente, a única saída aceitável é continuar mostrando os produtos do
// código.)
// ═══════════════════════════════════════════════════════════════════════════
import "server-only";
import { unstable_cache } from "next/cache";
import { getCatalog, getProductBySlug } from "./queries";
import { withStoreClient } from "./unbox/store";
import { resolveProductPrice } from "./format";
import { CAMPO_VITRINE, VITRINE_MAX, vitrineValida, type ContentDocument, type VitrineValue } from "./editable/document";

/**
 * O que a loja mostra de um produto numa vitrine — e, campo por campo, o que o
 * endpoint de leitura devolve ao seletor do editor.
 *
 * É de propósito o MÍNIMO: nada de cadastro interno, nada de credencial. Preço
 * pode vir `null` (produto sem variante com preço no painel); quem renderiza
 * mostra "—" em vez de inventar zero.
 */
export interface VitrineProduto {
  /** `productId` da Unbox — é o que o addToCart e `getProductById` usam. */
  id: string;
  titulo: string;
  slug: string;
  imagem: string | null;
  preco: number | null;
  esgotado: boolean;
}

/** Quantos produtos uma vitrine traz quando o lojista não disse. */
export const VITRINE_LIMITE_PADRAO = 12;

/**
 * O ÚLTIMO segmento do caminho de toda vitrine desta loja.
 *
 * O caminho completo é `<container>.<id da seção>.<este campo>` — e ele NÃO é
 * escrito à mão em lugar nenhum: no cliente, `Editable.Vitrine path={CAMPO_VITRINE}`
 * o monta a partir do escopo da seção (`joinPath(ctx.scope, CAMPO_VITRINE)`); no
 * servidor, `resolverVitrinesDoDocumento` o DESCOBRE varrendo o documento. É a
 * mesma string derivada dos dois lados, e é por isso que renomear o id de uma
 * seção — ou o lojista adicionar uma vitrine nova, com id sorteado em tempo de
 * execução (`novo-<tipo>-<n>`) — não descola loja e painel.
 *
 * A CONSTANTE mora na FOUNDATION (lib/editable/document.ts) e é só reexportada aqui. Este arquivo é
 * `server-only`: um componente de cliente não consegue importá-lo, e enquanto o literal vivia aqui
 * cada seção repetia `const CAMPO = "vitrine"` com um comentário pedindo para trocar os dois juntos.
 * Uma string, um lugar.
 */
export { CAMPO_VITRINE };

/**
 * Teto de vitrines resolvidas por página. Cada uma pode custar uma consulta ao
 * catálogo; um documento adulterado com centenas de caminhos `.vitrine` viraria
 * uma enxurrada de chamadas à Unbox no render da home.
 */
const VITRINES_POR_PAGINA_MAX = 12;

/** Limite pedido, preso entre 1 e `VITRINE_MAX` (o teto da foundation). */
export function limiteDaVitrine(limite?: number | null): number {
  const n = Number.isInteger(limite) ? (limite as number) : VITRINE_LIMITE_PADRAO;
  return Math.max(1, Math.min(VITRINE_MAX, n));
}

/** Node do catálogo (ou item de PDP) → produto de vitrine. `null` quando não dá para identificar. */
export function produtoDaVitrine(node: any): VitrineProduto | null {
  const p = node?.product ?? node;
  if (!p?.slug) return null;
  return {
    id: String(p.productId ?? p._id ?? p.slug),
    titulo: p.title ?? "",
    slug: p.slug,
    imagem: p.imageUrls?.[0] ?? null,
    preco: resolveProductPrice(p).price,
    esgotado: !!p.isSoldOut,
  };
}

function mapear(nodes: any[] | undefined, limite: number): VitrineProduto[] {
  const out: VitrineProduto[] = [];
  for (const n of nodes ?? []) {
    const p = produtoDaVitrine(n);
    if (p) out.push(p);
    if (out.length >= limite) break;
  }
  return out;
}

/**
 * Um produto pelo `productId`. Cacheado como o resto do catálogo (público e
 * estável), e só é chamado para os ids que a página de catálogo já lida não
 * cobriu — no caso normal, nenhum.
 */
const porId = (id: string) =>
  unstable_cache(
    () => withStoreClient((c) => c.getProductById(id)),
    ["unbox-vitrine-produto", id],
    { revalidate: 300, tags: ["catalog"] },
  )();

/**
 * Resolve a escolha do lojista em produtos.
 *
 * `produtos` preserva a ORDEM em que ele escolheu — é a única informação que a
 * lista carrega e que o catálogo não sabe repor.
 *
 * `estrito` é para quem PRECISA saber que a Unbox falhou: a rota da prévia
 * (app/api/unbox/vitrine/route.ts), que responde 502 em vez de 200 com lista
 * vazia. Sem ele — o padrão, usado pela página do cliente — uma falha vira
 * lista vazia e a seção volta aos produtos do código.
 *
 * ⚠️ A diferença é UMA linha: a página do catálogo no modo "produtos", a única
 * consulta que este arquivo engolia. Nos modos "categoria" e "busca" o
 * `getCatalog` já sobe o erro, e quem chama é que decide o que fazer com ele.
 * A busca de UM produto continua tolerante nos dois modos: id que não volta
 * costuma ser produto apagado do painel, não Unbox fora do ar, e derrubar a
 * vitrine inteira por causa de um item some com os outros quatro.
 */
export async function resolverVitrine(escolha: VitrineValue, opts?: { estrito?: boolean }): Promise<VitrineProduto[]> {
  const limite = limiteDaVitrine(escolha.limite);

  if (escolha.modo === "categoria") {
    const c = await getCatalog({ first: limite, tagIds: [escolha.tagId] });
    return mapear(c?.nodes, limite);
  }

  if (escolha.modo === "busca") {
    const c = await getCatalog({ first: limite, searchText: escolha.texto });
    return mapear(c?.nodes, limite);
  }

  // ── modo "produtos" ──────────────────────────────────────────────────────
  // Primeiro a página de catálogo que a home JÁ busca (mesmos `opts`, mesma
  // chave de cache → nenhuma chamada nova). Só o que sobrar vira consulta
  // individual, no máximo VITRINE_MAX delas.
  // No modo PRODUTOS o lojista escolheu a lista a dedo: ela é a resposta, e um `limite` gravado antes
  // não pode encolhê-la (ele nem tem onde mexer nesse número). O teto da foundation continua valendo.
  // Repetido entra uma vez só: a mesma vitrine mostrando o mesmo produto duas vezes é defeito, não escolha.
  const semRepetir = [...new Set(escolha.produtos)];
  const pedidos = semRepetir.slice(0, VITRINE_MAX);
  const pagina = opts?.estrito ? await getCatalog({ first: 100 }) : await getCatalog({ first: 100 }).catch(() => null);
  const achados = new Map<string, VitrineProduto>();
  const indexar = (node: any) => {
    const p = node?.product ?? node;
    const item = produtoDaVitrine(node);
    if (!item) return;
    // o lojista pode ter guardado productId, _id ou slug — os três apontam para cá
    for (const chave of [p.productId, p._id, p.slug]) if (chave) achados.set(String(chave), item);
  };
  for (const n of pagina?.nodes ?? []) indexar(n);

  const faltando = pedidos.filter((id) => !achados.has(id));
  if (faltando.length) {
    const extras = await Promise.all(
      faltando.map(async (id) => {
        // id pode ser productId ou slug; tenta os dois caminhos que a loja já tem
        const porProduto = await porId(id).catch(() => null);
        return porProduto ?? (await getProductBySlug(id).catch(() => null));
      }),
    );
    for (const e of extras) if (e) indexar(e);
  }

  return pedidos.map((id) => achados.get(id)).filter((p): p is VitrineProduto => !!p);
}

/** Produtos já resolvidos, indexados pelo CAMINHO da vitrine — é assim que a seção acha os seus. */
export type VitrinesResolvidas = Record<string, VitrineProduto[]>;

/**
 * Os caminhos de vitrine que ESTE documento tem dentro de um container.
 *
 * ⚠️ Este é o ponto que uma loja piloto errou e o scaffold não repete: lá o
 * caminho era uma CONSTANTE escrita à mão (`"home.vitrine-principal.vitrine"`)
 * enquanto o primitivo o deriva do id da seção — renomear o id descola os dois
 * EM SILÊNCIO (a loja lê uma caixa, o painel escreve em outra, e ninguém vê erro
 * nenhum). Aqui não existe constante de caminho: quem manda é o documento. E
 * tem de ser assim, porque a vitrine é um tipo ADICIONÁVEL — o id nasce em
 * tempo de execução (`novo-vitrine-de-produtos-2`) quando o lojista clica no
 * "+", e nenhuma constante do repositório poderia conhecê-lo de antemão.
 *
 * Cada seção tem o SEU caminho, então duas vitrines na mesma página têm duas
 * escolhas independentes.
 */
export function caminhosDeVitrine(doc: ContentDocument | null | undefined, container = "home"): string[] {
  const prefixo = `${container}.`;
  const sufixo = `.${CAMPO_VITRINE}`;
  return Object.entries(doc?.values ?? {})
    .filter(([caminho, valor]) => caminho.startsWith(prefixo) && caminho.endsWith(sufixo) && vitrineValida(valor))
    .map(([caminho]) => caminho)
    .sort()
    .slice(0, VITRINES_POR_PAGINA_MAX);
}

/**
 * Resolve TODAS as vitrines que o lojista configurou num container, de uma vez,
 * para a página entregar às seções já prontas.
 *
 * Sem documento, sem escolha, ou com a Unbox fora, devolve `{}` — e cada seção
 * cai no que o CÓDIGO mostra. Vitrine vazia lê como loja quebrada; os produtos
 * do código são a rede de segurança.
 */
export async function resolverVitrinesDoDocumento(
  doc: ContentDocument | null | undefined,
  container = "home",
): Promise<VitrinesResolvidas> {
  const caminhos = caminhosDeVitrine(doc, container);
  if (!caminhos.length) return {};
  const pares = await Promise.all(
    caminhos.map(async (caminho) => {
      const escolha = doc!.values[caminho] as VitrineValue;
      const produtos = await resolverVitrine(escolha).catch((err) => {
        console.warn("[vitrine] não consegui resolver", caminho, err instanceof Error ? err.message : err);
        return [] as VitrineProduto[];
      });
      return [caminho, produtos] as const;
    }),
  );
  // caminho que não resolveu em NADA fica de fora: a seção some do mapa e volta
  // para os produtos do código, em vez de renderizar uma grade vazia
  return Object.fromEntries(pares.filter(([, produtos]) => produtos.length > 0));
}
