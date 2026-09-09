// RASTREIO E MARKETING DA LOJA: o que entra na página, decidido em UM lugar (foundation 12).
//
// O app/layout.tsx da loja chama só isto, numa linha:
//
//   <Rastreio doc={conteudo} ambiente={process.env} unboxGtmId={UNBOX_GTM_ID} />
//
// e não conhece provedor nenhum. Daqui saem o contêiner central da Unbox (contrato: sempre ligado), o
// contêiner PRÓPRIO do lojista, o Google Analytics 4, o Meta Pixel, o TikTok Pixel, a Pinterest Tag, o
// page_view de cada navegação e o botão flutuante de WhatsApp. O próximo provedor entra por versão da
// foundation, sem tocar no layout de loja nenhuma: foi o dono que recusou reescrever os sites a cada
// capacidade nova.
//
// QUEM DECIDE O QUE ENTRA é `rastreioEmVigor` (document.ts): o que o lojista publicou na aba Apps do
// painel vence o valor do ambiente, provedor a provedor, e cada provedor entra UMA vez. Este arquivo só
// desenha o snippet de cada valor em vigor. O contêiner da Unbox não passa por essa regra: é contrato,
// entra sempre, e o contêiner próprio do lojista só entra se for OUTRO (os dois leem o mesmo dataLayer;
// o mesmo ID duas vezes seria o mesmo contêiner carregado em dobro).
//
// SERVIDOR SÓ: lê `process.env` inteiro (as variáveis são conhecidas pelo nome, `VARIAVEIS_DE_RASTREIO`),
// e o que chega ao navegador é o snippet com o ID, que já é público de qualquer jeito. A parte que
// precisa de hook de cliente (o page_view por rota) mora em rastreio-navegacao.tsx. Não importe este
// arquivo de um componente de cliente.
//
// Os IDs chegam validados pela régua de formato (`recusaDeRastreio`): só letras, números e hífen, que
// é o que permite interpolá-los dentro de um script inline sem escapar nada. O número e a mensagem do
// WhatsApp vão num `href` (o React escapa o atributo) e a mensagem passa por encodeURIComponent em
// `linkDoWhatsapp` (document.ts), que não lança nem para documento gravado com mensagem quebrada: este
// componente está no layout de toda página, e uma exceção aqui derrubava a loja inteira.
//
// PAGE_VIEW: cada provedor tem UM dono. O GA4 conta a navegação sozinho (medição otimizada de mudanças
// de histórico, ligada por padrão); Meta, TikTok e Pinterest não, e é `PageViewPorRota`
// (rastreio-navegacao.tsx) que os avisa. O porquê está no comentário de lá.
//
// OS SCRIPTS SÓ MUDAM QUANDO O LOJISTA PUBLICA: é o documento publicado que chega aqui. E a camada herda
// o comportamento de consentimento que a loja já tem: ela não põe banner, não segura pixel nem libera
// nada a mais (ver README, "Apps: rastreio e marketing").
import Script from "next/script";
import { linkDoWhatsapp, rastreioEmVigor, type Ambiente, type ContentDocument } from "./document";
import { PageViewPorRota } from "./rastreio-navegacao";

const SNIPPET_GTM = (id: string) =>
  `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`;

/** um contêiner do Google Tag Manager: o noscript e o loader. `chave` distingue o da Unbox do próprio. */
function Gtm({ id, chave }: { id: string; chave: string }) {
  return (
    <>
      <noscript>
        <iframe src={`https://www.googletagmanager.com/ns.html?id=${id}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} />
      </noscript>
      <Script id={chave} strategy="afterInteractive">
        {SNIPPET_GTM(id)}
      </Script>
    </>
  );
}

function Ga4({ id }: { id: string }) {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}

function MetaPixel({ id }: { id: string }) {
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`}
    </Script>
  );
}

