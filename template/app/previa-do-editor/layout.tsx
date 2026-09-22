// A PRÉVIA DO EDITOR COM A MOLDURA DA LOJA (foundation 18).
//
// A rota mora fora de app/(loja)/ para não entrar na varredura de rotas editáveis pelo simples fato de existir, e
// por isso nascia sem cabeçalho e rodapé: a prévia de uma página do lojista mostrava só o corpo, diferente do que
// vai ao ar, e o "Ocultar cabeçalho" / "Ocultar rodapé" da ficha (landing page) não tinha o que mostrar. Com a
// mesma moldura da loja (components/moldura-da-loja.tsx), a prévia é a página como ela vai ao ar, e o cabeçalho e o
// rodapé continuam editáveis aqui como em qualquer página do código (é o mesmo container `chrome`).
import { MolduraDaLoja } from "@/components/moldura-da-loja";

export default function LayoutDaPrevia({ children }: Readonly<{ children: React.ReactNode }>) {
  return <MolduraDaLoja>{children}</MolduraDaLoja>;
}
