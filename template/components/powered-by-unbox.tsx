// ═══════════════════════════════════════════════════════════════════════════
// POWERED BY UNBOX — OBRIGATÓRIO EM TODA LOJA (parte do contrato com a Unbox).
// NÃO remova este componente do rodapé nem o asset /unbox/powered-by.png.
// O build FALHA sem ele (scripts/check-unbox-brand.mjs, rodado no prebuild) —
// ou seja, o site não deploya sem o selo. Restyle é permitido (tamanho/opacity),
// remoção não.
// ═══════════════════════════════════════════════════════════════════════════

export function PoweredByUnbox({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://www.unbox.com.br?utm_source=storefront&utm_medium=powered-by"
      target="_blank"
      rel="noopener"
      className={`inline-flex items-center gap-2 no-underline opacity-80 transition-opacity hover:opacity-100 ${className}`}
    >
      <span className="text-[11px] font-semibold tracking-[0.3px]">Powered by</span>
      {/* REGRA DAS VARIANTES (definida pela Unbox): /unbox/powered-by.png é o arquivo ATIVO.
          Rodapé ESCURO → copie powered-by-transparente.png (logo neon transparente) por cima.
          Rodapé CLARO  → copie powered-by-fundo-preto.png (logo sobre fundo preto) por cima.
          O CLI já escolhe a variante certa pelo chrome do preset; se você mudar a cor do
          rodapé depois, troque o arquivo ativo pela variante correspondente. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- selo fixo de 67x23 px, servido do próprio domínio. */}
      <img src="/unbox/powered-by.png" alt="Unbox" width={67} height={23} loading="lazy" decoding="async" className="h-[23px] w-auto" />
    </a>
  );
}
