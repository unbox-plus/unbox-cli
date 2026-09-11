// ═══════════════════════════════════════════════════════════════════════════
// A CASCA EM MODO EDIÇÃO: `/previa-do-editor/<rota da página>`
//
// O editor abre as páginas do lojista aqui, com um token de prévia. Uma página que ele acabou de
// criar não existe na loja (nada vai ao ar sem o Publicar), e a rota de produção responderia 404: sem
// esta rota, o lojista não teria como VER o que está escrevendo antes de publicar.
//
// ── AS CINCO DIFERENÇAS PARA AS ROTAS DE PRODUÇÃO ─────────────────────────────
// 1. `force-dynamic`: nada aqui é cacheado. O rascunho chega por `postMessage`, e uma resposta
//    guardada mostraria o estado de outro momento.
// 2. `noindex`, e `/previa-do-editor` no DISALLOW do robots e fora da lista de páginas editáveis
//    (`ROTAS_INTERNAS`). Estas URLs mostram conteúdo não publicado: nenhuma delas pode ser indexada,
//    e nenhuma delas é uma "página da loja" no seletor do editor. O cabeçalho `X-Robots-Tag` vem de
//    next.config.ts, para valer inclusive na resposta de um caminho que a página não reconhece.
// 3. ATRÁS DE TOKEN. É a rota que abre uma página OCULTA já renderizada, e a loja responde 404 nessa
//    mesma página. O `middleware.ts` não serve de porta aqui: ele só fecha a loja em host de PREVIEW
//    (*.vercel.app, *.myunbox.com.br), e no domínio próprio da marca — o lançamento de verdade — ele
//    devolve `next()` e a prévia ficava aberta a quem adivinhasse a URL. Exigimos o MESMO token que o
//    middleware já sabe conferir (`verifyEditorToken(…, "preview")`, assinado pelo editor em ES256),
//    na query ou no cookie que ele grava. Sem token, `notFound()`.
//    O que isto NÃO resolve: o documento publicado inteiro já viaja no payload de toda página da
//    loja, então o TEXTO de uma página oculta já é público. O que a porta tira é a URL humana,
//    adivinhável e compartilhável para conteúdo que a loja responde 404.
// 4. NUNCA `notFound()` POR NÃO ESTAR PUBLICADA. Com o token na mão, a casca abre para qualquer
//    caminho de página, publicado ou não: é a única forma de editar uma página que ainda não existe
//    na loja. O 404 aqui é só o da porta e o do caminho que não é de página nenhuma.
// 5. O publicado é lido só para os FALLBACKS (a data marcada, a assinatura, o título de emergência).
//    O que está sendo editado chega do rascunho, pelo provider.
//
// A página do manifesto sai SEM este prefixo (`normalizarPagina` o remove na foundation), então uma
// linha capturada aqui pertence a `/blog/titulo`, a mesma rota da produção. Sem rewrite no
// middleware: a rota é de verdade, e o token dela passa pela porta de prévia como em qualquer outra.
//
// FORA DE `app/(loja)/` de propósito: assim ela não entra na varredura de rotas editáveis pelo
// simples fato de existir, e nasce sem o cabeçalho e o rodapé da loja, que a prévia de uma página do
// lojista não precisa (o chrome é editado nas páginas do código).
// ═══════════════════════════════════════════════════════════════════════════
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ColecaoNaTela, fatiaDaListagem } from "@/components/paginas/colecao-do-lojista";
import { PaginaDoLojistaNaTela } from "@/components/paginas/pagina-do-lojista";
import { PREFIXO_DE_PAGINAS } from "@/lib/paginas-do-lojista";
import { lerPaginas } from "@/lib/paginas-publicadas";
import { reservadosDaLoja } from "@/lib/reservados";
import { COOKIE_DA_PREVIA, PARAM_DO_TOKEN } from "@/lib/previa";
import { verifyEditorToken } from "@/lib/editable/verify";
import {
  handleValido,
  idDePagina,
  visivelAgora,
  type PaginaDoLojista,
  type TipoDePagina,
} from "@/lib/editable/document";