function TiktokPixel({ id }: { id: string }) {
  return (
    <Script id="tiktok-pixel" strategy="afterInteractive">
      {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${id}');ttq.page();}(window,document,'ttq');`}
    </Script>
  );
}

function PinterestTag({ id }: { id: string }) {
  return (
    <>
      <Script id="pinterest-tag" strategy="afterInteractive">
        {`!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");pintrk('load','${id}');pintrk('page');`}
      </Script>
      <noscript>
        {/* pixel 1x1 de quem está sem JavaScript: não é imagem da página, e next/image não se aplica */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height="1" width="1" style={{ display: "none" }} alt="" src={`https://ct.pinterest.com/v3/?tid=${id}&noscript=1`} />
      </noscript>
    </>
  );
}

// ── BOTÃO FLUTUANTE DE WHATSAPP ──────────────────────────────────────────────────────────────────
//
// Abre wa.me/<numero>?text=<mensagem> numa aba nova. Só existe com número em vigor; sem número o
// layout fica exatamente como era. Padrão do CTA flutuante de uma loja piloto (components/floating-cta.tsx):
// fixo, some no checkout junto com o resto do chrome (`.site-chrome`, regra que as lojas já têm em
// globals.css) e no celular sobe acima da barra de navegação inferior. Canto direito, para não disputar
// o centro com o CTA de compra.
//
// O CSS vai inline, num <style> próprio, de propósito: a foundation é copiada para lojas com Tailwind
// configurado de jeitos diferentes, e uma classe utilitária que a loja não gera vira botão sem estilo.
// Ícone só, sem texto visível: o rótulo está em `aria-label`/`title`. Não há copy aqui para o lojista
// editar (`data-editor-ignore`): número e mensagem são configuração, e se editam na aba Apps.
const CSS_DO_BOTAO = `.unbox-whatsapp{position:fixed;right:16px;bottom:96px;z-index:40;display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:9999px;background:#25D366;color:#fff;box-shadow:0 10px 28px rgba(0,0,0,.28);transition:transform .15s ease}.unbox-whatsapp:hover{transform:scale(1.05)}.unbox-whatsapp:focus-visible{outline:2px solid #25D366;outline-offset:2px}@media (min-width:768px){.unbox-whatsapp{right:24px;bottom:24px}}`;
const CAMINHO_DO_ICONE =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";

/** o link do botão mora em document.ts (`linkDoWhatsapp`, testado no runner do editor); sai daqui também */
export { linkDoWhatsapp };

function BotaoDeWhatsapp({ numero, mensagem }: { numero: string; mensagem?: string }) {
  return (
    <>
      <style>{CSS_DO_BOTAO}</style>
      <a
        href={linkDoWhatsapp(numero, mensagem)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar no WhatsApp"
        title="Falar no WhatsApp"
        data-editor-ignore
        className="site-chrome unbox-whatsapp"
      >
        <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
          <path d={CAMINHO_DO_ICONE} />
        </svg>
      </a>
    </>
  );
}

/**
 * A LINHA ÚNICA DO LAYOUT. Renderize no `<body>` (o fim dele é o melhor lugar: os scripts entram depois
 * da hidratação em qualquer posição, e o botão de WhatsApp fica por último na ordem de tabulação).
 *
 * - `doc`: o documento publicado (`getPublishedContent()`); `null` = a loja renderiza só o ambiente.
 * - `ambiente`: `process.env`, inteiro. Só as variáveis de `VARIAVEIS_DE_RASTREIO` são lidas.
 * - `unboxGtmId`: o contêiner CONTRATUAL da Unbox, o literal carimbado no layout pelo CLI (o prebuild
 *   da loja cobra a presença dele lá). Não é configuração do lojista e não passa pelo documento.
 */
export function Rastreio({ doc, ambiente, unboxGtmId }: { doc: ContentDocument | null | undefined; ambiente: Ambiente; unboxGtmId: string }) {
  // `unboxGtmId` vai junto: o contêiner do lojista igual ao da Unbox seria o MESMO contêiner carregado duas
  // vezes, e `rastreioEmVigor` o descarta (e não o conta como Tag Manager próprio para suprimir o Pixel)
  const r = rastreioEmVigor(doc, ambiente, { unboxGtmId });
  return (
    <>
      {/* GTM central da Unbox: contrato, sempre ligado, antes de qualquer outro */}
      {unboxGtmId && <Gtm id={unboxGtmId} chave="unbox-gtm" />}
      {r.gtm.valor && <Gtm id={r.gtm.valor} chave="gtm-loja" />}
      {r.ga4.valor && <Ga4 id={r.ga4.valor} />}
      {r.metaPixel.valor && <MetaPixel id={r.metaPixel.valor} />}
      {r.tiktok.valor && <TiktokPixel id={r.tiktok.valor} />}
      {r.pinterest.valor && <PinterestTag id={r.pinterest.valor} />}
      {/* sempre: page_view de cada navegação para quem não o conta sozinho (Meta, TikTok, Pinterest; o GA4
          conta), e o de entrada no dataLayer dos contêineres de GTM quando nenhum outro provedor o conta */}
      <PageViewPorRota />
      {r.whatsapp.valor && <BotaoDeWhatsapp numero={r.whatsapp.valor.numero} mensagem={r.whatsapp.valor.mensagem} />}
    </>
  );
}
