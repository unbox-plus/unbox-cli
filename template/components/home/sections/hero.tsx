"use client";

// HERO da home — 5 variantes (escolhidas na receita):
//   "imagem-full"    banner de imagem full-width clicável (default)
//   "carousel"       carrossel de banners com setas + dots (portado de loja real em produção)
//   "split-editorial" texto + CTA à esquerda, imagem à direita
//   "minimal-texto"  hero tipográfico sobre o chrome, sem imagem (nunca dá 404)
//   "imagem-imersiva" foto sangrando até a borda, PASSANDO POR BAIXO do header — é a única
//                     variante que emite `.hero-imersivo`, a classe que deixa o header
//                     "imersivo" ficar transparente (regra em app/globals.css). Exige foto
//                     real e boa: sem ela, prefira imagem-full ou minimal-texto.
// props da receita: imageDesktop/imageMobile (paths), banners (carousel),
// title/subtitle/ctaLabel/ctaHref (texto).
import * as React from "react";
import Link from "next/link";
import { ArrowRight, CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { SectionComponentProps } from "./registry";

function scrollToDestaques() {
  document.getElementById("destaques")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

type Banner = { imageDesktop: string; imageMobile?: string; href?: string; alt?: string };

export function HeroSection({ variant = "imagem-full", sectionProps = {} }: SectionComponentProps) {
  const {
    // TODO: o agente de branding troca pelas imagens reais da marca (.webp) via receita
    imageDesktop = "/brand/hero-desktop.svg",
    imageMobile = "/brand/hero-mobile.svg",
    title = "Bem-vindo à nossa loja",
    subtitle = "Produtos escolhidos com cuidado, do nosso catálogo pra sua casa.",
    ctaLabel = "Ver destaques",
    ctaHref = "",
  } = sectionProps as Record<string, string>;
  const banners = (sectionProps.banners as Banner[] | undefined) ?? [
    { imageDesktop, imageMobile },
    { imageDesktop, imageMobile },
    { imageDesktop, imageMobile },
  ];
  const [idx, setIdx] = React.useState(0);

  if (variant === "carousel") {
    const step = (d: number) => setIdx((i) => (i + d + banners.length) % banners.length);
    const b = banners[idx];
    const Frame = ({ children }: { children: React.ReactNode }) =>
      b.href ? <Link href={b.href} className="block">{children}</Link> : <button type="button" onClick={scrollToDestaques} aria-label="Ver destaques" className="block w-full cursor-pointer">{children}</button>;
    return (
      // full-bleed: banner em card arredondado é o tell nº 1 de "site de template".
      <div className="w-full">
        <div className="relative overflow-hidden bg-[var(--store-chrome-bg,#18181B)]">
          <Frame>
            <picture>
              {b.imageMobile && <source media="(max-width: 767px)" srcSet={b.imageMobile} width="1122" height="1402" sizes="100vw" />}
              <img src={b.imageDesktop} alt={b.alt ?? ""} width="1915" height="821" fetchPriority="high" className="block h-auto w-full" />
            </picture>
          </Frame>
          {banners.length > 1 && (
            <>
              <button type="button" onClick={() => step(-1)} aria-label="Banner anterior" className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[var(--store-ink)] transition-colors hover:bg-white"><CaretLeft weight="bold" /></button>
              <button type="button" onClick={() => step(1)} aria-label="Próximo banner" className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[var(--store-ink)] transition-colors hover:bg-white"><CaretRight weight="bold" /></button>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                {banners.map((_, i) => (
                  <button key={i} type="button" onClick={() => setIdx(i)} aria-label={`Banner ${i + 1}`} className={`h-2 w-2 rounded-full ${i === idx ? "bg-white" : "bg-white/45"}`} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (variant === "imagem-imersiva") {
    return (
      // .hero-imersivo: marcador que o CSS usa pra deixar o header transparente. Sem
      // max-w/px/pt/rounded — a foto tem que encostar nas 4 bordas e subir por baixo do header.
      <div className="hero-imersivo relative w-full overflow-hidden">
        <picture>
          <source media="(max-width: 767px)" srcSet={imageMobile} width="1122" height="1402" sizes="100vw" />
          {/* parallax: a foto desliza DENTRO do frame. Não é reveal — nada da primeira dobra
              entra animado (isso atrasaria a percepção de carregamento e mexeria no LCP). */}
          <img src={imageDesktop} alt="" fetchPriority="high" className="parallax-slow block h-[78svh] max-h-[760px] min-h-[420px] w-full object-cover" />
        </picture>
        {/* véu inferior: garante contraste do texto sobre qualquer foto */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[var(--container-max,1240px)] px-6 pb-12 sm:pb-16">
          <h1 className="font-display max-w-[680px] text-[34px] font-extrabold leading-[1.08] text-white sm:text-[52px]">{title}</h1>
          <p className="mt-3 max-w-[520px] text-[15px] leading-[1.5] text-white/85 sm:text-[16px]">{subtitle}</p>
          <HeroCta label={ctaLabel} href={ctaHref} className="mt-7" />
        </div>
      </div>
    );
  }

  if (variant === "minimal-texto") {
    return (
      <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[22px] sm:px-6">
        <div className="rounded-2xl bg-[var(--store-chrome-bg,#18181B)] px-7 py-14 text-center sm:py-20">
          <h1 className="font-display mx-auto max-w-[720px] text-[32px] font-extrabold leading-[1.12] text-[var(--store-chrome-text,#ffffff)] sm:text-[44px]">{title}</h1>
          <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-[1.5] text-[var(--store-chrome-muted)]">{subtitle}</p>
          <HeroCta label={ctaLabel} href={ctaHref} className="mt-8" />
        </div>
      </div>
    );
  }

  if (variant === "split-editorial") {
    return (
      <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[22px] sm:px-6">
        <div className="grid overflow-hidden store-card rounded-2xl md:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col items-start justify-center gap-4 px-7 py-10 sm:px-10">
            <h1 className="font-display text-[28px] font-extrabold leading-[1.15] sm:text-[36px]">{title}</h1>
            <p className="max-w-[420px] text-[15px] leading-[1.55] text-[var(--store-muted)]">{subtitle}</p>
            <HeroCta label={ctaLabel} href={ctaHref} className="mt-2" />
          </div>
          <img src={imageDesktop} alt="" fetchPriority="high" className="block h-full min-h-[260px] w-full object-cover" />
        </div>
      </div>
    );
  }

  // imagem-full (default)
  return (
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[22px] sm:px-6">
      <button
        type="button"
        onClick={scrollToDestaques}
        aria-label="Ver destaques da loja"
        className="block w-full cursor-pointer overflow-hidden rounded-2xl bg-[var(--store-chrome-bg,#18181B)] shadow-sm outline-none transition-transform hover:scale-[1.003] focus-visible:ring-4 focus-visible:ring-[var(--store-cta,#D97706)] focus-visible:ring-offset-2"
      >
        <picture>
          <source media="(max-width: 767px)" srcSet={imageMobile} width="1122" height="1402" sizes="100vw" />
          <img src={imageDesktop} alt="" width="1915" height="821" fetchPriority="high" className="block h-auto w-full" />
        </picture>
      </button>
    </div>
  );
}

function HeroCta({ label, href, className = "" }: { label: string; href: string; className?: string }) {
  const cls = "font-display inline-flex items-center gap-2 rounded-full bg-[var(--store-cta,#D97706)] px-7 py-3 text-[15px] font-extrabold text-[var(--store-cta-fg,#1C1207)] no-underline transition-colors hover:bg-[var(--store-cta-dark,#B45309)]";
  if (href) {
    return (
      <Link href={href} className={`${cls} ${className}`}>{label}<ArrowRight weight="bold" /></Link>
    );
  }
  return (
    <button type="button" onClick={scrollToDestaques} className={`${cls} ${className}`}>{label}<ArrowRight weight="bold" /></button>
  );
}
