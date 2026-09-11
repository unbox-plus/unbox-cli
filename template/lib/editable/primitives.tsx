"use client";

// ═══════════════════════════════════════════════════════════════════════════
// PRIMITIVOS EDITÁVEIS — a regra das "4 latas".
//
// Editabilidade não é um catálogo de seções: é uma propriedade de COMO a seção
// é escrita. Onde o construtor escreveria `<h2>{TITULO}</h2>`, escreve
// `<Editable.Text path="titulo" fallback={TITULO} as="h2" />`. Se a home
// decidiu não ter banner e ter quatro latas, cada lata é um `Editable.Image`
// e o lojista clica na lata e troca a foto. Nenhuma lista central precisa saber
// que a lata existe: ela se registra sozinha e aparece no manifesto.
//
// Em produção os primitivos renderizam o elemento puro (mesmo HTML de antes).
// Só em modo edição ganham `data-editor-*`.
// ═══════════════════════════════════════════════════════════════════════════
import * as React from "react";
import Image, { type ImageProps } from "next/image";
import Link from "next/link";
import { caminhoTemContainer, type EditableType, type EditableValue, type ImageValue, type LinkValue, linksExternosEmNovaAba, type PreviaDaVitrine, produtosDaVitrine, recusaDeHtml, recusaDeTextoRico, type SectionKind, SUFIXO_HTML, SUFIXO_RICO, joinPath, resolveStyle, resolveValue, vitrineValida, type VitrineValue } from "./document";
import { EditableContextProvider, EditableFatia, useEditableContext } from "./provider";

/**
 * RECADO PARA QUEM CONSTRUIU A LOJA, só em desenvolvimento e uma vez por defeito. Não é recado para o
 * lojista: ele não tem como consertar um container que ninguém declarou, e a tela dele não conta a
 * história interna do sistema. Quem vê isto é o construtor (console do `next dev`) e o gate.
 */
const jaAvisado = new Set<string>();
function avisarConstrutor(chave: string, mensagem: string) {
  if (process.env.NODE_ENV === "production") return;
  if (jaAvisado.has(chave)) return;
  jaAvisado.add(chave);
  console.error(mensagem);
}
function avisoForaDeContainer(full: string, label?: string) {
  return `[Editable] o editável "${full}"${label ? ` (${label})` : ""} está fora de qualquer container: ele gravaria na raiz do documento, onde o mesmo nome valeria para o site inteiro e bateria com o de outra página. A loja deixou o valor do código na tela e NÃO o tornou editável. Envolva esta seção em <Editable.Section id="..."> dentro de um <Editable.Sections container="<a-página>">.`;
}

function useRegistration<T extends EditableValue>(path: string, type: EditableType, fallback: T, label?: string) {
  const ctx = useEditableContext();
  const full = joinPath(ctx.scope, path);
  const ref = React.useRef<Element | null>(null);
  // FORA DE CONTAINER = FORA DO DOCUMENTO (foundation 11). Este caminho cairia na RAIZ, onde valeria
  // para o site inteiro e colidiria com o de outra página (duas seções soltas gravando `titulo`). A
  // loja não o registra e IGNORA o documento nele: renderiza o literal do código, íntegra. Quem
  // reclama é o console em desenvolvimento e o gate, pelo manifesto. Ver `caminhoTemContainer`.
  const semContainer = !caminhoTemContainer(ctx.container, ctx.scope, path);
  const value = semContainer ? fallback : resolveValue(ctx.doc, full, fallback);
  const { editing, register, foraDeContainer } = ctx;
  // no servidor não roda efeito: o aviso sai no terminal do `next dev` durante o render, uma vez por
  // caminho, para o construtor ver sem abrir o console do navegador
  if (semContainer && typeof window === "undefined") avisarConstrutor(`path:${full}`, avisoForaDeContainer(full, label));
  // fallback por valor (não por referência) pra não re-registrar a cada render
  const fallbackKey = JSON.stringify(fallback);
  React.useEffect(() => {
    if (!editing || semContainer) return;
    return register({ path: full, type, label, fallback: JSON.parse(fallbackKey) as T, el: () => ref.current });
  }, [editing, register, full, type, label, fallbackKey, semContainer]);
  React.useEffect(() => {
    if (!semContainer) return;
    avisarConstrutor(`path:${full}`, avisoForaDeContainer(full, label));
    if (!editing) return;
    return foraDeContainer({ path: full, type, label });
  }, [semContainer, editing, foraDeContainer, full, type, label]);
  const attrs =
    editing && !semContainer
      ? ({ "data-editor-path": full, "data-editor-type": type, "data-editor-label": label } as Record<string, string | undefined>)
      : {};
  // cor/fundo SÓ deste elemento, por cima do token ("desacoplar do mapa de cores")
  const style = semContainer ? undefined : resolveStyle(ctx.doc, full);
  // valor CRU do documento, sem o fallback e sem a defesa do `resolveValue`. Só o bloco de HTML usa:
  // é com ele que o primitivo consegue DIZER "o que você colou foi recusado" em vez de mostrar o
  // conteúdo do código calado — trocar em silêncio é o que a casa não faz.
  const guardado = semContainer ? undefined : ctx.doc?.values[full];
  return { value, ref, attrs, editing, full, style, guardado };
}

/** Valor editável que não vira elemento (cor de fundo, href de um botão, flag). */
export function useEditable<T extends EditableValue>(path: string, fallback: T, opts?: { type?: EditableType; label?: string }): T {
  const type = opts?.type ?? (typeof fallback === "string" ? "text" : "src" in (fallback as object) ? "image" : "link");
  return useRegistration(path, type, fallback, opts?.label).value;
}

type TextProps = {
  path: string;
  fallback: string;
  label?: string;
  as?: React.ElementType;
  /** quebra de linha vira <br/>; sem isso, "\n" é espaço */
  multiline?: boolean;
} & Omit<React.HTMLAttributes<HTMLElement>, "children">;

function Text({ path, fallback, label, as = "span", multiline = false, style: styleProp, ...rest }: TextProps) {
  const { value, ref, attrs, style } = useRegistration(path, "text", fallback, label);
  const Tag = as as React.ElementType;
  const estilo = style || styleProp ? { ...(styleProp ?? {}), ...(style ?? {}) } : undefined;
  const content = multiline
    ? value.split("\n").map((line, i, arr) => (
        <React.Fragment key={i}>
          {line}
          {i < arr.length - 1 ? <br /> : null}
        </React.Fragment>
      ))
    : value;
  return (
    <Tag ref={ref} {...attrs} {...rest} style={estilo}>
      {content}
    </Tag>
  );
}

