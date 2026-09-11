#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import prompts from "prompts";
import { normalizeHex, deriveBrandTokens } from "../src/colors.js";
import { applyPreset, applyStoreName } from "../src/theme.js";
import { PRESETS, PRESET_NAMES, suggestPreset } from "../src/presets.js";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.join(__dirname, "..", "template");
const EXCLUDE = new Set(["bootstrap.sh", "package-lock.json", ".DS_Store"]);
// Cores default = CANVAS PROVISÓRIA, não escolha estética. Tinta quase-preta + âmbar
// contido: a base mais neutra possível pra qualquer marca cair bem em cima. Trocar pelas
// cores REAIS é o primeiro ato do briefing (o build avisa enquanto estiverem aqui).
const DEFAULT_PRIMARY = "#18181B";
const DEFAULT_CTA = "#D97706";
// Removidos do projeto quando o checkout é o PADRÃO hospedado pela Unbox — sem UI de checkout
// customizada nesse modo, esses arquivos ficariam mortos (ver app/api/checkout-destination).
const CUSTOM_CHECKOUT_PATHS = ["app/(loja)/checkout", "components/checkout", "app/api/checkout"];

const CHECKOUT_WARNING = `
  ⚠️  Checkout customizável escolhido. Leia antes de continuar:
  Ao customizar o checkout, a Unbox deixa de controlar essa experiência: passa a ser
  responsabilidade deste projeto. Checkout é a área mais sensível pra conversão da loja: um erro
  de implementação aqui (frete, pagamento, validação de endereço) pode custar vendas de verdade.
  Teste bem (npm run unbox:test, QA.md) antes de publicar.
`;

function copyTemplate(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(TEMPLATE_DIR)) {
    if (EXCLUDE.has(entry)) continue;
    // "gitignore" (sem ponto) vira ".gitignore" no projeto — o npm pack remove/renomeia
    // arquivos .gitignore de dentro do pacote, então o template o carrega sem o ponto.
    const dest = entry === "gitignore" ? ".gitignore" : entry;
    fs.cpSync(path.join(TEMPLATE_DIR, entry), path.join(targetDir, dest), { recursive: true });
  }
}

// Ctrl+C no meio das perguntas: sem isto o `prompts` devolve undefined e o CLI seguia
// gerando um projeto com defaults (nome "undefined", checkout custom, sem credenciais).
const onCancel = () => { console.log("\n  Cancelado. Nada foi gerado."); process.exit(1); };

function removeCustomCheckout(targetDir) {
  for (const rel of CUSTOM_CHECKOUT_PATHS) {
    fs.rmSync(path.join(targetDir, rel), { recursive: true, force: true });
  }
}

/** "https://minhaloja.com.br/" ou "minhaloja.com.br" → "https://minhaloja.com.br" (sem barra final).
 *  Retorna null se não for um domínio válido (espaço, caminho, sem TLD) — nunca gera URL torta. */
function normalizeDomain(input) {
  let d = String(input ?? "").trim().replace(/\/+$/, "");
  if (!d) return null;
  if (!/^https?:\/\//i.test(d)) d = `https://${d}`;
  try {
    const u = new URL(d);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.pathname !== "/" || u.search || u.hash || u.username || u.port) return null;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname) || u.hostname.includes("..")) return null;
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return null;
  }
}
const validaDominio = (v) => (normalizeDomain(v) ? true : "Informe só o domínio, ex.: minhaloja.com.br (sem caminho, sem espaço)");

