/**
 * Para onde vai o e-mail capturado. UM lugar só, lido por todo bloco de captura da loja
 * (rodapé "conversão", catálogo e a seção `newsletter` da home).
 *
 * REGRA: sem destino, o bloco NÃO RENDERIZA. Formulário que engole o e-mail em silêncio é pior
 * que não ter formulário: a pessoa acha que se cadastrou e a loja não tem o contato. Foi o que
 * dois blocos desta foundation faziam, com `onSubmit={(e) => e.preventDefault()}`.
 *
 * O valor é a URL que recebe o POST do formulário (endpoint do CRM/ESP: Klaviyo, Revi, Mailchimp,
 * um Route Handler próprio). É `NEXT_PUBLIC_` porque o formulário é HTML no navegador.
 *
 * LOJA DE VITRINE (sem as credenciais da Unbox): a rota de app/api/previa responde "cadastro simulado" sem
 * guardar o e-mail, e é escolhida SÓ pela variável (o valor está no .env.example). Este arquivo não cai nela
 * sozinho: a variável é embutida no navegador, que não sabe se a loja tem credenciais, e a loja pode nascer
 * sem elas. Com as credenciais a rota é 404, e o gate da marca reprova o build que a mantiver como destino.
 */
export const NEWSLETTER_ACTION = process.env.NEXT_PUBLIC_NEWSLETTER_ACTION?.trim() || null;
