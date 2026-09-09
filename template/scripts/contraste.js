/**
 * contraste.js — mede contraste REAL no navegador, e classifica a paleta da marca.
 *
 * Cole no console do DevTools com a loja aberta, ou rode via CDP. Duas funções:
 *
 *   contraste()            varre o texto visível da página e lista o que reprova
 *   classificar("F20A64")  diz se a cor é SUPERFÍCIE (pode ter texto em cima) ou ACENTO
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OS TRÊS ERROS QUE ESTA VERSÃO NÃO COMETE
 * A mesma ferramenta foi escrita errada três vezes numa loja, sempre respondendo com
 * confiança. Os três estão tratados aqui, e cada um está comentado no ponto onde importa:
 *
 *   1. `getComputedStyle().color` NÃO é sempre rgb(). Com qualquer opacidade (e o Tailwind v4
 *      gera isso em todo `text-cor/60`) o navegador devolve `oklab(...)`. Parser de rgb()
 *      silenciosamente lê 0,0,0 e reprova texto claro sem motivo.
 *   2. Fundo não é a camada mais próxima. Véu semitransparente empilhado muda a cor efetiva:
 *      é preciso COMPOR todas as camadas até achar uma opaca.
 *   3. Alpha entra UMA vez só, na composição sobre o fundo. Medido neste navegador: o
 *      ImageData do canvas 2D é NÃO pré-multiplicado (`rgba(255,255,255,.5)` volta
 *      [255,255,255,128]), então "desfazer a pré-multiplicação" dividindo por alpha é o erro,
 *      não a correção — numa cor fora do sRGB isso estoura a faixa. Aplicar o alpha duas vezes,
 *      de qualquer um dos dois jeitos, reprova texto claro sobre escuro e APROVA texto escuro
 *      sobre claro que na verdade falha.
 *
 * E duas coisas que a ferramenta NÃO resolve, ditas aqui para ninguém confiar demais:
 *   • texto sobre foto: é preciso amostrar os pixels da imagem sob o texto e compor o véu por
 *     cima. Aqui isso é sinalizado como "sobre imagem: medir à mão", nunca aprovado no escuro.
 *   • captura de tela: esqueleto de carregamento e imagem não pintada já enganaram a leitura.
 *     Conclusão tirada de screenshot precisa ser confirmada no DOM.
 */

/** Converte QUALQUER cor que o navegador devolva em [r,g,b,a] 0-255. */
function corParaRgba(valor) {
  if (!valor || valor === "transparent") return [0, 0, 0, 0];
  // Hex direto, sem canvas: é o formato que a paleta da marca usa, e assim `classificar()`
  // também roda fora do navegador (Node, script de build) sem depender de DOM.
  const h = String(valor).trim();
  if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(h)) {
    const p = h.slice(1);
    const par = p.length <= 4 ? p.split("").map((c) => c + c) : p.match(/../g);
    const [r, g, b, a] = par.map((x) => parseInt(x, 16));
    return [r, g, b, a === undefined ? 1 : a / 255];
  }
  // (1) oklab/oklch/color(): o navegador devolve isso sempre que há opacidade. Em vez de
  // escrever um parser de espaço de cor, deixamos o próprio navegador converter, pintando
  // 1px num canvas — o resultado volta em RGBA de verdade.
  if (!/^rgba?\(/.test(valor)) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = valor;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    // (3) O ImageData do canvas 2D é NÃO pré-multiplicado: `rgba(255,255,255,.5)` volta como
    // [255,255,255,128], não [128,128,128,128] (medido neste navegador, não suposto). Ou seja,
    // os canais já são a cor pura e dividir por alpha é o erro, não a correção: numa cor fora
    // do sRGB isso estourava a faixa (um oklch deu R=404). O alpha entra uma vez só, na
    // composição sobre o fundo.
    return [d[0], d[1], d[2], d[3] / 255];
  }
  const n = valor.match(/[\d.]+/g).map(Number);
  return [n[0], n[1], n[2], n[3] === undefined ? 1 : n[3]];
}

/** Compõe `frente` (com alpha) sobre `fundo` (opaco). */
function compor([r, g, b, a], [R, G, B]) {
  return [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];
}

function luminancia([r, g, b]) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function razao(corA, corB) {
  const [L1, L2] = [luminancia(corA), luminancia(corB)].sort((x, y) => y - x);
  return (L1 + 0.05) / (L2 + 0.05);
}

