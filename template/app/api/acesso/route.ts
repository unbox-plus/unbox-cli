// Registra o lead da porta de preview e assina o cookie que libera a loja.
// Fica FORA da porta (o middleware deixa /api/acesso passar), senão não haveria como entrar.
//
// Os logs da Vercel têm retenção de HORAS — quem PERSISTE o lead é o Pipedrive
// (e o webhook opcional). Os logs servem pra conferir e contar.
import { NextResponse } from "next/server";
import { COOKIE, senhaDoPreview, tokenDaSenha } from "@/middleware";

const LOJA = "minhaloja"; // o CLI troca pelo slug — vira o título do negócio: "minhaloja - Nome"

export const dynamic = "force-dynamic";

/** Cookie que marca "esta pessoa já apareceu antes" — separa gente de recarga. */
const VISITANTE = `${LOJA}_visitante`;

/** "(11) 93619-8174" → "+5511936198174". Null quando não é BR plausível. */
function toE164(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return null;
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  return `+55${digits}`;
}

/** x-vercel-ip-city vem percent-encoded ("S%C3%A3o%20Paulo") — decodifica antes de
 *  qualquer uso humano (log, CRM, webhook), senão o time comercial lê lixo. */
function cidadeDe(req: Request): string | null {
  const raw = req.headers.get("x-vercel-ip-city");
  if (!raw) return null;
  try { return decodeURIComponent(raw); } catch { return raw; }
}

/**
 * Uma linha estruturada por tentativa. No painel de Logs da Vercel, filtrar por
 * `[preview-acesso]` e `"evento":"entrou"` dá a contagem de quem entrou.
 *
 * ⚠️ NÃO grava o IP: é dado pessoal sob a LGPD, e cidade/país já respondem "quem entrou".
 */
function registrar(req: Request, evento: "entrou" | "invalido", visitante: string, novo: boolean) {
  const h = req.headers;
  console.log(
    JSON.stringify({
      tag: "[preview-acesso]",
      evento,
      visitante, // id aleatório do cookie: conta PESSOAS, não recargas
      primeiraVez: novo,
      quando: new Date().toISOString(),
      cidade: cidadeDe(req),
      pais: h.get("x-vercel-ip-country") ?? null,
      dispositivo: /mobile|iphone|android/i.test(h.get("user-agent") ?? "") ? "mobile" : "desktop",
      veioDe: h.get("referer") ?? null,
    }),
  );
}

export async function POST(req: Request) {
  // Nome e e-mail obrigatórios; marca e WhatsApp opcionais — barreira alta demais
  // mata a visualização.
  const corpo = (await req.json().catch(() => ({}))) as {
    nome?: string; marca?: string; whatsapp?: string; email?: string;
  };
  const nome = (corpo.nome ?? "").trim();
  const marca = (corpo.marca ?? "").trim();
  const whatsapp = (corpo.whatsapp ?? "").trim();
  const email = (corpo.email ?? "").trim();

  // Identifica a pessoa entre tentativas, sem saber quem ela é.
  const cookies = req.headers.get("cookie") ?? "";
  const jaTinha = cookies.match(new RegExp(`${VISITANTE}=([^;]+)`))?.[1];
  const visitante = jaTinha ?? crypto.randomUUID().slice(0, 8);
  const marcaVisitante = { sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 180 };

  // Pausa fixa: torna envio em massa chato o bastante pra um link que circula entre
  // poucos, e disfarça a latência do Pipedrive.
  await new Promise((r) => setTimeout(r, 400));

  if (!nome || nome.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    registrar(req, "invalido", visitante, !jaTinha);
    const res = NextResponse.json({ ok: false }, { status: 400 });
    if (!jaTinha) res.cookies.set(VISITANTE, visitante, marcaVisitante);
    return res;
  }

  registrar(req, "entrou", visitante, !jaTinha);
  console.log(
    JSON.stringify({
      tag: "[preview-lead]",
      nome, marca: marca || null, whatsapp: whatsapp || null, email,
      visitante, quando: new Date().toISOString(),
    }),
  );

  // ── PIPEDRIVE ─────────────────────────────────────────────────────────────
  // AGUARDADO antes da resposta, de propósito: o `void fetch` do webhook abaixo
  // aceita perder a mensagem se a função congelar depois do return; pro CRM não dá.
  // Falha NUNCA bloqueia a entrada: o lead ainda está no log.
  const pdToken = process.env.PIPEDRIVE_API_TOKEN;
  if (pdToken) {
    try {
      const pd = (caminho: string, body?: unknown) =>
        fetch(`https://api.pipedrive.com/v1/${caminho}${caminho.includes("?") ? "&" : "?"}api_token=${pdToken}`, {
          method: body ? "POST" : "GET",
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        }).then((r) => r.json());

      // Dedup por e-mail: quem se cadastra duas vezes não vira pessoa duplicada.
      const busca = await pd(`persons/search?term=${encodeURIComponent(email)}&fields=email&exact_match=true&limit=1`);
      let pessoaId: number | undefined = busca?.data?.items?.[0]?.item?.id;
      if (!pessoaId) {
        const fone = toE164(whatsapp) ?? (whatsapp || null);
        const criada = await pd("persons", {
          name: nome,
          email: [{ value: email, primary: true }],
          ...(fone ? { phone: [{ value: fone, label: "whatsapp" }] } : {}),
          ...(marca ? { org_name: marca } : {}),
        });
        pessoaId = criada?.data?.id;
      }
      if (pessoaId) {
        // NEGÓCIO no funil, não Lead na caixa de entrada — o time olha o funil.
        // ⚠️ A RESPOSTA é conferida, não presumida: recusa do Pipedrive vem com
        // success:false e status 200 — logar ok sem olhar seria mentira.
        const negocio = await pd("deals", { title: `${LOJA} - ${nome}`, person_id: pessoaId });
        console.log(JSON.stringify({
          tag: "[preview-lead-pipedrive]",
          ok: !!negocio?.success,
          pessoaId,
          dealId: negocio?.data?.id ?? null,
          erro: negocio?.success ? null : (negocio?.error ?? "resposta sem success"),
          email,
        }));
      } else {
        console.log(JSON.stringify({ tag: "[preview-lead-pipedrive]", ok: false, motivo: "pessoa sem id", busca: busca?.success, email }));
      }
    } catch (e) {
      console.log(JSON.stringify({ tag: "[preview-lead-pipedrive]", ok: false, motivo: String(e), email }));
    }
  } else {
    // Pulo VISÍVEL, nunca silencioso: sem esta linha, um deploy sem o token engole
    // leads sem deixar rastro (20 min caçando fantasma numa estreia real).
    console.log(JSON.stringify({ tag: "[preview-lead-pipedrive]", ok: false, motivo: "sem PIPEDRIVE_API_TOKEN no ambiente", email }));
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await tokenDaSenha(senhaDoPreview()), {
    httpOnly: true, // fora do alcance de JS na página
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  });
  if (!jaTinha) res.cookies.set(VISITANTE, visitante, marcaVisitante);

  // Aviso em tempo real, opcional: aponte PREVIEW_WEBHOOK_URL pra um Slack/Zapier.
  const destino = process.env.PREVIEW_WEBHOOK_URL;
  if (destino) {
    const cidade = cidadeDe(req);
    void fetch(destino, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🔓 Lead na prévia (${LOJA}): ${nome}${marca ? ` (${marca})` : ""} · ${email}${whatsapp ? ` · ${whatsapp}` : ""}${cidade ? ` · ${cidade}` : ""}`,
      }),
    }).catch(() => {});
  }

  return res;
}
