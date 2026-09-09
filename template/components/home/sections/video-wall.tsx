"use client";

// Parede de vídeo-depoimentos 9:16 com play inline (portado de loja real em produção).
// ⚠️ SÓ VÍDEO REAL: itens via receita (props.items: [{ poster, videoUrl, label? }]). Sem itens
// com videoUrl, a seção não renderiza — moldura vazia nunca vai ao ar.
import * as React from "react";
import { Play } from "@phosphor-icons/react/dist/ssr";
import type { SectionComponentProps } from "./registry";

type VideoItem = { poster: string; videoUrl?: string; label?: string };


export function VideoWallSection({ sectionProps = {} }: SectionComponentProps) {
  const {
    title = "Quem usa, mostra",
    subtitle = "Depoimentos em vídeo de quem já comprou.",
  } = sectionProps as Record<string, string>;
  const items = ((sectionProps.items as VideoItem[] | undefined) ?? []).filter((v) => v?.poster && v?.videoUrl);
  const [playing, setPlaying] = React.useState<number | null>(null);
  if (items.length === 0) return null;

  return (
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[var(--section-gap,52px)] sm:px-6">
      <div className="mb-[18px]">
        <h2 className="font-display text-[28px] font-extrabold leading-[1.15]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--store-muted)]">{subtitle}</p>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {items.map((v, i) => (
          <div key={i} className="relative aspect-[9/16] overflow-hidden rounded-xl bg-[var(--store-surface-2)]">
            {playing === i && v.videoUrl ? (
              <video src={v.videoUrl} controls autoPlay playsInline className="h-full w-full object-cover" />
            ) : (
              <button type="button" onClick={() => v.videoUrl && setPlaying(i)} aria-label={v.label ?? "Assistir depoimento"} className="group h-full w-full cursor-pointer">
                <img src={v.poster} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                {v.videoUrl && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[var(--store-ink)] transition-transform group-hover:scale-110"><Play weight="fill" className="text-[18px]" /></span>
                  </span>
                )}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
