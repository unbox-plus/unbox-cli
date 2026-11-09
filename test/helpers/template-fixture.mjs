// Três árvores sintéticas para os testes do analyze-version e do upgrade-template: um template "base"
// (o que gerou a loja), um template "atual" (o que a CLI em teste traria) e a loja (a base personalizada
// pelo create mais o que o time mudou). Cada caso do classificador tem um arquivo com o nome do caso.
import fs from "node:fs";
import path from "node:path";
import { escreve } from "./git-sandbox.mjs";

export const BASE = {
  "package.json": JSON.stringify({ name: "storefront", private: true, scripts: { dev: "next dev", build: "next build" }, dependencies: { next: "15.5.24" } }, null, 2) + "\n",
  "agents/MANAGER.md": "# manager\n",
  "scripts/check-unbox-brand.mjs": "// gate\n",
  "gitignore": ".env*\n",
  "lib/copiar.ts": "export const a = 1;\n",
  "lib/reaplicar.ts": "export const r = 1;\nexport const r2 = 2;\n",
  "lib/reescrita.ts": Array.from({ length: 40 }, (_, i) => `export const x${i} = ${i};`).join("\n") + "\n",
  "lib/so-loja.ts": "export const s = 1;\n",
  "lib/intacto.ts": "export const i = 1;\n",
  "lib/removido.ts": "export const old = 1;\n",
  "lib/removido-importado.ts": "export const old2 = 1;\n",
  "lib/unbox/x.ts": "export const x = 1;\n",
  "lib/unbox/y.ts": "export const y = 1;\n",
  "lib/editable/document.ts": "export const doc = 1;\n",
  "lib/editable/config.ts": 'export const STORE_SLUG = "__STORE_SLUG__";\n',
  "lib/editable/tokens.ts": "export const tokens = [];\n",
  "lib/rotas-editaveis.ts": 'export const SO_CHROME: readonly string[] = [\n  "/termos",\n];\nexport const CONTAINERS_POR_ROTA: Readonly<Record<string, readonly string[]>> = {\n  "/": ["home"],\n  "/termos": [],\n};\n',
  "lib/paginas-do-lojista.ts": 'export const COLECOES_DO_CODIGO = [{ handle: "blog", titulo: "Blog" }];\n',
  "app/robots.ts": 'export const DISALLOW = ["/conta", "/carrinho", "/api"];\n',
  "app/globals.css": ":root { --p: #000; }\n",
  "app/layout.tsx": 'export const metadata = { title: "Minha Loja" };\n',
  "app/(loja)/page.tsx": 'import { Home } from "@/components/home/pagina-inicial";\nexport default Home;\n',
  "app/(loja)/termos/page.tsx": "export default function T() { return <p>termos</p>; }\n",
  "components/site-header.tsx": 'export const nome = process.env.NEXT_PUBLIC_SITE_NAME ?? "Minha Loja";\n',
  "components/home/pagina-inicial.tsx": 'import { catalogoDasVitrines } from "@/lib/catalog-map";\nexport function Home() { return catalogoDasVitrines([], []); }\n',
  "scripts/check-editable.mjs": "// gate editavel v1\n",
};

export const ATUAL = {
  ...BASE,
  "package.json": JSON.stringify({ name: "storefront", private: true, scripts: { dev: "next dev", build: "next build", "unbox:novo": "node x" }, dependencies: { next: "15.5.30", "@unbox-plus/sdk": "^0.4.1" } }, null, 2) + "\n",
  "lib/copiar.ts": "export const a = 2;\n",
  "lib/reaplicar.ts": "export const r = 1;\nexport const r2 = 2;\nexport const r3 = 3;\n",
  "lib/reescrita.ts": Array.from({ length: 40 }, (_, i) => `export const x${i} = ${i * 10};`).join("\n") + "\n",
  "lib/novo.ts": "export const novo = 1;\n",
  "lib/novo-importa-ausente.ts": 'import { z } from "@/lib/nao-existe";\nexport const n = z;\n',
  ".claude/skills/migrar/SKILL.md": "# skill\n",
  "lib/unbox.ts": "export const unbox = 1;\n",
  "lib/editable/document.ts": "export const doc = 2;\n",
  "lib/editable/config.ts": 'export const STORE_SLUG = "__STORE_SLUG__";\nexport const V = 2;\n',
  "app/globals.css": ":root { --p: #000; --q: #fff; }\n",
  "components/site-header.tsx": 'export const nome = process.env.NEXT_PUBLIC_SITE_NAME ?? "Minha Loja";\nexport const v = 2;\n',
  "scripts/check-editable.mjs": "// gate editavel v2\n",
};
delete ATUAL["lib/removido.ts"];
delete ATUAL["lib/removido-importado.ts"];
delete ATUAL["lib/unbox/x.ts"];
delete ATUAL["lib/unbox/y.ts"];

