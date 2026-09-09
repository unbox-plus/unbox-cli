import { ImageResponse } from "next/og";

// Imagem de compartilhamento (Open Graph / Twitter) gerada na hora: nome da loja sobre a cor
// primária. Existe para NENHUM compartilhamento sair sem imagem — antes saía. Quando a marca
// tiver uma imagem própria (1200×630), troque por um arquivo public/brand/og.png e aponte
// `openGraph.images` no layout; até lá, esta serve e nunca é placeholder de outra loja.
export const runtime = "edge";
export const alt = "Minha Loja";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SITE_NAME = "Minha Loja";
// Mesmos valores default de app/globals.css (o CLI escreve a cor real no scaffold).
const PRIMARY = "#18181B";
const PRIMARY_FG = "#FFFFFF";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          alignItems: "flex-start", justifyContent: "flex-end", padding: 72,
          background: PRIMARY, color: PRIMARY_FG, fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }}>{SITE_NAME}</div>
        <div style={{ marginTop: 18, fontSize: 30, opacity: 0.8 }}>Loja online</div>
      </div>
    ),
    size,
  );
}