type EditableImageProps = {
  path: string;
  fallback: ImageValue;
  label?: string;
} & Omit<ImageProps, "src" | "alt">;

/** next/image com src/alt editáveis. Todas as outras props (fill, sizes, priority…) passam direto. */
function EditableImage({ path, fallback, label, ...rest }: EditableImageProps) {
  const { value, ref, attrs } = useRegistration(path, "image", fallback, label);
  const v = value as ImageValue;
  return <Image ref={ref as React.Ref<HTMLImageElement>} src={v.src} alt={v.alt ?? fallback.alt ?? ""} {...attrs} {...rest} />;
}

type EditableImgProps = {
  path: string;
  fallback: ImageValue;
  label?: string;
} & Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">;

/**
 * `<img>` PURO com src/alt editáveis — pra onde o next/image mudaria o HTML
 * (assets da marca servidos direto de /public, `<picture>` com duas artes,
 * logo sem width/height). Rende exatamente o `<img>` de antes; o resto das
 * props (className, width, height, loading…) passa direto.
 */
function EditableImg({ path, fallback, label, ...rest }: EditableImgProps) {
  const { value, ref, attrs } = useRegistration(path, "image", fallback, label);
  const v = value as ImageValue;
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref as React.Ref<HTMLImageElement>} src={v.src} alt={v.alt ?? fallback.alt ?? ""} {...attrs} {...rest} />;
}

type EditableLinkProps = {
  path: string;
  fallback: LinkValue;
  label?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "href" | "children">;

/** next/link com href (e opcionalmente o rótulo) editáveis. Com children, o rótulo vem deles. */
function EditableLink({ path, fallback, label, children, style: styleProp, ...rest }: EditableLinkProps) {
  const { value, ref, attrs, style } = useRegistration(path, "link", fallback, label);
  const v = value as LinkValue;
  const estilo = style || styleProp ? { ...(styleProp ?? {}), ...(style ?? {}) } : undefined;
  return (
    <Link ref={ref as React.Ref<HTMLAnchorElement>} href={v.href} {...attrs} {...rest} style={estilo}>
      {v.label !== undefined && v.label !== fallback.label ? v.label : (children ?? v.label ?? fallback.label)}
    </Link>
  );
}

/**
 * Válvula de escape: qualquer elemento vira editável por render-prop.
 * `<Editable.Slot path="fundo" type="image" fallback={{src}}>{(v, attrs, ref) => <div ref={ref} {...attrs} style={{backgroundImage:`url(${v.src})`}} />}</Editable.Slot>`
 */
function Slot<T extends EditableValue>({
  path,
  type,
  fallback,
  label,
  children,
}: {
  path: string;
  type: EditableType;
  fallback: T;
  label?: string;
  /** o 4º argumento é a cor/fundo que o lojista deu SÓ a este elemento — aplique em `style` */
  children: (value: T, attrs: Record<string, string | undefined>, ref: React.RefCallback<Element>, style?: { color?: string; background?: string }) => React.ReactNode;
}) {
  const { value, ref, attrs, style } = useRegistration(path, type, fallback, label);
  const setRef = React.useCallback<React.RefCallback<Element>>(
    (el) => {
      ref.current = el;
    },
    [ref],
  );
  return <>{children(value as T, attrs, setRef, style)}</>;
}

/**
 * VITRINE: quais produtos a seção mostra. O documento guarda só a ESCOLHA (categoria da Unbox, lista de
 * produtos ou busca); quem resolve isso em produtos é a LOJA, no servidor, com o cliente da Unbox que ela já
 * usa — o editor nunca vê credencial nem catálogo, e preço/estoque continuam vindo do painel.
 *
 * Uso na loja (a escolha é lida no servidor com `escolhaDaVitrine`, os produtos são buscados lá, e este
 * primitivo registra o caminho para o editor poder trocar):
 *
 *   <Editable.Vitrine path="vitrine" label="Produtos desta vitrine" fallback={{ modo: "produtos", produtos: ids }}>
 *     {(escolha, attrs, ref, previa) => <div ref={ref} {...attrs}>{cards(previa?.produtos ?? doServidor)}</div>}
 *   </Editable.Vitrine>
 *
 * ── NA PRÉVIA É DIFERENTE, e é por isso que existe o 4º argumento ──────────────────────────────
 * O rascunho não passa pelo servidor da loja: ele chega ao iframe por `postMessage` e vive no
 * CLIENTE. Então, em modo edição, este primitivo pergunta à PRÓPRIA LOJA (`POST /api/unbox/vitrine`,
 * autenticada pelo token do editor) o que a escolha do rascunho vira em produtos, e entrega o
 * resultado em `previa`. Sem isso o lojista escolhia cinco produtos, clicava em aplicar e a tela não
 * mudava — numa loja que nunca publicou, não mudava nunca.
 *
 * O 4º argumento é ACRÉSCIMO: em produção ele é `undefined` e um render-prop que só recebe
 * `(escolha, attrs, ref)` continua valendo, byte por byte, como antes.
 *
 * ── SEÇÃO PRESA A UM PRODUTO SÓ ───────────────────────────────────────────────────────────────
 * O mesmo primitivo, sem tipo novo: `fallback={vinculoDeProduto(slug)}` (modo `produtos`, um item,
 * `limite: 1`) e a seção lê `produtoDoVinculo(previa, doServidor)` — o primeiro produto que voltar.
 * É assim que o bloco de um variante, um card da grade ou o combo deixam o lojista TROCAR o produto
 * que aparece ali, com o mesmo seletor e a mesma rota da vitrine de vários.
 */
function Vitrine({
  path,
  label,
  fallback,
  children,
}: {
  path: string;
  label?: string;
  /** o que o CÓDIGO mostra quando o lojista ainda não escolheu */
  fallback: VitrineValue;
  /**
   * O 4º argumento é a PRÉVIA: os produtos que a escolha do rascunho vira, buscados na loja aqui
   * mesmo, no navegador. Ele é `undefined` em produção — lá quem resolve é o servidor, e o
   * render-prop segue recebendo exatamente os três argumentos de sempre.
   */
  children: (escolha: VitrineValue, attrs: Record<string, string | undefined>, ref: React.RefCallback<Element>, previa?: PreviaDaVitrine) => React.ReactNode;
}) {
  const { value, ref, attrs, editing, guardado } = useRegistration(path, "vitrine", fallback, label);
  const { previewToken, renovarToken } = useEditableContext();
  const setRef = React.useCallback<React.RefCallback<Element>>((el) => {
    ref.current = el;
  }, [ref]);

  // A ESCOLHA DO RASCUNHO, e só ela. Sem valor no documento não há o que perguntar: a seção mostra o
  // que o CÓDIGO mostra, e disparar uma consulta para descobrir isso seria pedir à Unbox uma coisa
  // que já está na tela. Vai como string porque é o que entra na lista de dependências do efeito:
  // objeto novo a cada render re-dispararia a busca para sempre.
  const chave = editing && vitrineValida(guardado) ? JSON.stringify(guardado) : "";
  const [previa, setPrevia] = React.useState<PreviaDaVitrine>(PREVIA_PARADA);

  React.useEffect(() => {
    if (!chave) {
      setPrevia(PREVIA_PARADA);
      return;
    }
    if (!previewToken) {
      // Sem o token na URL (link colado à mão) não há como perguntar à loja. O lojista lê o MESMO
      // aviso de qualquer outra falha, porque a saída dele é a mesma: recarregar a prévia. POR QUE o
      // pedido não saiu é assunto nosso, e a tarja da loja não é lugar de contar isso.
      setPrevia({ produtos: null, carregando: false, erro: ERRO_VITRINE });
      return;
    }
    const ac = new AbortController();
    let vivo = true;
    // os produtos de antes ficam na tela enquanto o novo pedido corre: piscar para vazio e voltar é
    // pior de ler do que a lista antiga com o aviso de "buscando" em cima
    setPrevia((p) => ({ produtos: p.produtos, carregando: true, erro: null }));
    // trocar a escolha letra a letra (ou clicar em cinco produtos seguidos) não pode virar cinco
    // pedidos: o último ganha, e o anterior é ABORTADO pela limpeza deste efeito
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/unbox/vitrine", {
            method: "POST",
            headers: { "content-type": "application/json", "x-editor-token": previewToken },
            body: JSON.stringify({ escolha: JSON.parse(chave) as VitrineValue }),
            signal: ac.signal,
            cache: "no-store",
          });
          const corpo = (await res.json().catch(() => null)) as { produtos?: unknown; error?: unknown } | null;
          if (res.status === 401) {
            // token de prévia vencido (ele vale 15 min): pede outro ao editor. Quando ele chegar,
            // `previewToken` muda e este efeito roda de novo sozinho. A renovação é mecânica NOSSA e
            // não é narrada ao lojista: ele lê o aviso único, que some sozinho se o token novo vier.
            renovarToken();
            throw new Error(ERRO_VITRINE);
          }
          if (!res.ok) throw new Error(typeof corpo?.error === "string" && corpo.error ? corpo.error : ERRO_VITRINE);
          const produtos = produtosDaVitrine(corpo);
          // resposta fora do contrato é ERRO, não vitrine vazia: fingir que não há produto é como o
          // lojista acaba publicando uma seção em branco sem nunca ter sido avisado
          if (!produtos) throw new Error(ERRO_VITRINE);
          if (vivo) setPrevia({ produtos, carregando: false, erro: null });
        } catch (err) {
          if (ac.signal.aborted || !vivo) return; // pedido cancelado por outro mais novo: não é falha
          setPrevia({ produtos: null, carregando: false, erro: err instanceof Error ? err.message : ERRO_VITRINE });
        }
      })();
    }, ESPERA_VITRINE_MS);
    return () => {
      vivo = false;
      clearTimeout(timer);
      ac.abort();
    };
  }, [chave, previewToken, renovarToken]);

  // ESCOLHA QUE NÃO ACHOU NADA. Lista vazia é resposta legítima da loja ("hoje essa escolha não
  // mostra produto nenhum"), e é o caso em que a tela NÃO muda depois de aplicar: a seção cai nos
  // produtos do código, que é o que a página publicada também faria. Sem dizer isso, o lojista lê
  // "não funcionou" — a mesma leitura que fez a função inteira parecer quebrada no teste do dono.
  const vazia = Boolean(previa.produtos && previa.produtos.length === 0 && !previa.carregando && !previa.erro);

  return (
    <>
      {editing && (previa.carregando || previa.erro || vazia) ? <AvisoDaVitrine carregando={previa.carregando} erro={previa.erro} vazia={vazia} /> : null}
      {children(value as VitrineValue, attrs, setRef, editing ? previa : undefined)}
    </>
  );
}

