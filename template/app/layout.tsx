import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
// EDITOR DE LOJA: o conteúdo publicado pelo lojista entra aqui e os primitivos o aplicam por cima do
// que está escrito no código. Sem EDITOR_URL no ambiente, `conteudo` é null e a loja renderiza
// exatamente o código: o editor fica desligado, sem efeito nenhum.
import { EditableProvider } from "@/lib/editable";
import { getPublishedContent, presencaNoAmbiente } from "@/lib/editable/server";
// RASTREIO E MARKETING: a foundation renderiza tudo (GTM da Unbox e do lojista, GA4, Meta Pixel, TikTok,
// Pinterest, page_view por rota, botão de WhatsApp) numa linha, `<Rastreio>`; este layout não conhece
// provedor nenhum, e o próximo entra por versão da foundation. Ela lê as MESMAS variáveis de sempre
// (NEXT_PUBLIC_GTM_ID, NEXT_PUBLIC_GA_ID, NEXT_PUBLIC_META_PIXEL_ID) com a mesma régua (placeholder e
// formato errado são ausência; Pixel só sem GTM próprio), então nenhuma loja perde rastreio.
import { Rastreio } from "@/lib/editable/rastreio";
import { EDITABLE_TOKENS } from "@/lib/editable/tokens";
import { EDITOR_ORIGIN, STORE_SLUG } from "@/lib/editable/config";

// UNBOX-FONTS-BEGIN (bloco reescrito pelo create-unbox-store conforme o estilo escolhido — não renomear os markers)
import { Geist_Mono, Poppins, Plus_Jakarta_Sans } from "next/font/google";
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const sans = Plus_Jakarta_Sans({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const displayFont = Poppins({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700", "800"], display: "swap" });
// UNBOX-FONTS-END

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// ═══════════════════════════════════════════════════════════════════════════
// GTM CENTRAL DA UNBOX — OBRIGATÓRIO EM TODA LOJA. NÃO REMOVA NEM TROQUE O ID.
// É o container central da Unbox para captura de dados da plataforma (parte do
// contrato da loja). Tags próprias da marca NÃO entram aqui: o lojista configura
// os IDs dele (GTM próprio, GA4, Meta Pixel, TikTok, Pinterest, WhatsApp) na aba
// Apps do painel do editor, ou o cadastro da loja os traz do ambiente
// (NEXT_PUBLIC_GTM_ID / NEXT_PUBLIC_GA_ID / NEXT_PUBLIC_META_PIXEL_ID …), e a
// foundation injeta (`<Rastreio>`, lib/editable/rastreio.tsx), nunca
// editando/substituindo este ID. Este literal vai para o `<Rastreio>` como o
// contêiner contratual, e o prebuild (scripts/check-unbox-brand.mjs) cobra que
// ele continue aqui.
// ═══════════════════════════════════════════════════════════════════════════
const UNBOX_GTM_ID = "GTM-PZLT336";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Minha Loja · Compre Online",
    template: "%s · Minha Loja",
  },
  // ⚠ Descrição PROVISÓRIA: não diz o que a loja vende. O briefing troca por uma frase com o
  // produto e o público — é o que busca e resposta de IA extraem. O build avisa enquanto for esta.
  // Sem description de fábrica, de propósito: "Produtos de qualidade entregues na sua casa"
  // PARECE preenchido e ninguém revisa. Vazio o build avisa e o Google gera a partir do
  // conteúdo, que é melhor que uma frase que não diz o que a loja vende. O briefing escreve.
  description: process.env.NEXT_PUBLIC_SITE_DESCRIPTION || undefined,
  // openGraph.images vem de app/opengraph-image.tsx (gerada com o nome da loja nas cores da
  // marca): todo compartilhamento sai com imagem, mesmo antes de a marca mandar uma foto.
  openGraph: { type: "website", locale: "pt_BR", siteName: "Minha Loja" },
  twitter: { card: "summary_large_image" },
  // Favicon: NÃO declarar `icons` aqui — app/icon.svg e app/apple-icon.svg (convenção do
  // App Router) já geram os <link> corretos. Apontar pro logo horizontal deixa o favicon
  // ilegível/invisível na aba. Personalize substituindo esses dois arquivos.
};

// NÃO adicione maximumScale/userScalable aqui. Bloquear o pinch-zoom viola a WCAG 1.4.4
// (Resize Text) e prejudica de verdade quem depende de ampliar a tela — e toda loja gerada
// herdava isso. O motivo original era o zoom automático do iOS ao focar um input, que
// acontece quando o campo tem fonte MENOR que 16px; a correção certa é o piso de 16px nos
// controles de formulário no mobile, que está em app/globals.css.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const conteudo = await getPublishedContent();
  return (
    <html lang="pt-BR">
      <body className={`${sans.variable} ${geistMono.variable} ${displayFont.variable} antialiased`}>
        {/* Header/rodapé/nav da loja NÃO ficam aqui: moram em app/(loja)/layout.tsx (route
            group). Página criada fora de (loja) — acesso, erro, landing — nasce sem chrome. */}
        <EditableProvider doc={conteudo} shop={STORE_SLUG} tokens={EDITABLE_TOKENS} editorOrigin={EDITOR_ORIGIN || undefined} apps={presencaNoAmbiente(process.env, { unboxGtmId: UNBOX_GTM_ID })}>
          {children}
        </EditableProvider>
        <Toaster position="top-center" />
        {/* rastreio e marketing: o que o lojista publicou na aba Apps vence o ambiente, provedor a provedor,
            e cada provedor dispara UMA vez; o contêiner da Unbox entra sempre. Só muda quando ele PUBLICA.
            Nada de script de GA/Pixel/GTM escrito à mão neste arquivo: seria o mesmo provedor duas vezes. */}
        <Rastreio doc={conteudo} ambiente={process.env} unboxGtmId={UNBOX_GTM_ID} />
      </body>
    </html>
  );
}
