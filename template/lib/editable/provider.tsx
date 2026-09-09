"use client";

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER DO CONTEÚDO EDITÁVEL + PONTE COM O EDITOR
//
// Em produção: recebe o documento publicado (lido no servidor, com ISR) e o
// distribui por contexto aos primitivos. Zero JS a mais além do contexto.
//
// Em modo edição (a página aberta com `?unbox_editor=1`, dentro do iframe do
// editor): os primitivos ganham atributos `data-editor-*`, o provider publica o
// MANIFESTO (tudo que é editável nesta página, descoberto por quem se registrou)
// e passa a aceitar `apply {doc}` por postMessage — prévia instantânea, sem
// round-trip nem rebuild. Nada aqui grava nada: a única fonte de verdade do
// rascunho é o servidor do editor.
//
// O modo edição é cosmético: só acrescenta atributos e escuta mensagens da
// origem configurada. Sem origem configurada, aceita qualquer pai — o que um
// pai malicioso consegue é sobrepor texto NA PRÓPRIA PÁGINA DELE, o que ele já
// conseguia sem nós.
// ═══════════════════════════════════════════════════════════════════════════
import * as React from "react";
import {
  type ContentDocument,
  type EditableType,
  type EditableValue,
  type Manifest,
  type ManifestApps,
  type ManifestEntry,
  type ManifestSectionType,
  type ManifestSemContainer,
  emptyDocument,
  isColor, normalizarPagina, resolveValue, type SectionKind, SECTION_KIND_LABEL } from "./document";

export interface EditableTokenSpec {
  token: string;
  label: string;
}

interface Registration {
  path: string;
  type: EditableType;
  label?: string;
  fallback: EditableValue;
  el: () => Element | null;
}

/**
 * O QUE FICOU FORA DE UM CONTAINER (foundation 11). Não é registro de editável: é o contrário disso.
 * O primitivo que cairia na RAIZ do documento não se registra (a loja renderiza o literal do código),
 * e passa por aqui só para o manifesto poder DECLARAR o defeito e o gate reprovar. Ver
 * `caminhoTemContainer` em document.ts.
 */
interface RegistroForaDeContainer {
  path: string;
  type: EditableType;
  label?: string;
}

/** Um tipo do catálogo da loja, como a loja o declara (o container vem de quem registra). */
export type TipoDeSecaoDeclarado = Omit<ManifestSectionType, "container">;

interface SectionRegistration {
  container: string;
  id: string;
  label?: string;
  clone?: boolean;
  /** seção ADICIONADA pelo lojista, instanciada a partir do catálogo da loja */
  criada?: boolean;
  /** tipo do catálogo (só em `criada`) */
  tipo?: string;
  fixed?: boolean;
  kind?: SectionKind;
  item?: boolean;
  /** posição no CÓDIGO (não muda com a reordenação do lojista) */
  ordemNoCodigo?: number;
  /** a página reaproveita o container sem mandar nele (`Editable.Sections layout={false}`) */
  semLayout?: boolean;
  el: () => Element | null;
}

interface Ctx {
  doc: ContentDocument;
  editing: boolean;
  selectMode: boolean;
  scope: string[];
  /**
   * O CONTAINER em vigor. `undefined` = nenhum foi declarado ainda, e nada aqui dentro é editável:
   * o padrão era "home", e por causa dele qualquer página que envolvesse suas seções sem dizer o
   * container entrava escrevendo NA HOME e passava a disputar a ordem da home (foundation 11).
   */
  container?: string;
  section?: string;
  /** false = ignora ordem/ocultas do documento (páginas que reaproveitam a receita da home) */
  layout: boolean;
  register: (r: Registration) => () => void;
  registerSection: (r: SectionRegistration) => () => void;
  /** o CATÁLOGO daquele container: os tipos que esta loja sabe instanciar (`Editable.Sections catalogo`) */
  registerTipos: (container: string, tipos: TipoDeSecaoDeclarado[]) => () => void;
  select: (entry: ManifestEntry, el: Element) => void;
  /** o primitivo que cairia na RAIZ do documento se declara aqui, para o manifesto poder acusar */
  foraDeContainer: (r: RegistroForaDeContainer) => () => void;
  /**
   * O token de prévia (o `unbox_editor_token` com que o editor abriu este iframe), guardado só em
   * memória — ele sai da URL na primeira renderização e nunca volta para lá.
   *
   * Serve para UMA coisa: em modo edição, o primitivo da vitrine perguntar à PRÓPRIA LOJA o que a
   * escolha do rascunho vira em produtos (`POST /api/unbox/vitrine`). A credencial da Unbox
   * continua só na loja — o que trafega aqui é o token do editor, que a loja verifica pelo JWKS.
   * `null` fora do modo edição (e enquanto o efeito de captura não rodou).
   */
  previewToken: string | null;
  /**
   * Pede ao editor um token novo. O de prévia vale 15 minutos; uma sessão de edição passa disso
   * com facilidade, e sem isto a primeira vitrine trocada depois do prazo responderia 401 e o
   * lojista veria "não autorizado" sem ter feito nada errado.
   */
  renovarToken: () => void;
}

const noop = () => () => {};
const EditableContext = React.createContext<Ctx>({
  doc: emptyDocument(""),
  editing: false,
  selectMode: false,
  scope: [],
  container: undefined,
  layout: true,
  register: noop,
  registerSection: noop,
  registerTipos: noop,
  select: () => {},
  foraDeContainer: noop,
  previewToken: null,
  renovarToken: () => {},
});

export function useEditableContext() {
  return React.useContext(EditableContext);
}

