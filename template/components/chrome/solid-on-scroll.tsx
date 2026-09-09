"use client";

// Casca de pintura do header SOBREPOSTO: transparente no topo, sólido depois de rolar.
// É o ÚNICO arquivo client do chrome — as variantes seguem sendo server components e
// entram aqui como `children` (o App Router renderiza o filho no servidor e serializa).
//
// Sem hydration mismatch: o estado inicial (`false`) é exatamente o que o SSR emitiu.
// Nunca leia window.scrollY durante o render.
//
// A decisão de PINTURA fica toda no CSS (`.chrome-bar:not([data-solid])` em globals.css),
// por isso aqui só marcamos o atributo — assim o estado de scroll e a regra de
// transparência condicional (:has(.hero-imersivo)) convivem sem duplicar cor no JSX.
import * as React from "react";

export function SolidOnScroll({
  children,
  className = "",
  threshold = 80,
}: {
  children: React.ReactNode;
  className?: string;
  threshold?: number;
}) {
  const [solid, setSolid] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () =>
      setSolid((window.scrollY || document.documentElement.scrollTop || 0) > threshold);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // corrige scroll restaurado (voltar/avançar, link com #hash)
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return (
    <div className={`chrome-bar ${className}`} data-solid={solid || undefined}>
      {children}
    </div>
  );
}
