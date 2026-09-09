// Layout do GRUPO DE ROTAS da loja: header, barra de anúncio e rodapé vivem
// AQUI, não no layout raiz. Assim qualquer página fora da loja (tela de acesso, erro,
// landing avulsa) nasce limpa, sem chrome vazando por trás — basta criá-la fora de (loja).
// O grupo não muda as URLs: app/(loja)/produtos/page.tsx continua sendo /produtos.
import { CartProvider } from "@/components/cart/cart-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function StoreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <CartProvider>
      {/* Coluna flex de altura mínima igual à tela: em página curta (confirmação, conta vazia) o
          rodapé encosta no fim da viewport em vez de flutuar com fundo branco embaixo. */}
      <div className="flex min-h-[100svh] flex-col">
        <SiteHeader />
        {/* .site-main / chrome: ocultos/expandidos em /checkout via CSS :has(.checkout-root) */}
        <main className="site-main mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-6">{children}</main>
        <SiteFooter />
      </div>
    </CartProvider>
  );
}