/** A loja: a base como o create a deixa (nome, .gitignore, slug), mais o que o time mudou. */
export function LOJA(versao = "0.29.0") {
  const l = { ...BASE };
  delete l.gitignore;
  l[".gitignore"] = BASE.gitignore;
  l["package.json"] = JSON.stringify({ name: "loja-teste", private: true, scripts: { dev: "next dev", build: "next build", "test:meu": "node t" }, dependencies: { next: "15.5.24", zod: "^4" }, unbox: { templateVersion: versao } }, null, 2) + "\n";
  l["marca/briefing.json"] = JSON.stringify({ nome: "Loja Teste", loja: "loja-teste" }) + "\n";
  l["components/site-header.tsx"] = 'export const nome = process.env.NEXT_PUBLIC_SITE_NAME ?? "Loja Teste";\n';
  l["app/layout.tsx"] = 'export const metadata = { title: "Loja Teste" };\n';
  l["lib/editable/config.ts"] = 'export const STORE_SLUG = "lojateste";\n';
  l["lib/reaplicar.ts"] = "export const r = 1;\nexport const r2 = 2;\nexport const meu = 9;\n";
  l["lib/reescrita.ts"] = Array.from({ length: 40 }, (_, i) => `export const y${i} = ${i};`).join("\n") + "\n";
  l["lib/so-loja.ts"] = "export const s = 2;\n";
  l[".claude/skills/migrar/SKILL.md"] = "# skill\n"; // a loja já trouxe à mão, igual: intacto, não colisão
  l["lib/unbox/x.ts"] = "export const x = 1;\nexport const meu = 1;\n";
  l["lib/unbox/proprio.ts"] = "export const proprio = 1;\n";
  l["lib/importa-removido.ts"] = 'import { old2 } from "@/lib/removido-importado";\nexport const u = old2;\n';
  l["app/(loja)/sobre/page.tsx"] = 'import c from "@/lib/brand/conteudo.json";\nexport default function Sobre() { return <main><h1>{c.titulo}</h1><p>Prosa da marca.</p></main>; }\n';
  l["app/(loja)/blog/page.tsx"] = "export default function Blog() { return <ul><li>post</li></ul>; }\n";
  l["lib/brand/conteudo.json"] = JSON.stringify({ titulo: "Sobre" }) + "\n";
  l["lib/brand/catalogo.json"] = JSON.stringify({ products: [{ productId: "1", price: 10, descriptionHtml: "<p>x</p>", variants: [] }] }) + "\n";
  l["lib/brand/catalogo.ts"] = 'import c from "./catalogo.json";\nexport const p = c.products;\n';
  l["components/brand/card.tsx"] = 'import { p } from "@/lib/brand/catalogo";\nexport function Card() { return <div>{p[0].productId}</div>; }\n';
  return l;
}

export function monta(dir, arvore) {
  for (const [rel, conteudo] of Object.entries(arvore)) escreve(dir, rel, conteudo);
  return dir;
}

export function migracaoFalsa() {
  return `# Migração

## 0.30.0
### Template
+ \`lib/novo.ts\`
### Loja já gerada
copiar lib/novo.ts
### Ambiente
+ \`NOVA_VAR\`
### Mudanças de comportamento
nada
### Armadilhas
nenhuma conhecida

## 0.29.0
### Template
~ \`lib/copiar.ts\`
### Loja já gerada
nada
### Ambiente
- \`VAR_ANTIGA\`
### Mudanças de comportamento
nada
### Armadilhas
nenhuma conhecida

## 0.26.0 a 0.28.0
### Template
nada
### Loja já gerada
nada
### Ambiente
nada
### Mudanças de comportamento
nada
### Armadilhas
nenhuma conhecida
`;
}

export const lerPkg = (dir) => JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
