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
//   200 → { paginas: [ { rota, caminho, label, dinamica, soChrome?, containers? } , … ] }
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
import { containersDaRota, rotasEditaveis, soChrome } from "@/lib/rotas-editaveis";
import { getCatalog, getTopTags } from "@/lib/queries";

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
      return { rota, caminho, label: rotulo(rota), dinamica, ...(soChrome(rota) ? { soChrome: true } : {}), ...(containers ? { containers: [...containers] } : {}) };
    }),
  );
  // a home primeiro (é onde a prévia abre), depois as estáticas, depois as dinâmicas
  paginas.sort((a, b) => {
    if (a.rota === "/") return -1;
    if (b.rota === "/") return 1;
    if (a.dinamica !== b.dinamica) return a.dinamica ? 1 : -1;
    return a.rota.localeCompare(b.rota);
  });
  return ok({ paginas });
}
