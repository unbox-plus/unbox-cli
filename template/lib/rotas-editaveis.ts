// ═══════════════════════════════════════════════════════════════════════════
// AS PÁGINAS DESTA LOJA — DERIVADAS, NUNCA DIGITADAS.
//
// Antes daqui, a lista de páginas que o editor abre morava no `shops.json` do EDITOR: digitada à
// mão, com slug de produto cravado dentro, e ignorada inteira quando `SHOPS_JSON` existia no
// ambiente. Para 100 lojas isso não se sustenta — quem sabe quais páginas existem é a loja.
//
// A REGRA, uma só, e já mantida por outra pessoa: é editável a página dentro de `app/(loja)/` cujo
// caminho não casa com nenhum prefixo do `DISALLOW` de `app/robots.ts` (as "áreas privadas/
// transacionais" que o SEO já declara). Não há segunda lista para alguém esquecer de atualizar: a
// página nova aparece porque o arquivo dela existe, e some do editor porque o SEO a bloqueou.
//
// UMA ENTRADA POR ROTA, não por produto. `/produto/[productSlug]` é UMA página editável (a receita
// que renderiza todas), e não uma por produto. O exemplo concreto (para a prévia abrir) é resolvido
// em app/api/unbox/paginas/route.ts, que é quem fala com o catálogo.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { DISALLOW } from "@/app/robots";

const ARQUIVO_DE_PAGINA = /^page\.(tsx|ts|jsx|js)$/;

/** `/conta/pedidos` casa com o prefixo `/conta`; `/contato` NÃO casa (prefixo é segmento, não texto). */
export function bloqueadaPeloRobots(rota: string): boolean {
  return DISALLOW.some((d) => rota === d || rota.startsWith(`${d}/`));
}

// ── AS PÁGINAS QUE SÃO SÓ CABEÇALHO E RODAPÉ, POR REGRA ─────────────────────────────────────────
// A regra da casa (README do editor, §8) diz o que NÃO vira primitivo: texto legal, rótulo de
// formulário e de UI, mecânica de compra. Nestas rotas o corpo inteiro é isso, então o que o lojista
// edita nelas é só o `chrome` (cabeçalho e rodapé). Sem esta lista o gate de cobertura as mediria
// como qualquer outra página, veria 22% a 65% e reprovaria a loja para sempre; e um gate que sempre
// reprova é um gate que ninguém lê.
//
// NÃO é uma segunda lista de páginas: ela não põe nem tira página do editor (isso é o `DISALLOW`).
// Ela só diz, das páginas editáveis, quais são só cabeçalho e rodapé POR DECISÃO de quem construiu a
// loja, com o motivo ao lado. Explícita de propósito: o gate não infere isso do conteúdo, e a página
// que não está aqui continua sob a régua de 80%. Vai para `GET /api/unbox/paginas` como `soChrome: true`.
//
// ROTA NOVA que seja só texto legal ou mecânica de compra entra aqui, com o motivo citando o §8.
export const SO_CHROME: readonly string[] = [
  "/termos", // texto legal (termos de uso): §8, "texto legal (política, CNPJ, termos)"
  "/privacidade", // texto legal (política de privacidade): §8, o mesmo item
  "/devolucoes", // texto legal (política de trocas e devoluções): §8, o mesmo item
  "/busca", // campo de busca e resultados do catálogo: §8, "rótulo de formulário e de UI" e "produto do catálogo"
];

/** `rota` é uma das páginas que, por regra (§8), só tem cabeçalho e rodapé editáveis. Igualdade exata: `/termos/x` não herda. */
export function soChrome(rota: string): boolean {
  return SO_CHROME.includes(rota);
}

