#!/bin/bash
set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Unbox Storefront — Bootstrap"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Credenciais ───────────────────────────────────────────────────────────
echo "Você já tem as credenciais da loja Unbox?"
echo "(UNBOX_API_KEY, UNBOX_USER, UNBOX_PASS)"
read -rp "  [s/N] " HAS_CREDS
echo ""

# ── 2. CRO Package ───────────────────────────────────────────────────────────
echo "Gostaria de ativar o Unbox AI CRO Package?"
echo ""
echo "  Módulos disponíveis:"
echo "  [1] Prova Social no PDP           — badge de vendas + avaliações"
echo "  [2] Urgência de Estoque           — 'Restam X unidades'"
echo "  [3] Countdown Flash Sale          — banner com temporizador"
echo "  [4] Barra de Frete Grátis         — progress bar no carrinho"
echo "  [5] Upsell Pós-Checkout           — recomendações na confirmação"
echo "  [6] Recently Viewed               — produtos vistos (localStorage)"
echo "  [7] Sticky CTA Mobile             — botão fixo no scroll do PDP"
echo "  [8] Trust Strip Customizável      — ícones de confiança"
echo "  [9] Kits & Combos com Cross-sell  — seção de kits na home"
echo " [10] Brindes (Gift with Purchase)  — brinde ao atingir valor mínimo"
echo ""
echo "  ⚠️  Módulos 4 e 10 precisam de configuração no painel Unbox antes do lançamento."
echo ""
echo "  Digite 'all', números separados por vírgula (ex: 1,4,7), ou Enter para pular."
read -rp "  CRO modules: " CRO_CHOICE
echo ""

# Salva escolha para o agente 13-cro usar depois
if [ -n "$CRO_CHOICE" ] && [ "$CRO_CHOICE" != "none" ]; then
  echo "$CRO_CHOICE" > .cro-modules
  echo "  ✓ Escolha salva em .cro-modules"
  echo "  Execute o agente 13-cro após o setup para implementar os módulos."
  echo "  (agents/definitions/13-cro.md)"
else
  echo "  CRO Package pulado. Você pode ativar depois com o agente 13-cro."
fi
echo ""

# ── 3. Node 22 LTS ───────────────────────────────────────────────────────────
echo "→ Garantindo Node 22 LTS..."
nvm install 22 --silent && nvm use 22 --silent

# ── 4. Remove lock file global que conflita com npm ──────────────────────────
rm -f ~/package-lock.json

# ── 5. Dependências ──────────────────────────────────────────────────────────
echo "→ Instalando dependências (pode demorar ~2 min)..."
npm install --silent

# ── 6. .env.local ────────────────────────────────────────────────────────────
if [ ! -f .env.local ]; then
  cp .env.example .env.local
fi

# ── 7. Modo com ou sem credenciais ───────────────────────────────────────────
if [[ "$HAS_CREDS" =~ ^[Ss]$ ]]; then
  echo ""
  echo "  Preencha .env.local com as credenciais antes de continuar:"
  echo "  UNBOX_API_KEY, UNBOX_USER, UNBOX_PASS, SESSION_SECRET, NEXT_PUBLIC_SITE_URL"
  echo ""
  read -rp "  Pressione Enter quando .env.local estiver preenchido..."
  echo ""
  echo "→ Testando conexão com a API Unbox..."
  npm run unbox:test
  echo ""
  echo "  Conectado. Rodando em modo completo."
else
  echo "  MODO MOCKUP — o layout vai abrir mas páginas que dependem"
  echo "  da API (catálogo, produto, checkout) vão mostrar erro."
  echo "  Preencha .env.local e rode 'npm run unbox:test' antes do QA."
  echo ""
fi

echo ""
echo "→ Iniciando dev server..."
echo "  (primeira compilação demora ~3 min — aguarde o 'Ready' aparecer)"
echo ""
npm run dev
