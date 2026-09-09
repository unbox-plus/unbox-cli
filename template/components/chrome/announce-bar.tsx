// Barra de anúncio (desktop) — fica ACIMA do header e rola pra fora.
// Compartilhada por todas as variantes de header: o conteúdo é comercial (frete/brinde),
// não estrutura de marca, e a regra de honestidade tem que valer igual em todas.
//
// Só renderiza quando há promessa REAL configurada em lib/store-config (defaults zerados =
// a barra inteira some). A casca não a renderiza no modo "sobreposto" (header transparente).
//
// EDITOR: a faixa é uma seção do chrome (`chrome.faixa`, fixa) e cada aviso é um ITEM de lista
// aninhada, com id de PAPEL (`frete`, `brinde`), não posicional: os dois só existem quando a
// configuração comercial existe, e um id posicional mudaria de dono conforme o que está ligado.
// O lojista troca o texto, reordena, oculta e duplica pelo painel ("+ Adicionar" copia o último
// aviso visível: é assim que ele acrescenta um aviso próprio). O VALOR do frete (R$X) fica fora do
// primitivo: é configuração da loja (lib/store-config), não copy (README do editor, §8). A cópia
// do aviso no celular mora em components/chrome/header-bar-mobile.tsx, dentro do cabeçalho.
import { Truck } from "@phosphor-icons/react/dist/ssr";
import { FREE_SHIPPING_THRESHOLD, GIFT_TIERS } from "@/lib/store-config";
// Exports NOMEADOS: server component (ver components/site-header.tsx).
import { EditableIcon, EditableSection, EditableSections, EditableText } from "@/lib/editable";

export function AnnounceBar() {
  if (FREE_SHIPPING_THRESHOLD == null && GIFT_TIERS.length === 0) return null;

  return (
    <EditableSection id="faixa" kind="faixa-de-anuncio" container="chrome" fixed label="Faixa de anúncio do topo">
      <div className="store-layout site-chrome hidden items-stretch bg-[var(--store-chrome-bg,#18181B)] text-[13px] font-semibold text-[var(--store-chrome-text,#ffffff)] md:flex">
        <div className="flex flex-1 items-center justify-center gap-2 px-4 py-[9px]">
          {/* a className era do ícone; vai para o invólucro do Icon (regra do `Editable.Icon`) */}
          <EditableIcon path="icone" label="Ícone da faixa" size={16} className="text-base text-[var(--store-cta,#D97706)]">
            <Truck weight="bold" />
          </EditableIcon>
          {/* o invólucro de cada item é display:contents: quem continua sendo filho do flex é o <span> do aviso */}
          <EditableSections nested>
            {FREE_SHIPPING_THRESHOLD != null && (
              <EditableSection item id="frete" label="Aviso de frete grátis">
                <span className="text-[var(--store-surface-2)]">
                  <EditableText path="texto" fallback="Frete Grátis acima de" label="Texto do aviso de frete" />{" "}
                  <span className="text-[var(--store-chrome-text,#ffffff)]">R${FREE_SHIPPING_THRESHOLD}</span>
                </span>
              </EditableSection>
            )}
            {GIFT_TIERS.length > 0 && (
              <EditableSection item id="brinde" label="Aviso de brinde">
                <EditableText
                  path="texto"
                  fallback={`${FREE_SHIPPING_THRESHOLD != null ? "· e ganhe" : "Ganhe"} brindes exclusivos`}
                  label="Texto do aviso de brinde"
                  className="text-[var(--store-chrome-muted)]"
                />
              </EditableSection>
            )}
          </EditableSections>
        </div>
        {/* TODO: adicionar badge de cupom/promoção da marca */}
      </div>
    </EditableSection>
  );
}
