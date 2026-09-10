// ═══════════════════════════════════════════════════════════════════════════════════════
// GERADOR DA PÁGINA DO NOTION — node tools/notion-doc.mjs
//
// Emite o conteúdo da página "create-unbox-store — CLI de geração de loja" em Notion-flavored
// Markdown, pronto pra ser passado ao update-page do MCP do Notion.
//
// Existe pra que "manter a página atualizada" seja um comando, não um trabalho manual que
// ninguém lembra de fazer no dia do release. A versão vem do package.json e o changelog é
// extraído do README.md — as duas únicas fontes da verdade. Rode depois de todo release e
// atualize a página com a saída.
//
// A prosa de apresentação é curada aqui (uma página de Notion para o time não é um despejo
// do README). O changelog é mecânico: toda entrada "### vX.Y.Z" do README vira um toggle.
// ═══════════════════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8"));
const readme = fs.readFileSync(path.join(RAIZ, "README.md"), "utf8");
const VERSAO = pkg.version;

// ── Changelog: extrai as entradas "### vX" / "### Beta vX" do README ────────────────────
function extrairChangelog() {
  const linhas = readme.split("\n");
  const ini = linhas.findIndex((l) => l.trim() === "## Changelog");
  if (ini === -1) throw new Error("seção '## Changelog' não encontrada no README.md");

  const entradas = [];
  let atual = null;
  for (const linha of linhas.slice(ini + 1)) {
    const m = linha.match(/^### (.+)$/);
    if (m) {
      if (atual) entradas.push(atual);
      atual = { titulo: m[1].trim(), corpo: [] };
    } else if (atual) {
      atual.corpo.push(linha);
    }
  }
  if (atual) entradas.push(atual);
  return entradas;
}

// Markdown do README → Notion-flavored. As diferenças que importam:
//  • parágrafo quebrado em várias linhas vira UMA linha (no Notion, \n encerra o bloco);
//  • item de lista com continuação indentada é juntado no mesmo item;
//  • o resto (negrito, código inline, links) é compatível.
function paraNotion(corpo) {
  const out = [];
  for (const bruta of corpo) {
    const linha = bruta.replace(/\s+$/, "");
    if (!linha.trim()) { out.push(""); continue; }
    const ehItem = /^\s*[-*]\s+/.test(linha);
    const ehTitulo = /^#{1,6}\s/.test(linha);
    const ehCodigo = /^\s*```/.test(linha);
    const continuacao = /^\s+\S/.test(linha) && !ehItem && !ehCodigo;
    if ((continuacao || (!ehItem && !ehTitulo && !ehCodigo)) && out.length && out[out.length - 1]) {
      // continua o bloco anterior em vez de abrir um novo
      const ant = out[out.length - 1];
      if (!/^\s*```/.test(ant)) { out[out.length - 1] = ant + " " + linha.trim(); continue; }
    }
    out.push(ehItem ? "- " + linha.replace(/^\s*[-*]\s+/, "") : linha.trim());
  }
  return escaparAngulos(out.join("\n").replace(/\n{3,}/g, "\n\n").trim());
}

// O Notion lê "<algo>" fora de crase como bloco/tag XML. Escapa só o que está solto —
// dentro de crase (código inline e blocos) o conteúdo é literal e não pode ser tocado.
function escaparAngulos(texto) {
  const partes = texto.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return partes.map((p, i) => (i % 2 ? p : p.replace(/</g, "\\<").replace(/>/g, "\\>"))).join("");
}

const entradas = extrairChangelog();
// Detalhe integral só na era da arquitetura atual (v0.12.13+, quando o versionamento foi
// unificado). O histórico anterior vira uma linha por versão dentro de um toggle: ninguém lê
// 35 changelogs completos, e o texto integral continua no README do pacote.
const DETALHADAS = entradas.findIndex((e) => /^Beta v/.test(e.titulo));
const corte = DETALHADAS === -1 ? entradas.length : DETALHADAS;

const detalhadas = entradas.slice(0, corte).map((e, i) => {
  const corpo = paraNotion(e.corpo);
  const marca = i === 0 ? " · atual" : "";
  return `### ${e.titulo}${marca} {toggle="true"}\n` +
    corpo.split("\n").map((l) => (l ? "\t" + l : "")).join("\n");
}).join("\n");

// Uma linha por versão antiga: título + primeira frase do corpo.
const antigas = entradas.slice(corte).map((e) => {
  const texto = paraNotion(e.corpo)
    .split("\n").map((l) => l.replace(/^-\s*/, "").trim()).filter(Boolean)[0] ?? "";
  let resumo = texto.split(/(?<=\.)\s/)[0].slice(0, 170).replace(/[\s:—-]+$/, "");
  if (resumo.length >= 170) resumo += "…";
  return `- **${e.titulo}** — ${resumo}`;
}).join("\n");

const changelog = detalhadas + `

<details>
<summary>Histórico anterior (${entradas.length - corte} versões, era "Beta")</summary>
` + antigas.split("\n").map((l) => "\t" + l).join("\n") + `
\t
\tO texto integral de cada uma está no \`README.md\` dentro do pacote.
</details>`;

