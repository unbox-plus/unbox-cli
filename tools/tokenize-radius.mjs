// Dev-time, roda UMA vez: troca rounded-[Npx] literais pela escala de --radius,
// pra --radius (escrito pelo CLI por estilo) valer de verdade no template.
// Calibração (com --radius default 0.875rem = 14px): lg=14, xl≈18, 2xl≈22.
//
//   node tools/tokenize-radius.mjs [--dry]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "template");
const DRY = process.argv.includes("--dry");

// px → sufixo da escala. 2/5/6px ficam literais (detalhes minúsculos, intencionais).
const SCALE = {
  8: "sm", 9: "sm",
  10: "md", 11: "md", 12: "md",
  13: "lg", 14: "lg", 16: "lg",
  17: "xl", 18: "xl", 20: "xl",
  22: "2xl", 24: "2xl",
};

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith(".tsx")) yield p;
  }
}

const counts = {};
let filesTouched = 0;
for (const dir of ["components", "app"]) {
  for (const file of walk(path.join(ROOT, dir))) {
    const src = fs.readFileSync(file, "utf8");
    let changed = false;
    const out = src.replace(/rounded(-(?:t|b|l|r|tl|tr|bl|br|s|e|ss|se|es|ee))?-\[(\d+)px\]/g, (m, side, px) => {
      const suffix = SCALE[+px];
      if (!suffix) return m;
      changed = true;
      const key = `${px}px→${suffix}`;
      counts[key] = (counts[key] ?? 0) + 1;
      return `rounded${side ?? ""}-${suffix}`;
    });
    if (changed) {
      filesTouched++;
      if (!DRY) fs.writeFileSync(file, out);
    }
  }
}

console.log(`${DRY ? "[dry-run] " : ""}arquivos alterados: ${filesTouched}`);
for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${k} ×${n}`);