export const dynamic = "force-dynamic";

// `index: false` no `<meta name="robots">` da página, além do cabeçalho HTTP de next.config.ts: um
// dos dois sozinho já basta, e os dois juntos cobrem quem lê só o HTML e quem lê só o cabeçalho.
export const metadata: Metadata = {
  title: "Prévia do editor",
  robots: { index: false, follow: false },
};

/** o prefixo `/paginas` sem a barra, que é como ele aparece no primeiro segmento do caminho */
const SEGMENTO_DE_PAGINAS = PREFIXO_DE_PAGINAS.replace(/^\//, "");

/**
 * O registro de uma página que o lojista está criando e ainda não publicou. Datas VAZIAS de
 * propósito: a casca não mostra data sem data, e carimbar "hoje" aqui faria a prévia exibir uma data
 * de publicação que ninguém escolheu.
 */
function registroDeRascunho(tipo: TipoDePagina, handle: string, colecao?: string): PaginaDoLojista {
  return { tipo, handle, colecao, visibilidade: "oculta", criadoEm: "", atualizadoEm: "" };
}

/** a frase da tarja: por que esta página ainda não aparece na loja */
function avisoDaPrevia(registro: PaginaDoLojista | undefined): string | null {
  if (!registro) return "Esta página ainda não foi publicada, então ainda não aparece na loja.";
  if (visivelAgora(registro)) return null;
  if (registro.visibilidade === "visivel") return "Esta página está agendada e ainda não aparece na loja.";
  return "Esta página está oculta e não aparece na loja.";
}

/** o que dizer quando o caminho não é o de nenhuma página, artigo ou coleção */
function CaminhoQueNaoAbre() {
  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-16 text-[15px] leading-[1.6] text-[var(--store-ink-2)] sm:px-6">
      <p>Esta prévia abre uma página, um artigo ou uma coleção da loja.</p>
      <p className="mt-2">Abra a página pelo editor: é ele que monta o endereço certo.</p>
    </div>
  );
}

/**
 * Quem abriu esta prévia é o editor? O token vem na query (é assim que ele monta a URL) ou no cookie
 * que o `middleware.ts` grava a partir dela, para uma recarga dentro do iframe não perder a porta. Nos
 * dois casos quem decide é `verifyEditorToken`, com a chave pública do editor: a loja não guarda
 * segredo nenhum, e sem `EDITOR_URL` nada é válido (uma loja sem editor não tem prévia do editor).
 */
async function abertaPeloEditor(searchParams: Promise<Record<string, string | string[] | undefined>>): Promise<boolean> {
  const q = (await searchParams)[PARAM_DO_TOKEN];
  const daQuery = Array.isArray(q) ? q[0] : q;
  const token = daQuery || (await cookies()).get(COOKIE_DA_PREVIA)?.value;
  if (!token) {
    console.warn("[previa-do-editor] sem token na URL nem no cookie: 404. Esta rota só abre pelo editor.");
    return false;
  }
  if (await verifyEditorToken(token, "preview")) return true;
  // O 404 mudo aqui custa uma tarde. O caso mais comum não é ataque: é o editor rodando SEM
  // `EDITOR_PRIVATE_KEY_JWK`, que em desenvolvimento faz ele assinar com um par novo a cada arranque
  // (o `kid` do token nunca casa com o do JWKS, e toda prévia de página do lojista vira 404). Depois
  // vêm o `EDITOR_URL` apontando para outro editor e o token expirado (a prévia dura 15 minutos).
  console.warn(
    `[previa-do-editor] token recusado (${daQuery ? "veio na URL" : "veio do cookie"}): a assinatura não confere com o JWKS de ${process.env.EDITOR_URL || "(EDITOR_URL ausente)"}. ` +
      "Em desenvolvimento, o editor precisa de EDITOR_PRIVATE_KEY_JWK para assinar sempre com a mesma chave; sem ela, cada arranque gera um par novo e nenhuma prévia de página abre.",
  );
  return false;
}

