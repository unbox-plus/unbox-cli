// Idempotência de webhook em memória (doc 07): deduplica por event._id e mantém uma fila
// simples de processamento. Responder 200 rápido (<30s) e processar fora do hot path.
//
// PROD: trocar o Set/array por uma tabela no DB (dedup durável) + fila real (QStash, SQS…).
import "server-only";

const seen = new Set<string>();
// limita o tamanho do Set para não vazar memória em runtime longo
const MAX = 5000;

/** Retorna true se o evento é novo (deve ser processado); false se já foi visto. */
export function markIfNew(eventId: string): boolean {
  if (!eventId) return true;
  if (seen.has(eventId)) return false;
  seen.add(eventId);
  if (seen.size > MAX) {
    // descarta os mais antigos (FIFO aproximado)
    const it = seen.values();
    for (let i = 0; i < 1000; i++) seen.delete(it.next().value as string);
  }
  return true;
}
