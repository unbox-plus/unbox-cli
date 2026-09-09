import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: process.env.NEXT_PUBLIC_SITE_NAME ?? "Minha Loja",
    short_name: process.env.NEXT_PUBLIC_SITE_NAME ?? "Loja",
    description: "Loja oficial. Compre com segurança e receba em casa.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    // theme_color: usar o --store-chrome-bg da marca (preencher ao configurar cores)
    theme_color: "#18181B",
    orientation: "portrait",
    icons: [
      // SVG funciona na maioria dos browsers modernos
      { src: "/brand/logo.svg", sizes: "any", type: "image/svg+xml" },
      // TODO: criar /public/icon-192.png e /public/icon-512.png com a marca real
      // (PNG é necessário para Android e iOS antigos; usar squoosh.app ou similar)
    ],
  };
}
