// ═══════════════════════════════════════════════════════════════════════════
// A LOJA DIZ QUAIS PÁGINAS ELA TEM.
//
// Por que existe: a lista de páginas que o editor abre estava no `shops.json` DELE — digitada à mão,
// com slug de produto cravado, e ignorada inteira quando `SHOPS_JSON` existia no ambiente. Quem sabe
// quais páginas existem é a loja, e ela sabe sem ninguém digitar nada: a regra é a de
// lib/rotas-editaveis.ts (página de `app/(loja)/` que o `DISALLOW` do robots não bloqueia).
//
// ── CONTRATO (o outro lado é lib/paginas-da-loja.ts do editor) ─────────────
//   GET /api/unbox/paginas          (PÚBLICO, sem token)
//   200 → { loja?: { slug, nome, url?, paginasDoLojista? }, paginas: [ { rota, caminho, label, dinamica, soChrome?, doLojista?, containers? } , … ] }
//         loja      A LOJA DIZ QUEM É (campo de topo, opcional no contrato; esta loja sempre manda). `slug` é o
//                   STORE_SLUG de lib/editable/config.ts (o mesmo do `aud` dos tokens do editor); `nome` é o nome
//                   de exibição. É por esta resposta que o editor descobre uma loja nova SEM registro: dado um
//                   slug, ele procura em https://<slug>.myunbox.com.br/api/unbox/paginas, e um 200 no contrato
//                   é "a loja existe e é editável"; o `nome` vira o rótulo no editor. E o `slug` é a trava: a
//                   loja que responder ali dizendo ser OUTRA é recusada (um host curinga nunca abre a loja errada).
//                   `url` é o ENDEREÇO PÚBLICO da loja (a origem de NEXT_PUBLIC_SITE_URL, só quando é https):
//                   a loja diz onde vive. Quando esse endereço é outro que não o da convenção (domínio próprio
//                   já apontado para cá), o editor confirma que ELE responde esta mesma rota, com este mesmo
//                   slug, e passa a abrir a loja por ele: a prévia, a publicação e a revalidação vão para o
//                   endereço de verdade, sem ninguém registrar nada. Endereço que não confirma (DNS ainda não
//                   apontado, certificado pendente) é ignorado com aviso no log do editor, e a convenção segue.
//                   Em desenvolvimento (http://localhost) o campo não sai: só https vale como endereço.
//         paginasDoLojista  OPCIONAL, e é o INTERRUPTOR das páginas do lojista (foundation 13): a loja
//                   declarando que sabe abrir `/paginas/<endereço>`, `/<coleção>` e `/<coleção>/<endereço>`.
//                   É o mesmo objeto que vai ao `EditableProvider` (lib/paginas-do-lojista.ts): a versão da
//                   foundation, o prefixo das páginas avulsas, as coleções que já existem no CÓDIGO e a lista
//                   de primeiros segmentos RESERVADOS (rotas e arquivos de `public/`), que o editor usa para
//                   recusar um endereço de coleção antes de gravar. AUSENTE = esta loja ainda não sabe abrir
//                   página nenhuma, e o editor não oferece a criação.
//                   OS `reservados` SAEM POR ESTA PORTA E SÓ POR ELA. Quem os lê é o editor (servidor a
//                   servidor); no manifesto que a prévia posta eles não vão, porque aquele objeto viaja no
//                   HTML de toda página de quem COMPRA, e uma lista de rotas internas não tem o que fazer ali.
//         rota      caminho da ROTA como o Next a escreve ("/produto/[productSlug]"). É a forma que
//                   `revalidatePath(rota, "page")` entende, e é UMA por rota — nunca uma por produto.
//         caminho   caminho CONCRETO para a prévia abrir ("/produto/<slug de um produto real>").
//                   Igual a `rota` nas páginas estáticas. `null` = a rota existe e precisa ser
//                   re-renderizada, mas hoje não há exemplo para abrir (catálogo vazio ou fora do ar).
//         label     nome que o lojista lê no seletor de página.
//         dinamica  a rota tem segmento `[…]`: um `caminho` é um exemplo, não a página inteira.
//         soChrome  OPCIONAL, e só aparece quando `true`: a página é, por regra (README do editor, §8), só
//                   cabeçalho e rodapé editáveis, porque o corpo dela é texto legal, rótulo de formulário/UI
//                   ou mecânica de compra, e isso não vira primitivo. A lista é `SO_CHROME` em
//                   lib/rotas-editaveis.ts, com o motivo de cada rota. O gate não aplica a régua de 80% nela
//                   (o resto do gate vale), e o editor sabe que a lista de seções dela é só o chrome.
//         doLojista OPCIONAL, e só aparece quando `true`: esta rota é um MOLDE de página do lojista (a
//                   página avulsa, o artigo, a listagem da coleção e a listagem paginada). O `caminho` dela é
//                   um exemplo real quando já existe conteúdo publicado; o que ela renderiza sai do documento,
//                   não do código, e por isso o gate de cobertura não cobra primitivo nela.
//         containers OPCIONAL: os containers que esta ROTA renderiza, fora o `chrome` (que é do site inteiro).
//                   É a tabela `CONTAINERS_POR_ROTA` de lib/rotas-editaveis.ts, com o motivo de cada rota. `[]` é
//                   declaração ("só o chrome"); o campo AUSENTE é rota fora da tabela (a loja não declarou; o gate
//                   reprova). O editor usa para avisar "isto também aparece em «Categoria»" antes de alguém abrir
//                   /categoria, e para a publicação alcançar a página certa já na primeira sessão. O gate confere:
//                   o que o manifesto da página mostrou (fora o chrome) tem de ser exatamente isto.
//   500 → { error: "<motivo verdadeiro>" }  — a loja não conseguiu descobrir as próprias páginas. Inclui a
//         descoberta que falhou NO MEIO (uma subpasta de app/(loja) ilegível): a lista é recusada inteira, com o
//         caminho que não abriu, em vez de sair parcial com 200 e sumir com a página do seletor e do gate.
//
//   PÚBLICO de propósito: é a mesma informação que `sitemap.xml` já publica, e o gate de cobertura
//   (`scripts/check-editable.mjs`) precisa dela sem ter token de editor nenhum em mãos.
//
// ⚠️ LISTA VAZIA NUNCA VIRA 200. Uma loja sem páginas não existe; lista vazia é falha da descoberta,
// e responder 200 com `[]` faria o editor (e o gate) concluírem "não há nada para editar/medir".
// ═══════════════════════════════════════════════════════════════════════════
import { ok, fail } from "@/lib/api";
import { STORE_SLUG } from "@/lib/editable/config";
import { containersDaRota, doLojista, rotasEditaveis, soChrome } from "@/lib/rotas-editaveis";
import { getCatalog, getTopTags } from "@/lib/queries";
// PÁGINAS DO LOJISTA (foundation 13): a declaração que libera a criação de páginas no editor, e os
// exemplos concretos das quatro rotas que são molde delas.
import { declaracaoDoLojista, PREFIXO_DE_PAGINAS } from "@/lib/paginas-do-lojista";
import { reservadosDaLoja } from "@/lib/reservados";
import { artigosVisiveis, colecoesEmProducao, lerPaginas } from "@/lib/paginas-publicadas";
import { ARTIGOS_POR_PAGINA, rotaDeColecao, rotaDePagina, visivelAgora } from "@/lib/editable/server";