/**
 * UM aviso para toda falha de busca. Token vencido, token ausente e resposta fora do contrato são
 * três defeitos NOSSOS com uma única saída para o lojista — recarregar a prévia. Três frases
 * diferentes para a mesma coisa a fazer só ensinam a ele o nosso encanamento.
 */
const ERRO_VITRINE = "Não consegui buscar os produtos na loja agora.";

/** Nada resolvido pela prévia: a seção mostra o que o servidor entregou (ou o que o código traz). */
const PREVIA_PARADA: PreviaDaVitrine = { produtos: null, carregando: false, erro: null };

/** Espera antes de perguntar à loja. Clicar em vários produtos seguidos vira UM pedido. */
const ESPERA_VITRINE_MS = 300;

/**
 * A tarja de estado da vitrine, SÓ em modo edição.
 *
 * Ela existe porque o lojista clicou em "aplicar" e precisa ver que algo está acontecendo: sem
 * isso, a espera da Unbox é indistinguível de "não funcionou" — que foi exatamente a leitura do
 * dono no teste. Estilo em `style` inline de propósito: o primitivo não pode depender do CSS da
 * loja, e em produção esta tarja não existe.
 */
// A tarja é ferramenta do EDITOR, não copy da loja: `data-editor-ignore` tira do gate de cobertura
// o texto dela — senão "Buscando os produtos na loja…" apareceria na lista de "fora dos primitivos"
// de quem rodasse o gate no exato segundo em que uma vitrine estivesse carregando.
const AVISO_FORA_DA_COBERTURA = { "data-editor-ignore": "" } as Record<string, string>;

