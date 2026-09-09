// ═══════════════════════════════════════════════════════════════════════════
// RECEITA DO CHROME — qual header e qual rodapé esta loja usa.
// Escrita pelo create-unbox-store conforme o ESTILO escolhido no setup; editada
// pelo agente de branding no briefing (é AQUI que o chrome muda — não reescreva
// o JSX de uma variante; catálogo em agents/PADROES.md).
// `npm run typecheck` acusa header/rodapé inexistente.
// ═══════════════════════════════════════════════════════════════════════════
import type { ChromeRecipe } from "@/components/chrome/registry";

export const chromeRecipe: ChromeRecipe = {
  header: "classico",
  footer: "colunas",
};