// DINÂMICA de propósito. Com `revalidate` (rota estática com ISR) o Next só devolve a resposta depois
// que todo trabalho de cache pendente termina, e a busca do exemplo que estourou o prazo continuava
// pendente por trás do `Promise.race`: a rota levava 56 s para responder uma lista que estava pronta
// em 3 s (medido em dev, sem credenciais). A lista de rotas custa um `readdirSync`; o exemplo tem
// guarda própria em memória (abaixo). Nada aqui precisa do cache de rota.
export const dynamic = "force-dynamic";

/**
 * O nome que o lojista lê. Derivar do segmento dá "Devolucoes" sem cedilha — então o que é COPY
 * fica declarado aqui, que é a loja, e o resto cai na derivação. Rota nova com acento ou nome
 * composto entra aqui; sem entrada, o rótulo é o último segmento com a inicial maiúscula.
 */
const ROTULOS: Record<string, string> = {
  "/": "Página inicial",
  "/produtos": "Produtos",
  "/sobre": "Sobre",
  "/busca": "Busca",
  "/oferta": "Oferta",
  "/devolucoes": "Trocas e devoluções",
  "/privacidade": "Privacidade",
  "/termos": "Termos de uso",
  "/produto/[productSlug]": "Produto",
  "/categoria/[tagSlug]": "Categoria",
  // as páginas do lojista (foundation 13): o rótulo é o do MOLDE, no singular, porque a rota é uma e
  // as páginas que ela serve são muitas
  "/paginas/[handle]": "Página",
  "/[colecao]": "Coleção",
  "/[colecao]/pagina/[n]": "Coleção, páginas seguintes",
  "/[colecao]/[handle]": "Artigo",
};