function AvisoDaVitrine({ carregando, erro, vazia = false }: { carregando: boolean; erro: string | null; /** a escolha resolveu, e não trouxe produto nenhum */ vazia?: boolean }) {
  const falhou = Boolean(erro);
  // três tarjas, três cores: vermelha = a loja não respondeu; âmbar = respondeu, e não tem produto;
  // azul = buscando. Confundir as duas primeiras é como o lojista publica uma seção às cegas.
  const tom = falhou ? { borda: "#e4b4b4", fundo: "#fdeeee", texto: "#8a1f1f" } : vazia ? { borda: "#e6d3a3", fundo: "#fdf6e6", texto: "#6b5312" } : { borda: "#d3d8e8", fundo: "#eef1f8", texto: "#39415c" };
  return (
    <div
      role="status"
      aria-live="polite"
      data-editor-vitrine-aviso={falhou ? "erro" : vazia ? "vazio" : "carregando"}
      {...AVISO_FORA_DA_COBERTURA}
      style={{
        margin: "0 0 10px",
        padding: "7px 11px",
        borderRadius: 10,
        border: `1px solid ${tom.borda}`,
        background: tom.fundo,
        color: tom.texto,
        font: "500 13px/1.45 system-ui, -apple-system, Segoe UI, sans-serif",
        // A vitrine de UM produto costuma ser um CARD dentro de uma grade (`<ul class="grid">`), e a
        // tarja é irmã dele: sem isto ela ocuparia uma célula e embaralharia as colunas. Numa
        // grade, atravessa a linha inteira e lê como aviso da seção; em qualquer outro pai, esta
        // linha é ignorada e ela continua sendo o bloco de sempre.
        gridColumn: "1 / -1",
      }}
    >
      {falhou ? (
        <>
          {erro}{" "}
          {/* A busca só é refeita quando a ESCOLHA muda: clicar em aplicar de novo, com a mesma
              escolha, não mudaria nada no documento e não dispararia pedido nenhum. Recarregar a
              prévia dispara — e dizer isso é melhor do que deixar o lojista clicando em aplicar. */}
          <span style={{ opacity: 0.75 }}>Recarregue a prévia para tentar de novo.</span>
        </>
      ) : vazia ? (
        <>
          Nenhum produto veio dessa escolha.{" "}
          {/* É o que a página publicada faria também: sem produto resolvido, a seção volta aos
              produtos ORIGINAIS. Dizer isso evita a leitura de "cliquei em aplicar e não mudou nada".
              "Originais" e não "o que vem do código": o lojista não vê código, vê a seção como ela
              nasceu — e é a mesma palavra do "voltar ao original" do painel. */}
          <span style={{ opacity: 0.75 }}>A seção está mostrando os produtos originais. Escolha outro produto ou outra categoria.</span>
        </>
      ) : (
        "Buscando os produtos na loja…"
      )}
    </div>
  );
}

/**
 * VÍDEO: mesmo valor da imagem (`{ src, alt? }`), tipo próprio no documento. O tipo é o que faz o painel
 * mostrar prévia de vídeo, aceitar arquivo de até 32 MB (mp4/webm) e não oferecer o vídeo onde cabe foto.
 *
 * É RENDER-PROP, e não um `<video src>` pronto, porque um vídeo de verdade tem filhos e vizinhos que só
 * a loja conhece: `<source>`, pôster, `key` para trocar de arquivo, o `ref` imperativo do play/pause e a
 * escolha entre arquivo de computador e de celular. Renderizar cego forçaria toda loja a abandonar isso.
 *
 *   <Editable.Video path="video" label="Vídeo de abertura" fallback={{ src: "/brand/hero.mp4" }}>
 *     {(v, attrs, ref) => <video ref={ref} {...attrs} src={v.src} muted loop playsInline />}
 *   </Editable.Video>
 *
 * A loja que já tem um `useRef` no `<video>` precisa juntar os dois refs numa função só — o `ref` daqui
 * é callback; guardar o elemento no ref próprio E chamar este é o que mantém play/pause funcionando.
 */
function Video({
  path,
  label,
  fallback,
  children,
}: {
  path: string;
  label?: string;
  /** o arquivo que o CÓDIGO usa enquanto o lojista não trocar */
  fallback: ImageValue;
  children: (valor: ImageValue, attrs: Record<string, string | undefined>, ref: React.RefCallback<Element>) => React.ReactNode;
}) {
  const { value, ref, attrs } = useRegistration(path, "video", fallback, label);
  const setRef = React.useCallback<React.RefCallback<Element>>((el) => {
    ref.current = el;
  }, [ref]);
  return <>{children(value as ImageValue, attrs, setRef)}</>;
}

/**
 * Ícone substituível: renderiza o ícone do código (children) até o lojista subir uma
 * imagem no lugar. Fallback `{src: ""}` = "ícone original". Funciona para SVG inline,
 * componente de ícone ou <img>.
 */
