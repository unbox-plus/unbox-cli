// Revalidação on-demand (ISR) — chamada por webhook/cron quando catálogo/estoque mudam.
// Protegida por REVALIDATE_SECRET.
import { revalidatePath } from "next/cache";
import { serverEnv } from "@/lib/config";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret") ?? req.headers.get("x-revalidate-secret");
  if (!serverEnv.revalidateSecret || secret !== serverEnv.revalidateSecret) {
    return fail("Não autorizado.", 401);
  }
  const body = await req.json().catch(() => ({}));
  const paths: string[] = Array.isArray(body.paths) && body.paths.length ? body.paths : ["/", "/produtos"];
  for (const p of paths) revalidatePath(p);
  return ok({ revalidated: paths });
}