function rotulo(rota: string): string {
  const declarado = ROTULOS[rota];
  if (declarado) return declarado;
  // último segmento que não é dinâmico ("/produto/[slug]" → "produto"); nada disso → a rota crua
  const segmentos = rota.split("/").filter(Boolean);
  const util = [...segmentos].reverse().find((s) => !s.startsWith("["));
  if (!util) return rota;
  const palavra = util.replace(/-/g, " ");
  return palavra.charAt(0).toUpperCase() + palavra.slice(1);
}

/**
 * O EXEMPLO CONCRETO de cada rota dinâmica: um slug de verdade, para a prévia abrir e o gate medir.
 * Vive aqui porque é conhecimento da loja (quem tem o cliente da Unbox é ela, nunca o editor).
 * Falha de catálogo devolve `null` — a rota continua na lista, sem exemplo, e isso é dito.
 *
 * COM PRAZO, e a LISTA NUNCA ESPERA POR ELE. O primeiro desenho varria o catálogo inteiro
 * (`loadAllCatalogItems`, 100 por página) para achar UM slug, e sem credenciais da Unbox esperava os
 * 15 s de timeout do cliente, duas vezes: a rota levava 30 s, o editor (que espera 5 s) caía no
 * `shops.json` sempre, e o gate esperava meio minuto para descobrir que não havia exemplo. Agora é
 * uma consulta curta (`first: 8`, cacheada como o resto do catálogo), no máximo `PRAZO_EXEMPLO_MS`
 * por rota; o que não respondeu a tempo sai como `caminho: null` NESTA resposta, e a busca que ficou
 * pendente corrige a guarda quando terminar. Guarda em memória porque em dev o `revalidate` da rota
 * não cacheia nada, e ninguém precisa pagar o catálogo a cada login no editor.
 */
const PRAZO_EXEMPLO_MS = 3_000;
const TTL_EXEMPLO_MS = 5 * 60_000;
const TTL_SEM_EXEMPLO_MS = 60_000;
const EXEMPLOS: Record<string, () => Promise<string | null>> = {
  "/produto/[productSlug]": async () => {
    const pagina = await getCatalog({ first: 8, offset: 0 });
    const p = ((pagina as any)?.nodes ?? []).map((n: any) => n?.product ?? n).find((p: any) => p && p.isVisible !== false && p.slug);
    return p ? `/produto/${encodeURIComponent(p.slug)}` : null;
  },
  "/categoria/[tagSlug]": async () => {
    const tags = (await getTopTags()) as any[];
    const t = tags.find((t) => t && t.isVisible !== false && t.slug);
    return t ? `/categoria/${encodeURIComponent(t.slug)}` : null;
  },
  // ── as quatro rotas das páginas do lojista ────────────────────────────────────────────────────
  // O exemplo sai do documento PUBLICADO, e só de página que está no ar: abrir na prévia uma URL que
  // responde 404 seria pior que não oferecer exemplo nenhum. Sem nenhuma publicada, `null` (e o gate
  // imprime "molde não medido: nenhuma página publicada", que não é reprovação).
  "/paginas/[handle]": async () => {
    const doc = await lerPaginas();
    for (const registro of Object.values(doc?.paginas ?? {})) {
      if (registro.tipo === "pagina" && visivelAgora(registro)) return rotaDePagina(registro, PREFIXO_DE_PAGINAS);
    }
    return null;
  },
  "/[colecao]": async () => {
    // a coleção do CÓDIGO existe sempre e a listagem dela responde 200 mesmo vazia, então há sempre
    // um exemplo a abrir enquanto a loja declarar ao menos uma
    const handles = await colecoesEmProducao();
    return handles.length ? rotaDeColecao(handles[0]) : null;
  },
  "/[colecao]/pagina/[n]": async () => {
    // só existe página 2 onde há mais artigos do que cabem numa página; sem isso o exemplo levaria a
    // um 404
    for (const handle of await colecoesEmProducao()) {
      const artigos = await artigosVisiveis(handle);
      if (artigos.length > ARTIGOS_POR_PAGINA) return `${rotaDeColecao(handle)}/pagina/2`;
    }
    return null;
  },
  "/[colecao]/[handle]": async () => {
    for (const handle of await colecoesEmProducao()) {
      const artigos = await artigosVisiveis(handle);
      if (artigos.length) return rotaDePagina(artigos[0].registro, PREFIXO_DE_PAGINAS);
    }
    return null;
  },
};
const exemplosGuardados = new Map<string, { ate: number; caminho: string | null }>();