function Icon({
  path,
  label,
  size,
  className,
  children,
}: {
  path: string;
  label?: string;
  /** tamanho em px da imagem enviada (default: o tamanho do ícone original, via CSS) */
  size?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const { value, ref, attrs } = useRegistration(path, "image", { src: "", alt: label ?? "" }, label);
  const v = value as ImageValue;
  if (v.src) {
    return <img ref={ref as React.Ref<HTMLImageElement>} src={v.src} alt={v.alt ?? label ?? ""} width={size} height={size} className={className} style={{ display: "inline-block", objectFit: "contain" }} {...attrs} />;
  }
  return (
    <span ref={ref as React.Ref<HTMLSpanElement>} className={className} style={{ display: "inline-flex", lineHeight: 0 }} {...attrs}>
      {children}
    </span>
  );
}

/** marcador do bloco vazio e aviso de recusa: estilo INLINE, para não depender do CSS da loja */
const MARCADOR_HTML: React.CSSProperties = {
  display: "block",
  padding: "14px 16px",
  border: "1px dashed currentColor",
  borderRadius: 8,
  font: "500 13px/1.45 system-ui, -apple-system, Segoe UI, sans-serif",
  opacity: 0.7,
  cursor: "pointer",
};
const AVISO_HTML: React.CSSProperties = { ...MARCADOR_HTML, border: "1px solid #b42318", color: "#b42318", opacity: 1 };

/**
 * A CERCA DO BLOCO DE HTML — o que impede o que está DENTRO do bloco de sair por cima da loja.
 *
 * O modo de falha real, e por que a limpeza do editor sozinha não fecha isto: a limpeza olha o
 * `style=` (é lá que ela tira `position: fixed`), mas `class=` ela DEIXA passar de propósito, porque
 * é assim que um selo colado usa as classes da própria loja. Só que as classes da loja incluem as do
 * Tailwind, e `class="fixed inset-0 z-50"` faz exatamente o que o `style=` estava proibido de fazer:
 * cobre a página inteira com um retângulo, e o botão de comprar fica embaixo. Nenhuma lista de
 * classes proibidas resolveria — a loja escolhe o CSS dela, e a lista envelheceria sozinha. Então a
 * regra não é sobre o QUE está escrito lá dentro, é sobre até onde o resultado pode chegar.
 *
 * `contain: layout paint` faz as duas coisas de que isto depende, e é por isso que são as duas:
 *   • LAYOUT: o invólucro vira o bloco que contém os `position: fixed` e `absolute` de dentro. O
 *     `fixed` para de se medir pela janela e passa a se medir por este `<div>`; `inset-0` cobre o
 *     bloco, não a tela. Vira também um contexto de empilhamento próprio, então o `z-50` de dentro
 *     disputa com os irmãos DELE, e nunca com o cabeçalho da loja.
 *   • PAINT: o que for maior que o invólucro é recortado nele, em vez de ser pintado por cima do
 *     resto da página (um `width: 100vw`, uma margem negativa de mil pixels).
 *
 * O que fica DE FORA da lista, e não é esquecimento: `size`. Contenção de tamanho manda o navegador
 * calcular a altura do invólucro como se ele estivesse VAZIO, e o bloco inteiro colapsaria para zero.
 *
 * `position: relative` é o degrau de baixo, para navegador que não conheça `contain`: ele já prende
 * o `absolute` (o `fixed`, não). Vem junto por ser de graça e não mudar nada do desenho.
 *
 * Isto é aplicado DEPOIS do `style` que a receita da loja passou: contenção que a receita pode
 * desligar sem querer não é contenção. O `overflowX: auto` continua antes, esse sim negociável.
 */
const CERCA_DO_HTML: React.CSSProperties = { contain: "layout paint", position: "relative" };

type HtmlProps = {
  path: string;
  /** o HTML que o CÓDIGO traz. Quase sempre vazio: o bloco nasce para o lojista colar. */
  fallback?: string;
  label?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "dangerouslySetInnerHTML">;

/**
 * BLOCO DE HTML: o lojista cola HTML pronto (um selo do fornecedor, uma tabela, um trecho que veio
 * de fora). O chat NÃO escreve aqui — o agente aponta o bloco e quem cola é o lojista.
 *
 * O caminho ganha o sufixo `.html` AQUI (`path="conteudo"` → `home.bloco-1.conteudo.html`): é ele que
 * diz ao servidor da loja que o valor é HTML, e a loja lê o publicado sem manifesto nenhum.
 *
 * Este é o terceiro lugar em que a lista de recusa roda, e o ÚNICO que existe na PRÉVIA — ali o
 * rascunho chega por postMessage e não passa por servidor. Por isso aqui é RECUSAR, não limpar: HTML
 * perigoso não é injetado, e em modo edição o bloco diz o motivo em vez de mostrar outra coisa calado.
 *
 * E o que NENHUMA das três camadas resolve com lista, porque `class=` passa de propósito, é o alcance
 * do que ficou: quem prende isso é a CERCA (`CERCA_DO_HTML`, logo acima) no invólucro deste bloco.
 *
 * Em produção, bloco vazio não rende NADA — nem invólucro. Um `<div>` de 0px ainda come o `gap` do
 * container e abre uma faixa branca no meio da página.
 */
function Html({ path, fallback = "", label, style: styleProp, ...rest }: HtmlProps) {
  // sufixo idempotente: o construtor escreve `path="conteudo"`, mas `path="conteudo.html"` não vira `.html.html`
  const caminho = path.endsWith(SUFIXO_HTML) ? path : path + SUFIXO_HTML;
  const { value, ref, attrs, editing, guardado } = useRegistration(caminho, "html", fallback, label);
  const html = typeof value === "string" ? value : "";
  // recusa no CLIENTE: vale para o rascunho da prévia e para o `fallback` do próprio código
  const recusaNoRender = html ? recusaDeHtml(html) : null;
  // e o que o lojista GRAVOU já tinha sido recusado lá no `resolveValue` (que devolveu o fallback)?
  // sem esta linha, o bloco mostraria o conteúdo do código e ninguém saberia por quê
  const recusaGuardada = typeof guardado === "string" && guardado !== html ? recusaDeHtml(guardado) : null;
  const motivo = recusaGuardada ?? recusaNoRender;
  const seguro = recusaNoRender ? "" : html;
  if (!seguro && !editing) return null;
  const estilo: React.CSSProperties = { overflowX: "auto", ...styleProp, ...CERCA_DO_HTML };
  const caixa = { ...attrs, ...rest, style: estilo };
  const aviso = editing && motivo ? <span style={AVISO_HTML}>Este HTML não foi aplicado: {motivo}</span> : null;
  if (!seguro) {
    return (
      <div ref={ref as React.Ref<HTMLDivElement>} {...caixa}>
        {aviso ?? <span style={MARCADOR_HTML}>Bloco de HTML vazio: clique aqui e cole o seu HTML</span>}
      </div>
    );
  }
  // recusa + conteúdo do código ao mesmo tempo: o aviso vem ANTES, e o HTML entra num filho
  // `display: contents` (sem caixa própria) para o layout não mudar por causa do aviso
  if (aviso) {
    return (
      <div ref={ref as React.Ref<HTMLDivElement>} {...caixa}>
        {aviso}
        <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: seguro }} />
      </div>
    );
  }
  // `dangerouslySetInnerHTML` e `children` não convivem no mesmo elemento — por isso os três retornos.
  // O HTML aqui já passou pela lista; o teto entra na conta porque `recusaDeHtml` o cobre.
  return <div ref={ref as React.Ref<HTMLDivElement>} {...caixa} dangerouslySetInnerHTML={{ __html: seguro }} />;
}

