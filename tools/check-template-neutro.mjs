// ═══════════════════════════════════════════════════════════════════════════════════════
// GATE DE NEUTRALIDADE DO PACOTE: roda no `prepack`, e o pack FALHA se reprovar.
//
// Por que existe: o pacote vai para um registro npm PÚBLICO. Duas coisas diferentes não
// podem viajar nele, e o gate cobra as duas:
//
//   1. VOCABULÁRIO DE UM RAMO. A foundation nasceu de uma loja de temperos e, por duas
//      varreduras, ainda entregava loja de outro ramo com "polvilhe sobre o alimento",
//      "escolha o molho", aba nutricional com traços e selo "Sem glúten" inventado. As
//      varreduras anteriores olharam COR; o que vazava era VOCABULÁRIO.
//   2. O QUE É NOSSO E NÃO É DE NINGUÉM MAIS: quem são os clientes, em que máquina isto
//      foi escrito, quem pediu cada coisa e quais são os identificadores internos.
//
// Por que aqui e NÃO no projeto gerado: uma loja de alimento pode e deve dizer "polvilhe"
// depois do briefing. O que não pode é a FOUNDATION dizer. Então a checagem é no repositório
// do CLI, antes de empacotar, e nunca viaja para o cliente.
//
// ── ESCOPO ─────────────────────────────────────────────────────────────────────────────
// A versão anterior deste gate olhava só `template/`, pulava `.py` e imprimiu
// "✓ Foundation neutra" com oito nomes de cliente dentro do pacote, porque o que vaza não
// mora só no template: mora no README, no `tools/`, num `.py` e no nome dos arquivos.
//
// Agora o escopo é EXATAMENTE o que o `npm pack` levaria, perguntado ao próprio npm. Não é
// uma imitação da regra do `files`: é a lista de verdade, com README, arquivos ocultos,
// scripts e o que mais entrar. `--ignore-scripts` é obrigatório na chamada, senão o
// `prepack` chamaria este gate de novo, em recursão.
//
// O CAMINHO de cada arquivo também é conteúdo: `public/brand/loja-do-fulano.png` vaza o
// nome do cliente sem uma linha de texto dentro.
//
// ── A LISTA DE NOMES, QUE NÃO PODE SER UMA LISTA DE NOMES ───────────────────────────────
// A régua "não cite cliente nosso" só é verificável se o gate souber quem são os clientes.
// Mas escrever a lista aqui em texto aberto seria trocar oito vazamentos por um vazamento
// só, mais organizado: a carteira inteira, num arquivo, ordenada.
//
// Então o gate NÃO carrega os nomes. Carrega o SHA-256 salgado de cada um, truncado. A régua
// é a mesma (o nome bate ou não bate), e quem lê o arquivo não descobre de quem é a loja: um
// hash não se lê de trás para frente. Para acrescentar um nome sem nunca escrevê-lo aqui:
//
//     node tools/check-template-neutro.mjs --hash "Nome Da Marca"
//
// e cole a linha que sair em NOMES_PROIBIDOS. A comparação é sobre o texto NORMALIZADO (sem
// acento, sem caixa, sem espaço e sem pontuação), então UMA entrada cobre a marca escrita de
// todo jeito: com acento, sem acento, junta, separada, em caixa alta. E a varredura testa
// janelas de uma, duas e três palavras, para pegar nome composto.
//
// Hash resolve a lista que EXISTE. O que a lista não tem continua passando, e foi assim que
// oito nomes entraram. Por isso vem junto uma peneira ESTRUTURAL, que não depende de saber
// o nome: o que aparece logo depois de "loja", "cliente", "case" ou "marca" é, por
// construção, o nome de alguém. Ela erra para o lado de reclamar demais, de propósito.
//
// ── A UNIDADE DE MEDIDA É O ARQUIVO, NÃO A LINHA ───────────────────────────────────────
// A varredura de nome roda sobre o texto do arquivo INTEIRO, com as quebras de linha
// colapsadas. O motivo é um defeito medido: um nome que já estava em NOMES_PROIBIDOS passou
// pelo gate porque caiu no fim de uma linha do README e continuou na seguinte, e a janela de
// três palavras nunca via as duas metades juntas. Quem escreve o texto não escolhe onde a
// linha quebra; o gate não pode depender disso. O número da linha guardado para a mensagem é
// o da PRIMEIRA palavra da janela, que é onde a pessoa vai procurar.
//
// ── DADO DE PESSOA ─────────────────────────────────────────────────────────────────────
// Nome de cliente é o vazamento óbvio. O menos óbvio é o dado de UMA pessoa: CPF, CNPJ e
// telefone copiados de um pedido ou de um relatório de bug. Nenhuma regra de texto pega
// isso, porque a forma é a de qualquer número. Então o gate CALCULA: documento entra pelo
// dígito verificador (se fecha a conta, é documento de alguém, não é enfeite), e telefone
// entra pela repetição (fixture de verdade repete o algarismo; número de gente espalha).
// ═══════════════════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── normalização e hash ────────────────────────────────────────────────────────────────
const SAL = "create-unbox-store/gate-de-neutralidade/v1";
/** Uma marca escrita de dois jeitos vira a MESMA palavra: sem acento, sem caixa, só letra e número. */
function normalizar(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function digerir(s) {
  return crypto.createHash("sha256").update(`${SAL}|${normalizar(s)}`).digest("hex").slice(0, 16);
}

// Nome de MARCA/LOJA de cliente. Gerado com `--hash`; nunca escrito em texto aqui.
const NOMES_PROIBIDOS = new Set([
  "046ccfa0f1d4b471", "058b924275ae73c2", "11e2f1f0133a3dc5", "1f2965db910302b4",
  "47b8b0109e55f461", "5dbaffe04f1ff2c7", "7b187f88b18eca9e", "7f05309a0d156096",
  "8beb6a7d376720ec", "8dabbae34dc6a503", "8e3b8d719bfdd476", "9f65d9184c2c5a49",
  "aed32d5dd3534187", "ce46282f4668c09d", "e0f9e2b170d6ba0a", "e17d4a86bd6494f8",
  "f16508c7fec78508", "f8a15bb5e83c112a", "fd189e7046cd4f04", "ffc0fa4b396cb7ff",
]);

// Nome de PESSOA do time. Mesma mecânica, motivo diferente: atribuição pessoal ("pedido do
// Fulano") dentro de um pacote público diz quem trabalha aqui e em quê.
const PESSOAS = new Set([
  "1e40d881aec18c64", "254ba9dcb1e41385", "b0ed5d1e02b76815", "b776bd849647689c",
]);

// O que a foundation PODE nomear: a própria plataforma, a stack e os serviços com que a loja
// gerada fala de verdade. Allowlist curta de propósito: ela é o contrapeso da peneira
// estrutural, que fora daqui reclama de qualquer nome próprio.
const NOMES_LEGITIMOS = new Set([
  "unbox", "next", "nextjs", "react", "vercel", "meta", "google", "claude", "typescript",
  "tailwind", "node", "nodejs", "pipedrive", "shopify", "vtex", "stape", "slack", "zapier",
  "agente", "agentes", // os agentes do template são chamados pelo número: "loja do Agente 00"
  "github", "npm", "chrome", "safari", "firefox", "pix", "correios", "whatsapp", "instagram",
  "facebook", "cloudflare", "lighthouse", "pagespeed", "playwright", "jose", "zod",
  "revi", "klaviyo",         // CRMs com que a loja gerada fala de verdade
  "organization",            // tipo do schema.org, não empresa nenhuma
  "editabletext",            // componente do próprio template
]);

// ── as regras de texto ─────────────────────────────────────────────────────────────────
// [regex, motivo]. Cada uma responde por UMA das quatro verificações do gate, mais a
// verificação de vocabulário que já existia.

// (1) nome de cliente: peneira estrutural, para o que a lista de hashes não tem.
// Só o que vem depois de uma palavra que ANUNCIA dono ("loja X", "case da Y"). Nome todo em
// caixa alta fica de fora: em código e em comentário nosso, MAIÚSCULA é ênfase, não marca.
// O delimitador de abertura é opcional porque a forma que passou pelo gate foi `cliente (Nome)`:
// o parêntese ficava entre o `\s+` e a maiúscula, e a peneira não via nome nenhum ali.
const DONO = /\b(?:loja|lojas|cliente|clientes|case|marca|marcas)\s+(?:d[aeo]s?\s+)?[(\[«“"']?\s*([A-ZÀ-Ú][a-zà-ÿ][\wÀ-ÿ'’-]*(?:\s+[A-ZÀ-Ú][a-zà-ÿ][\wÀ-ÿ'’-]*)?)/g;

// (2) caminho pessoal: a máquina de quem escreveu, e a atribuição a uma pessoa.
const CAMINHOS_PESSOAIS = [
  [/\/Users\/[A-Za-z0-9._-]+/, "caminho pessoal (home de macOS)"],
  [/(?:^|[^\w/])\/home\/[A-Za-z0-9._-]+\//, "caminho pessoal (home de Linux)"],
  [/[Cc]:\\Users\\[A-Za-z0-9._-]+/, "caminho pessoal (home de Windows)"],
  [/\/Users\/|\bwww-data\b/, "caminho pessoal"],
];
// A última alternativa é a forma curta de changelog, `(por Fulano)`, que é como uma atribuição
// pessoal atravessou as três primeiras: ela não tem verbo nenhum para casar.
const ATRIBUICAO = /\b(?:pedido|feedback|sugest[ãa]o|reclama[çc][ãa]o|ideia|relato)\s+d[eoa]s?\s+([A-ZÀ-Ú][a-zà-ÿ]+)|\bapontad[oa]s?\s+pel[oa]\s+([A-ZÀ-Ú][a-zà-ÿ]+)|\breportad[oa]s?\s+pel[oa]\s+([A-ZÀ-Ú][a-zà-ÿ]+)|\((?:por|via)\s+([A-ZÀ-Ú][a-zà-ÿ]+)\)/g;

// (3) identificador interno: o que só faz sentido dentro da nossa conta.
const IDENTIFICADORES = [
  [/\b(?:app\.)?notion\.(?:so|com)\/[^\s)"'`]+/i, "link de página interna (Notion)"],
  [/\blinear\.app\/[^\s)"'`]+|\batlassian\.net\/[^\s)"'`]+/i, "link de ferramenta interna"],
  [/\b[0-9a-f]{32}\b/, "identificador interno (32 hex, formato de id do Notion)"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, "identificador interno (UUID cravado)"],
];

// Propriedade de Google Tag Manager / Analytics / Ads. Não é segredo, é PLANTA: o ID diz em que
// conta a medição mora, e com ele vem, no texto em volta, a configuração de dentro dela. Um ID
// de medição já tinha viajado assim no README, junto com o inventário de gatilhos do container.
const ANALYTICS = /\b(?:GTM|G|AW|UA|DC)-[A-Z0-9]{6,}\b/g;
// Exceção nomeada e revisada, uma a uma. Cada linha diz por que aquele ID PODE ser publicado.
const ANALYTICS_LEGITIMOS = new Set([
  "GTM-PZLT336",   // contrato de produto: toda loja gerada sai com o GTM central da Unbox
  "G-ABC1234567",  // valor inventado no README para mostrar que o validador aceita ID bem formado
]);
/** Placeholder de documentação (só X, só 0, ou o literal de um regex) não é conta de ninguém. */
const ANALYTICS_PLACEHOLDER = /^(?:GTM|G|AW|UA|DC)-([A-Z0-9])\1+$/i;

// (4) segredo: o que o pacote publicaria como valor de fábrica.
// A primeira regra é a que pegou os dois defeitos reais: um `||`/`??` que transforma
// "variável ausente" em "segredo conhecido por todo mundo que baixar o pacote".
const SEGREDOS = [
  [/process\.env\.[A-Z0-9_]*(?:SECRET|PASSWORD|SENHA|TOKEN|API_?KEY|KEY|PASS)[A-Z0-9_]*\s*(?:\|\||\?\?)\s*["'`][^"'`\n]+["'`]/,
   "segredo de fábrica (fallback publicado para variável de ambiente)"],
  [/\bsk-[A-Za-z0-9]{16,}|\bghp_[A-Za-z0-9]{20,}|\bxox[baprs]-[A-Za-z0-9-]{10,}|\bAKIA[0-9A-Z]{16}\b/,
   "credencial de serviço cravada"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "chave privada cravada"],
  [/\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/, "JWT cravado"],
];

// (5) dado de UMA pessoa: CPF, CNPJ e telefone.
// Nenhuma família de regex acima olha para isto, e por isso um CPF que fecha a conta viajou em
// dois scripts que rodam contra a loja de produção, com nome, endereço completo e telefone ao
// lado. A forma de um documento é a de qualquer número: o que separa o documento de alguém de
// "00000000000" não é o formato, é a ARITMÉTICA. Então o gate calcula o dígito verificador.
const CPF_FORMA = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const CNPJ_FORMA = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
function digitoCpf(base) {
  const soma = [...base].reduce((a, d, i) => a + Number(d) * (base.length + 1 - i), 0);
  const r = (soma * 10) % 11;
  return r >= 10 ? 0 : r;
}
function cpfFechaAConta(d) {
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false; // dígito repetido: fixture, não documento
  const a = digitoCpf(d.slice(0, 9));
  return `${a}${digitoCpf(d.slice(0, 9) + a)}` === d.slice(9);
}
function digitoCnpj(base) {
  const pesos = base.length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
  const r = [...base].reduce((a, d, i) => a + Number(d) * pesos[i], 0) % 11;
  return r < 2 ? 0 : 11 - r;
}
function cnpjFechaAConta(d) {
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const a = digitoCnpj(d.slice(0, 12));
  return `${a}${digitoCnpj(d.slice(0, 12) + a)}` === d.slice(12);
}

// Celular brasileiro. Aqui não há conta para fazer: todo número é igualmente bem formado. O que
// separa fixture de telefone de gente é a REPETIÇÃO. O pacote inteiro usa 99999-9999, 99999-8888
// e 99990-000 como exemplo; os dois números que vieram de relatório de caso real eram os únicos
// com dígito espalhado. A régua é essa: no máximo 3 dígitos distintos nos 8 finais, senão é
// número de alguém e não se publica.
const FONE_FORMA = /(?:\(\s*0?\d{2}\s*\)|\b0?\d{2})[\s.-]?9\d{4}[\s.-]?\d{4}\b|\b9\d{4}[\s.-]?\d{4}\b/g;
const FONE_DISTINTOS_MAX = 3;

// (6) vocabulário de um ramo: a verificação que este gate já fazia, preservada.
// Só termos SEM uso legítimo numa foundation neutra. "alimento", "nutricional", "glúten"
// ficam de fora de propósito: aparecem em código CONDICIONAL correto ("tabela nutricional só
// se for alimento") e o gate não pode punir isso.
const VOCABULARIO = [
  [/polvilh/i, "instrução de uso de tempero"],
  [/\btemperos?\b|\btempere\b|\btemperad[oa]s?\b/i, "vocabulário de tempero"],
  [/\bespeciarias?\b|\bcondimentos?\b/i, "vocabulário de tempero"],
  [/p[aá]prica|or[eé]gano|cominho|a[cç]afr[aã]o|chimichurri|lemon pepper|sriracha|garlic|alho em p[oó]/i, "produto de tempero"],
  // As nove regras eram todas em português, e por isso quatro exemplos em inglês sobreviveram
  // DENTRO do template, que é justamente onde este bloco é cobrado.
  [/\bpaprika\b|\bcilantro\b|\bcumin\b|\bcayenne\b|\bturmeric\b|\bchimichurri\b|\bchil[ei]\s*(?:&|and)?\s*lime\b|\bsmoked\s+paprika\b/i, "produto de tempero (nome em inglês)"],
  [/\bmolhos?\b(?! de contato)/i, "produto de alimentação"],
  [/marinad[ao]s?|churrasco|festa junina/i, "contexto de alimentação"],
  [/\bsabor(es)?\b/i, "copy de alimentação ('mais sabor')"],
  [/porção 1 ?g\b/i, "porção de tempero cravada"],
  [/Cliente [A-C]\. .*(tempero|prato|receita de)/i, "depoimento de alimentação"],
];

// O vocabulário de ramo é cobrado na FOUNDATION. O README é changelog: ele NARRA o defeito
// ("a loja dizia polvilhe"), e proibir a palavra ali apagaria a explicação de por que este
// gate existe. Nome de cliente, caminho pessoal, identificador e segredo não têm essa
// licença: valem no artefato inteiro.
const VOCABULARIO_SO_EM = "template/";

// Trechos permitidos: a explicação do próprio bug, em comentário, precisa poder citar a
// palavra uma vez. Mantém a lista CURTA: todo item aqui é uma exceção que alguém revisou.
// VAZIA hoje, e é para continuar assim: exceção aqui é buraco no gate. Um item novo só entra
// com o motivo escrito ao lado e alguém que o revisou.
const PERMITIDOS = [];

// ── varredura ──────────────────────────────────────────────────────────────────────────
const BINARIOS = /\.(webp|png|jpe?g|gif|ico|woff2?|ttf|otf|mp4|pdf|zip|tgz)$/i;
const achados = [];
function anotar(rel, n, motivo, texto) {
  if (PERMITIDOS.some((ok) => rel === ok || rel.startsWith(ok))) return;
  achados.push({ rel, n, motivo, texto: String(texto).trim().slice(0, 110) });
}

/**
 * Nomes proibidos no texto de um ARQUIVO: janelas de 1, 2 e 3 palavras, normalizadas e
 * digeridas. As palavras vêm com o número da linha em que cada uma começa, e a janela pode
 * atravessar a quebra de linha: foi exatamente assim que um nome da lista passou pelo gate.
 * Devolve TODAS as ocorrências, e não a primeira: um arquivo pode citar dois clientes.
 */
const memo = new Map();
function nomesProibidosNo(texto) {
  const palavras = [];
  let linha = 1;
  for (const t of texto.split(/([A-Za-zÀ-ÿ0-9]+)/)) {
    if (!t) continue;
    if (/^[A-Za-zÀ-ÿ0-9]+$/.test(t)) palavras.push({ t, linha });
    else linha += (t.match(/\n/g) || []).length;
  }
  const achados = [];
  for (let i = 0; i < palavras.length; i++) {
    for (let j = 1; j <= 3 && i + j <= palavras.length; j++) {
      const janela = palavras.slice(i, i + j);
      const chave = normalizar(janela.map((x) => x.t).join(""));
      if (chave.length < 4) continue; // 3 letras dão colisão demais com palavra comum
      let d = memo.get(chave);
      if (d === undefined) { d = digerir(chave); memo.set(chave, d); }
      const motivo = NOMES_PROIBIDOS.has(d) ? "nome de cliente"
                   : PESSOAS.has(d) ? "nome de pessoa do time" : null;
      if (motivo) achados.push({ motivo, linha: janela[0].linha, trecho: janela.map((x) => x.t).join(" ") });
    }
  }
  return achados;
}

function conferirLinha(rel, n, linha, dentroDoTemplate) {
  let m;
  DONO.lastIndex = 0;
  while ((m = DONO.exec(linha))) {
    const nome = m[1].trim();
    if (!NOMES_LEGITIMOS.has(normalizar(nome.split(/\s+/)[0])) && !NOMES_LEGITIMOS.has(normalizar(nome))) {
      anotar(rel, n, `nome de cliente (nome próprio depois de "${m[0].split(/\s+/)[0]}")`, linha);
      break;
    }
  }

  ATRIBUICAO.lastIndex = 0;
  if (ATRIBUICAO.test(linha)) anotar(rel, n, "atribuição pessoal (quem pediu não é público)", linha);

  for (const [re, motivo] of CAMINHOS_PESSOAIS) if (re.test(linha)) { anotar(rel, n, motivo, linha); break; }
  for (const [re, motivo] of IDENTIFICADORES) if (re.test(linha)) { anotar(rel, n, motivo, linha); break; }
  for (const [re, motivo] of SEGREDOS) if (re.test(linha)) { anotar(rel, n, motivo, linha); break; }

  ANALYTICS.lastIndex = 0;
  while ((m = ANALYTICS.exec(linha))) {
    const id = m[0].toUpperCase();
    if (ANALYTICS_LEGITIMOS.has(id) || ANALYTICS_PLACEHOLDER.test(id)) continue;
    anotar(rel, n, "propriedade de analytics (a conta é nossa, não é do pacote)", linha);
    break;
  }

  for (const [re, fecha, motivo] of [[CPF_FORMA, cpfFechaAConta, "CPF de alguém (o dígito verificador fecha)"],
                                     [CNPJ_FORMA, cnpjFechaAConta, "CNPJ de alguém (o dígito verificador fecha)"]]) {
    re.lastIndex = 0;
    let achou = false;
    while ((m = re.exec(linha))) if (fecha(m[0].replace(/\D/g, ""))) { achou = true; break; }
    if (achou) { anotar(rel, n, motivo, linha); break; }
  }

  FONE_FORMA.lastIndex = 0;
  while ((m = FONE_FORMA.exec(linha))) {
    const finais = m[0].replace(/\D/g, "").slice(-8);
    if (new Set(finais).size <= FONE_DISTINTOS_MAX) continue; // fixture: 99999-8888 e parentes
    anotar(rel, n, "telefone de pessoa (dígito espalhado demais para ser fixture)", linha);
    break;
  }

  if (dentroDoTemplate) {
    for (const [re, motivo] of VOCABULARIO) if (re.test(linha)) { anotar(rel, n, motivo, linha); break; }
  }
}

/** A lista de verdade do que seria publicado, perguntada ao npm. */
function arquivosDoPacote() {
  const npm = process.env.npm_execpath;
  const saida = npm && /\.c?js$/.test(npm)
    ? execFileSync(process.execPath, [npm, "pack", "--dry-run", "--ignore-scripts", "--json"], { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    : execFileSync("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const lista = JSON.parse(saida)?.[0]?.files?.map((f) => f.path);
  // Gate que varre o vazio e diz "limpo" aprova sem ter olhado: sem lista, não há aprovação.
  if (!lista?.length) throw new Error("npm pack --dry-run não devolveu arquivo nenhum");
  return lista;
}

if (process.argv[2] === "--hash") {
  const alvo = process.argv[3];
  if (!alvo) { console.error('uso: node tools/check-template-neutro.mjs --hash "Nome Da Marca"'); process.exit(2); }
  console.log(`  "${digerir(alvo)}",   // cole em NOMES_PROIBIDOS (ou PESSOAS), sem o nome ao lado`);
  process.exit(0);
}

let arquivos;
try {
  arquivos = arquivosDoPacote();
} catch (e) {
  console.error(`\n✗ PACK BLOQUEADO: o gate não conseguiu listar o que seria publicado. ${e.message}`);
  console.error("  Sem a lista o gate varreria o vazio e aprovaria sem ter olhado.\n");
  process.exit(2);
}

for (const rel of arquivos) {
  // O CAMINHO é conteúdo: um arquivo chamado com o nome do cliente vaza sem uma linha dentro.
  const caminhoEmPalavras = rel.replace(/[/_-]/g, " ");
  conferirLinha(rel, 0, caminhoEmPalavras, false);
  for (const a of nomesProibidosNo(caminhoEmPalavras)) anotar(rel, 0, a.motivo, `${rel}  (no caminho: ${a.trecho})`);
  if (BINARIOS.test(rel)) continue;
  const dentroDoTemplate = rel.startsWith(VOCABULARIO_SO_EM);
  const conteudo = fs.readFileSync(path.join(RAIZ, rel), "utf8");
  const linhas = conteudo.split("\n");
  linhas.forEach((linha, i) => conferirLinha(rel, i + 1, linha, dentroDoTemplate));
  // Nome roda sobre o arquivo INTEIRO: a janela precisa poder atravessar a quebra de linha.
  for (const a of nomesProibidosNo(conteudo)) anotar(rel, a.linha, a.motivo, linhas[a.linha - 1] ?? a.trecho);
}

// ── Travessão no texto que o CLI IMPRIME ─────────────────────────────────────
// O template tem gate próprio (scripts/check-unbox-brand.mjs). Aqui pega o outro lado: as
// perguntas, avisos e mensagens do wizard, e os cabeçalhos que o CLI escreve dentro do projeto.
// Comentário de código fica de fora: é nota de engenharia, não texto para quem lê a tela.
function semComentario(linha, dentroDeBloco) {
  let out = "", aspas = null, bloco = dentroDeBloco;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i], prox = linha[i + 1];
    if (bloco) { if (c === "*" && prox === "/") { bloco = false; i++; } continue; }
    if (aspas) {
      if (c === "\\") { out += c + (prox ?? ""); i++; continue; }
      if (c === aspas) aspas = null;
      out += c; continue;
    }
    if (c === '"' || c === "'" || c === "`") { aspas = c; out += c; continue; }
    if (c === "/" && prox === "/") break;
    if (c === "/" && prox === "*") { bloco = true; i++; continue; }
    out += c;
  }
  return { texto: out, bloco };
}
// A lista vem do npm, não escrita à mão: com quatro nomes fixos, um arquivo novo em `src/`
// entrava no pacote sem nunca passar por esta checagem.
for (const arquivo of arquivos.filter((f) => /^(?:bin|src)\//.test(f) && /\.[cm]?js$/.test(f))) {
  const caminho = path.join(RAIZ, arquivo);
  if (!fs.existsSync(caminho)) continue;
  let bloco = false;
  fs.readFileSync(caminho, "utf8").split("\n").forEach((linha, i) => {
    const r = semComentario(linha, bloco);
    bloco = r.bloco;
    if (r.texto.includes("\u2014")) {
      achados.push({ rel: arquivo, n: i + 1, motivo: "travessão no texto impresso pelo CLI", texto: linha.trim().slice(0, 110) });
    }
  });
}

if (achados.length) {
  const porMotivo = new Map();
  for (const a of achados) porMotivo.set(a.motivo, (porMotivo.get(a.motivo) ?? 0) + 1);
  console.error(`\n✗ PACK BLOQUEADO: ${achados.length} resíduo(s) em ${arquivos.length} arquivos que o npm publicaria.\n`);
  for (const a of achados) console.error(`   ${a.rel}:${a.n}  [${a.motivo}]\n      ${a.texto}`);
  console.error("\n  Resumo:");
  for (const [motivo, n] of [...porMotivo].sort((x, y) => y[1] - x[1])) console.error(`   ${String(n).padStart(4)}  ${motivo}`);
  console.error("\n  O pacote vai para um registro PÚBLICO. Nada de nome de cliente, caminho de máquina,");
  console.error("  atribuição pessoal, identificador interno ou segredo de fábrica pode viajar nele.");
  console.error("  A foundation também é neutra: nada de vocabulário de um ramo, nem em comentário.");
  console.error("  E o texto que o CLI imprime não usa travessão: vírgula, dois-pontos, ponto ou \"·\".");
  console.error("  Nome de cliente novo entra na lista por hash: --hash \"Nome Da Marca\".\n");
  process.exit(1);
}
console.log(`✓ Pacote neutro: ${arquivos.length} arquivos publicáveis, sem nome de cliente, caminho pessoal, identificador interno, segredo de fábrica nem vocabulário de ramo`);
