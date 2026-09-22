// A MOLDURA DA LOJA: o cabeçalho (com a faixa de avisos), o <main> e o rodapé, dentro do carrinho. Dois layouts a
// usam: o do grupo de rotas da loja (app/(loja)/layout.tsx) e o da prévia do editor (app/previa-do-editor/layout.tsx).
// Uma moldura só para as duas: a página do lojista aparece na prévia com o que vai ao ar em volta dela, e o "Ocultar
// cabeçalho" / "Ocultar rodapé" da ficha (landing page) aparece na hora, pela mesma regra de app/globals.css.
import { CartProvider } from "@/components/cart/cart-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function MolduraDaLoja({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      {/* Coluna flex de altura mínima igual à tela: em página curta (confirmação, conta vazia) o
          rodapé encosta no fim da viewport em vez de flutuar com fundo branco embaixo. */}
      <div className="flex min-h-[100svh] flex-col">
        <SiteHeader />
        {/* .site-main / chrome: ocultos/expandidos em /checkout via CSS :has(.checkout-root), e numa landing page
            que pediu (`.lp-sem-cabecalho`, `.lp-sem-rodape`) */}
        <main className="site-main mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-6">{children}</main>
        <SiteFooter />
      </div>
    </CartProvider>
  );
}
