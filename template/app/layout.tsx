import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { RouteAnalytics } from "@/components/analytics/route-analytics";
import { Toaster } from "@/components/ui/sonner";

// UNBOX-FONTS-BEGIN (bloco reescrito pelo create-unbox-store conforme o estilo escolhido — não renomear os markers)
import { Geist_Mono, Poppins, Plus_Jakarta_Sans } from "next/font/google";

/** ID de analytics só vale se tiver a CARA de um ID. Placeholder ("x", "todo", "G-XXXX") é
 *  truthy e passa em `if (id)`, então o script carrega, inicializa com lixo e não reporta em
 *  lugar nenhum, sem dar sinal no painel nem no DevTools. */
function idValido(bruto: string | undefined, formato: RegExp): string | null {
  const id = bruto?.trim();
  if (!id || /^(x+|todo|placeholder|seu[-_]?id|sua[-_]?id|G-XXXX.*|GTM-XXXX.*|AW-XXXX.*)$/i.test(id)) return null;
  return formato.test(id) ? id : null;
}
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const sans = Plus_Jakarta_Sans({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const displayFont = Poppins({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700", "800"], display: "swap" });
// UNBOX-FONTS-END

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// ═══════════════════════════════════════════════════════════════════════════
// GTM CENTRAL DA UNBOX — OBRIGATÓRIO EM TODA LOJA. NÃO REMOVA NEM TROQUE O ID.
// É o container central da Unbox para captura de dados da plataforma (parte do
// contrato da loja). Tags próprias da marca NÃO entram aqui: use os campos
// opcionais NEXT_PUBLIC_GA_ID / NEXT_PUBLIC_META_PIXEL_ID abaixo (ou um
// container GTM adicional próprio), nunca editando/substituindo este ID.
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Placeholder que passa em validação é pior que campo vazio: uma loja rodou 31 DIAS com
  // NEXT_PUBLIC_GA_ID="x", os scripts carregando, o painel mostrando a variável preenchida e
  // nada chegando em conta nenhuma. Vazio quebra visivelmente; "x" quebra em silêncio.
  const gaId = idValido(process.env.NEXT_PUBLIC_GA_ID, /^(G|AW|UA)-/);
  const gtmDaLoja = idValido(process.env.NEXT_PUBLIC_GTM_ID, /^GTM-/);
  // Pixel no container E no código = PageView contado duas vezes, e a inflação é silenciosa.
  // Com o container da loja configurado, o Pixel entra por ele (é o que a agência espera mexer).
  const metaPixelId = gtmDaLoja ? null : idValido(process.env.NEXT_PUBLIC_META_PIXEL_ID, /^\d{5,}$/);
  return (
    <html lang="pt-BR">
      <body className={`${sans.variable} ${geistMono.variable} ${displayFont.variable} antialiased`}>
        {/* GTM central da Unbox — obrigatório, não remover (ver comentário em UNBOX_GTM_ID) */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${UNBOX_GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {/* Container da PRÓPRIA loja (NEXT_PUBLIC_GTM_ID), quando a marca tem um. Convive com o
            central da Unbox: são dois containers independentes lendo o mesmo dataLayer. */}
        {gtmDaLoja && (
          <>
            <noscript>
              <iframe src={`https://www.googletagmanager.com/ns.html?id=${gtmDaLoja}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} />
            </noscript>
            <Script id="gtm-loja" strategy="afterInteractive">
              {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmDaLoja}');`}
            </Script>
          </>
        )}
        <Script id="unbox-gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${UNBOX_GTM_ID}');`}
        </Script>
        {gaId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
            </Script>
          </>
        )}
        {metaPixelId && (
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId}');fbq('track','PageView');`}
          </Script>
        )}
        {/* sempre ativo: alimenta o dataLayer do GTM central com page_view nas navegações SPA
            (e GA4/Meta quando configurados) */}
        <RouteAnalytics />
        {/* Header/rodapé/nav da loja NÃO ficam aqui: moram em app/(loja)/layout.tsx (route
            group). Página criada fora de (loja) — acesso, erro, landing — nasce sem chrome. */}
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
