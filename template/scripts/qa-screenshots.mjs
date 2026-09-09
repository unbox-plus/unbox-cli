// ═══════════════════════════════════════════════════════════════════════════════════════
// CAPTURA DE TELA DO QA VISUAL — npm run unbox:qa
//
// POR QUE ESTE SCRIPT EXISTE, e por que NÃO use `chrome --screenshot --window-size=390,844`:
//
// No macOS o Chrome trava a largura mínima da janela. Pedindo 390 de largura, o PNG SAI
// com 390 — e é por isso que ninguém percebe — mas a página renderizou a 500. Medido nesta
// máquina, nos dois modos headless:
//
//     --window-size=390,844  →  window.innerWidth = 500
//
// Ou seja: o "mobile" do QA era o layout de 500px reduzido. Metade da revisão visual de
// toda loja aprovava uma tela que nenhum usuário vê.
//
// A emulação de dispositivo do CDP (Emulation.setDeviceMetricsOverride) é independente do
// tamanho da janela e devolve 390x844 dpr=2 de verdade, com user agent e eventos de toque
// de celular. Sem dependência nova: Node 22+ tem WebSocket e fetch nativos.
// ═══════════════════════════════════════════════════════════════════════════════════════
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const OUT = process.env.QA_OUT ?? "qa";
const PORTA = 9333;

// Orçamento de frames — ver agents/definitions/16-qa-visual.md. O que pega defeito é dobra,
// transição entre seções e extremos, não o meio de um bloco. Cobrir "toda região" custa 70+
// frames por rodada e a maioria mostra o que a anterior já mostrou.
const PLANO = [
  { nome: "home",      url: "/",          frames: 4 },
  { nome: "catalogo",  url: "/produtos",  frames: 1 },
  { nome: "carrinho",  url: "/carrinho",  frames: 1 },
  { nome: "checkout",  url: "/checkout",  frames: 1 },
  // PDP: o script não sabe o slug; passe QA_PDP=/produto/<slug> (2 frames: dobra + conteúdo).
  ...(process.env.QA_PDP ? [{ nome: "pdp", url: process.env.QA_PDP, frames: 2 }] : []),
];

const PERFIS = [
  { nome: "1440", width: 1440, height: 900, dpr: 1, mobile: false },
  { nome: "390",  width: 390,  height: 844, dpr: 2, mobile: true  },
];

function acharChrome() {
  const cands = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const achado = cands.find((c) => { try { return fs.existsSync(c); } catch { return false; } });
  if (!achado) {
    console.error("✗ Chrome não encontrado. Instale o Google Chrome ou aponte CHROME_PATH=/caminho/do/chrome");
    process.exit(1);
  }
  return achado;
}

async function conectar(chrome) {
  const perfil = path.join(process.env.TMPDIR ?? "/tmp", `unbox-qa-${process.pid}`);
  const proc = spawn(chrome, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${PORTA}`, `--user-data-dir=${perfil}`,
    "--no-first-run", "--no-default-browser-check", "about:blank",
  ], { stdio: "ignore" });

  let alvos = null;
  for (let i = 0; i < 60; i++) {
    try { alvos = await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json(); break; }
    catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  if (!alvos) { proc.kill(); throw new Error("Chrome não abriu a porta de depuração"); }

  const alvo = alvos.find((t) => t.type === "page");
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  const pend = new Map();
  let id = 0;
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  };
  await new Promise((r, rej) => { ws.onopen = r; ws.onerror = rej; });

  const cdp = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pend.set(i, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  return { cdp, fechar: () => { ws.close(); proc.kill(); fs.rmSync(perfil, { recursive: true, force: true }); } };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { cdp, fechar } = await conectar(acharChrome());
  let n = 0;
  const avisos = [];

  try {
    await cdp("Page.enable");
    for (const perfil of PERFIS) {
      await cdp("Emulation.setDeviceMetricsOverride", {
        width: perfil.width, height: perfil.height,
        deviceScaleFactor: perfil.dpr, mobile: perfil.mobile,
      });
      // Confere que a emulação PEGOU. Sem esta checagem o script poderia repetir em
      // silêncio exatamente o bug que ele existe para corrigir.
      for (const alvoPagina of PLANO) {
        await cdp("Page.navigate", { url: BASE + alvoPagina.url });
        await esperar(1400);

        const { result: larg } = await cdp("Runtime.evaluate", { expression: "window.innerWidth" });
        if (larg.value !== perfil.width) {
          avisos.push(`${alvoPagina.nome}@${perfil.nome}: viewport renderizou ${larg.value}px, não ${perfil.width}px`);
        }

        const { result: alt } = await cdp("Runtime.evaluate", {
          expression: "Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)",
        });
        const total = Math.max(alt.value ?? perfil.height, perfil.height);
        const passos = alvoPagina.frames;
        // Distribui os frames pela página: dobra, transições e o fim (rodapé).
        const max = Math.max(0, total - perfil.height);

        for (let i = 0; i < passos; i++) {
          const y = passos === 1 ? 0 : Math.round((max * i) / (passos - 1));
          await cdp("Runtime.evaluate", { expression: `window.scrollTo(0, ${y})` });
          await esperar(450);
          const { data } = await cdp("Page.captureScreenshot", { format: "png" });
          const arq = path.join(OUT, `${alvoPagina.nome}-${perfil.nome}-${i}.png`);
          fs.writeFileSync(arq, Buffer.from(data, "base64"));
          n++;
        }
        process.stdout.write(`  ✓ ${alvoPagina.nome} @ ${perfil.nome}px — ${passos} frame(s)\n`);
      }
    }
  } finally {
    fechar();
  }

  console.log(`\n${n} frames em ${OUT}/`);
  if (avisos.length) {
    console.log("\n⚠ Emulação divergiu do pedido — NÃO avalie estes frames como mobile:");
    for (const a of avisos) console.log(`   • ${a}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
