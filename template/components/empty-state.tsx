import { Package } from "@phosphor-icons/react/dist/ssr";

export function EmptyState({
  title,
  description,
  // Nível do título do aviso. O padrão é h4 porque, na maioria das telas, este bloco fica
  // DENTRO de uma página que já tem o seu título (a busca mostra o campo, o h1 e, abaixo,
  // "Nada encontrado"): ali ele é rótulo de bloco. Mas em duas telas ele é a página inteira
  // — o carrinho vazio e o pedido que não dá para exibir não têm mais nada — e um rótulo
  // sozinho deixaria a página sem h1 nenhum. Elas pedem "h1", como o catálogo já faz com o
  // título dos resultados.
  tituloComo: Titulo = "h4",
  children,
}: {
  title: string;
  description?: string;
  tituloComo?: "h1" | "h4";
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--store-line-2)] bg-[var(--store-surface)] px-6 py-16 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--store-primary-soft,#F1F1F3)] text-[var(--store-primary,#18181B)]">
        <Package weight="duotone" className="text-[34px]" />
      </span>
      <Titulo className="font-display text-[var(--store-ink)]">{title}</Titulo>
      {description && <p className="mt-1.5 max-w-sm text-[14px] leading-[1.5] text-[var(--store-muted)]">{description}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
