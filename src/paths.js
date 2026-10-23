// Onde o pacote mora no disco. Tudo que o CLI copia ou lê do próprio pacote sai daqui, e não de um
// `__dirname` solto: o corpo do scaffold saiu de `bin/` para `src/commands/`, e um
// `path.join(__dirname, "..", "template")` copiado junto apontaria para `src/template`, que não existe.
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Raiz do pacote: um nível acima de `src/`. */
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const TEMPLATE_DIR = path.join(PACKAGE_ROOT, "template");
