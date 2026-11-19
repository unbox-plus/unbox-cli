// O slug da loja no editor da Unbox. Quem decide é a PLATAFORMA: o backend grava `UNBOX_EDITOR_SHOP` com o
// slug da loja na hospedagem (o mesmo do claim do token e do subdomínio `<slug>.myunbox.com.br`), e o editor
// acha a loja por ele, recusando a que declare outro. O literal que o create carimba em
// `lib/editable/config.ts` (`STORE_SLUG`) só vale onde a variável não existe, o `next dev`; ele tem de ser o
// mesmo, senão a loja local pede ao editor o conteúdo de outra loja.
import fs from "node:fs";
import path from "node:path";

/** Vai para um literal TS e para a URL do editor: só minúsculas, números e hífen. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;

const CONFIG = path.join("lib", "editable", "config.ts");
const LITERAL = /(STORE_SLUG\s*=[^\n]*?")([^"\n]+)(")/;

/** O literal carimbado, ou null sem o arquivo ou com o marcador intacto. */
export function slugDaLoja(dir) {
  let src;
  try { src = fs.readFileSync(path.join(dir, CONFIG), "utf8"); } catch { return null; }
  const m = src.match(LITERAL);
  return m && m[2] !== "__STORE_SLUG__" ? m[2] : null;
}

/** Troca o literal carimbado. Devolve o anterior, ou null se não havia literal para trocar. */
export function trocaSlugDaLoja(dir, novo) {
  if (!SLUG_RE.test(novo)) return null;
  const arquivo = path.join(dir, CONFIG);
  const antes = slugDaLoja(dir);
  if (!antes || antes === novo) return null;
  const src = fs.readFileSync(arquivo, "utf8");
  fs.writeFileSync(arquivo, src.replace(LITERAL, (_, a, _b, c) => `${a}${novo}${c}`));
  return antes;
}
