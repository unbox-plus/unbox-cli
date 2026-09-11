"use client";

// Porta do preview — prévia privada com captura de lead. Uma tela própria em vez do
// Basic Auth do navegador: o link vai pro dono da marca, e a caixa cinza do sistema
// pedindo usuário e senha passa a impressão de site quebrado.
//
// Fica FORA do route group (loja) de propósito: nasce sem header/rodapé/nav da loja.
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, LockSimple } from "@phosphor-icons/react/dist/ssr";
import { maskPhone } from "@/lib/format";

export default function AcessoPage() {
  return (
    // Suspense: useSearchParams obriga, senão a rota inteira vira dinâmica.
    <React.Suspense fallback={null}>
      <Porta />
    </React.Suspense>
  );
}

function Porta() {
  const params = useSearchParams();
  const [nome, setNome] = React.useState("");
  const [marca, setMarca] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [erro, setErro] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);
  const valido = nome.trim().length > 1 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando || !valido) return;
    setEnviando(true);
    setErro(false);
    try {
      const r = await fetch("/api/acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, marca, whatsapp, email }),
      });
      if (!r.ok) {
        setErro(true);
        setEnviando(false);
        return;
      }
      // Só caminho interno começando com "/" — senão ?de=https://outro-site vira
      // redirecionamento aberto, cortesia da nossa própria tela de acesso.
      const de = params.get("de") ?? "/";
      const destino = de.startsWith("/") && !de.startsWith("//") ? de : "/";
      // NAVEGAÇÃO DE DOCUMENTO INTEIRO, não router.replace(): o App Router guarda em
      // cache o payload RSC do destino — que é o REDIRECT pra /acesso, gerado antes do
      // cookie existir. router.replace() voltava pra própria porta (bug real em produção).
      window.location.replace(destino);
    } catch {
      setErro(true);
      setEnviando(false);
    }
  }

  const campos = [
    { id: "nome", rotulo: "Nome completo", valor: nome, muda: setNome, tipo: "text", ph: "Seu nome", auto: "name", foco: true },
    { id: "marca", rotulo: "Nome da sua marca", valor: marca, muda: setMarca, tipo: "text", ph: "Sua marca", auto: "organization", foco: false },
    { id: "whatsapp", rotulo: "WhatsApp", valor: whatsapp, muda: (v: string) => setWhatsapp(maskPhone(v)), tipo: "tel", ph: "(11) 99999-8888", auto: "tel", foco: false },
    { id: "email", rotulo: "E-mail", valor: email, muda: setEmail, tipo: "email", ph: "voce@empresa.com.br", auto: "email", foco: false },
  ];

  return (
    <div className="store-layout flex min-h-[100svh] items-center justify-center bg-[var(--store-bg)] px-5 py-16">
      <div className="w-full max-w-[430px] text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo do chrome: SVG de poucos KB. O next/image marcaria lazy num elemento que aparece em toda página (o preload scanner perde o recurso) e o reencode come o traço fino do lettering. Otimizar poucos KB não paga essas duas contas. */}
        <img src="/brand/logo.svg" alt="Logo da loja" className="mx-auto h-14 w-auto" />

        <div className="mt-8 rounded-[26px] border border-[var(--store-line)] bg-[var(--store-surface)] p-7 sm:p-9">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--store-primary,#18181B)]">
            <LockSimple weight="fill" className="text-[26px] text-white" />
          </span>

          <h1 className="font-display mt-5 text-[var(--store-ink)]">
            Prévia privada
          </h1>
          <p className="mt-2.5 text-[.98rem] leading-[1.55] text-[var(--store-muted)]">
            Esta é uma versão em construção da loja, ainda não publicada. Preencha para visualizar.
          </p>

          <form onSubmit={entrar} className="mt-7 space-y-4 text-left">
            {campos.map((c) => (
              <div key={c.id}>
                <label htmlFor={c.id} className="mb-1.5 block text-[0.85rem] font-extrabold text-[var(--store-ink)]">
                  {c.rotulo}
                </label>
                <input
                  id={c.id}
                  type={c.tipo}
                  value={c.valor}
                  autoFocus={c.foco}
                  autoComplete={c.auto}
                  inputMode={c.id === "whatsapp" ? "tel" : undefined}
                  onChange={(e) => { c.muda(e.target.value); setErro(false); }}
                  placeholder={c.ph}
                  className="h-[50px] w-full rounded-full border border-[var(--store-line-2)] bg-[var(--store-surface)] px-5 text-[0.98rem] text-[var(--store-ink)] outline-none transition-colors focus:border-[var(--store-primary,#18181B)]"
                />
              </div>
            ))}

            {erro && (
              <p role="alert" className="text-[.9rem] font-semibold text-[var(--store-primary,#18181B)]">
                Confere o nome e o e-mail e tenta de novo.
              </p>
            )}

            <button
              type="submit"
              disabled={enviando || !valido}
              className="mt-1 flex h-14 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-[var(--store-primary,#18181B)] text-[16px] font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? "Entrando..." : <>Ver a loja <ArrowRight weight="bold" /></>}
            </button>
          </form>
        </div>

        <p className="mt-6 text-[.85rem] text-[var(--store-muted)]">
          Usamos seus dados apenas para falar com você sobre esta prévia.
        </p>
      </div>
    </div>
  );
}