/** Fundo efetivo de um elemento: sobe a árvore COMPONDO cada camada até achar uma opaca. */
function fundoEfetivo(el) {
  const camadas = [];
  let n = el;
  let sobreImagem = false;
  while (n && n !== document.documentElement.parentNode) {
    const s = getComputedStyle(n);
    if (s.backgroundImage && s.backgroundImage !== "none") sobreImagem = true;
    const c = corParaRgba(s.backgroundColor);
    if (c[3] > 0) {
      camadas.push(c);
      // (2) só paramos numa camada OPACA: véu translúcido continua subindo, porque a cor
      // efetiva depende de tudo o que está atrás dele.
      if (c[3] === 1) break;
    }
    n = n.parentElement;
  }
  let fundo = [255, 255, 255, 1]; // o branco do papel, só se nada opaco apareceu
  for (const c of camadas.reverse()) fundo = compor(c, fundo);
  return { fundo, sobreImagem };
}

const MIN_GRANDE = 3.0; // >=24px, ou >=18.66px em negrito
const MIN_NORMAL = 4.5;

/** Varre o texto visível e devolve o que reprova. */
function contraste({ apenasFalhas = true } = {}) {
  const saida = [];
  for (const el of document.querySelectorAll("body *")) {
    const texto = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(" ");
    if (!texto) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) continue;

    const { fundo, sobreImagem } = fundoEfetivo(el);
    const frente = compor(corParaRgba(s.color), fundo);
    const px = parseFloat(s.fontSize);
    const grande = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
    const minimo = grande ? MIN_GRANDE : MIN_NORMAL;
    const valor = razao(frente, fundo);
    const passa = valor >= minimo;
    if (apenasFalhas && passa && !sobreImagem) continue;
    saida.push({
      texto: texto.slice(0, 60),
      razao: Number(valor.toFixed(2)),
      minimo,
      passa,
      // Texto sobre foto NÃO é aprovado por esta conta: o fundo real são os pixels da imagem.
      aviso: sobreImagem ? "sobre imagem: medir à mão (amostrar os pixels sob o texto)" : undefined,
      seletor: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(/\s+/).slice(0, 2).join(".") : ""),
    });
  }
  console.table(saida);
  return saida;
}

/**
 * Classifica uma cor da marca. É o uso principal: define se a cor pode receber texto.
 *   superfície = passa contra tinta OU contra branco (>=4.5) → pode ser fundo de texto
 *   acento     = não passa em nenhum → contorno, ícone, faixa. NUNCA fundo de texto.
 *
 * O CLI não "corrige" cor de marca sozinho para passar no WCAG: isso descaracteriza a marca.
 * Ele mede, aplica o que a marca pediu, e escreve o número ao lado do token com a alternativa.
 */
function classificar(hex, { tinta = "#18181B", claro = "#FFFFFF" } = {}) {
  const c = corParaRgba(hex);
  const contraTinta = razao(c, corParaRgba(tinta));
  const contraClaro = razao(c, corParaRgba(claro));
  const papel = Math.max(contraTinta, contraClaro) >= 4.5 ? "superfície" : "acento";
  const r = {
    cor: hex,
    contraTinta: Number(contraTinta.toFixed(2)),
    contraBranco: Number(contraClaro.toFixed(2)),
    papel,
    textoPorCima: papel === "superfície" ? (contraTinta > contraClaro ? "tinta" : "branco") : "NENHUM",
    recomendacao:
      papel === "superfície"
        ? `use como fundo com texto ${contraTinta > contraClaro ? "escuro" : "branco"} por cima`
        : "contorno, sombra, ícone ou faixa decorativa. Para usar como fundo de texto, gere a versão funda (-deep) e ponha branco em cima",
  };
  console.log(`${hex}: ${papel} (tinta ${r.contraTinta} · branco ${r.contraBranco}) — ${r.recomendacao}`);
  return r;
}

// Sem `export`: o arquivo é feito para ser COLADO NO CONSOLE do DevTools, e `export` quebra
// isso com "Unexpected token". No navegador as funções ficam em window; em Node, no module.
if (typeof window !== "undefined") {
  Object.assign(window, { contraste, classificar, razao });
  console.log("contraste.js pronto: contraste() varre a página · classificar('#HEX') define o papel da cor");
}
if (typeof module !== "undefined") module.exports = { contraste, classificar, razao };
