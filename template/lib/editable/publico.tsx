"use client";
// ═══════════════════════════════════════════════════════════════════════════
// PERSONALIZAÇÃO POR PÚBLICO NO NAVEGADOR (foundation 18).
//
// Quem decide a versão da home é a BORDA (o middleware, com `decidirPublico`), antes do cache; aqui só se
// GRAVA a escolha que acontece depois que a página carregou (o quiz respondeu) e se pede a versão nova:
// `router.refresh()` busca a rota de novo, o middleware lê o cookie e reescreve para a página do público.
// Nada de conteúdo é trocado no navegador por conta própria (piscaria, e pioraria o LCP).
//
// O CONTRATO COM OS APPS (o quiz do Admin e qualquer outro), dois eventos que `<PontoDePublico/>`, no layout, ouve.
// O app não precisa importar nada desta loja:
//   · o QUIZ só avisa a resposta, e quem a liga a um público é o lojista, no editor (a regra "Respostas do quiz"):
//       window.dispatchEvent(new CustomEvent("unbox:resposta-do-quiz", { detail: { resposta: "Quero volume" } }))
//     (ou `{ respostas: [...] }` no fim de um quiz de várias perguntas);
//   · o app que já sabe o id do público o diz direto (a lista está em `GET /api/unbox/publicos`):
//       window.dispatchEvent(new CustomEvent("unbox:definir-publico", { detail: { id: "volume" } }))
// ═══════════════════════════════════════════════════════════════════════════
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  COOKIE_DE_PUBLICO, DIAS_DA_ESCOLHA, EVENTO_DEFINIR_PUBLICO, EVENTO_RESPOSTA_DO_QUIZ, PARAM_DE_PUBLICO, cookieDaLojaPadrao, idDePublicoValido, lerCookieDePublico,
  publicoDaResposta, valorDoCookieDePublico,
  type OrigemDoPublico, type PublicosDaBorda,
} from "./document";
import { useEditableContext } from "./provider";

function cookieAtual(): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_DE_PUBLICO}=([^;]*)`));
  return m ? m[1] : null;
}

function gravarCookie(valor: string, dias: number): void {
  document.cookie = `${COOKIE_DE_PUBLICO}=${encodeURIComponent(valor)}; path=/; max-age=${dias * 86_400}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
}

/** 0 a 99, uma vez por visitante (o mesmo que a borda sorteia quando é ela quem grava primeiro) */
function sortear(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % 100;
}

/**
 * Põe o visitante num público e mostra a versão dele, sem recarregar a página. Guarda o sorteio que ele já
 * tinha: trocar de público não o tira nem o põe no grupo de controle.
 *
 * Na PRÉVIA do editor não grava nada: lá quem escolhe a visão é o painel ("Ver como"), e um cookie gravado
 * dentro do iframe mudaria a loja de quem está editando fora dele.
 */
export function useDefinirPublico(): (id: string, origem?: OrigemDoPublico) => void {
  const router = useRouter();
  const { editing } = useEditableContext();
  return React.useCallback(
    (id: string, origem: OrigemDoPublico = "app") => {
      if (editing || !idDePublicoValido(id)) return;
      const sorteio = lerCookieDePublico(cookieAtual())?.sorteio ?? sortear();
      gravarCookie(valorDoCookieDePublico({ publico: id, sorteio, forca: "forte", origem }), DIAS_DA_ESCOLHA[origem]);
      // o link do anúncio que trouxe a pessoa não pode desfazer, numa recarga, a escolha que ela acabou de fazer
      const u = new URL(location.href);
      if (u.searchParams.has(PARAM_DE_PUBLICO)) {
        u.searchParams.delete(PARAM_DE_PUBLICO);
        history.replaceState(history.state, "", u.toString());
      }
      // a mesma medição do carregamento (`scriptDaMedicaoDoPublico`), agora com a escolha nova
      const w = window as unknown as { dataLayer?: unknown[]; __unboxPublicos?: { c: number; p: string[] } };
      const d = w.__unboxPublicos;
      (w.dataLayer ??= []).push({ event: "unbox_publico", publico: id, publico_origem: origem, ...(d ? { publico_grupo: d.c > sorteio ? "controle" : "versao" } : {}) });
      router.refresh();
    },
    [editing, router],
  );
}