function setProjectName(targetDir, name) {
  const pkgPath = path.join(targetDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  pkg.name = name;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

/** Valor seguro pra linha KEY=... do .env.local. O Next lê o arquivo com dotenv + dotenv-expand:
 *  sem aspas, `#` vira comentário (senha truncada), `$X` é expandido (some) e espaço quebra.
 *  Caso real: senha com `$` chegava cortada e o signIn falhava sem pista.
 *  Medido com o @next/env real (9 valores adversos): aspas simples NÃO protegem `$1` (o expand
 *  roda mesmo assim) e aspas duplas não desfazem `\"`. O único formato que devolve todos os
 *  valores intactos é CRASE com `$` escapado como `\$`. Só caracteres simples saem crus. */
function envValue(v) {
  const s = String(v ?? "").replace(/\r?\n/g, "");
  if (s === "" || /^[A-Za-z0-9_.\/:@+=,-]*$/.test(s)) return s;
  const esc = s.replace(/\$/g, "\\$");
  if (!s.includes("`")) return "`" + esc + "`";
  // Valor com crase: aspas duplas (a única perda possível é uma aspa dupla interna, sem escape em dotenv).
  return `"${esc.replace(/"/g, "")}"`;
}

function writeEnvLocal(targetDir, values) {
  const examplePath = path.join(targetDir, ".env.example");
  const lines = fs.readFileSync(examplePath, "utf8").split("\n");
  // Segredos que a loja precisa e ninguém gera à mão: SESSION_SECRET assina o cookie de posse
  // do pedido (lib/session.ts) e REVALIDATE_SECRET protege /api/revalidate e /api/payment-link.
  //
  // PREVIEW_PASSWORD entra na mesma regra, e por um motivo de publicação: o template já teve
  // uma senha de fábrica escrita no código, e o pacote vai para um registro npm público, então
  // ela valia para toda loja gerada. Agora é uma por instalação, sorteada aqui. Curta de
  // propósito: quem usa isso digita a chave numa URL, `?chave=<senha>`.
  const all = {
    SESSION_SECRET: crypto.randomBytes(32).toString("hex"),
    REVALIDATE_SECRET: crypto.randomBytes(24).toString("hex"),
    PREVIEW_PASSWORD: crypto.randomBytes(6).toString("base64url"),
    ...values,
  };
  const out = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (!match) return line;
    const key = match[1];
    if (all[key] !== undefined) return `${key}=${envValue(all[key])}`;
    return line;
  });
  fs.writeFileSync(path.join(targetDir, ".env.local"), out.join("\n"));

  // O MESMO segredo vai para um arquivo VERSIONADO da loja (lib/segredo-da-loja.ts). O .env.local
  // não sobe no deploy, e quem hospeda as lojas é a Unbox, não o dono da loja: sem isto, a loja
  // sobe sem segredo e a tela pós-pagamento manda entrar na conta. Versionado, ele viaja com o
  // código, é único por loja e não tem passo manual para esquecer. A variável de ambiente continua
  // vencendo este valor, que é como se rotaciona sem mexer no código.
  const segredoPath = path.join(targetDir, "lib", "segredo-da-loja.ts");
  const segredoSrc = fs.readFileSync(segredoPath, "utf8");
  const segredoNovo = segredoSrc.replace(
    /export const SEGREDO_DA_LOJA = "";/,
    `export const SEGREDO_DA_LOJA = "${all.SESSION_SECRET}";`,
  );
  if (segredoNovo === segredoSrc) {
    throw new Error("lib/segredo-da-loja.ts mudou de forma: a âncora SEGREDO_DA_LOJA = \"\" não foi encontrada.");
  }
  fs.writeFileSync(segredoPath, segredoNovo);
}

/**
 * Grava marca/briefing.json com o que o formulário coletou (menos credenciais).
 * É a "memória" do scaffold pro agente 15 (Branding): ele lê isso na Regra 0 e
 * não repergunta nada daqui. Campos opcionais vazios são omitidos.
 */
function writeBriefing(targetDir, data) {
  const briefing = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && String(v).trim() !== ""),
  );
  const dir = path.join(targetDir, "marca");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "briefing.json"), JSON.stringify(briefing, null, 2) + "\n");
}

function printHelp() {
  console.log(`
  create-unbox-store: gera um storefront Next.js integrado à Unbox

  Uso:
    npx --package=@unbox-plus/cli create-unbox-store [pasta] [flags]

  Sem flags, roda o wizard interativo: nome da loja, cores, estilo visual,
  credenciais da Unbox (Enter pra pular = modo mockup) e checkout.
  As credenciais coletadas viram o .env.local do projeto gerado.

  Flags:
    --yes, -y          não pergunta nada (defaults + modo mockup; pasta default "minha-loja")
    --estilo <nome>    estilo visual: essencial | promocional | editorial | boutique
    --install          roda npm install ao final
    --no-install       não roda npm install
    --help, -h         esta ajuda

  Exemplos:
    npx --package=@unbox-plus/cli create-unbox-store minha-loja
    npx --package=@unbox-plus/cli create-unbox-store loja-x --yes --no-install --estilo boutique

  Depois de gerar: cd <pasta> && claude  (o briefing de marca abre sozinho)
  Docs completas: README.md dentro do zip da beta.
`);
}

