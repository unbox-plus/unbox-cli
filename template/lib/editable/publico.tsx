"use client";
// ═══════════════════════════════════════════════════════════════════════════
// PERSONALIZAÇÃO POR PÚBLICO NO NAVEGADOR (foundation 18).
//
// Quem decide a versão da home é a BORDA (o middleware, com `decidirPublico`), antes do cache; aqui só se
// GRAVA a escolha que acontece depois que a página carregou (o quiz respondeu) e se pede a versão nova:
// `router.refresh()` busca a rota de novo, o middleware lê o cookie e reescreve para a página do público.
// Nada de conteúdo é trocado no navegador por conta própria (piscaria, e pioraria o LCP).
//
// O CONTRATO COM OS APPS (o quiz do Admin e qualquer outro): disparar
//   window.dispatchEvent(new CustomEvent("unbox:definir-publico", { detail: { id: "volume" } }))
// com o id de um público da loja (a lista está em `GET /api/unbox/publicos`). `<PontoDePublico/>`, no
// layout, ouve o evento. O app não precisa importar nada desta loja.
// ═══════════════════════════════════════════════════════════════════════════
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  COOKIE_DE_PUBLICO, DIAS_DA_ESCOLHA, EVENTO_DEFINIR_PUBLICO, PARAM_DE_PUBLICO, idDePublicoValido, lerCookieDePublico, valorDoCookieDePublico,
  type OrigemDoPublico,
} from "./document";
import { useEditableContext } from "./provider";

function cookieAtual(): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_DE_PUBLICO}=([^;]*)`));
  return m ? m[1] : null;
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
      const valor = valorDoCookieDePublico({ publico: id, sorteio, forca: "forte", origem });
      document.cookie = `${COOKIE_DE_PUBLICO}=${encodeURIComponent(valor)}; path=/; max-age=${DIAS_DA_ESCOLHA[origem] * 86_400}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
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

/** Ouve o evento dos apps (`unbox:definir-publico`). Uma linha no layout, dentro do `EditableProvider`. */
export function PontoDePublico(): null {
  const definir = useDefinirPublico();
  React.useEffect(() => {
    const ouvir = (ev: Event) => {
      const id = (ev as CustomEvent<{ id?: unknown }>).detail?.id;
      if (typeof id === "string") definir(id.trim().toLowerCase(), "app");
    };
    window.addEventListener(EVENTO_DEFINIR_PUBLICO, ouvir);
    return () => {
      window.removeEventListener(EVENTO_DEFINIR_PUBLICO, ouvir);
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