/**
 * a lista dos públicos com as regras (a rota pública da loja, em cache na CDN), buscada uma vez por página e só
 * quando um quiz responde: a lista não vai no HTML de toda página para servir a um clique que talvez nem aconteça
 */
let listaDaPagina: Promise<PublicosDaBorda | null> | null = null;
function listaDosPublicos(): Promise<PublicosDaBorda | null> {
  listaDaPagina ??= fetch("/api/unbox/publicos", { headers: { accept: "application/json" } })
    .then((r) => (r.ok ? (r.json() as Promise<PublicosDaBorda>) : null))
    .catch(() => null)
    .then((l) => {
      if (!l) listaDaPagina = null; // falhou: a próxima resposta tenta de novo
      return l;
    });
  return listaDaPagina;
}

/** Ouve os eventos dos apps (a resposta do quiz e o público dito direto). Uma linha no layout, dentro do `EditableProvider`. */
export function PontoDePublico(): null {
  const definir = useDefinirPublico();
  React.useEffect(() => {
    const ouvirId = (ev: Event) => {
      const id = (ev as CustomEvent<{ id?: unknown }>).detail?.id;
      if (typeof id === "string") definir(id.trim().toLowerCase(), "app");
    };
    const ouvirResposta = (ev: Event) => {
      const d = (ev as CustomEvent<{ resposta?: unknown; respostas?: unknown }>).detail;
      const respostas = [...(Array.isArray(d?.respostas) ? d.respostas : []), d?.resposta].filter((r): r is string => typeof r === "string" && r.trim() !== "");
      if (!respostas.length) return;
      void listaDosPublicos().then((lista) => {
        const id = publicoDaResposta(respostas, lista);
        if (id) definir(id, "app");
      });
    };
    window.addEventListener(EVENTO_DEFINIR_PUBLICO, ouvirId);
    window.addEventListener(EVENTO_RESPOSTA_DO_QUIZ, ouvirResposta);
    return () => {
      window.removeEventListener(EVENTO_DEFINIR_PUBLICO, ouvirId);
      window.removeEventListener(EVENTO_RESPOSTA_DO_QUIZ, ouvirResposta);
    };
  }, [definir]);
  return null;
}

/**
 * Apaga a escolha gravada. A rota do público renderiza isto quando o id do cookie não existe mais (o lojista
 * excluiu o público): a pessoa vê Todos, e o cookie velho não fica pedindo uma versão que não há.
 */
export function LimparPublico(): null {
  React.useEffect(() => {
    document.cookie = `${COOKIE_DE_PUBLICO}=; path=/; max-age=0; samesite=lax`;
  }, []);
  return null;
}

/**
 * A LOJA PADRÃO, o direito de oposição (LGPD): a pessoa pede para não ver versão nenhuma. `recusar` grava o
 * cookie da recusa (`todos~<sorteio>~forte~recusa`): a borda serve Todos, e nenhum sinal automático (link,
 * campanha, site, região, login) a tira de lá. `voltar` apaga a recusa. Uma escolha que ela mesma faça depois
 * num app (o quiz) vale: é ela escolhendo de novo.
 *
 * `recusou` começa `null` (o servidor não lê cookie: a página é a mesma para todo mundo) e vira booleano depois
 * de montar, para o botão não mentir na primeira pintura. Na prévia do editor não grava nada.
 */
export function useLojaPadrao(): { recusou: boolean | null; recusar: () => void; voltar: () => void } {
  const router = useRouter();
  const { editing } = useEditableContext();
  const [recusou, setRecusou] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    setRecusou(lerCookieDePublico(cookieAtual())?.origem === "recusa");
  }, []);
  const recusar = React.useCallback(() => {
    if (editing) return;
    gravarCookie(valorDoCookieDePublico(cookieDaLojaPadrao(lerCookieDePublico(cookieAtual())?.sorteio ?? sortear())), DIAS_DA_ESCOLHA.recusa);
    setRecusou(true);
    router.refresh();
  }, [editing, router]);
  const voltar = React.useCallback(() => {
    if (editing) return;
    document.cookie = `${COOKIE_DE_PUBLICO}=; path=/; max-age=0; samesite=lax`;
    setRecusou(false);
    router.refresh();
  }, [editing, router]);
  return { recusou, recusar, voltar };
}