export default async function PreviaDoEditor({
  params,
  searchParams,
}: {
  params: Promise<{ caminho?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // A PORTA, ANTES DE QUALQUER LEITURA. Sem token, esta URL responde o mesmo que qualquer outra que
  // não existe: 404. (`searchParams` e `cookies()` tornariam a rota dinâmica, e aqui isso não custa
  // nada: ela já é `force-dynamic` pelo motivo 1 do cabeçalho.)
  if (!(await abertaPeloEditor(searchParams))) notFound();

  const { caminho } = await params;
  const segmentos = (caminho ?? []).map((s) => decodeURIComponent(s));
  const doc = await lerPaginas();

  // ── uma página avulsa: /paginas/<endereço> ──
  if (segmentos.length === 2 && segmentos[0] === SEGMENTO_DE_PAGINAS && handleValido(segmentos[1])) {
    const handle = segmentos[1];
    const id = idDePagina("pagina", handle);
    const publicada = doc?.paginas?.[id];
    return (
      <PaginaDoLojistaNaTela
        id={id}
        registro={publicada ?? registroDeRascunho("pagina", handle)}
        caminho={`${PREFIXO_DE_PAGINAS}/${handle}`}
        aviso={avisoDaPrevia(publicada)}
      />
    );
  }

  // DAQUI PARA BAIXO O PRIMEIRO SEGMENTO É UMA COLEÇÃO, e uma coleção nunca ocupa endereço reservado
  // (`/carrinho`, `/produto`, `/api`…): a loja não deixa ela existir, e a prévia não pode abrir o que
  // a loja não deixa existir. Sem esta guarda, a escolha era só pela FORMA do caminho, e
  // `/previa-do-editor/carrinho` renderizava a listagem inventada de uma coleção `carrinho`, com
  // `/previa-do-editor/produto/qualquer` inventando um artigo, enquanto `CaminhoQueNaoAbre` ficava
  // inalcançável para todo caminho de um ou dois segmentos.
  if (reservadosDaLoja().includes(segmentos[0] ?? "")) return <CaminhoQueNaoAbre />;

  // ── um artigo: /<coleção>/<endereço> ──
  if (segmentos.length === 2 && handleValido(segmentos[0]) && handleValido(segmentos[1]) && segmentos[1] !== "pagina") {
    const [colecao, handle] = segmentos;
    const id = idDePagina("artigo", handle, colecao);
    const publicada = doc?.paginas?.[id];
    return (
      <PaginaDoLojistaNaTela
        id={id}
        registro={publicada ?? registroDeRascunho("artigo", handle, colecao)}
        caminho={`/${colecao}/${handle}`}
        aviso={avisoDaPrevia(publicada)}
      />
    );
  }

  // ── a listagem de uma coleção: /<coleção> e /<coleção>/pagina/N ──
  const paginado = segmentos.length === 3 && segmentos[1] === "pagina" && /^[1-9][0-9]{0,4}$/.test(segmentos[2]);
  if ((segmentos.length === 1 || paginado) && handleValido(segmentos[0])) {
    const handle = segmentos[0];
    const pedida = paginado ? Number(segmentos[2]) : 1;
    // sem `notFound()`: a coleção pode não ter artigo nenhum publicado (ou nem existir ainda no
    // publicado), e a prévia mostra a listagem vazia, que é o que o lojista vai ver ao publicar
    const fatia = (await fatiaDaListagem(handle, pedida)) ?? { artigos: [], totalDePaginas: pedida };
    return <ColecaoNaTela handle={handle} pagina={pedida} artigos={fatia.artigos} totalDePaginas={fatia.totalDePaginas} />;
  }

  return <CaminhoQueNaoAbre />;
}
