// ═══════════════════════════════════════════════════════════════════════════
// OS PÚBLICOS DESTA LOJA (foundation 18): `{ controle, publicos: [{ id, nome, entrada, versoes }], paginas }`.
// `versoes` são os containers em que cada público tem versão (a borda só reescreve uma LP para a versão que
// existe) e `paginas`, as páginas avulsas feitas para um público (quem abre uma delas entra nele).
//
// Quem lê: o MIDDLEWARE desta loja (lib/publicos-da-borda.ts), que guarda a lista em memória e decide por ela
// qual versão servir, e os apps da loja que queiram saber quais públicos existem. (A resposta do quiz → público
// é regra do editor, `entrada.quiz`, e quem a aplica é a própria loja: o quiz só avisa a resposta.)
//
// Pública por contrato, como `/api/unbox/paginas`: o nome e as regras de cada público já aparecem no
// comportamento da loja e no link do anúncio, e escondê-los não protegeria nada. A DESCRIÇÃO não sai daqui
// (é o contexto do chat do editor) — `publicosDaBorda` nem a lê.
//
// Em cache como as páginas (ISR de 300 s), e revalidada em TODA publicação do editor (app/api/revalidate).
// ═══════════════════════════════════════════════════════════════════════════
import { getPublishedContent, publicosDaBorda } from "@/lib/editable/server";

export const revalidate = 300;

export async function GET() {
  return Response.json(publicosDaBorda(await getPublishedContent()));
}
