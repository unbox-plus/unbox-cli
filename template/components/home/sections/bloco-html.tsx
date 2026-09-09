"use client";

// ═══════════════════════════════════════════════════════════════════════════
// BLOCO DE HTML — a seção em que o LOJISTA cola um HTML pronto que veio de fora
// (o selo de um fornecedor, uma tabela de medidas, um trecho que alguém mandou).
//
// SIMPLES DE PROPÓSITO: a seção não desenha nada. Ela é só o container (a mesma largura e o mesmo
// respiro vertical das outras seções da home), e todo o conteúdo sai do primitivo. Título, subtítulo
// ou fundo próprio aqui competiriam com o que o lojista colou e ele não teria como desligá-los.
//
// O QUE É PERIGOSO NÃO ENTRA, E QUEM DECIDE ISSO NÃO É ESTA SEÇÃO. `Editable.Html` (lib/editable/
// primitives.tsx) roda a lista de recusa (`recusaDeHtml`) no cliente antes de injetar, e é a única das
// três camadas que existe na PRÉVIA (ali o rascunho chega por postMessage sem passar por servidor
// nenhum). As outras duas: o editor ao gravar (limpa e RELATA ao lojista o que tirou) e a loja ao ler o
// publicado (lib/editable/server.ts, que faz uma regra nova valer para quem já publicou).
//
// ── POR QUE O CONTAINER É O PRÓPRIO PRIMITIVO, E NÃO UM <div> À VOLTA DELE ──
// Bloco vazio em produção não renderiza NADA, nem invólucro (regra do primitivo). Se o padding
// morasse num <div> à volta, esse <div> continuaria na página com `py-72px` e abriria uma faixa branca
// no meio da home enquanto o lojista não colasse nada. Com as classes NO primitivo, some tudo junto.
//
// O <div className="w-full"> de fora existe por outro motivo: o fundo de seção do editor pinta o
// PRIMEIRO FILHO do invólucro da seção (a regra `[data-unbox-sec-bg="1"]>*` em provider.tsx), e o
// invólucro é `display: contents`. Sem esse filho de largura cheia, um fundo escolhido pelo lojista
// pararia na largura do container em vez de atravessar a tela. Vazio ele sai como
// `<div class="w-full"></div>`, altura 0 e padding 0: não é a faixa branca de que o parágrafo acima fala.
//
// O `sectionProps` fica de fora de propósito: um HTML cru escrito na RECEITA seria marcação à mão num
// arquivo onde o certo é chamar um componente. Este bloco nasce para o lojista colar.
// ═══════════════════════════════════════════════════════════════════════════
import { EditableHtml } from "@/lib/editable";

/**
 * Não recebe props: o conteúdo é do documento, não da receita (ver o cabeçalho). A assinatura continua
 * compatível com `SectionComponentProps`: o renderer passa `data`/`variant` e esta seção os ignora.
 */
export function BlocoHtmlSection() {
  return (
    <div className="w-full">
      <EditableHtml
        path="conteudo"
        label="Bloco de HTML"
        className="mx-auto max-w-[var(--container-max,1240px)] px-4 py-[var(--section-gap,52px)] sm:px-6"
      />
    </div>
  );
}
