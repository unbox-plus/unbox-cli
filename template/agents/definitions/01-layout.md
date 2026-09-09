# Agente 01 — Layout

## Escopo
Chrome global da loja: header (barra de anúncio + nav + busca + carrinho), footer (trust strip +
colunas de links + pagamento) e navegação mobile. Usado em toda página via `app/layout.tsx`.

## Dependências
- Agente 00 (Scaffold) — `lib/config.ts`, `lib/unbox/*`, tokens de cor em `app/globals.css`

## Arquivos proprietários

| Arquivo | Descrição |
|---------|-----------|
| `app/layout.tsx` | RootLayout — monta `<SiteHeader>`, `{children}`, `<SiteFooter>`, providers (`CartProvider`, `Toaster`) |
| `components/site-header.tsx` | Barra de anúncio + header sticky (logo, busca, conta, carrinho) + nav de categorias |
| `components/site-footer.tsx` | Trust strip, colunas de links, `PaymentChips`, logo em fundo escuro |
| `components/mobile-nav.tsx` | Drawer mobile com categorias (`NavCategory[]`) |
| `components/account-nav.tsx` | Ícone/menu de conta no header desktop |

## Regra de ouro — degradação sem credenciais
Header e footer **sempre** buscam dados da loja (`getShopData`, `getTopTags`) com `.catch()` e
fallback, nunca deixam o erro subir — é o que permite o "modo mockup" (sem `.env.local`
preenchido) funcionar sem crashar a página inteira:

```tsx
const [shop, tags] = await Promise.all([
  getShopData().catch(() => null),
  getTopTags().catch(() => []),
]);
const shopName = shop?.name ?? "Minha Loja";
```

Qualquer novo dado buscado no chrome global (header/footer) precisa seguir esse padrão — uma
página de dados (catálogo, PDP, checkout) pode mostrar erro, mas o chrome nunca pode derrubar o
layout inteiro.

## Categorias (nav)
`NavCategory[]` vem de `getTopTags()` — **sem** filtro `isTopLevel` (ver doc 05-cart/lib/unbox/client.ts:
forçar `isTopLevel: true` esconde categorias reais marcadas `false` no admin). Filtra por
`isVisible !== false` e ordena por `position`. Reusado pelo header desktop e pelo `mobile-nav.tsx`.

## Tokens de marca
Logo: `public/brand/logo.svg` (fundo claro, header) e `logo-white.svg` (fundo escuro, footer).
Cores via CSS vars `--store-primary`, `--store-cta`, `--store-chrome-bg`/`--store-chrome-text`
(bloco "CONFIGURE AQUI" em `app/globals.css`) — **nunca hardcode hex** nos componentes de layout;
sempre `bg-[var(--store-X,#fallback)]` para que a customização do CLI (`create-unbox-store`)
realmente se propague.