async function exemploDe(rota: string): Promise<string | null> {
  const guardado = exemplosGuardados.get(rota);
  if (guardado && guardado.ate > Date.now()) return guardado.caminho;
  const buscar = EXEMPLOS[rota];
  if (!buscar) return null;
  const pendente = buscar().then(
    (caminho) => {
      exemplosGuardados.set(rota, { ate: Date.now() + TTL_EXEMPLO_MS, caminho });
      return caminho;
    },
    (err: unknown) => {
      console.warn("[paginas] não consegui um exemplo para", rota, err instanceof Error ? err.message : err);
      exemplosGuardados.set(rota, { ate: Date.now() + TTL_SEM_EXEMPLO_MS, caminho: null });
      return null;
    },
  );
  const prazo = new Promise<"prazo">((r) => setTimeout(() => r("prazo"), PRAZO_EXEMPLO_MS));
  const resultado = await Promise.race([pendente, prazo]);
  if (resultado !== "prazo") return resultado;
  console.warn(`[paginas] o catálogo não respondeu em ${PRAZO_EXEMPLO_MS} ms para ${rota}; esta resposta sai sem exemplo`);
  // "sem exemplo" fica guardado por pouco tempo, para os próximos pedidos não esperarem de novo; a
  // busca pendente sobrescreve a guarda assim que terminar
  exemplosGuardados.set(rota, { ate: Date.now() + TTL_SEM_EXEMPLO_MS, caminho: null });
  return null;
}

/**
 * O ENDEREÇO PÚBLICO desta loja, como ela mesma o conhece (NEXT_PUBLIC_SITE_URL, o mesmo do canonical, do
 * sitemap e do Open Graph): só a origem, e só quando é https. `http://localhost:3000` (dev) e valor ausente
 * ou inválido dão `undefined`, e o campo não sai da resposta: o editor só troca de endereço pelo que a loja
 * declara E confirma; nunca por um palpite.
 */
function enderecoPublico(bruto: string | undefined): string | undefined {
  if (!bruto) return undefined;
  try {
    const u = new URL(bruto.trim());
    if (u.protocol !== "https:" || u.username || u.password) return undefined;
    return u.origin.toLowerCase();
  } catch {
    return undefined;
  }
}

export async function GET() {
  let rotas: string[];
  try {
    rotas = rotasEditaveis();
  } catch (e) {
    // A descoberta falhou (raiz ausente sem lista no ambiente, subpasta ilegível, nenhum page.tsx): a resposta é
    // recusar a lista INTEIRA, com o motivo. Uma lista parcial com 200 faria a página sumir do seletor e o gate
    // deixar de medi-la sem dizer NÃO RODOU.
    const motivo = e instanceof Error ? e.message : String(e);
    console.error(`[paginas] descoberta recusada: ${motivo}`);
    return fail(`A loja não conseguiu descobrir as próprias páginas: ${motivo}.`, 500);
  }
  const paginas = await Promise.all(
    rotas.map(async (rota) => {
      const dinamica = rota.includes("[");
      const caminho = dinamica ? await exemploDe(rota) : rota;
      const containers = containersDaRota(rota);
      // `soChrome` só quando é verdade, e `containers` só quando a tabela declara: quem lê a lista não precisa
      // saber dos campos para continuar certo, e o campo ausente é informação ("a loja não declarou")
      return { rota, caminho, label: rotulo(rota), dinamica, ...(soChrome(rota) ? { soChrome: true } : {}), ...(doLojista(rota) ? { doLojista: true } : {}), ...(containers ? { containers: [...containers] } : {}) };
    }),
  );
  // a home primeiro (é onde a prévia abre), depois as estáticas, depois as dinâmicas
  paginas.sort((a, b) => {
    if (a.rota === "/") return -1;
    if (b.rota === "/") return 1;
    if (a.dinamica !== b.dinamica) return a.dinamica ? 1 : -1;
    return a.rota.localeCompare(b.rota);
  });
  // quem responde: o slug que o editor usa para achar esta loja e o nome que o lojista lê no rótulo
  const url = enderecoPublico(process.env.NEXT_PUBLIC_SITE_URL);
  // `paginasDoLojista` é o INTERRUPTOR: enquanto ele não vem, o editor não oferece páginas nesta loja
  // (a régua do documento recusa toda operação de página). É o MESMO objeto que o app/layout.tsx
  // passa ao `EditableProvider`, e por isso os `reservados` que o editor confere são os que esta loja
  // calculou, nunca uma lista digitada.
  return ok({
    loja: {
      slug: STORE_SLUG,
      nome: process.env.NEXT_PUBLIC_SITE_NAME || "Minha Loja",
      ...(url ? { url } : {}),
      paginasDoLojista: declaracaoDoLojista(reservadosDaLoja()),
    },
    paginas,
  });
}