type RichTextProps = {
  path: string;
  /** o texto que o CÓDIGO traz. Quase sempre vazio: o corpo de um artigo nasce para o lojista escrever. */
  fallback?: string;
  label?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "dangerouslySetInnerHTML">;

/**
 * TEXTO FORMATADO (foundation 13): o corpo de um artigo ou de uma página do lojista. Parágrafo, negrito,
 * itálico, sublinhado, riscado, link, lista, subtítulo, citação e linha; nada além disso.
 *
 * Existe AO LADO do bloco de HTML, e não em cima dele, porque os dois resolvem problemas opostos:
 *   · o bloco de HTML é para COLAR o que veio de fora (um selo, uma tabela do fornecedor) e por isso é
 *     lista de RECUSA (tudo entra, menos o que faz mal) com o chat proibido de escrever nele;
 *   · o texto formatado é para ESCREVER, pelo editor de texto do painel ou pelo markdown do chat, e por
 *     isso é lista FECHADA (`TAGS_DO_TEXTO_RICO`, só `href` em `a`): tudo que não está nela é, por
 *     definição, coisa que o editor não produziu. É o que deixa o chat escrever um artigo inteiro sem
 *     abrir a porta que o bloco de HTML fecha.
 * `Editable.Text multiline` não serve: ele só quebra linha, e um artigo precisa de subtítulo e link.
 *
 * O caminho ganha o sufixo `.rico` AQUI (`path="corpo"` → `artigo-blog-x.novo-texto-1.corpo.rico`): é ele que
 * diz ao servidor da loja que o valor é marcação a passar pela lista fechada, e não um texto a escapar. A
 * loja lê o publicado sem manifesto nenhum.
 *
 * Como no bloco de HTML, esta é a terceira camada da régua e a ÚNICA que existe na PRÉVIA (o rascunho chega
 * por postMessage, sem servidor): aqui é RECUSAR, não limpar. Texto recusado não é injetado; em modo
 * edição o bloco diz o motivo, em vez de mostrar outra coisa calado. Quem limpa e relata é o editor, antes
 * de gravar.
 *
 * Os links de FORA saem com `target="_blank"` e `rel="noopener noreferrer"` NA RENDERIZAÇÃO
 * (`linksExternosEmNovaAba`, transformação de string sobre texto já aprovado): o documento guarda só o
 * `href`, e a lista fechada continua valendo para o que está guardado.
 *
 * O invólucro é `<div class="texto-rico">`: o CSS de prosa (espaçamento de parágrafo, lista, citação) é do
 * template da loja, por essa classe. Em produção, texto vazio não rende NADA, nem invólucro: um `<div>` de
 * 0px ainda come o `gap` do container e abre uma faixa branca no meio da página. Em edição, o vazio vira
 * o convite para escrever.
 */
function RichText({ path, fallback = "", label, className, ...rest }: RichTextProps) {
  // sufixo idempotente, como no bloco de HTML: `path="corpo.rico"` não vira `.rico.rico`
  const caminho = path.endsWith(SUFIXO_RICO) ? path : path + SUFIXO_RICO;
  const { value, ref, attrs, editing, guardado } = useRegistration(caminho, "richtext", fallback, label);
  const html = typeof value === "string" ? value : "";
  // recusa no CLIENTE: vale para o rascunho da prévia e para o `fallback` do próprio código
  const recusaNoRender = html ? recusaDeTextoRico(html) : null;
  // o que o lojista GRAVOU já tinha sido recusado em `resolveValue` (que devolveu o fallback)? Sem esta
  // linha, o bloco mostraria o texto do código e ninguém saberia por quê
  const recusaGuardada = typeof guardado === "string" && guardado !== html ? recusaDeTextoRico(guardado) : null;
  const motivo = recusaGuardada ?? recusaNoRender;
  // os links de fora só entram na string depois de aprovada: a transformação pressupõe a lista fechada
  const seguro = recusaNoRender ? "" : linksExternosEmNovaAba(html);
  const vazio = !seguro.trim();
  if (vazio && !editing) return null;
  const caixa = { ...attrs, ...rest, className: className ? `texto-rico ${className}` : "texto-rico" };
  const aviso = editing && motivo ? <span style={AVISO_HTML}>Este texto não foi aplicado: {motivo}</span> : null;
  if (vazio) {
    return (
      <div ref={ref as React.Ref<HTMLDivElement>} {...caixa}>
        {aviso ?? <span style={MARCADOR_HTML}>Clique para escrever</span>}
      </div>
    );
  }
  // recusa + texto do código ao mesmo tempo: o aviso vem ANTES, e o texto entra num filho `display: contents`
  // (sem caixa própria) para o layout não mudar por causa do aviso
  if (aviso) {
    return (
      <div ref={ref as React.Ref<HTMLDivElement>} {...caixa}>
        {aviso}
        <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: seguro }} />
      </div>
    );
  }
  // `dangerouslySetInnerHTML` e `children` não convivem no mesmo elemento: por isso os três retornos
  return <div ref={ref as React.Ref<HTMLDivElement>} {...caixa} dangerouslySetInnerHTML={{ __html: seguro }} />;
}

/**
 * Seção: dá identidade estável (id) e escopo de caminho (`<container>.<id>.…`).
 * Em produção, seção oculta não renderiza. O wrapper é `display:contents` — não
 * cria caixa, não muda layout.
 */
