// ═══════════════════════════════════════════════════════════════════════════
// OS PÚBLICOS DESTA LOJA (foundation 18): `{ controle, publicos: [{ id, nome, entrada }] }`.
//
// Quem lê: o MIDDLEWARE desta loja (lib/publicos-da-borda.ts), que guarda a lista em memória e decide por ela
// qual versão da home servir, e os APPS da loja (o quiz do Admin), que mapeiam as respostas em públicos na tela
// de configuração deles.
//
// Pública por contrato, como `/api/unbox/paginas`: o nome e as regras de cada público já aparecem no
// comportamento da loja e no link do anúncio, e escondê-los não protegeria nada. A DESCRIÇÃO não sai daqui
// (é o contexto do chat do editor) — `publicosDaBorda` nem a lê.
//
// Em cache como as páginas (ISR de 300 s), e revalidada na publicação pela mesma tag do conteúdo.
// ═══════════════════════════════════════════════════════════════════════════
import { getPublishedContent, publicosDaBorda } from "@/lib/editable/server";

export const revalidate = 300;

export async function GET() {
  return Response.json(publicosDaBorda(await getPublishedContent()));
}
