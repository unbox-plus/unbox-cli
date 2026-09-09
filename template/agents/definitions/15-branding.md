# Agente 15 — Branding & Identidade

**Este arquivo é um ponteiro de propósito. Não há definição aqui.**

A definição viva do agente 15 é `.claude/agents/branding-briefing.md`, e o
`.claude/settings.json` a carrega como **system prompt** assim que você abre o Claude Code na
raiz deste projeto.

Ou seja: **se você está numa sessão de briefing, esse texto já está inteiro no seu contexto.**
Abrir a definição pra "consultar o que o agente deve fazer" relê ~8k tokens do que você já tem.

Até a v0.14.3 este arquivo era uma cópia integral daquele prompt — 32 KB duplicados que o
MANAGER apontava como "a definição", convidando exatamente essa releitura. Virou ponteiro na
v0.15.0.

## Se você quer mesmo ler a definição

Casos legítimos: você está numa sessão que **não** é a de briefing (por exemplo, rodando o
agente 16 de QA e querendo saber o que o 15 prometeu), ou está editando o prompt.

    .claude/agents/branding-briefing.md

## Se você quer saber onde as coisas ficam no projeto

Não é aqui. É o `CLAUDE.md` da raiz — o mapa "quero mudar X, mexo em Y". É bem mais barato que
abrir componentes até achar.