// ── A página ────────────────────────────────────────────────────────────────────────────
const pagina = `<callout icon="📦" color="blue_bg">
	**Versão atual: v${VERSAO}** — entregue como \`CLI - Unbox v${VERSAO}.zip\`, que contém \`create-unbox-store.tgz\` e o README completo.
	O nome do tarball é sempre \`create-unbox-store.tgz\`, **sem versão** — a versão fica dentro do pacote. Zips antigos traziam a versão no nome do arquivo e isso gerava erro de \`npx\` quando o comando não batia com o nome real.
  O pacote também está sendo distribuído como [@unbox-plus/cli](https://www.npmjs.com/package/@unbox-plus/cli) no NPM.
</callout>

<callout icon="🔄" color="gray_bg">
	Esta página é gerada a partir do \`README.md\` e do \`package.json\` do CLI. Para atualizá-la depois de um release, rode \`node tools/notion-doc.mjs\` no repositório do CLI e substitua o conteúdo com a saída. Não edite o changelog aqui à mão: ele será sobrescrito.
</callout>

## O que é

CLI de dependência zero (só \`prompts\`) que gera um **storefront Next.js 15 completo**, integrado com a API headless da Unbox, já com a marca do cliente aplicada: layout, fontes, neutros, cores e nome da loja.

O que sai do CLI é **fundação**, não loja pronta. A personalização de verdade acontece logo depois, no briefing de marca conduzido pelo Claude Code — e é de propósito: o cliente é entrevistado **antes** de ver qualquer coisa, para não ancorar a expectativa dele no padrão.

## Como usar

Único pré-requisito da máquina: **Node.js** ([nodejs.org](https://nodejs.org), botão LTS). Navegue até a pasta onde queira criar o projeto e rode:

\`\`\`bash
npx --package=@unbox-plus/cli create-unbox-store
\`\`\`

<callout icon="⚠️" color="yellow_bg">
	Use sempre a forma com \`--package=\` para detecção correta do pacote.
</callout>

O CLI pergunta 12 coisas: nome do projeto e da loja, cor primária e de CTA, site e Instagram da marca, objetivo em uma frase, **estilo visual** (Essencial, Promocional, Editorial ou Boutique), credenciais da Unbox, tipo de checkout, o segredo de captcha (só com key de parceiro) e se roda \`npm install\`. Tudo menos as credenciais fica em \`marca/briefing.json\`, para o agente de marca não reperguntar.

Sem credenciais em mãos, responda "não": o projeto sobe em **modo mockup** com o layout completo e sem dados reais. Preenche o \`.env.local\` depois.

### O passo seguinte não é \`npm run dev\`

\`\`\`bash
cd <nome-do-projeto>
claude
\`\`\`

O Claude Code abre direto no briefing de marca e conduz a personalização. Encerrado o briefing, o próprio agente remove a chave que força esse modo e as sessões seguintes voltam ao normal.

### Sem interação (CI ou testes)

\`\`\`bash
npx --package=@unbox-plus/cli create-unbox-store minha-loja --yes --no-install
\`\`\`

Use \`--estilo <essencial|promocional|editorial|boutique>\` para escolher o preset sem interação.

## O que o projeto gerado traz

Next.js 15 (App Router) + Tailwind v4 + shadcn/ui sobre Base UI, com catálogo, carrinho, checkout, área do cliente (login por OTP, pedidos, assinaturas, endereços), páginas legais, PWA e SEO básico já implementados. \`DEPLOY.md\` e \`QA.md\` dentro do projeto trazem o checklist de publicação na Vercel.

O projeto também vem com um \`CLAUDE.md\` que mapeia "quero mudar X, mexo em Y", e com \`agents/MANAGER.md\`, que descreve a ordem dos passos: **15 (Branding) primeiro**, depois os opcionais 13 (CRO) e 14 (SEO), e por último 12 (Deploy).

### Portões de qualidade

| Comando | O que faz |
| --- | --- |
| \`npm run typecheck\` | o gate mais barato, rode primeiro |
| \`npm run build\` | dispara o prebuild de marca (bloqueia sem o selo Powered by Unbox ou sem o GTM) |
| \`npm run unbox:honestidade\` | promessa comercial ou prova social sem lastro |
| \`npm run unbox:receita\` | variedade da composição da home (mede, não bloqueia) |
| \`npm run unbox:qa\` | screenshots do QA com emulação de dispositivo |
| \`npm run unbox:dump\` | imprime o catálogo e as promoções **reais** da loja |

## Antes de publicar — decisões que não são do CLI

A fundação traz placeholders que funcionam mas **precisam de uma decisão consciente**. O CLI não resolve isso sozinho de propósito: seria tomar a decisão no lugar de quem publica.

1. **Prova social: a foundation não traz nenhuma.** Sem avaliação real em \`lib/enrichment/products.json\`, a loja não mostra nota, estrelas, contagem nem depoimento (o bloco some, não cai em placeholder). Decida antes de publicar: popular com dados reais ou publicar sem prova social. O agente de Branding pede esse material no briefing; o \`unbox:honestidade\` lista qualquer número ou promessa que entrar sem lastro.
2. **CRO: 1 de 10 módulos na fundação.** Só a barra de frete grátis vem pronta. Os outros nove são do agente 13, que o briefing oferece ao terminar (o wizard não pergunta mais sobre isso).
3. **SEO avançado: o básico está, os 7 módulos não.** JSON-LD de produto, Organization + WebSite/SearchAction, imagem Open Graph gerada e canonical por página já vêm. Breadcrumbs, FAQ schema, OG por produto e templates de título/description são do agente 14.
4. **Kits e combos vêm vazios.** A seção só aparece depois que alguém popular os kits reais.

<callout icon="🧭" color="gray_bg">
	A regra que orienta tudo isso: **um campo vazio declarado é melhor que um campo plausível inventado.** Quando falta material real, o certo é registrar a pendência, não preencher com algo verossímil. É no briefing e na fundação que um valor plausível vira lei sem ninguém questionar.
</callout>

## Changelog

${changelog}
`;

process.stdout.write(pagina);
