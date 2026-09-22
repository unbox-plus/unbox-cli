// Layout do GRUPO DE ROTAS da loja: header, barra de anúncio e rodapé vivem
// AQUI, não no layout raiz. Assim qualquer página fora da loja (tela de acesso, erro,
// landing avulsa) nasce limpa, sem chrome vazando por trás — basta criá-la fora de (loja).
// O grupo não muda as URLs: app/(loja)/produtos/page.tsx continua sendo /produtos.
//
// A moldura em si mora em components/moldura-da-loja.tsx: a prévia do editor (app/previa-do-editor) usa a mesma.
import { MolduraDaLoja } from "@/components/moldura-da-loja";

export default function StoreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <MolduraDaLoja>{children}</MolduraDaLoja>;
}
