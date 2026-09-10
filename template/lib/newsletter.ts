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
 */
export const NEWSLETTER_ACTION = process.env.NEXT_PUBLIC_NEWSLETTER_ACTION?.trim() || null;