/** Lê o flag de edição no cliente, depois da hidratação (evita mismatch). */
function detectEditing(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("unbox_editor") === "1";
  } catch {
    return false;
  }
}

/** fundo por seção: o invólucro é `display: contents`; a variável herda e o filho direto pinta (e um gradiente do código sai da frente) */
const SECTION_CSS = `[data-unbox-sec-bg="1"]>*{background-color:var(--unbox-sec-bg) !important;background-image:none !important}`;

/** o primeiro texto visível da seção (título, se houver; senão o primeiro texto editável), até 60 caracteres */
function trechoDaSecao(node: Element | null): string | undefined {
  if (!node) return undefined;
  const cand = node.querySelector("h1[data-editor-path],h2[data-editor-path],h3[data-editor-path],[data-editor-type='text']");
  const txt = (cand as HTMLElement | null)?.innerText?.replace(/\s+/g, " ").trim();
  if (!txt) return undefined;
  return txt.length > 60 ? txt.slice(0, 59) + "…" : txt;
}

/** rgb()/rgba() → [r,g,b,a]; #rrggbb → alfa 1; transparente → alfa 0 */
function rgba(cor: string | null | undefined): [number, number, number, number] | undefined {
  const m = cor?.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)/);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
    return [Number(m[1]), Number(m[2]), Number(m[3]), Number.isFinite(a) ? a : 1];
  }
  const h = cor?.match(/^#([0-9a-f]{6})$/i);
  return h ? [parseInt(h[1].slice(0, 2), 16), parseInt(h[1].slice(2, 4), 16), parseInt(h[1].slice(4, 6), 16), 1] : undefined;
}
const hex = (c: [number, number, number, number]) => "#" + c.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
/** cor computada → #rrggbb (o inspector usa <input type=color>); transparente → undefined */
function paraHex(cor: string | null | undefined): string | undefined {
  const c = rgba(cor);
  return c && c[3] > 0 ? hex(c) : undefined;
}
/**
 * A cor de fundo que o olho vê: sobe pelos ancestrais compondo as camadas semitransparentes
 * (rgba(255,0,0,.5) sobre branco é rosa, não vermelho) até fechar em uma cor opaca.
 */
function fundoEmUso(el: Element | null): string | undefined {
  const camadas: [number, number, number, number][] = [];
  for (let e: Element | null = el; e; e = e.parentElement) {
    const cs = getComputedStyle(e);
    // imagem ou gradiente de fundo nesta camada: o que se vê não é UMA cor — "não representável"
    if (cs.backgroundImage && cs.backgroundImage !== "none") return undefined;
    const bruto = cs.backgroundColor;
    const c = rgba(bruto);
    // formato que não sabemos ler (oklch, color(), …) é uma camada OPACA desconhecida: não é
    // transparente, então não atravessa — "não representável" em vez da cor do ancestral
    if (!c && bruto && bruto !== "transparent") return undefined;
    if (!c || c[3] === 0) continue;
    camadas.push(c);
    if (c[3] >= 1) break;
  }
  if (!camadas.length) return undefined;
  // compõe de trás (mais opaca/mais funda) para a frente
  let acc = camadas[camadas.length - 1];
  if (acc[3] < 1) acc = [acc[0] * acc[3] + 255 * (1 - acc[3]), acc[1] * acc[3] + 255 * (1 - acc[3]), acc[2] * acc[3] + 255 * (1 - acc[3]), 1]; // fundo da página branco como base
  for (let i = camadas.length - 2; i >= 0; i--) {
    const c = camadas[i];
    acc = [c[0] * c[3] + acc[0] * (1 - c[3]), c[1] * c[3] + acc[1] * (1 - c[3]), c[2] * c[3] + acc[2] * (1 - c[3]), 1];
  }
  return hex(acc);
}

/**
 * DESTAQUE POR CAMADA (bloco B7, lição do editor da Shopify): em vez de `outline` em cada um dos
 * ~150 editáveis (a loja parecia quebrada e o contorno sumia dentro de `overflow:hidden`),
 * uma camada fixa por cima da página desenha três caixas — hover, selecionado e seção ativa —
 * medidas por getBoundingClientRect, com um chip de nome. O pontilhado permanente virou opção
 * ("mostrar o que dá para editar"), desligada por padrão.
 *
 * Esse pontilhado nascia INVISÍVEL, por dois motivos somados: era o mesmo azul da caixa de hover a 45%
 * (a camada de destaque o engolia) e ficava FORA da borda (`outline-offset:2px`), onde qualquer ancestral
 * com `overflow:hidden` o recorta — e num layout de loja quase toda seção tem um. Agora o traço é desenhado
 * DENTRO da caixa (`outline-offset:-1px`): assim ele só some junto com o próprio elemento, que é honesto,
 * e nunca por causa do recorte do vizinho. A cor é `currentColor` — a cor de texto que o designer já
 * garantiu legível naquele fundo, clara no escuro e escura no claro, e que por construção não é o azul do
 * hover. Redesenhar os ~150 contornos na camada `#unbox-editor-overlay` daria o mesmo resultado, mas
 * custaria medir 150 retângulos a cada quadro de rolagem e só valeria com a camada montada — ela sai do ar
 * no modo Navegar, e o pontilhado tem de continuar.
 */