function parseArgs(argv) {
  const flags = { yes: false, install: undefined, target: undefined, estilo: undefined };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") { printHelp(); process.exit(0); }
    else if (arg === "--yes" || arg === "-y") flags.yes = true;
    else if (arg === "--install") flags.install = true;
    else if (arg === "--no-install") flags.install = false;
    else if (arg === "--estilo") flags.estilo = argv[++i];
    else if (arg.startsWith("--estilo=")) flags.estilo = arg.slice("--estilo=".length);
    else if (arg.startsWith("--")) {
      // Flag desconhecida vira erro, não silêncio: "--estylo boutique" ignorado geraria
      // uma loja com o estilo errado sem ninguém perceber.
      console.error(`\n✗ Flag desconhecida: "${arg}". Veja as opções com --help.`);
      process.exit(1);
    }
    else positional.push(arg);
  }
  flags.target = positional[0];
  if (flags.estilo && !PRESET_NAMES.includes(flags.estilo)) {
    console.error(`\n✗ Estilo desconhecido: "${flags.estilo}". Opções: ${PRESET_NAMES.join(", ")}.`);
    process.exit(1);
  }
  return flags;
}

async function main() {
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  create-unbox-store");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  const flags = parseArgs(process.argv.slice(2));
  const nonInteractive = flags.yes || !process.stdin.isTTY;

  let targetName = flags.target;
  let hasCreds = false;
  let displayName, primary, cta;
  let checkoutMode = "custom";
  let hostedCheckoutUrl = "";
  let site = "", instagram = "", objetivo = "";
  let estilo = flags.estilo ?? "essencial";

  if (nonInteractive) {
    targetName = targetName || "minha-loja";
    displayName = path.basename(targetName);
    primary = DEFAULT_PRIMARY;
    cta = DEFAULT_CTA;
  } else {
    const answers = await prompts([
      {
        type: targetName ? null : "text",
        name: "targetName",
        message: "Nome da pasta/projeto",
        initial: "minha-loja",
      },
      {
        type: "text",
        name: "displayName",
        message: "Nome de exibição da loja",
        initial: (prev) => prev || "Minha Loja",
      },
      {
        type: "text",
        name: "primary",
        message: "Cor primária (hex): botões, preços, links",
        initial: DEFAULT_PRIMARY,
        validate: (v) => (normalizeHex(v) ? true : "Hex inválido, ex: #15803D"),
      },
      {
        type: "text",
        name: "cta",
        message: "Cor de destaque/CTA (hex): ofertas, banners",
        initial: DEFAULT_CTA,
        validate: (v) => (normalizeHex(v) ? true : "Hex inválido, ex: #F3C012"),
      },
      {
        type: "text",
        name: "site",
        message: "Site atual da marca (URL, Enter se não tiver)",
      },
      {
        type: "text",
        name: "instagram",
        message: "Instagram da marca (@usuario ou URL, Enter pra pular)",
      },
      {
        type: "text",
        name: "objetivo",
        message: "Objetivo da loja em uma frase (ex.: aumentar o ticket médio, Enter pra pular)",
      },
      {
        type: flags.estilo ? null : "select",
        name: "estilo",
        message: "Estilo visual da loja (sugerido a partir do que você contou; layout, fontes e clima mudam com ele)",
        choices: (prev, values) => {
          const sugg = suggestPreset(values);
          return PRESET_NAMES.map((name) => ({
            title: `${PRESETS[name].label}${name === sugg ? " (sugerido)" : ""}: ${PRESETS[name].tagline}`,
            value: name,
          }));
        },
        initial: (prev, values) => PRESET_NAMES.indexOf(suggestPreset(values)),
      },
      {
        type: "confirm",
        name: "hasCreds",
        message: "Você já tem as credenciais da Unbox (key de parceiro ou da loja + UNBOX_USER/UNBOX_PASS)?",
        initial: false,
      },
      {
        type: "select",
        name: "checkoutMode",
        message: "Checkout: customizável (código neste projeto) ou padrão da Unbox (hospedado)?",
        choices: [
          { title: "Customizável (mais flexível, mas você assume o risco)", value: "custom" },
          { title: "Padrão da Unbox (hospedado, sem código aqui)", value: "unbox" },
        ],
        initial: 0,
      },
      {
        type: (prev) => (prev === "unbox" ? "text" : null),
        name: "checkoutDomain",
        message: "Domínio da loja vinculado na Unbox (ex.: minhaloja.com.br). O checkout usa esse mesmo domínio",
        validate: validaDominio,
      },
    ], { onCancel });
    targetName = targetName || answers.targetName;
    displayName = answers.displayName || targetName;
    primary = normalizeHex(answers.primary) || DEFAULT_PRIMARY;
    cta = normalizeHex(answers.cta) || DEFAULT_CTA;
    site = (answers.site ?? "").trim();
    instagram = (answers.instagram ?? "").trim();
    objetivo = (answers.objetivo ?? "").trim();
    estilo = flags.estilo ?? answers.estilo ?? "essencial";
    hasCreds = answers.hasCreds;
    checkoutMode = answers.checkoutMode ?? "custom";
    if (checkoutMode === "unbox") {
      const dom = normalizeDomain(answers.checkoutDomain);
      if (dom) {
        hostedCheckoutUrl = `${dom}/carrinho/finalizar-pedido`;
      } else {
        // Sem domínio válido NÃO dá pra apagar o checkout do projeto: a loja ficaria sem
        // nenhum (o botão "finalizar" cairia em 404). Mantém o customizável e avisa.
        checkoutMode = "custom";
        console.log("\n  ⚠ Domínio do checkout hospedado ausente/inválido: mantendo o checkout customizável.");
        console.log("    Pra usar o hospedado depois: preencha UNBOX_HOSTED_CHECKOUT_URL no .env.local.\n");
      }
    }
    if (checkoutMode === "custom") console.log(CHECKOUT_WARNING);
  }

  const targetDir = path.resolve(process.cwd(), targetName);

  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    console.error(`\n✗ A pasta "${targetName}" já existe e não está vazia. Abortando.`);
    process.exit(1);
  }

  let credAnswers = {};
  if (hasCreds) {
    credAnswers = await prompts([
      { type: "text", name: "UNBOX_PARTNER_API_KEY", message: "UNBOX_PARTNER_API_KEY: api key única do PARCEIRO (recomendada; Enter se ainda usa key por loja)" },
      { type: "text", name: "UNBOX_API_KEY", message: "UNBOX_API_KEY: key da loja, modelo antigo (Enter pra pular se informou a de parceiro)" },
      { type: "text", name: "UNBOX_USER", message: "UNBOX_USER" },
      { type: "password", name: "UNBOX_PASS", message: "UNBOX_PASS" },
      { type: "text", name: "UNBOX_SHOP_ID", message: "UNBOX_SHOP_ID (opcional, Enter pra deixar em branco)" },
      { type: "text", name: "UNBOX_SHOP_SLUG", message: "UNBOX_SHOP_SLUG (opcional, Enter pra deixar em branco)" },
      {
        // Só faz sentido com a key de parceiro: é o segredo que o header x-captcha-verification
        // espera no placeOrder/OTP (sem ele, a key vai no lugar e o cliente vê CAPTCHA_MALFORMED_ERROR).
        type: (_prev, values) => (values.UNBOX_PARTNER_API_KEY?.trim() ? "password" : null),
        name: "UNBOX_CAPTCHA_BYPASS",
        message: "UNBOX_CAPTCHA_BYPASS: segredo de bypass do reCAPTCHA (pedir à Unbox junto com a key de parceiro; Enter pra pular)",
      },
      { type: "password", name: "UNBOX_MCP_TOKEN", message: "Token do MCP da Unbox (opcional, habilita o .mcp.json pronto; pedir à Unbox; Enter pra pular)" },
    ], { onCancel });
  } else {
    console.log("\n  Subindo em modo mockup. Preencha o .env.local depois e rode `npm run unbox:test`.\n");
  }

  console.log(`\n→ Gerando projeto em ${targetDir} ...`);
  copyTemplate(targetDir);
  setProjectName(targetDir, targetName);
  // MCP da Unbox: com o token informado, o .mcp.json REAL já sai pronto (preenchido com as
  // credenciais coletadas). O .mcp.json.example fica sempre só com placeholders — nunca
  // embarque credencial viva em arquivo de exemplo (ele vai pro git; o .mcp.json não).
  if (credAnswers.UNBOX_MCP_TOKEN) {
    const subst = {
      SEU_UNBOX_MCP_TOKEN: credAnswers.UNBOX_MCP_TOKEN,
      SUA_UNBOX_PARTNER_API_KEY: credAnswers.UNBOX_PARTNER_API_KEY || credAnswers.UNBOX_API_KEY || "",
      SEU_UNBOX_USER: credAnswers.UNBOX_USER || "",
      SUA_UNBOX_PASS: credAnswers.UNBOX_PASS || "",
    };
    // Percorre o JSON e troca os placeholders como VALORES — nunca replace de string no texto
    // (credencial com `$&`, `$'` ou aspas corrompia o arquivo; JSON.stringify escapa tudo).
    const troca = (v) => (typeof v === "string" && v in subst ? subst[v]
      : Array.isArray(v) ? v.map(troca)
      : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, troca(x)]))
      : v);
    const example = JSON.parse(fs.readFileSync(path.join(targetDir, ".mcp.json.example"), "utf8"));
    fs.writeFileSync(path.join(targetDir, ".mcp.json"), JSON.stringify(troca(example), null, 2) + "\n");
    delete credAnswers.UNBOX_MCP_TOKEN; // não é env do app — não vai pro .env.local
    console.log("  ✓ MCP da Unbox configurado (.mcp.json pronto; fora do git)");
  } else {
    delete credAnswers.UNBOX_MCP_TOKEN;
  }
  // Porta de preview: se escopa pelo DOMÍNIO sozinha (liga em *.vercel.app/*.myunbox.com.br,
  // some em domínio próprio e no localhost) — nenhuma env necessária no .env.local.
  writeEnvLocal(targetDir, {
    ...credAnswers,
    NEXT_PUBLIC_SITE_NAME: displayName,
    ...(hostedCheckoutUrl ? { UNBOX_HOSTED_CHECKOUT_URL: hostedCheckoutUrl } : {}),
  });

  if (checkoutMode === "unbox") {
    removeCustomCheckout(targetDir);
    console.log(`  ✓ Checkout padrão da Unbox configurado (${hostedCheckoutUrl})`);
  }

  const preset = PRESETS[estilo];
  const brandTokens = deriveBrandTokens({ primary, cta }, preset);
  applyPreset(targetDir, estilo, brandTokens);
  applyStoreName(targetDir, displayName);
  console.log(`  ✓ Estilo "${preset.label}" aplicado: layout, fontes e neutros do preset + primária ${primary}, CTA ${cta}, loja "${displayName}"`);

  writeBriefing(targetDir, {
    loja: displayName,
    corPrimaria: primary,
    corCta: cta,
    estilo,
    // Dials de composição (1-10). Default do preset; o agente 15 revalida no briefing.
    // variancia = quão assimétrica/ousada é a composição · motion = quanta animação
    // (0 desliga) · densidade = quanto conteúdo por tela (arejado ↔ compacto).
    dials: PRESETS[estilo]?.dials,
    site,
    instagram,
    objetivo,
    checkout: checkoutMode === "unbox" ? "padrao-unbox" : "customizavel",
    geradoPor: "create-unbox-store",
    criadoEm: new Date().toISOString(),
  });
  console.log("  ✓ Briefing inicial salvo em marca/briefing.json (o agente de marca lê daqui)");

  let install = flags.install ?? true;
  if (!nonInteractive && flags.install === undefined) {
    const res = await prompts({
      type: "confirm",
      name: "install",
      message: "Rodar `npm install` agora? (pode demorar ~2 min)",
      initial: true,
    }, { onCancel });
    install = res.install;
  }

  if (install) {
    console.log("\n→ Instalando dependências...");
    execSync("npm install", { cwd: targetDir, stdio: "inherit" });
  }

  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ✓ Projeto criado!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  // "Perguntar antes de mostrar": o próximo passo é o BRIEFING no Claude Code (agente 15),
  // não "npm run dev" — o cliente não deve ver a loja padrão antes da personalização.
  console.log(`
  Próximo passo: dar a cara da sua marca pra loja.

  cd ${targetName}
  ${install ? "" : "npm install\n  "}claude

  O Claude Code abre direto no briefing de marca e puxa a conversa sozinho.
  Ele entrevista você, aplica logo, cores e conteúdo reais, e só então te
  mostra a loja, já personalizada.

  (Não tem o Claude Code? npm install -g @anthropic-ai/claude-code)

  Antes de ir pra produção: npm run unbox:test
  Depois do briefing, os passos opcionais (CRO, SEO, Deploy): agents/MANAGER.md
`);
}

main();
