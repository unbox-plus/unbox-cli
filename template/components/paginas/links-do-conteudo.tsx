// ═══════════════════════════════════════════════════════════════════════════
// A TIRA "CONTEÚDO" DO RODAPÉ: como se chega, navegando, nas páginas que o lojista publicou.
//
// Sem ela, NADA na loja linkava para uma página, um artigo ou uma listagem do lojista. A loja
// publicava dezenas de URLs no sitemap e nenhuma era alcançável por quem visita: `/blog` só aparecia
// na migalha DENTRO de um artigo, e o artigo só se alcançava pelo sitemap. Página órfã é página que
// ninguém lê e que o buscador trata como de segunda: a ligação interna é o que diz a ele que aquilo é
// parte da loja, e é o que dá a quem visita um caminho até lá.
//
// O desenho previa outro contorno ("o lojista edita o `href` de um link de marca já editável"), e ele
// não existe neste template: o cabeçalho e o rodapé são SERVER components sem nenhum primitivo de
// link de conteúdo, e não há `Editable.Link` para páginas. Enquanto o menu dinâmico não chega
// (registrado no "fora do v1" do desenho), esta tira é derivada, não editável.
//
// ── DERIVADA, E POR ISSO `data-editor-ignore` ─────────────────────────────────
// Os títulos daqui são o título de cada página e de cada coleção, lidos do documento. Deixá-los
// editáveis aqui faria a mesma frase existir em dois lugares, com duas respostas — é o mesmo
// argumento dos cards da listagem. Quem muda o nome é a página, e a tira acompanha.
//
// ── A MESMA FONTE DO SITEMAP ──────────────────────────────────────────────────
// `colecoesEmProducao()` e `todasAsPaginasVisiveis()`, exatamente o que o sitemap lê. Uma segunda
// regra aqui faria a loja oferecer ao buscador uma lista e a quem visita outra. Coleção SEM artigo
// fica de fora pelo mesmo motivo pelo qual ela fica de fora do sitemap (e pelo qual ela nasce
// `noindex`): é uma listagem vazia, e um link para uma frase de "ainda não há nada aqui" não é
// navegação. Página marcada "ocultar de buscadores" também fica de fora: ela já não é oferecida a
// ninguém, e o rodapé é o lugar mais público da loja.
// ═══════════════════════════════════════════════════════════════════════════
import "server-only";
import Link from "next/link";
import { tituloDaColecao, tituloDaPaginaOuEndereco } from "@/components/paginas/titulos";
import { artigosVisiveis, colecoesEmProducao, lerPaginas, todasAsPaginasVisiveis } from "@/lib/paginas-publicadas";

/**
 * O teto de páginas avulsas listadas. Uma loja pode ter até 500 (`PAGINAS_MAX`), e um rodapé com 500
 * links não é navegação: é uma parede. As coleções não precisam de teto próprio (são no máximo 20, e
 * cada uma é a porta de entrada dos artigos dela).
 */
const TETO_DE_PAGINAS = 12;

/** um link derivado; nada aqui é copy da marca */
interface LinkDoConteudo {
  href: string;
  nome: string;
}

/** as coleções com artigo no ar e as páginas avulsas visíveis, na ordem em que a loja as publica */
async function linksDoConteudo(): Promise<{ colecoes: LinkDoConteudo[]; paginas: LinkDoConteudo[] }> {
  const doc = await lerPaginas();
  const colecoes: LinkDoConteudo[] = [];
  for (const handle of await colecoesEmProducao()) {
    const artigos = await artigosVisiveis(handle);
    if (!artigos.length) continue;
    colecoes.push({ href: `/${handle}`, nome: tituloDaColecao(doc, handle) });
  }
  const paginas = (await todasAsPaginasVisiveis())
    .filter((p) => p.registro.tipo === "pagina")
    .slice(0, TETO_DE_PAGINAS)
    .map((p) => ({ href: p.rota, nome: tituloDaPaginaOuEndereco(doc, p.id, p.registro.handle) }));
  return { colecoes, paginas };
}

/**
 * A tira, ou NADA. Loja recém-nascida não tem página nenhuma publicada, e uma faixa vazia com um
 * título "Conteúdo" e nenhum link abaixo é pior do que faixa nenhuma.
 *
 * Fica na CASCA do rodapé (components/site-footer.tsx), fora das variantes: assim toda variante a
 * herda, e trocar a receita do chrome não some com o único caminho até as páginas do lojista.
 */
export async function LinksDoConteudo() {
  // a leitura do editor não pode derrubar o rodapé, que vive no layout de toda página
  let dados: { colecoes: LinkDoConteudo[]; paginas: LinkDoConteudo[] };
  try {
    dados = await linksDoConteudo();
  } catch {
    return null;
  }
  const { colecoes, paginas } = dados;
  if (!colecoes.length && !paginas.length) return null;

  return (
    <div data-editor-ignore="" className="border-t border-[var(--store-chrome-line,rgba(255,255,255,.1))]">
      <nav aria-label="Conteúdo da loja" className="mx-auto flex max-w-[var(--container-max,1240px)] flex-wrap gap-x-10 gap-y-6 px-6 py-8">
        {colecoes.length ? <Coluna titulo="Conteúdo" links={colecoes} /> : null}
        {paginas.length ? <Coluna titulo="Páginas" links={paginas} /> : null}
      </nav>
    </div>
  );
}

function Coluna({ titulo, links }: { titulo: string; links: LinkDoConteudo[] }) {
  return (
    <div className="min-w-[180px]">
      <div className="font-display mb-3 text-sm font-bold text-[var(--store-chrome-text,#ffffff)]">{titulo}</div>
      <div className="flex flex-col gap-2.5 text-[13px] text-[var(--store-chrome-muted)]">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="no-underline hover:text-[var(--store-chrome-text,#ffffff)]">
            {l.nome}
          </Link>
        ))}
      </div>
    </div>
  );
}