const EDITING_CSS = `
[data-editor-path]{cursor:pointer !important}
[data-editor-mostrar-editaveis="1"] [data-editor-path]{outline:1px dashed currentColor;outline-offset:-1px}
#unbox-editor-overlay{position:fixed;inset:0;pointer-events:none;z-index:2147483000}
#unbox-editor-overlay .ux-box{position:absolute;border-radius:3px;box-sizing:border-box;transition:all .08s ease-out}
#unbox-editor-overlay .ux-hover{border:2px solid rgba(37,99,235,.9)}
#unbox-editor-overlay .ux-sel{border:2px solid #f59e0b;box-shadow:0 0 0 4px rgba(245,158,11,.22)}
#unbox-editor-overlay .ux-sec{border:1.5px dashed rgba(27,26,33,.55);border-radius:6px}
#unbox-editor-overlay .ux-chip{position:absolute;transform:translateY(-100%);margin-top:-4px;left:0;max-width:60vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:600 11px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;padding:3px 7px;border-radius:5px;color:#fff;background:#1b1a21;letter-spacing:.01em}
#unbox-editor-overlay .ux-hover .ux-chip{background:#2563eb}
#unbox-editor-overlay .ux-sel .ux-chip{background:#b45309}
#unbox-editor-overlay .ux-sec .ux-chip{background:#1b1a21;opacity:.85}
[data-editor-editing="1"]{outline:2px solid #1b1a21 !important;outline-offset:2px;box-shadow:0 0 0 4px rgba(27,26,33,.18);cursor:text !important;caret-color:#1b1a21}
[data-editor-section-hidden="1"]{display:none !important}
`;

interface OverlayHandle {
  marcarSelecionado(el: HTMLElement | null, entry?: ManifestEntry): void;
  marcarSecao(el: HTMLElement | null): void;
}
// o nome do que está sob o cursor, na palavra do lojista. Tipo sem entrada aqui deixa o chip só com o
// rótulo — o tipo CRU do documento ("vitrine", "html") é nome nosso e não vai para a tela dele
const TIPO_NOME: Record<string, string> = { text: "Texto", image: "Imagem", link: "Link", color: "Cor", vitrine: "Vitrine", video: "Vídeo", html: "Bloco de HTML" };
/** a camada de destaque: três caixas fixas por cima da loja, medidas a cada scroll/resize/apply */
const Overlay = React.forwardRef<OverlayHandle, object>(function Overlay(_props, ref) {
  const raiz = React.useRef<HTMLDivElement | null>(null);
  const alvos = React.useRef<{ hover: HTMLElement | null; sel: HTMLElement | null; selRotulo: string; sec: HTMLElement | null }>({ hover: null, sel: null, selRotulo: "", sec: null });
  const pinta = React.useCallback(() => {
    const r = raiz.current;
    if (!r) return;
    const caixa = (cls: string, el: HTMLElement | null, rotulo: string) => {
      const box = r.querySelector(`.${cls}`) as HTMLElement | null;
      if (!box) return;
      if (!el || !el.isConnected) {
        box.style.display = "none";
        return;
      }
      const b = el.getBoundingClientRect();
      if (b.width === 0 && b.height === 0) {
        box.style.display = "none";
        return;
      }
      box.style.display = "block";
      box.style.left = `${b.left - 2}px`;
      box.style.top = `${b.top - 2}px`;
      box.style.width = `${b.width + 4}px`;
      box.style.height = `${b.height + 4}px`;
      const chip = box.querySelector(".ux-chip") as HTMLElement | null;
      if (chip) {
        if (chip.textContent !== rotulo) chip.textContent = rotulo;
        chip.style.display = rotulo ? "block" : "none";
        // chip cabe acima; se a caixa encosta no topo, o chip vai para dentro
        chip.style.transform = b.top < 28 ? "translateY(0)" : "translateY(-100%)";
        chip.style.marginTop = b.top < 28 ? "2px" : "-4px";
      }
    };
    const a = alvos.current;
    // Sem `label`, o chip fica só com o tipo ("Texto", "Perguntas frequentes"). O caminho
    // (`home.faq.pergunta-1.pergunta`) e o id da seção (`hero`, `marquee-2`) são endereço do NOSSO
    // documento: o lojista não os escreveu, não os reconhece e não tem como mudá-los. Falta de rótulo
    // é defeito de quem construiu a loja (o gate reprova por isso) — não é recado para o dono dela.
    const rotuloDe = (el: HTMLElement | null) => {
      if (!el) return "";
      const tipo = TIPO_NOME[el.dataset.editorType ?? ""] ?? "";
      return [tipo, el.dataset.editorLabel ?? ""].filter(Boolean).join(" · ");
    };
    const rotuloSec = (el: HTMLElement | null) => {
      if (!el) return "";
      const kind = el.dataset.editorKind;
      const tipo = (kind && SECTION_KIND_LABEL[kind as keyof typeof SECTION_KIND_LABEL]) || "";
      return [tipo, el.dataset.editorLabel ?? ""].filter(Boolean).join(" · ");
    };
    caixa("ux-hover", a.hover && a.hover !== a.sel ? a.hover : null, rotuloDe(a.hover));
    caixa("ux-sel", a.sel, a.selRotulo || rotuloDe(a.sel));
    // a caixa da seção é o primeiro filho do invólucro display:contents
    caixa("ux-sec", (a.sec?.firstElementChild as HTMLElement | null) ?? null, rotuloSec(a.sec));
  }, []);
  React.useImperativeHandle(ref, () => ({
    marcarSelecionado(el, entry) {
      alvos.current.sel = el;
      alvos.current.selRotulo = entry ? [TIPO_NOME[entry.type] ?? "", entry.label ?? ""].filter(Boolean).join(" · ") : "";
      alvos.current.sec = (el?.closest("[data-editor-section]") as HTMLElement | null) ?? alvos.current.sec;
      pinta();
    },
    marcarSecao(el) {
      alvos.current.sec = el;
      alvos.current.sel = null;
      pinta();
    },
  }), [pinta]);
  React.useEffect(() => {
    let raf = 0;
    const agenda = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(pinta);
    };
    const onMove = (ev: MouseEvent) => {
      const el = (ev.target as Element | null)?.closest("[data-editor-path]") as HTMLElement | null;
      if (el !== alvos.current.hover) {
        alvos.current.hover = el;
        agenda();
      }
    };
    const onLeave = () => {
      alvos.current.hover = null;
      agenda();
    };
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseleave", onLeave, true);
    window.addEventListener("scroll", agenda, true);
    window.addEventListener("resize", agenda);
    // as mutações do PRÓPRIO overlay (a pintura mexe em style/textContent) não agendam outra pintura —
    // senão pintar → mutação → pintar em ciclo (revisão v3 do Astra, achado 2)
    const mo = new MutationObserver((recs) => {
      const proprio = raiz.current;
      if (proprio && recs.every((r) => proprio.contains(r.target))) return;
      agenda();
    });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    const t = setInterval(pinta, 500); // rede de segurança: fontes/imagens que mudam a medida sem evento
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseleave", onLeave, true);
      window.removeEventListener("scroll", agenda, true);
      window.removeEventListener("resize", agenda);
      mo.disconnect();
      clearInterval(t);
      cancelAnimationFrame(raf);
    };
  }, [pinta]);
  return (
    <div id="unbox-editor-overlay" ref={raiz} aria-hidden>
      <div className="ux-box ux-sec" style={{ display: "none" }}><span className="ux-chip" /></div>
      <div className="ux-box ux-hover" style={{ display: "none" }}><span className="ux-chip" /></div>
      <div className="ux-box ux-sel" style={{ display: "none" }}><span className="ux-chip" /></div>
    </div>
  );
});

