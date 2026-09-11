// ═══════════════════════════════════════════════════════════════════════════
// A PORTA DA PRÉVIA DAS PÁGINAS DO LOJISTA — os dois nomes que o middleware e a rota compartilham.
//
// Arquivo próprio, e não uma constante em cada lado, porque quem GRAVA o cookie é o `middleware.ts`
// (roda no edge) e quem o LÊ é `app/previa-do-editor/[[...caminho]]/page.tsx` (roda no Node). Escrito
// duas vezes, um erro de digitação num dos lados fecharia a prévia sem nenhum sinal, e o sintoma
// ("a prévia dá 404 no editor") não apontaria para cá.
//
// O que o cookie guarda é o PRÓPRIO token assinado pelo editor, não um "sim" nosso: quem decide se
// ele vale continua sendo `verifyEditorToken` (ES256, chave pública do JWKS do editor), nos dois
// lados. Um cookie que dissesse só "esta pessoa já entrou" seria forjável por quem o escrevesse à mão.
// ═══════════════════════════════════════════════════════════════════════════

/** o parâmetro com que o editor abre a prévia (é ele que o `provider.tsx` tira da URL depois de ler) */
export const PARAM_DO_TOKEN = "unbox_editor_token";

/**
 * O cookie que carrega o mesmo token pelas navegações seguintes DENTRO da prévia. `httpOnly` (nenhum
 * script da página precisa dele) e curto: ele vale enquanto durar a sessão de edição, não um mês.
 */
export const COOKIE_DA_PREVIA = "unbox_previa";

/** quanto tempo o cookie da prévia dura, em segundos (uma jornada de edição) */
export const VALIDADE_DO_COOKIE_DA_PREVIA = 60 * 60 * 8;
