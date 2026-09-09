# Agente 07 — Auth (OTP Login)

> ⚠️ **Doc de plano (histórico).** A implementação entregue pela foundation difere em nomes e
> caminhos de arquivo citados abaixo. O mapa REAL de arquivos por área é a tabela "Agentes
> 00-11" do `agents/MANAGER.md` — em conflito, valem o MANAGER e o código.

## Escopo
Login passwordless (OTP por e-mail), gestão de sessão via cookie httpOnly, e proteção de rotas.

## Dependências
- Agente 00 (Scaffold) — `lib/auth.ts` base

## Arquivos proprietários

| Arquivo | Descrição |
|---------|-----------|
| `app/(loja)/conta/entrar/page.tsx` | Página de login (2 steps: email → código) |
| `app/api/account/otp/route.ts` | Dispara OTP por e-mail |
| `app/api/account/signin/route.ts` | Troca código OTP pelo token do cliente |
| `app/api/account/signout/route.ts` | Limpa cookie e redireciona |
| `lib/auth.ts` | getCustomerToken / setCustomerToken / clearCustomerToken |
| `middleware.ts` | Protege /conta/pedidos e /conta/assinaturas |
| `components/auth/OTPForm.tsx` | Formulário em dois steps |

## lib/auth.ts (completo)

```ts
import "server-only"
import { cookies } from "next/headers"

const COOKIE_NAME = "unbox_customer_token"
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
}

export async function getCustomerToken(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE_NAME)?.value
}

export async function setCustomerToken(token: string, maxAge = 7 * 24 * 60 * 60) {
  (await cookies()).set(COOKIE_NAME, token, { ...COOKIE_OPTS, maxAge })
}

export async function clearCustomerToken() {
  (await cookies()).delete(COOKIE_NAME)
}
```

## /api/auth/otp (POST) — CRÍTICO

```ts
// ⚠️ Manda e-mail REAL — rate-limit obrigatório
// Rate-limit simples: Map<email, lastSentAt>
const rateLimitMap = new Map<string, number>()

export async function POST(req: Request) {
  const { email } = await req.json()

  // Rate-limit: 1 por minuto por email
  const last = rateLimitMap.get(email) ?? 0
  if (Date.now() - last < 60_000) {
    return Response.json({ error: "Aguarde antes de reenviar o código" }, { status: 429 })
  }
  rateLimitMap.set(email, Date.now())

  const client = await getUnboxClient()
  await client.gql(
    `mutation($i:CustomerOTPRequestInput!){ customerOTPRequest(input:$i){success} }`,
    { i: { email, shopId: process.env.UNBOX_SHOP_ID } },
    { captcha: true }  // ⚠️ obrigatório — SDK envia x-captcha-verification
  )
  return Response.json({ success: true })
}
```

## /api/auth/signin (POST)

```ts
export async function POST(req: Request) {
  const { email, code } = await req.json()
  const client = await getUnboxClient()
  const data = await client.gql(
    `mutation($i:CustomerPasswordlessSignInInput){
      customerPasswordlessSignIn(input:$i){
        accessToken firstAccess newShopSignIn
      }
    }`,
    { i: { email, otpCode: code, shopId: process.env.UNBOX_SHOP_ID } },
    { captcha: true }
  )
  await setCustomerToken(data.customerPasswordlessSignIn.accessToken)
  return Response.json({ success: true, firstAccess: data.customerPasswordlessSignIn.firstAccess })
}
```

## middleware.ts

```ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const token = req.cookies.get("unbox_customer_token")?.value
  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = "/conta/entrar"
    url.searchParams.set("next", req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/conta/pedidos/:path*", "/conta/assinaturas/:path*"],
}
```

## OTPForm — UX

```
Step 1: Campo de email + botão "Enviar código"
Step 2: Campo de 6 dígitos (autofoco) + botão "Entrar"
        + botão "Reenviar código" (habilitado após 60s)

Erros: via friendlyError() do lib/feedback.ts
Após sucesso: redirect para ?next ou /conta/pedidos
```