function Section({
  id,
  label,
  container,
  fixed = false,
  clone = false,
  criada = false,
  tipo,
  kind,
  item = false,
  ordemNoCodigo,
  children,
}: {
  id: string;
  label?: string;
  container?: string;
  /** cabeçalho/rodapé: aparece no manifesto, mas não move nem oculta */
  fixed?: boolean;
  /** cópia feita pelo lojista (Editable.Sections marca sozinho) */
  clone?: boolean;
  /** seção ADICIONADA pelo lojista, instanciada do catálogo (Editable.Sections marca sozinho) */
  criada?: boolean;
  /** tipo do catálogo que originou a seção criada (só com `criada`) */
  tipo?: string;
  /** tipo da seção no vocabulário fechado (`SECTION_KINDS`): o nome que qualquer pessoa entende no painel */
  kind?: SectionKind;
  /** item de uma lista dentro da seção (dentro de `<Editable.Sections nested>`): não precisa de kind */
  item?: boolean;
  /**
   * Posição desta seção NO CÓDIGO (quem preenche é `Editable.Sections`). Não muda quando o lojista
   * reordena — é o que permite ao editor saber a ordem original mesmo lendo o DOM já reordenado.
   */
  ordemNoCodigo?: number;
  children: React.ReactNode;
}) {
  const ctx = useEditableContext();
  // SEM CONTAINER, SEM ESCOPO (foundation 11). O padrão era `ctx.container = "home"`, e por causa dele
  // uma página que envolvesse suas seções sem declarar container entrava escrevendo NA HOME e passava
  // a disputar a ordem da home. Agora, sem container declarado, a seção RENDERIZA (a loja não cai) e
  // não é editável: não se registra, não obedece ordem nem ocultar, e o escopo vazio faz os primitivos
  // de dentro recusarem a raiz do documento, cada um dizendo por quê.
  const cont = container ?? ctx.container;
  const ref = React.useRef<HTMLDivElement | null>(null);
  // seção fixa (cabeçalho/rodapé) nunca some, mesmo que um documento diga o contrário
  const hidden = Boolean(cont) && !fixed && ctx.layout && (ctx.doc.sections[cont as string]?.hidden ?? []).includes(id);
  const { editing, registerSection } = ctx;
  const semLayout = !ctx.layout;
  React.useEffect(() => {
    if (!editing || !cont) return;
    return registerSection({ container: cont, id, label, clone, criada, tipo, fixed, kind, item, ordemNoCodigo, semLayout, el: () => ref.current });
  }, [editing, registerSection, cont, id, label, clone, criada, tipo, fixed, kind, item, ordemNoCodigo, semLayout]);
  React.useEffect(() => {
    if (cont) return;
    avisarConstrutor(
      `section:${id}`,
      `[Editable] a seção "${id}" está fora de um <Editable.Sections container="...">: ela aparece na tela, mas nada dentro dela é editável, porque os caminhos cairiam na raiz do documento. Declare o container desta página (<Editable.Sections container="sobre">) ou passe container= nesta seção. Duas páginas que declaram o MESMO container dividem ordem e copy de propósito; página que quer copy própria declara container próprio.`,
    );
  }, [cont, id]);
  const value = React.useMemo(() => ({ ...ctx, container: cont, section: cont ? id : undefined, scope: cont ? [cont, id] : [] }), [ctx, cont, id]);
  // fundo da seção inteira (`<container>.<id>.estilo`): o invólucro é `display: contents`, então
  // a cor vai numa variável herdada e a regra global pinta o filho direto (ver EditableProvider)
  const fundo = cont ? resolveStyle(ctx.doc, `${cont}.${id}`)?.background : undefined;
  if (hidden && !editing) return null;
  return (
    <EditableContextProvider value={value}>
      <div
        ref={ref}
        style={fundo ? ({ display: "contents", "--unbox-sec-bg": fundo } as React.CSSProperties) : { display: "contents" }}
        data-unbox-sec-bg={fundo ? "1" : undefined}
        {...(editing && cont
          ? { "data-editor-section": id, "data-editor-container": cont, "data-editor-label": label, "data-editor-kind": kind, "data-editor-item": item ? "1" : undefined, "data-editor-fixed": fixed ? "1" : undefined, "data-editor-clone": clone ? "1" : undefined, "data-editor-criada": criada ? "1" : undefined, "data-editor-tipo": tipo, "data-editor-section-hidden": hidden ? "1" : undefined }
          : {})}
      >
        {children}
      </div>
    </EditableContextProvider>
  );
}

/**
 * UM TIPO DO CATÁLOGO DA LOJA — o que o lojista pode ADICIONAR neste container.
 *
 * O catálogo é CURADO e é da loja (6 a 8 tipos, só os que renderizam bem sem props de receita); o
 * editor nunca tem lista própria — 100 lojas, 100 catálogos. Isto não abre exceção na regra das "4
 * latas" (não existe catálogo de EDITABILIDADE): o que a loja declara aqui é o catálogo de COMPONENTES
 * que ela já tem, e a seção adicionada nasce com os LITERAIS do componente (os `fallback`), sem nada
 * escrito no documento.
 */
export interface TipoDeSecao {
  /** rótulo que o lojista lê no "+" ("Perguntas frequentes") */
  label: string;
  /** uma frase dizendo o que a seção mostra (sem imagem de prévia no v1) */
  descricao?: string;
  /** tipo no vocabulário fechado (`SECTION_KINDS`) */
  kind?: SectionKind;
  /** o que renderizar. Fecha por closure os dados que a loja já buscou no servidor. */
  render: () => React.ReactNode;
}
/** tipo → como instanciá-lo. A CHAVE é o que entra no id da seção criada (`novo-<tipo>-<n>`). */
export type CatalogoDeSecoes = Record<string, TipoDeSecao>;

/**
 * Container de seções: reordena/oculta os filhos pelo `id` deles conforme o
 * documento. Cada filho direto precisa ser um `<Editable.Section id=…>` (ou
 * qualquer elemento com prop `id`).
 */
type SectionsPropsBase = {
  /** false = renderiza na ordem do código, sem ocultar (ex.: página de produto que reusa a home) */
  layout?: boolean;
  /**
   * O que o lojista pode ADICIONAR neste container. Sem catálogo, o container não oferece "adicionar
   * seção" — e é o padrão: quem não declara nada continua exatamente como antes.
   */
  catalogo?: CatalogoDeSecoes;
  children: React.ReactNode;
};
/**
 * O CONTAINER É OBRIGATÓRIO (foundation 11), e o compilador cobra. Ele era `?? "home"`, e o padrão
 * fazia qualquer página que esquecesse de declarar entrar escrevendo na HOME. A regra que vale agora:
 * a ORDEM é do container e a COPY é do container. Duas páginas que declaram o mesmo container
 * dividem ordem e copy DE PROPÓSITO (é assim que o `chrome` vale no site inteiro); a página que quer
 * copy própria declara container próprio. Uma chave de container nova é inerte para todo código já no
 * ar, então declarar não custa migração nenhuma.
 *
 * `nested` é a única forma sem container explícito, e não é exceção: ali o container É a seção em
 * volta (o escopo atual, ex.: "home.faq"), que já foi declarada por alguém.
 */
type SectionsProps = SectionsPropsBase &
  (
    | {
        container: string;
        nested?: false;
      }
    | {
        container?: undefined;
        /**
         * LISTA DENTRO DE UMA SEÇÃO (bloco B9): `nested` faz o container ser o escopo atual (ex.: "home.faq"),
         * então cada filho `<Editable.Section item id="pergunta-1">` mantém os caminhos de sempre
         * (`home.faq.pergunta-1.pergunta`) e ganha ordem, ocultar, duplicar e remover — sem catálogo.
         */
        nested: true;
      }
  );

