"use client";

import * as React from "react";
import Image from "next/image";
import { Heart, PlayCircle } from "@phosphor-icons/react/dist/ssr";

export function PdpGallery({
  images,
  videos,
  title,
  discountPct,
}: {
  images: string[];
  videos?: string[];
  title: string;
  discountPct?: number | null;
}) {
  const imgs = images.length ? images : [];
  const [active, setActive] = React.useState(0);
  const [wish, setWish] = React.useState(false);
  const hasVideo = (videos?.length ?? 0) > 0;
  const current = imgs[active];

  // EDITOR: fotos e vídeo são do produto (catálogo da Unbox), não copy do molde: a galeria inteira
  // fica fora do editor (`data-editor-ignore`, README §8).
  return (
    <div className="grid grid-cols-[74px_1fr] gap-4 max-md:flex max-md:flex-col-reverse lg:sticky lg:top-[150px]" data-editor-ignore>
      {/* thumbnails */}
      <div className="flex flex-col gap-3 max-md:flex-row max-md:overflow-x-auto">
        {imgs.slice(0, 4).map((src, i) => (
          <button
            key={src + i}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Imagem ${i + 1}`}
            className="relative h-[74px] w-[74px] shrink-0 overflow-hidden rounded-xl bg-[var(--store-line)]"
            style={{ border: i === active ? "2px solid var(--store-primary,#18181B)" : "1px solid var(--store-line)" }}
          >
            <Image src={src} alt="" fill sizes="74px" className="object-cover" />
          </button>
        ))}
        {hasVideo && (
          <a
            href={videos![0]}
            target="_blank"
            rel="noreferrer"
            className="flex h-[74px] w-[74px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-[var(--store-line)] bg-[var(--store-chrome-bg)] text-white"
          >
            <PlayCircle className="text-[22px] text-[var(--store-cta,#D97706)]" />
            <span className="text-[9px] font-bold">Vídeo</span>
          </a>
        )}
      </div>

      {/* main image */}
      <div className="relative h-[360px] overflow-hidden rounded-xl border border-[var(--store-line)] bg-[var(--store-line)] sm:h-[560px]">
        <div className="absolute left-4 top-4 z-[2] flex flex-col items-start gap-2">
          {/* Sem selo "MAIS VENDIDO" fixo: aparecia em todo produto de toda loja, sem dado de venda.
              O selo de desconto abaixo fica porque vem do compareAtPrice real. */}
          {discountPct ? (
            <span className="rounded-md bg-[var(--store-sale)] px-[11px] py-[5px] text-[11px] font-extrabold tracking-[0.4px] text-white">-{discountPct}% OFF</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setWish((w) => !w)}
          aria-label="Favoritar"
          className="absolute right-4 top-4 z-[2] flex h-[42px] w-[42px] items-center justify-center rounded-full border border-[var(--store-line)] bg-white"
        >
          <Heart weight={wish ? "fill" : "regular"} className="text-[20px]" style={{ color: wish ? "var(--store-sale)" : "var(--store-muted)" }} />
        </button>
        {current ? (
          <Image src={current} alt={title} fill priority sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--store-muted)]">sem imagem</div>
        )}
        {imgs.length > 1 && (
          <div className="absolute bottom-3.5 left-1/2 flex -translate-x-1/2 gap-1.5">
            {imgs.slice(0, 4).map((_, i) => (
              <span key={i} className="h-2 w-2 rounded-full" style={{ background: i === active ? "var(--store-primary,#18181B)" : "var(--store-line-2)" }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
