"use client";

import * as React from "react";
import {
  EnvelopeSimple, Key, ArrowLeft, Warning, CircleNotch, ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";

export default function EntrarPage() {
  const [phase, setPhase] = React.useState<"email" | "otp">("email");
  const [email, setEmail] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  async function call(url: string, body: any) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Erro inesperado.");
    return data;
  }

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await call("/api/account/otp", { email: email.trim() });
      setInfo("Enviamos um código de 6 dígitos para o seu e-mail.");
      setPhase("otp");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await call("/api/account/signin", { email: email.trim(), otp: otp.trim() });
      // Navegação de DOCUMENTO inteiro, não router.push(): o App Router pode reusar o payload
      // RSC de /conta cacheado ANTES do cookie de sessão existir (que era um redirect de volta
      // pra cá) — sintoma "digitei a senha e não entrou; recarreguei e foi" (caso real em produção).
      window.location.assign("/conta");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="store-layout full-bleed flex min-h-[78vh] items-center justify-center bg-white px-4 py-12 text-[var(--store-ink)]">
      <div className="w-full max-w-[440px]">
        <div className="rounded-xl border border-[var(--store-line)] bg-white p-7 shadow-[0_12px_40px_rgba(24,24,27,.08)] sm:p-9">
          <div className="text-xs font-extrabold tracking-[1.5px] text-[var(--store-primary,#18181B)]">MINHA CONTA</div>
          <h1 className="font-display mt-2 text-[28px] font-extrabold leading-[1.12]">Entrar</h1>
          <p className="mt-1.5 text-[14.5px] leading-[1.5] text-[var(--store-muted)]">
            Acesse com seu e-mail: sem senha, por código de verificação.
          </p>

          {error && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[var(--store-sale-soft)] bg-[var(--store-sale-soft)] px-4 py-3 text-[13.5px] font-semibold text-[#A21F25]" role="alert">
              <Warning weight="fill" className="mt-px shrink-0 text-[17px] text-[var(--store-sale)]" />
              <span>{error}</span>
            </div>
          )}
          {info && phase === "otp" && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[var(--store-primary-soft)] bg-[var(--store-primary-soft,#F1F1F3)] px-4 py-3 text-[13.5px] font-semibold text-[var(--store-primary,#18181B)]">
              <ShieldCheck weight="fill" className="mt-px shrink-0 text-[17px]" />
              <span>{info}</span>
            </div>
          )}

          {phase === "email" ? (
            <form onSubmit={requestOtp} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-bold text-[var(--store-ink-2)]">E-mail</span>
                <input
                  type="email" autoComplete="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  className="h-12 w-full rounded-xl border-[1.5px] border-[var(--store-line-2)] bg-white px-4 text-[15px] font-medium text-[var(--store-ink)] outline-none transition-colors focus:border-[var(--store-primary,#18181B)]"
                />
              </label>
              <button type="submit" disabled={loading || !email.trim()} className="font-display mt-1 flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--store-primary,#18181B)] text-[15px] font-bold tracking-[0.3px] text-white transition-colors hover:bg-[var(--store-primary-dark,#09090B)] disabled:opacity-60">
                {loading ? <CircleNotch className="animate-spin text-lg" /> : <EnvelopeSimple weight="bold" className="text-lg" />}
                Enviar código
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-bold text-[var(--store-ink-2)]">Código recebido</span>
                <input
                  inputMode="numeric" autoComplete="one-time-code" maxLength={6} required
                  value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" autoFocus
                  className="h-[58px] w-full rounded-xl border-[1.5px] border-[var(--store-line-2)] bg-white text-center font-display text-[26px] font-extrabold tracking-[14px] text-[var(--store-ink)] outline-none transition-colors focus:border-[var(--store-primary,#18181B)]"
                />
                <span className="text-[12px] text-[var(--store-muted)]">Enviado para <b className="text-[var(--store-ink-2)]">{email}</b></span>
              </label>
              <button type="submit" disabled={loading || otp.length < 4} className="font-display mt-1 flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--store-primary,#18181B)] text-[15px] font-bold tracking-[0.3px] text-white transition-colors hover:bg-[var(--store-primary-dark,#09090B)] disabled:opacity-60">
                {loading ? <CircleNotch className="animate-spin text-lg" /> : <Key weight="bold" className="text-lg" />}
                Entrar
              </button>
              <button type="button" onClick={() => { setPhase("email"); setOtp(""); setError(null); }} className="flex cursor-pointer items-center justify-center gap-1.5 text-[13.5px] font-bold text-[var(--store-primary,#18181B)]">
                <ArrowLeft weight="bold" /> Usar outro e-mail
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