export function EditableProvider({
  doc: initialDoc,
  shop,
  tokens = [],
  editorOrigin,
  apps,
  children,
}: {
  doc: ContentDocument | null;
  shop: string;
  tokens?: EditableTokenSpec[];
  /** Origem do editor (ex.: https://editor.unbox.com.br). Se definida, só ela pode aplicar rascunho. */
  editorOrigin?: string;
  /**
   * APPS (foundation 12): o que a loja tem no AMBIENTE para rastreio, só presença, e o ESTADO da
   * Conversions API do Meta (`EstadoDoCapi`: ativa, sem token, sem Pixel, ou Pixel diferente do token), e o
   * contêiner contratual da Unbox (`unboxGtmId`, público). Vem de
   * `presencaNoAmbiente(process.env, { unboxGtmId: UNBOX_GTM_ID })` (lib/editable/server.ts), calculado no
   * servidor pelo app/layout.tsx com o documento publicado: este componente é de cliente e não enxerga o
   * ambiente. Vai direto no manifesto, para o painel dizer de onde vem cada valor em vigor e o que a CAPI
   * está fazendo, sem nunca ver o valor do ambiente.
   */
  apps?: ManifestApps;
  children: React.ReactNode;
}) {
  const [doc, setDoc] = React.useState<ContentDocument>(initialDoc ?? emptyDocument(shop));
  const [editing, setEditing] = React.useState(false);
  const [selectMode, setSelectMode] = React.useState(true);
  // token de prévia: sai da URL e vive só aqui (ver `previewToken` no contexto)
  const [previewToken, setPreviewToken] = React.useState<string | null>(null);
  const registry = React.useRef(new Map<string, Registration>());
  // um caminho pode ter VÁRIAS instâncias montadas (ícone absoluto compartilhado pelos itens de uma lista):
  // o registro só some quando a última desmonta; até lá outra instância viva responde (Astra v3, achado 9)
  const instancias = React.useRef(new Map<string, Set<Registration>>());
  const sections = React.useRef(new Map<string, SectionRegistration>());
  // editáveis que cairiam na RAIZ do documento: NÃO são editáveis, e o manifesto os declara para o gate
  const semContainer = React.useRef(new Map<string, RegistroForaDeContainer>());
  // catálogo por container: o que o lojista pode ADICIONAR ali. É da LOJA, nunca do editor.
  const tiposPorContainer = React.useRef(new Map<string, TipoDeSecaoDeclarado[]>());
  const selectedEl = React.useRef<Element | null>(null);
  const overlayRef = React.useRef<OverlayHandle | null>(null);
  const docRef = React.useRef(doc);
  docRef.current = doc;

  // publicado mudou (revalidação ISR + navegação) → segue o servidor, fora do modo edição
  React.useEffect(() => {
    if (!editing && initialDoc) setDoc(initialDoc);
  }, [initialDoc, editing]);

  React.useEffect(() => {
    // Só dentro de um iframe e só com a origem do editor configurada: sem isso, um
    // site qualquer abriria a loja num popup com ?unbox_editor=1 e mandaria `apply`
    // (achado 6 da revisão adversarial).
    const dentroDeFrame = typeof window !== "undefined" && window.parent !== window;
    setEditing(detectEditing() && Boolean(editorOrigin) && dentroDeFrame);
    // o token de prévia não fica na URL: GA/Meta mandam document.location inteiro (achado 7).
    // Ele é GUARDADO EM MEMÓRIA antes de sair dali — é com ele que a vitrine pergunta à loja o que
    // a escolha do rascunho vira em produtos. Apagar sem guardar deixava a prévia sem como perguntar.
    try {
      const u = new URL(window.location.href);
      const t = u.searchParams.get("unbox_editor_token");
      if (t) {
        setPreviewToken(t);
        u.searchParams.delete("unbox_editor_token");
        window.history.replaceState(null, "", u.toString());
      }
    } catch {}
  }, [editorOrigin]);

  const post = React.useCallback(
    (msg: Record<string, unknown>) => {
      if (typeof window === "undefined" || window.parent === window || !editorOrigin) return;
      window.parent.postMessage({ source: "unbox-loja", shop, ...msg }, editorOrigin);
    },
    [shop, editorOrigin],
  );

  // Token vencido: o editor emite outro e devolve por `unbox-editor:token`. Só um pedido de cada
  // vez em voo — uma página com seis vitrines não pode disparar seis pedidos pelo mesmo motivo.
  const pedindoToken = React.useRef(false);
  const renovarToken = React.useCallback(() => {
    if (pedindoToken.current) return;
    pedindoToken.current = true;
    post({ type: "unbox-editor:token-expirado" });
    // se o editor não responder (rede caída, sessão dele expirada), a trava cai sozinha: sem isto
    // UMA falha deixaria a prévia sem nunca mais tentar renovar, até recarregar a página
    setTimeout(() => {
      pedindoToken.current = false;
    }, 15_000);
  }, [post]);

  const buildManifest = React.useCallback((): Manifest => {
    const d = docRef.current;
    // a PÁGINA vai em cada linha, não só no topo: o editor funde manifestos de páginas diferentes, e
    // sem isto a origem de cada linha some na fusão (foundation 11)
    const pagina = normalizarPagina(typeof window !== "undefined" ? window.location.pathname : "/");
    const entries: ManifestEntry[] = [];
    for (const r of registry.current.values()) {
      const el = r.el();
      const sec = el?.closest("[data-editor-section]") as HTMLElement | null;
      entries.push({
        path: r.path,
        type: r.type,
        label: r.label,
        section: sec?.dataset.editorSection,
        container: sec?.dataset.editorContainer,
        pagina,
        fallback: r.fallback,
        current: d.values[r.path],
      });
    }
    // ordem visual = ordem no DOM
    const pos = (a: Element | null, b: Element | null) => {
      if (!a || !b) return 0;
      const c = a.compareDocumentPosition(b);
      return c & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : c & Node.DOCUMENT_POSITION_PRECEDING ? 1 : 0;
    };
    const elOf = new Map(entries.map((e) => [e.path, registry.current.get(e.path)?.el() ?? null]));
    entries.sort((a, b) => pos(elOf.get(a.path) ?? null, elOf.get(b.path) ?? null));
    // caixa visível agora? (resposta fechada do FAQ, slide oculto, gaveta): a ficha da seção precisa saber
    for (const e of entries) {
      const el = elOf.get(e.path);
      const r = el?.getBoundingClientRect();
      e.visible = Boolean(r && (r.width > 0 || r.height > 0));
    }
    const secs = [...sections.current.values()]
      .map((s) => ({ ...s, node: s.el() }))
      .sort((a, b) => pos(a.node, b.node))
      .map((s) => ({
        container: s.container,
        id: s.id,
        label: s.label,
        pagina,
        semLayout: s.semLayout || undefined,
        hidden: (d.sections[s.container]?.hidden ?? []).includes(s.id),
        fixed: s.fixed || undefined,
        clone: s.clone || undefined,
        criada: s.criada || undefined,
        tipo: s.tipo,
        kind: s.kind,
        item: s.item || undefined,
        ordemNoCodigo: s.ordemNoCodigo,
        // a linha do painel fala o conteúdo: o primeiro texto editável que a seção mostra
        excerpt: trechoDaSecao(s.node),
        background: fundoEmUso(s.node?.firstElementChild ?? null),
      }));
    const cs = typeof window !== "undefined" ? getComputedStyle(document.documentElement) : null;
    // `original` = a cor do código, lida com a folha do rascunho desligada: é o que um "reset" devolve
    const folha = typeof document !== "undefined" ? (document.querySelector("style[data-editor-tokens]") as HTMLStyleElement | null) : null;
    let originais: Record<string, string | undefined> = {};
    if (cs) {
      if (folha) folha.disabled = true;
      originais = Object.fromEntries(tokens.map((t) => [t.token, cs.getPropertyValue(t.token).trim() || undefined]));
      if (folha) folha.disabled = false;
    }
    const toks = tokens.map((t) => ({ ...t, current: cs?.getPropertyValue(t.token).trim() || undefined, original: originais[t.token] }));
    // os tipos que esta loja declara saber instanciar, achatados com o container de cada catálogo
    const tipos: ManifestSectionType[] = [...tiposPorContainer.current.entries()].flatMap(([container, lista]) => lista.map((t) => ({ container, ...t })));
    // a versão diz ao editor o que esta loja sabe renderizar (cópias, inline, estilo por elemento)
    // 3 = fundo por seção e cores computadas na seleção (2 = inline, estilo por elemento, cópias, Icon)
    // 7 = tipo "video" no documento (Editable.Video): abaixo disso o painel não oferece troca de vídeo,
    //     porque a loja não tem caminho de tipo video e a operação só produziria erro de validação
    // 8 = seções ADICIONADAS (`add_section` + `Editable.Sections catalogo`): uma loja abaixo de 8 não
    //     renderiza `sections[container].criadas`, então o editor não pode oferecer o "+" ali — a seção
    //     entraria no documento e simplesmente não apareceria na tela
    // 9 = BLOCO DE HTML (`Editable.Html`): tipo "html" no documento e sufixo `.html` no caminho. Abaixo
    //     de 9 a loja não tem nem o primitivo nem a lista de recusa — o painel não pode oferecer o campo
    //     de colar HTML, porque o valor entraria no documento e a loja renderizaria só o do código
    // 10 = VITRINE RESOLVIDA NA PRÉVIA: a loja tem `POST /api/unbox/vitrine` e o primitivo pergunta a
    //     ela o que a escolha do RASCUNHO vira em produtos. Abaixo de 10 a prévia só muda depois de
    //     publicar — por isso o editor recarrega o iframe ao aplicar uma vitrine nessas lojas, e não
    //     nesta: aqui a troca aparece na hora
    // 11 = cada linha do manifesto diz de que PÁGINA veio (`pagina`), a lista de seções diz quando a
    //      página só REAPROVEITA o container (`semLayout`), e a RAIZ do documento deixou de ser
    //      gravável: editável fora de container não se registra, e o manifesto o declara em
    //      `semContainer`. Abaixo de 11 o editor não pode confiar na página de cada linha ao fundir
    //      manifestos de páginas diferentes, porque ela simplesmente não vem.
    // 12 = APPS: RASTREIO E MARKETING. A loja lê `doc.apps.rastreio` (`rastreioEmVigor`, pelo `<Rastreio>`
    //      de rastreio.tsx que o app/layout.tsx chama) e o manifesto diz o que ela tem no ambiente
    //      (`apps.rastreio`, só presença).
    //      Abaixo de 12 a loja não lê `apps`: o valor entraria no documento e nenhum script mudaria na
    //      página, e é por isso que `validateOp` recusa `set_app` contra um manifesto sem esta versão.
    const fora: ManifestSemContainer[] = [...semContainer.current.values()].map((r) => ({ ...r, pagina }));
    return { shop, capturedAt: new Date().toISOString(), url: pagina, foundation: 12, entries, sections: secs, tipos, semContainer: fora, tokens: toks, ...(apps ? { apps } : {}) };
  }, [shop, tokens, apps]);

  // manifesto: publica depois que os registros assentam (debounce)
  const manifestTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleManifest = React.useCallback(() => {
    if (!editing) return;
    if (manifestTimer.current) clearTimeout(manifestTimer.current);
    manifestTimer.current = setTimeout(() => post({ type: "unbox-editor:manifest", manifest: buildManifest() }), 250);
  }, [editing, post, buildManifest]);

  const register = React.useCallback(
    (r: Registration) => {
      const conjunto = instancias.current.get(r.path) ?? new Set<Registration>();
      conjunto.add(r);
      instancias.current.set(r.path, conjunto);
      registry.current.set(r.path, r);
      scheduleManifest();
      return () => {
        conjunto.delete(r);
        if (conjunto.size === 0) {
          registry.current.delete(r.path);
          instancias.current.delete(r.path);
        } else if (registry.current.get(r.path) === r) {
          registry.current.set(r.path, [...conjunto].at(-1)!);
        }
        scheduleManifest();
      };
    },
    [scheduleManifest],
  );
  // a MESMA seção pode estar montada duas vezes (a faixa de anúncio no cabeçalho desktop e no mobile):
  // o registro só some quando a última instância desmonta, senão a lista da página fica incompleta e o
  // editor passa a achar que a seção não existe (verificação v3.7 do Astra, achado 2)
  const instanciasDeSecao = React.useRef(new Map<string, Set<SectionRegistration>>());
  const registerSection = React.useCallback(
    (r: SectionRegistration) => {
      const key = `${r.container}/${r.id}`;
      const conjunto = instanciasDeSecao.current.get(key) ?? new Set<SectionRegistration>();
      conjunto.add(r);
      instanciasDeSecao.current.set(key, conjunto);
      sections.current.set(key, r);
      scheduleManifest();
      return () => {
        conjunto.delete(r);
        if (conjunto.size === 0) {
          sections.current.delete(key);
          instanciasDeSecao.current.delete(key);
        } else if (sections.current.get(key) === r) {
          sections.current.set(key, [...conjunto].at(-1)!);
        }
        scheduleManifest();
      };
    },
    [scheduleManifest],
  );

  // o catálogo do container é declarado uma vez por `Editable.Sections`; o último a registrar manda
  // (a loja tem um catálogo por container, não vários), e desmontar só apaga o que ainda é o dele
  const registerTipos = React.useCallback(
    (container: string, tipos: TipoDeSecaoDeclarado[]) => {
      tiposPorContainer.current.set(container, tipos);
      scheduleManifest();
      return () => {
        if (tiposPorContainer.current.get(container) === tipos) tiposPorContainer.current.delete(container);
        scheduleManifest();
      };
    },
    [scheduleManifest],
  );

  // O DEFEITO SE DECLARA (foundation 11). Um mesmo caminho pode aparecer em várias instâncias soltas
  // (dez itens da mesma faixa): a chave é o caminho, e a última a desmontar limpa.
  const instanciasForaDeContainer = React.useRef(new Map<string, number>());
  const foraDeContainer = React.useCallback((r: RegistroForaDeContainer) => {
    const n = instanciasForaDeContainer.current.get(r.path) ?? 0;
    instanciasForaDeContainer.current.set(r.path, n + 1);
    semContainer.current.set(r.path, r);
    scheduleManifest();
    return () => {
      const atual = (instanciasForaDeContainer.current.get(r.path) ?? 1) - 1;
      if (atual <= 0) {
        instanciasForaDeContainer.current.delete(r.path);
        semContainer.current.delete(r.path);
      } else instanciasForaDeContainer.current.set(r.path, atual);
      scheduleManifest();
    };
  }, [scheduleManifest]);

  const select = React.useCallback(
    (entry: ManifestEntry, el: Element) => {
      if (selectedEl.current) selectedEl.current.removeAttribute("data-editor-selected");
      selectedEl.current = el;
      el.setAttribute("data-editor-selected", "1");
      overlayRef.current?.marcarSelecionado(el as HTMLElement, entry);
      const r = el.getBoundingClientRect();
      const sec = el.closest("[data-editor-section]") as HTMLElement | null;
      const cs = getComputedStyle(el);
      const fundo = fundoEmUso(el);
      // texto semitransparente é composto sobre o fundo em uso (rgba(255,0,0,.5) sobre branco = rosa)
      const cor = rgba(cs.color);
      const corHex = cor ? (cor[3] >= 1 ? hex(cor) : fundo && rgba(fundo) ? hex([0, 1, 2].map((i) => cor[i] * cor[3] + rgba(fundo)![i] * (1 - cor[3])).concat([1]) as [number, number, number, number]) : undefined) : undefined;
      post({
        type: "unbox-editor:select",
        entry: { ...entry, section: sec?.dataset.editorSection, container: sec?.dataset.editorContainer, current: docRef.current.values[entry.path], computed: { color: corHex, background: fundo } },
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      });
    },
    [post],
  );

  // ponte: mensagens do editor
  React.useEffect(() => {
    if (!editing) return;
    const onMessage = (ev: MessageEvent) => {
      if (editorOrigin && ev.origin !== editorOrigin) return;
      const m = ev.data as { source?: string; type?: string; doc?: ContentDocument; on?: boolean; path?: string; section?: string; container?: string; token?: string } | null;
      if (!m || m.source !== "unbox-editor") return;
      switch (m.type) {
        case "unbox-editor:apply":
          if (m.doc && m.doc.schema === 1) setDoc(m.doc);
          break;
        case "unbox-editor:token":
          // token de prévia novo (resposta a `renovarToken`). Trocá-lo faz a vitrine que falhou
          // por 401 tentar de novo sozinha — o efeito dela depende deste valor.
          pedindoToken.current = false;
          if (typeof m.token === "string" && m.token) setPreviewToken(m.token);
          break;
        case "unbox-editor:select-mode":
          setSelectMode(Boolean(m.on));
          break;
        case "unbox-editor:show-editables":
          document.documentElement.setAttribute("data-editor-mostrar-editaveis", (m as { on?: boolean }).on ? "1" : "0");
          break;
        case "unbox-editor:inline-result": {
          // o editor recusou (ou o lojista cancelou a declaração): o texto digitado sai do DOM.
          // Cada edição tem o próprio id: duas confirmações em trânsito são resolvidas cada uma
          // pela sua resposta (um editor antigo, sem id, é atendido pelo caminho)
          const r = m as { path?: string; ok?: boolean; inlineId?: number };
          const pend = inlinePendentes.current;
          const id = typeof r.inlineId === "number" ? r.inlineId : [...pend.keys()].find((k) => pend.get(k)?.path === r.path);
          const u = id != null ? pend.get(id) : undefined;
          if (u) {
            // restaura a partir do DOCUMENTO (a verdade), não do texto capturado no clique: uma edição
            // mais nova no mesmo caminho pode já ter sido aplicada
            if (r.ok === false) {
              const reg = registry.current.get(u.path);
              const atual = reg ? resolveValue(docRef.current, u.path, reg.fallback) : undefined;
              u.el.innerText = typeof atual === "string" ? atual : u.original;
            }
            pend.delete(id!);
          }
          break;
        }
        case "unbox-editor:ping":
          post({ type: "unbox-editor:manifest", manifest: buildManifest() });
          break;
        case "unbox-editor:scroll-to": {
          // container + id: "uso-1" existe em duas colunas; sem container, a primeira ocorrência (como antes)
          const seletorSecao = m.section ? `${m.container ? `[data-editor-container="${CSS.escape(m.container)}"]` : ""}[data-editor-section="${CSS.escape(m.section)}"]` : "";
          const target = m.path
            ? document.querySelector(`[data-editor-path="${CSS.escape(m.path)}"]`)
            : seletorSecao
              ? document.querySelector(seletorSecao)?.firstElementChild
              : null;
          for (let d = target?.closest("details"); d; d = d.parentElement?.closest("details") ?? null) d.open = true;
          if (!m.path && seletorSecao) overlayRef.current?.marcarSecao(document.querySelector(seletorSecao) as HTMLElement | null);
          // aba oculta não anima (sem quadros): rola direto, senão a prévia nunca chega lá
          target?.scrollIntoView({ behavior: document.visibilityState === "hidden" ? "auto" : "smooth", block: "center" });
          if (target && m.path) {
            const r = registry.current.get(m.path);
            if (r) select({ path: r.path, type: r.type, label: r.label, fallback: r.fallback }, target);
          }
          break;
        }
      }
    };
    window.addEventListener("message", onMessage);
    post({ type: "unbox-editor:ready", url: window.location.href });
    scheduleManifest();
    return () => window.removeEventListener("message", onMessage);
  }, [editing, editorOrigin, post, buildManifest, scheduleManifest, select]);

  // em modo seleção, clique escolhe o elemento em vez de navegar; texto vira
  // editável ali mesmo (contentEditable): Enter confirma, Esc cancela, Shift+Enter
  // quebra linha. O valor só sai daqui ao confirmar — quem grava é o editor.
  const editandoRef = React.useRef<{ el: HTMLElement; path: string; original: string } | null>(null);
  // edições inline em trânsito (por id), para restaurar o texto se o editor recusar (honestidade cancelada, erro)
  const inlinePendentes = React.useRef(new Map<number, { el: HTMLElement; path: string; original: string }>());
  const inlineSeq = React.useRef(0);
  const encerrarInline = React.useCallback(
    (confirmar: boolean) => {
      const e = editandoRef.current;
      if (!e) return;
      editandoRef.current = null;
      const novo = e.el.innerText.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      e.el.removeAttribute("contenteditable");
      e.el.removeAttribute("data-editor-editing");
      if (confirmar && novo && novo !== e.original) {
        const inlineId = ++inlineSeq.current;
        inlinePendentes.current.set(inlineId, e);
        post({ type: "unbox-editor:inline", path: e.path, value: novo, inlineId });
      } else e.el.innerText = e.original; // volta ao que estava (o React reconcilia no próximo apply)
    },
    [post],
  );
  React.useEffect(() => {
    if (!editing || !selectMode) return;
    const onClick = (ev: MouseEvent) => {
      const t = ev.target as Element | null;
      const el = t?.closest("[data-editor-path]") as HTMLElement | null;
      if (editandoRef.current && el === editandoRef.current.el) return; // clique dentro do texto em edição
      // acordeão (FAQ): o clique seleciona a pergunta E abre a resposta, senão ela nunca aparece para editar
      const sumario = t?.closest("summary");
      if (sumario?.parentElement instanceof HTMLDetailsElement) sumario.parentElement.open = true;
      ev.preventDefault();
      ev.stopPropagation();
      if (editandoRef.current) encerrarInline(true);
      if (!el) {
        // clique em área "morta": nunca cai no vazio — seleciona a seção envolvente
        const sec = t?.closest("[data-editor-section]") as HTMLElement | null;
        if (sec) {
          overlayRef.current?.marcarSecao(sec);
          post({ type: "unbox-editor:select-section", container: sec.dataset.editorContainer, id: sec.dataset.editorSection, label: sec.dataset.editorLabel, kind: sec.dataset.editorKind });
        }
        return;
      }
      const r = registry.current.get(el.dataset.editorPath ?? "");
      if (!r) return;
      select({ path: r.path, type: r.type, label: r.label, fallback: r.fallback }, el);
      if (r.type === "text" && !el.querySelector("img,svg,video,input,button")) {
        editandoRef.current = { el, path: r.path, original: el.innerText };
        el.setAttribute("contenteditable", "plaintext-only");
        el.setAttribute("data-editor-editing", "1");
        el.focus();
        // texto todo selecionado: digitar substitui; um segundo clique posiciona o cursor
        try {
          const range = document.createRange();
          range.selectNodeContents(el);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        } catch {}
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      const e = editandoRef.current;
      if (!e || ev.target !== e.el) return;
      if (ev.key === "Escape") {
        ev.preventDefault();
        encerrarInline(false);
      } else if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        encerrarInline(true);
      }
    };
    const onBlur = (ev: FocusEvent) => {
      if (editandoRef.current && ev.target === editandoRef.current.el) encerrarInline(true);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("blur", onBlur, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("blur", onBlur, true);
    };
  }, [editing, selectMode, select, encerrarInline]);

  // manifesto também quando o documento muda (hidden/order refletem)
  React.useEffect(() => {
    scheduleManifest();
  }, [doc, scheduleManifest]);

  const value = React.useMemo<Ctx>(
    // `container: undefined` de propósito: a raiz do provider não é a home. Quem quer editar declara
    // o container da sua página (`Editable.Sections container="sobre"`); quem não declara não edita.
    () => ({ doc, editing, selectMode, scope: [], container: undefined, layout: true, register, registerSection, registerTipos, select, foraDeContainer, previewToken, renovarToken }),
    [doc, editing, selectMode, register, registerSection, registerTipos, select, foraDeContainer, previewToken, renovarToken],
  );

  // tokens editados → :root. Só os da allowlist da loja.
  const allowed = React.useMemo(() => new Set(tokens.map((t) => t.token)), [tokens]);
  // segunda trava, no cliente: só token da allowlist E só valor em formato de cor —
  // este texto entra num <style> cru, então o formato fechado é a defesa.
  const tokenCss = Object.entries(doc.tokens ?? {})
    .filter(([k, v]) => allowed.has(k) && /^--[a-z0-9-]+$/.test(k) && typeof v === "string" && isColor(v))
    .map(([k, v]) => `${k}:${v.trim()}`)
    .join(";");

  return (
    <EditableContext.Provider value={value}>
      {tokenCss ? <style data-editor-tokens="">{`:root{${tokenCss}}`}</style> : null}
      <style data-editor-base="">{SECTION_CSS}</style>
      {editing ? <style data-editor-css="" dangerouslySetInnerHTML={{ __html: EDITING_CSS }} /> : null}
      {editing && selectMode ? <Overlay ref={overlayRef} /> : null}
      {children}
    </EditableContext.Provider>
  );
}

/** Escopo de caminho: tudo que estiver dentro ganha o prefixo. */
export function EditableScope({ path, children }: { path: string; children: React.ReactNode }) {
  const ctx = useEditableContext();
  const value = React.useMemo(() => ({ ...ctx, scope: [...ctx.scope, path] }), [ctx, path]);
  return <EditableContext.Provider value={value}>{children}</EditableContext.Provider>;
}

export function useEditableScopeValue(container: string, section: string | undefined, scope: string[]) {
  const ctx = useEditableContext();
  return React.useMemo(() => ({ ...ctx, container, section, scope }), [ctx, container, section, scope]);
}

export const EditableContextProvider = EditableContext.Provider;
