const METHODS = [
  { label: "Visa",             src: "/brand/pay-visa.webp" },
  { label: "Mastercard",       src: "/brand/pay-mastercard.webp" },
  { label: "Elo",              src: "/brand/pay-elo.webp" },
  { label: "American Express", src: "/brand/pay-amex.webp" },
  { label: "Pix",              src: "/brand/pay-pix.webp" },
];

export function PaymentChips({ size = "sm" }: { size?: "sm" | "md" }) {
  const h = size === "md" ? "h-[34px]" : "h-[28px]";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {METHODS.map((m) => (
        // eslint-disable-next-line @next/next/no-img-element -- bandeiras de ~1 KB: passar 1 KB pelo otimizador não economiza nada. O que importa aqui é o loading=lazy, porque o React 19 preloada <img> eager renderizado no servidor e estas ficam no rodapé.
        <img key={m.label} src={m.src} alt={m.label} loading="lazy" decoding="async" className={`${h} w-auto rounded`} />
      ))}
    </div>
  );
}
