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
//
// EDITOR: a copy é editável no PONTO DE USO (a receita segue sendo só o literal de partida), com os
// MESMOS caminhos em toda variante (titulo · subtitulo · cta · cta-icone · arte-desktop · arte-mobile):
// trocar a variante na receita não descola o que o lojista já editou. No carrossel cada banner tem o
// próprio escopo (`banner-N.arte-desktop`, `banner-N.arte-mobile`); só o banner na vez está no DOM.
// A arte do celular mora no srcSet do <source>: é valor de imagem que NÃO vira <img>, então vai de
// Slot (Editable.Img ali trocaria o <source> por uma segunda foto na tela). O <img> é puro, e não
// next/image, de propósito: o next/image traria wrapper + srcset e a paridade com o HTML de antes cairia.
// Para o lojista, isto se chama BANNER (id/rótulo da receita), nunca "hero": vocabulário de código.
import * as React from "react";
import Link from "next/link";
import { ArrowRight, CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { Editable, EditableScope } from "@/lib/editable";
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
            {/* cada banner tem o próprio escopo: trocar a foto do 2º não mexe no 1º */}
            <EditableScope path={`banner-${idx + 1}`}>
              <picture>
                {b.imageMobile && (
                  <Editable.Slot path="arte-mobile" type="image" fallback={{ src: b.imageMobile }} label={`Imagem do banner ${idx + 1} (celular)`}>
                    {(v, attrs, ref) => <source ref={ref} media="(max-width: 767px)" srcSet={v.src} width="1122" height="1402" sizes="100vw" {...attrs} />}
                  </Editable.Slot>
                )}
                <Editable.Img path="arte-desktop" fallback={{ src: b.imageDesktop, alt: b.alt ?? "" }} label={`Imagem do banner ${idx + 1} (computador)`} width="1915" height="821" fetchPriority="high" className="block h-auto w-full" />
              </picture>
            </EditableScope>
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
          <Editable.Slot path="arte-mobile" type="image" fallback={{ src: imageMobile }} label="Imagem do banner (celular)">
            {(v, attrs, ref) => <source ref={ref} media="(max-width: 767px)" srcSet={v.src} width="1122" height="1402" sizes="100vw" {...attrs} />}
          </Editable.Slot>
          {/* parallax: a foto desliza DENTRO do frame. Não é reveal — nada da primeira dobra
              entra animado (isso atrasaria a percepção de carregamento e mexeria no LCP).
              alt="" continua vazio de propósito: a foto é decorativa, quem fala é a headline. */}
          <Editable.Img path="arte-desktop" fallback={{ src: imageDesktop, alt: "" }} label="Imagem do banner (computador)" fetchPriority="high" className="parallax-slow block h-[78svh] max-h-[760px] min-h-[420px] w-full object-cover" />
        </picture>
        {/* véu inferior: garante contraste do texto sobre qualquer foto */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[var(--container-max,1240px)] px-6 pb-12 sm:pb-16">
          {/* `as="h1"` mantém o MESMO elemento de antes; `multiline` deixa o lojista escolher onde a
              headline quebra sem mexer no CSS */}
          <Editable.Text as="h1" path="titulo" fallback={title} label="Título" multiline className="font-display titulo-heroi-foto max-w-[680px] text-white" />
          <Editable.Text as="p" path="subtitulo" fallback={subtitle} label="Frase de apoio" className="mt-3 max-w-[520px] text-[15px] leading-[1.5] text-white/85 sm:text-[16px]" />
          <HeroCta label={ctaLabel} href={ctaHref} className="mt-7" />
        </div>
      </div>
    );
  }

  if (variant === "minimal-texto") {
    return (
      <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[22px] sm:px-6">
        <div className="rounded-2xl bg-[var(--store-chrome-bg,#18181B)] px-7 py-14 text-center sm:py-20">
          <Editable.Text as="h1" path="titulo" fallback={title} label="Título" multiline className="font-display titulo-heroi-texto mx-auto max-w-[720px] text-[var(--store-chrome-text,#ffffff)]" />
          <Editable.Text as="p" path="subtitulo" fallback={subtitle} label="Frase de apoio" className="mx-auto mt-4 max-w-[520px] text-[15px] leading-[1.5] text-[var(--store-chrome-muted)]" />
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
            <Editable.Text as="h1" path="titulo" fallback={title} label="Título" multiline className="font-display titulo-heroi-lado" />
            <Editable.Text as="p" path="subtitulo" fallback={subtitle} label="Frase de apoio" className="max-w-[420px] text-[15px] leading-[1.55] text-[var(--store-muted)]" />
            <HeroCta label={ctaLabel} href={ctaHref} className="mt-2" />
          </div>
          <Editable.Img path="arte-desktop" fallback={{ src: imageDesktop, alt: "" }} label="Imagem do banner" fetchPriority="high" className="block h-full min-h-[260px] w-full object-cover" />
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
          <Editable.Slot path="arte-mobile" type="image" fallback={{ src: imageMobile }} label="Imagem do banner (celular)">
            {(v, attrs, ref) => <source ref={ref} media="(max-width: 767px)" srcSet={v.src} width="1122" height="1402" sizes="100vw" {...attrs} />}
          </Editable.Slot>
          <Editable.Img path="arte-desktop" fallback={{ src: imageDesktop, alt: "" }} label="Imagem do banner (computador)" width="1915" height="821" fetchPriority="high" className="block h-auto w-full" />
        </picture>
      </button>
    </div>
  );
}

// O rótulo vem da receita por prop, mas o ponto EDITÁVEL é aqui, no uso. Vai de Slot (e não de
// Editable.Text) porque o botão é `inline-flex gap-2` com dois filhos, rótulo e seta: um <span> a
// mais viraria um terceiro item de flex. Assim o ponto editável é o próprio <a>/<button>, e o HTML
// de produção continua idêntico. O 4º argumento do render-prop é a cor que o lojista deu SÓ a este
// botão; sem ele, cor por elemento não funcionaria aqui.
function HeroCta({ label, href, className = "" }: { label: string; href: string; className?: string }) {
  const cls = "font-display inline-flex items-center gap-2 rounded-full bg-[var(--store-cta,#D97706)] px-7 py-3 text-[15px] font-extrabold text-[var(--store-cta-fg,#1C1207)] no-underline transition-colors hover:bg-[var(--store-cta-dark,#B45309)]";
  const seta = (
    <Editable.Icon path="cta-icone" label="Ícone do botão" size={16}>
      <ArrowRight weight="bold" />
    </Editable.Icon>
  );
  return (
    <Editable.Slot path="cta" type="text" fallback={label} label="Botão principal">
      {(v, attrs, ref, estilo) =>
        href ? (
          <Link ref={ref} href={href} className={`${cls} ${className}`} style={estilo} {...attrs}>{v}{seta}</Link>
        ) : (
          <button ref={ref} type="button" onClick={scrollToDestaques} className={`${cls} ${className}`} style={estilo} {...attrs}>{v}{seta}</button>
        )
      }
    </Editable.Slot>
  );
}
