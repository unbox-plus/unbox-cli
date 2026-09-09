import "server-only";
import { hasUnboxCredentials } from "./config";

/**
 * Único lugar onde "a API falhou" pode virar "resultado vazio". Sem credenciais (modo mockup)
 * devolve o fallback em silêncio: é o comportamento esperado de um scaffold sem .env. COM
 * credenciais, loga e RELANÇA — a falha tem que aparecer.
 *
 * Por que isso importa: os `.catch(() => [])` espalhados nas páginas tratavam "Unbox fora do
 * ar" igual a "sem credenciais". Em produção isso produzia home e catálogo VAZIOS com HTTP 200,
 * que o ISR então CACHEAVA por 5 minutos no lugar da versão boa (o Next só preserva a versão
 * anterior quando a regeneração lança), sem uma linha de log. E nos layouts de produto e
 * categoria, virava `notFound()` — 404 real e cacheado na rota mais indexada da loja. Relançar
 * dá ao ISR a chance de manter a página anterior e ao error.tsx a chance de existir.
 */
export async function mockupOr<T, F = T>(promessa: Promise<T>, fallback: F, rotulo: string): Promise<T | F> {
  try {
    return await promessa;
  } catch (e) {
    if (!hasUnboxCredentials) return fallback;
    console.error(`[unbox] falha em ${rotulo} COM credenciais configuradas — não é modo mockup:`, e instanceof Error ? e.message : e);
    throw e;
  }
}