// ── OS CONTAINERS QUE CADA ROTA RENDERIZA ───────────────────────────────────────────────────────
// A regra do modelo: a ORDEM é do container e a COPY é do container. Então "em que outras páginas esta
// seção aparece?" tem resposta exata: nas rotas que renderizam o mesmo container. O editor só sabia isso
// DEPOIS de alguém abrir a outra página na prévia (o manifesto é capturado por página): de /produtos, sem
// /categoria aberta, ele deixava publicar a copy do catálogo sem avisar que ela vale nas categorias. Aqui a
// loja DECLARA, igual ao SO_CHROME: rota → containers que ela renderiza, FORA o `chrome` (cabeçalho, faixa,
// rodapé), que é do site inteiro e não se lista. Lista vazia é declaração ("esta página só tem o chrome"),
// não ausência. Vai para `GET /api/unbox/paginas` como `containers`.
//
// O GATE CONFERE (scripts/check-editable.mjs): os containers que o manifesto de cada página mostrou, fora o
// chrome, têm de ser exatamente estes. Página que renderiza um container que não está aqui, ou que declara um
// que não aparece, reprova a loja dizendo a rota e o container. É o que impede esta tabela de envelhecer em
// silêncio quando alguém mexe numa página. Rota editável que não estiver aqui sai SEM o campo, e o gate reprova.
//
// ⚠️ ROTA NOVA EM app/(loja)/ ENTRA NESTA TABELA, OU O GATE REPROVA. O nome do container é o que a página
// (ou o componente que ela renderiza) passa em `<EditableSections container="…">`: tem de ser o MESMO aqui.
// Página com container próprio declara o nome dele; página que só tem cabeçalho e rodapé declara `[]`.
export const CONTAINERS_POR_ROTA: Readonly<Record<string, readonly string[]>> = {
  "/": ["home"], // components/home/combos-home.tsx: a home é a dona do container (manda na ordem, oculta e copia)
  "/produtos": ["catalogo"], // components/catalog/catalog-client.tsx: /produtos é a dona do container (manda na ordem)
  "/categoria/[tagSlug]": ["catalogo"], // a categoria reaproveita o catálogo com layout={false}: mesma copy, ordem editada em /produtos
  "/produto/[productSlug]": ["produto"], // components/product/pdp/*: um molde para todos os produtos
  "/oferta": ["oferta"], // app/(loja)/oferta/page.tsx: a landing tem container PRÓPRIO (mesmos componentes da home, copy própria)
  "/busca": [], // só o chrome: campo de busca e resultados do catálogo não viram primitivo (§8)
  "/termos": [], // só o chrome: texto legal (§8)
  "/privacidade": [], // só o chrome: texto legal (§8)
  "/devolucoes": [], // só o chrome: texto legal (§8)
};

/** os containers que `rota` declara renderizar, fora o chrome; `undefined` = a rota não está na tabela (a loja não declarou; o gate reprova) */
export function containersDaRota(rota: string): readonly string[] | undefined {
  return CONTAINERS_POR_ROTA[rota];
}

/** a descoberta das páginas falhou: quem chama recusa a lista INTEIRA, com este motivo (nunca responde uma parcial) */
export class ErroDeVarredura extends Error {}

function varrer(dir: string, prefixo: string, saida: string[]) {
  let itens: fs.Dirent[];
  try {
    itens = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    // NÃO engole: uma subpasta ilegível virava lista parcial com 200, a página sumia do seletor e o gate
    // deixava de medi-la sem dizer NÃO RODOU. O caminho vai relativo: a mensagem é pública.
    const codigo = (e as NodeJS.ErrnoException | null)?.code;
    throw new ErroDeVarredura(`não consegui ler ${path.relative(process.cwd(), dir) || dir}${codigo ? ` (${codigo})` : ""}`);
  }
  for (const item of itens) {
    if (item.isDirectory()) {
      const nome = item.name;
      // pasta privada (`_x`), slot de rota paralela (`@x`) e rota interceptada (`(.)x`) não são páginas
      if (nome.startsWith("_") || nome.startsWith("@")) continue;
      const grupo = /^\(.+\)$/.test(nome); // grupo de rotas: não vira segmento de URL
      if (!grupo && nome.includes("(")) continue;
      varrer(path.join(dir, nome), grupo ? prefixo : `${prefixo}/${nome}`, saida);
    } else if (ARQUIVO_DE_PAGINA.test(item.name)) {
      saida.push(prefixo || "/");
    }
  }
}

