// Verificação dos tokens assinados pelo editor (ES256, chave pública via JWKS).
// Roda no edge (middleware) e no Node (rotas). A loja NÃO guarda segredo do
// editor: só busca a chave pública em EDITOR_URL/.well-known/jwks.json.
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { EDITOR_URL, STORE_SLUG } from "./config";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

// "catalogo": leitura do catálogo da loja pelo SELETOR de vitrine do editor. É só
// leitura, e a loja continua sendo a única que fala com a Unbox — o editor nunca
// vê credencial (ver app/api/unbox/catalogo/route.ts).
export type EditorTokenPurpose = "preview" | "revalidate" | "catalogo";

export async function verifyEditorToken(token: string, purpose: EditorTokenPurpose): Promise<JWTPayload | null> {
  if (!EDITOR_URL || !token) return null;
  try {
    jwks ??= createRemoteJWKSet(new URL(`${EDITOR_URL}/.well-known/jwks.json`), { cooldownDuration: 30_000, cacheMaxAge: 600_000 });
    const { payload } = await jwtVerify(token, jwks, { issuer: "unbox-editor", audience: `loja:${STORE_SLUG}`, algorithms: ["ES256"] });
    if (payload.purpose !== purpose) return null;
    return payload;
  } catch {
    return null;
  }
}
