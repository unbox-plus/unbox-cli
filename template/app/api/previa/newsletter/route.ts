// ═══════════════════════════════════════════════════════════════════════════
// NEWSLETTER DE VITRINE: o destino do formulário enquanto a loja não tem Shop na Unbox.
//
// O formulário da newsletter só existe com NEXT_PUBLIC_NEWSLETTER_ACTION (lib/newsletter.ts): sem destino, o
// bloco some, porque formulário que engole o e-mail engana quem se cadastra. Uma loja de vitrine (sem as
// credenciais da Unbox, montada para mostrar a loja antes de ela vender) perderia as faixas de newsletter que
// o desenho tem. Esta rota é o destino dela, e só dela:
//
//   NEXT_PUBLIC_NEWSLETTER_ACTION=/api/previa/newsletter
//
// O visitante vê as faixas e, ao enviar, recebe uma página curta dizendo que o cadastro é simulado. O e-mail
// NÃO é lido, guardado nem registrado. É OPT-IN: nenhum componente nem receita escreve este caminho, ele entra
// só pela variável.
//
// COM AS CREDENCIAIS DA UNBOX (a régua de `hasUnboxCredentials`, a mesma do modo mockup), a rota responde 404:
// loja que vende precisa de destino real. O gate da marca (`scripts/check-unbox-brand.mjs`, item 10) reprova o
// build que juntar as credenciais com este destino, e o destino escrito no código.
// ═══════════════════════════════════════════════════════════════════════════
import { hasUnboxCredentials } from "@/lib/config";

export const dynamic = "force-dynamic";

const escapar = (texto: string) => texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function pagina(): string {
  const nome = escapar(process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "a loja");
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Cadastro simulado · ${nome}</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: system-ui, sans-serif; background: #f6f6f6; color: #18181b; }
  main { max-width: 420px; margin: 24px; padding: 32px; background: #fff; border-radius: 16px; text-align: center; }
  h1 { font-size: 22px; margin: 0 0 12px; }
  p { font-size: 15px; line-height: 1.5; margin: 0 0 24px; color: #52525b; }
  a { display: inline-block; padding: 12px 24px; border-radius: 999px; background: #18181b; color: #fff;
    text-decoration: none; font-weight: 600; font-size: 14px; }
</style>
</head>
<body>
<main>
  <h1>Cadastro simulado</h1>
  <p>Esta loja é uma prévia. Nenhum e-mail foi guardado: na loja no ar, este formulário leva o seu e-mail para a lista de novidades de ${nome}.</p>
  <a href="/">Voltar para a loja</a>
</main>
</body>
</html>`;
}

export async function POST(): Promise<Response> {
  if (hasUnboxCredentials) return new Response("Not Found", { status: 404 });
  return new Response(pagina(), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}
