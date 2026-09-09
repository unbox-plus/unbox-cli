import * as React from "react";
import Image from "next/image";

// Hosts que o next.config.ts autoriza no otimizador. Manter em sincronia com `images.remotePatterns`.
const HOSTS_OTIMIZADOS = [/(^|\.)unbox\.com\.br$/i, /(^|\.)s3\.amazonaws\.com$/i, /(^|\.)public\.blob\.vercel-storage\.com$/i, /(^|\.)myunbox\.com\.br$/i];

/**
 * Foto de seção: passa pelo otimizador do Next quando dá, e cai em `<img>` quando não dá.
 *
 * Por que não usar `next/image` direto: o `src` vem da RECEITA, escrito no briefing. Se alguém
 * apontar para um host que o `next.config.ts` não autoriza (o CDN da agência, um link do
 * Instagram), o `next/image` LANÇA e a página inteira deixa de renderizar. Uma foto fora do host
 * esperado não pode derrubar a home: aqui ela só deixa de ser otimizada.
 *
 * `sizes` é obrigatório de propósito. Sem ele o navegador não sabe o tamanho de exibição e baixa
 * uma variante grande demais (peso) ou pequena demais (borrada). Passe o tamanho REAL na tela.
 *
 * EDITOR: `ref` e `attrs` existem para a foto virar ponto editável SEM trocar este componente por
 * um `<img>` puro (o que jogaria fora a otimização): a seção a envolve num `Editable.Slot` de imagem
 * e repassa os dois argumentos do render-prop, `(v, attrs, ref) => <Foto ref={ref} attrs={attrs}
 * src={v.src} … />`. Em produção `attrs` chega vazio e o HTML é o mesmo de antes.
 */
export function Foto({
  src, alt = "", width, height, sizes, className, priority = false, ref, attrs,
}: {
  src: string;
  alt?: string;
  width: number;
  height: number;
  sizes: string;
  className?: string;
  priority?: boolean;
  /** o ref do `Editable.Slot` (é ele que dá ao editor o elemento para selecionar) */
  ref?: React.Ref<HTMLImageElement>;
  /** os atributos `data-editor-*` do `Editable.Slot`; só existem em modo edição */
  attrs?: Record<string, string | undefined>;
}) {
  const local = src.startsWith("/");
  let otimizavel = local;
  if (!local) {
    try {
      otimizavel = HOSTS_OTIMIZADOS.some((rx) => rx.test(new URL(src).hostname));
    } catch {
      otimizavel = false;
    }
  }
  if (!otimizavel) {
    // eslint-disable-next-line @next/next/no-img-element -- host fora do otimizador: ver comentário acima
    return <img ref={ref} {...attrs} src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" className={className} />;
  }
  return (
    <Image ref={ref} {...attrs} src={src} alt={alt} width={width} height={height} sizes={sizes} className={className} priority={priority} />
  );
}