function Sections(props: SectionsProps) {
  const { container: containerProp, layout = true, nested = false, catalogo, children } = props as SectionsPropsBase & { container?: string; nested?: boolean };
  const ctx = useEditableContext();
  // sem container declarado, NADA aqui dentro é editável: `container` vazio desce como `undefined`,
  // as seções não se registram e os primitivos delas recusam a raiz do documento. A lista continua
  // renderizando na ordem do código, porque derrubar a loja não conserta o defeito de quem a montou.
  // `nested` só vale DENTRO de uma seção: é ela o container. Um `Editable.Scope` solto na raiz também
  // enche o escopo ("atributos"), e por isso a pergunta é pela seção em vigor, não pelo escopo
  const container = (nested ? (ctx.section ? ctx.scope.join(".") : "") : containerProp) || undefined;
  React.useEffect(() => {
    if (container) return;
    avisarConstrutor(
      nested ? "sections:nested-sem-secao" : "sections:sem-container",
      nested
        ? `[Editable] <Editable.Sections nested> fora de uma <Editable.Section>: a lista aninhada usa a seção em volta como container, e aqui não há nenhuma. A lista aparece na tela, mas nada dentro dela é editável.`
        : `[Editable] <Editable.Sections> sem container: declare o container desta página (<Editable.Sections container="sobre">). A lista aparece na tela, mas nada dentro dela é editável, porque os caminhos cairiam na raiz do documento.`,
    );
  }, [container, nested]);
  const state = layout && container ? ctx.doc.sections[container] : undefined;
  const items = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<{ id?: string }>[];
  const ids = items.map((c) => c.props.id).filter((x): x is string => typeof x === "string");
  if (process.env.NODE_ENV !== "production" && ids.length !== items.length) {
    console.warn("[Editable.Sections] todo filho direto precisa de `id`; os sem id foram descartados");
  }
  const byId = new Map(items.filter((c) => typeof c.props.id === "string").map((c) => [c.props.id as string, c]));
  // cópias do lojista: o MESMO componente da origem, com id (= escopo) próprio → todos
  // os textos/imagens da cópia nascem editáveis, sem código novo
  const clones = layout ? Object.entries(state?.clones ?? {}).filter(([, src]) => byId.has(src)) : [];
  // seções ADICIONADAS pelo lojista: só as de tipo que ESTA loja tem no catálogo. Um tipo que ela não
  // conhece (catálogo mudou, loja atrás da versão) fica de fora da TELA sem estourar — o painel continua
  // listando a seção, porque `manifestWithClones` a deriva do rascunho, e é lá que ele explica.
  // `render` de verdade, não só "a chave existe": um tipo herdado do prototype ("constructor",
  // "toString") vindo de um documento antigo devolveria um valor truthy e estouraria no render
  const doCatalogo = (tipo: string): TipoDeSecao | undefined => {
    const t = catalogo && Object.prototype.hasOwnProperty.call(catalogo, tipo) ? catalogo[tipo] : undefined;
    return t && typeof t.render === "function" ? t : undefined;
  };
  const criadas = layout && catalogo ? Object.entries(state?.criadas ?? {}).filter(([, tipo]) => Boolean(doCatalogo(tipo))) : [];
  const todos = [...ids, ...clones.map(([id]) => id).filter((id) => !byId.has(id)), ...criadas.map(([id]) => id).filter((id) => !byId.has(id))];
  const order = state?.order ?? [];
  const present = new Set(todos);
  const ordered = [...order.filter((id) => present.has(id)), ...todos.filter((id) => !order.includes(id))];
  const origem = new Map(clones);
  const tipoDaCriada = new Map(criadas);
  const value = React.useMemo(() => ({ ...ctx, container, layout }), [ctx, container, layout]);
  // o catálogo vira uma ASSINATURA de texto: o objeto é recriado a cada render da loja, e depender
  // dele por referência re-registraria os tipos sem parar (o manifesto nunca assentaria)
  const { editing, registerTipos } = ctx;
  const assinaturaDoCatalogo = catalogo && layout && container ? Object.entries(catalogo).map(([tipo, d]) => [tipo, d.label, d.descricao ?? "", d.kind ?? ""].join("\u0000")).join("\u0001") : "";
  React.useEffect(() => {
    if (!editing || !assinaturaDoCatalogo || !container) return;
    const tipos = assinaturaDoCatalogo.split("\u0001").map((linha) => {
      const [tipo, label, descricao, kind] = linha.split("\u0000");
      return { tipo, label, descricao: descricao || undefined, kind: (kind || undefined) as SectionKind | undefined };
    });
    return registerTipos(container, tipos);
  }, [editing, registerTipos, container, assinaturaDoCatalogo]);
  return (
    <EditableContextProvider value={value}>
      {ordered.map((id) => {
        // seção criada: o componente vem do CATÁLOGO, não dos filhos do JSX
        const tipo = tipoDaCriada.get(id);
        const doTipo = tipo ? doCatalogo(tipo) : undefined;
        if (tipo && doTipo) {
          return (
            <Section key={id} id={id} container={container} criada tipo={tipo} kind={doTipo.kind} label={doTipo.label}>
              {doTipo.render()}
            </Section>
          );
        }
        const src = origem.get(id);
        const el = byId.get(src ?? id);
        // um id que não é filho do código, nem cópia, nem criada renderizável não pode DERRUBAR a
        // página (era um `!` não-nulo): fica de fora da tela e o painel resolve pelo documento
        if (!el) return null;
        const label = src ? `${(el.props as { label?: string }).label ?? src} (cópia)` : undefined;
        // `ordemNoCodigo` = posição do filho no CÓDIGO (da origem, no caso de uma cópia): o editor precisa
        // dela para saber a ordem original mesmo lendo um DOM já reordenado (Astra v3.5, achado 1)
        // só com `layout` esta lista MANDA na ordem: a página de produto reusa o container "home" com
        // layout={false} só para reaproveitar componentes, e não pode ditar a ordem da home (Astra v3.6, 1)
        const ordemNoCodigo = layout ? ids.indexOf(src ?? id) : undefined;
        return React.cloneElement(el, { key: id, id, container, ordemNoCodigo, ...(src ? { clone: true, label } : {}) } as Partial<{ id: string; container: string; clone: boolean; label: string; item: boolean; ordemNoCodigo: number }>);
      })}
    </EditableContextProvider>
  );
}

// Exportações NOMEADAS para server components: o objeto `Editable` é de um módulo
// "use client", e um server component que importa um OBJETO de client module recebe
// undefined (só componentes atravessam a fronteira). Nomeados atravessam.
export { Section as EditableSection, Text as EditableText, EditableImage, EditableImg, EditableLink, Slot as EditableSlot, Icon as EditableIcon, Vitrine as EditableVitrine, Video as EditableVideo, Html as EditableHtml, RichText as EditableRichText, Sections as EditableSections };

export const Editable = {
  // a fatia do documento de uma página do lojista (mora no provider; aqui só entra no namespace)
  Fatia: EditableFatia,
  Text,
  Image: EditableImage,
  Img: EditableImg,
  Link: EditableLink,
  Slot,
  Icon,
  Vitrine,
  Video,
  Html,
  RichText,
  Section,
  Sections,
};

// Exports NOMEADOS pros server components (cabeçalho, rodapé): um server
// component só recebe referências de cliente por nome de export — `Editable.X`
// chega como undefined lá ("Element type is invalid"). Nos client components
// o namespace `Editable.*` continua sendo a forma de uso.
