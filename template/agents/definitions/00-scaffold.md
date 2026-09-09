# Agente 00 — Scaffold

> ⚠️ **Doc de plano (histórico).** A implementação entregue pela foundation difere em nomes e
> caminhos de arquivo citados abaixo. O mapa REAL de arquivos por área é a tabela "Agentes
> 00-11" do `agents/MANAGER.md` — em conflito, valem o MANAGER e o código.

## Escopo
Criar a estrutura completa do projeto Next.js 15: arquivos de configuração, fundação compartilhada
(`lib/`), shell de `app/layout.tsx` e todas as rotas como placeholders para os outros agentes preencherem.

## Dependências
Nenhuma — este agente roda primeiro.

## Arquivos a criar

| Arquivo | Descrição |
|---------|-----------|
| `package.json` | Next.js 15 + Base UI + shadcn + Tailwind v4 |
| `tsconfig.json` | Padrão Next.js com paths `@/*` |
| `next.config.ts` | Minimal, domains de imagem em branco |
| `app/globals.css` | `@import "tailwindcss"` + variáveis CSS de tema |
| `app/layout.tsx` | RootLayout shell (providers placeholder) |
| `lib/unbox.ts` | UnboxClient singleton server-only |
| `lib/auth.ts` | getCustomerToken/setCustomerToken/clearCustomerToken |
| `lib/feedback.ts` | Re-export friendlyError, cartEventLabel do SDK |
| `lib/metadata.ts` | buildMetadata(product) → Metadata do Next.js |
| `.env.local.example` | Template de variáveis de ambiente |
| `middleware.ts` | Proteção das rotas /conta/* |
| Todas as rotas | Placeholders com comentário `// TODO: agente X` |

## SDK
```ts
import "server-only"
import { UnboxClient } from "@payflows/unbox-sdk"

let _client: UnboxClient | null = null

export async function getUnboxClient(): Promise<UnboxClient> {
  if (_client) return _client
  _client = new UnboxClient({
    apiKey: process.env.UNBOX_API_KEY!,
    shopId: process.env.UNBOX_SHOP_ID!,
  })
  await _client.signIn(process.env.UNBOX_USER!, process.env.UNBOX_PASS!)
  return _client
}
```

## Regras
- `UNBOX_API_KEY` nunca com prefixo `NEXT_PUBLIC_`
- `lib/unbox.ts` deve ter `import "server-only"` na primeira linha
- Token de cliente é separado — `lib/auth.ts` usa cookies httpOnly
- Tailwind v4: `app/globals.css` deve ter `@import "tailwindcss"`

## Saída esperada
Lista de todos os arquivos criados com conteúdo completo.