/** a lista do ambiente (`UNBOX_ROTAS_EDITAVEIS`, ver .env.example): só vale quando a raiz não existe, e cada defeito dela é dito */
function rotasDoAmbiente(raizRelativa: string): string[] {
  const bruto = process.env.UNBOX_ROTAS_EDITAVEIS;
  if (!bruto) throw new ErroDeVarredura(`${raizRelativa} não existe (fontes ausentes no pacote da função? confira outputFileTracingIncludes em next.config.ts) e UNBOX_ROTAS_EDITAVEIS não está definida`);
  let lista: unknown;
  try {
    lista = JSON.parse(bruto);
  } catch (e) {
    throw new ErroDeVarredura(`UNBOX_ROTAS_EDITAVEIS não é JSON válido (${e instanceof Error ? e.message : String(e)})`);
  }
  if (!Array.isArray(lista)) throw new ErroDeVarredura(`UNBOX_ROTAS_EDITAVEIS precisa ser uma lista JSON de rotas, como ["/","/sobre","/produto/[productSlug]"]`);
  // CADA ENTRADA É CONFERIDA, E UMA INVÁLIDA RECUSA A LISTA INTEIRA. Filtrar a entrada errada
  // ("produto/[productSlug]" sem a barra, um número) e responder o resto com 200 era a página digitada
  // errada sumindo do seletor e do gate sem ninguém saber. O motivo diz QUAL entrada e POR QUÊ, para consertar
  // de uma vez; a lista nunca é filtrada, nem deduplicada antes de ser conferida.
  const defeitos: string[] = [];
  lista.forEach((entrada, i) => {
    const defeito = defeitoDaRota(entrada);
    if (defeito) defeitos.push(`a entrada ${i + 1} (${mostrarEntrada(entrada)}) ${defeito}`);
  });
  if (defeitos.length) {
    const quantas = defeitos.length === 1 ? "uma entrada inválida" : `${defeitos.length} entradas inválidas`;
    throw new ErroDeVarredura(`UNBOX_ROTAS_EDITAVEIS foi recusada inteira porque tem ${quantas}: ${defeitos.join("; ")}. ${FORMA_DA_ROTA}`);
  }
  if (!lista.length) throw new ErroDeVarredura(`UNBOX_ROTAS_EDITAVEIS está vazia: precisa de pelo menos uma rota, como "/"`);
  return [...new Set(lista as string[])].sort();
}

const FORMA_DA_ROTA = `Cada entrada precisa ser uma rota como o Next a escreve: um texto que começa com "/", sem espaço e sem barra dupla, como "/" ou "/produto/[productSlug]"`;

/** o defeito de UMA entrada de `UNBOX_ROTAS_EDITAVEIS`, ou `null` quando ela é uma rota como o Next a escreve */
function defeitoDaRota(entrada: unknown): string | null {
  if (typeof entrada !== "string") return `não é texto (é ${tipoDaEntrada(entrada)})`;
  if (!entrada.startsWith("/")) return `não começa com "/"`;
  if (/\s/.test(entrada)) return "tem espaço";
  if (entrada.includes("//")) return `tem barra dupla ("//")`;
  return null;
}

function tipoDaEntrada(v: unknown): string {
  if (v === null) return "nulo";
  if (Array.isArray(v)) return "uma lista";
  if (typeof v === "number") return "um número";
  if (typeof v === "boolean") return "um booleano";
  if (typeof v === "object") return "um objeto";
  return typeof v;
}

/** a entrada como foi escrita no JSON, curta: a mensagem é pública e chega à tela do editor */
function mostrarEntrada(entrada: unknown): string {
  const s = JSON.stringify(entrada) ?? String(entrada);
  return s.length > 60 ? `${s.slice(0, 57)}...` : s;
}

/**
 * As rotas de `app/(loja)/`, com os segmentos dinâmicos como o Next os escreve
 * (`/produto/[productSlug]`) — é essa forma que `revalidatePath(rota, "page")` entende.
 *
 * A varredura acontece no servidor, em tempo de execução. Em produção os fontes só existem dentro
 * da função porque `next.config.ts` os inclui (`outputFileTracingIncludes`); se algum dia isso
 * deixar de valer (a raiz não existe), `UNBOX_ROTAS_EDITAVEIS` (um JSON de strings) responde no
 * lugar. Qualquer OUTRA falha (subpasta ilegível, erro de leitura, raiz sem nenhum page.tsx) estoura
 * `ErroDeVarredura` com o motivo, e quem chama recusa a descoberta inteira: uma lista parcial com 200
 * é a página sumindo do seletor e do gate em silêncio, que é pior do que um 500 dizendo por quê.
 */
export function rotasDaLoja(): string[] {
  const raizRelativa = path.join("app", "(loja)");
  const raiz = path.join(process.cwd(), raizRelativa);
  if (!fs.existsSync(raiz)) return rotasDoAmbiente(raizRelativa);
  const achadas: string[] = [];
  varrer(raiz, "", achadas); // propaga a falha: lista parcial não é lista
  if (!achadas.length) throw new ErroDeVarredura(`a varredura de ${raizRelativa} não achou nenhum page.tsx`);
  return [...new Set(achadas)].sort();
}

/** As rotas que o lojista pode editar: as de `app/(loja)/` menos as que o robots bloqueia. Estoura `ErroDeVarredura` quando a descoberta falha. */
export function rotasEditaveis(): string[] {
  return rotasDaLoja().filter((r) => !bloqueadaPeloRobots(r));
}
