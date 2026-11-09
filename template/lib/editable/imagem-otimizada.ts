// ═══════════════════════════════════════════════════════════════════════════
// IMAGEM OTIMIZADA PARA <img> E <source> PUROS
//
// O banner da home é `<picture>` com `<img>` puro, sem o wrapper do next/image (ver o
// cabeçalho de components/home/sections/hero.tsx). Puro, ele também saía SEM o
// otimizador: a arte ia ao navegador como foi salva. Medido numa loja da esteira em
// 23/10/2026: a arte do celular era um JPEG de 634 KB, 40% do peso da home e o LCP da
// página (simulado em 4G: 9,6 s). Pelo otimizador a mesma arte, em WebP na largura da
// tela, tem ~40 KB.
//
// `imagemOtimizada` devolve o `src`/`srcSet`/`sizes` que o next/image geraria
// (`getImageProps`, a saída oficial do Next para `<picture>` com duas artes), sem mudar
// o elemento. O que o otimizador recusaria volta como veio:
//   • URL de host fora de `images.remotePatterns` (next.config.ts): o /_next/image
//     responde 400 e a foto sumiria. A lista abaixo é a MESMA de lá; host novo entra nos
//     dois lugares;
//   • SVG, `data:` e `blob:`: o próprio getImageProps os deixa sem otimizar.
// ═══════════════════════════════════════════════════════════════════════════
import { getImageProps } from "next/image";

// os `**.<host>` de images.remotePatterns: qualquer subdomínio, nunca o domínio puro
const HOSTS_DO_OTIMIZADOR = [".s3.amazonaws.com", ".unbox.com.br", ".public.blob.vercel-storage.com", ".myunbox.com.br"];

function otimizavel(src: string): boolean {
  if (src.startsWith("/")) return !src.startsWith("//");
  try {
    const u = new URL(src);
    return u.protocol === "https:" && HOSTS_DO_OTIMIZADOR.some((h) => u.hostname.endsWith(h));
  } catch {
    return false;
  }
}

/** `sizes` é a largura que a imagem ocupa na tela (ex.: "100vw"); é ela que escolhe o arquivo do `srcSet`. */
export function imagemOtimizada(src: string, sizes: string): { src: string; srcSet?: string; sizes?: string } {
  if (!src || !otimizavel(src)) return { src };
  const { props } = getImageProps({ src, alt: "", fill: true, sizes });
  return props.srcSet ? { src: props.src, srcSet: props.srcSet, sizes: props.sizes } : { src };
}
