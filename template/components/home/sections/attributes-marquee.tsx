"use client";

// Marquee infinito de atributos da marca (artesanal, feito no Brasil, edição limitada...).
// Portado de uma loja Unbox real em produção e genericizado: itens via receita
// (props.items: [{ label, icon?, slashed? }]). Sem itens, não renderiza.
// Ícones por nome (mapa abaixo) pra receita ser serializável.
//
// ── EDITOR ──────────────────────────────────────────────────────────────────
// Cada palavra da faixa é um ITEM de lista (`Editable.Sections nested` + `Editable.Section item`):
// o lojista troca o texto, troca o ícone, reordena, oculta e duplica, sem código novo.
//
// A faixa é a MESMA lista repetida 4 vezes na tela (é assim que o `translateX(-50%)` fecha o loop
// sem emenda). Por isso só a PRIMEIRA sequência é a lista editável; as outras são ECO: leem o
// documento direto (`orderSections` + `resolveValue`) e não registram caminho nenhum. Sem isso a
// mesma palavra viraria 4 registros e 4 alvos de clique no painel, e as metades deixariam de bater.
//
// Os caminhos são RELATIVOS ao escopo do item: a seção entra na home e na landing de oferta, e um
// caminho com o id da seção dentro faria as duas instâncias brigarem pela mesma caixa.
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Leaf, Drop, Cube, Bread, Heart, Sparkle, ShieldCheck, Star } from "@phosphor-icons/react/dist/ssr";
import { Editable, joinPath, orderSections, resolveValue, useEditableContext, type ImageValue } from "@/lib/editable";
import type { SectionComponentProps } from "./registry";

const ICONS: Record<string, PhosphorIcon> = {
  leaf: Leaf, drop: Drop, cube: Cube, bread: Bread,
  heart: Heart, sparkle: Sparkle, shield: ShieldCheck, star: Star,
};

type Attribute = { label: string; icon?: string; text?: string; slashed?: boolean };

// ── Caminhos editáveis (relativos ao item) ──────────────────────────────────
const CAMINHO_TEXTO = "texto";
const CAMINHO_ICONE = "icone";
const ROTULO_ICONE = "Ícone";
const TAMANHO_ICONE = 18;

/** id do item na lista editável: posicional, o padrão da foundation. */
const idDoItem = (i: number) => `item-${i + 1}`;

// As classes viram constante porque a linha editável e o eco dela precisam
// renderizar EXATAMENTE o mesmo HTML: duas cópias do literal descolariam.
const CLASSE_PILULA = "rounded-full bg-[var(--store-primary-soft,#F1F1F3)]/70 px-4 py-2 text-[13px] font-semibold text-[var(--store-primary,#18181B)]";
const CLASSE_CIRCULO = "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--store-primary,#18181B)]/70 text-[var(--store-primary,#18181B)]";
const CLASSE_RISCO = "pointer-events-none absolute left-[-2px] right-[-2px] top-1/2 h-[2px] -translate-y-1/2 rotate-45 bg-[var(--store-primary,#18181B)]/70";
const CLASSE_SIGLA = "text-[9px] font-extrabold";
const CLASSE_ICONE = "text-[18px]";

/** Item da faixa já resolvido pelo documento (ordem, ocultas, cópias e valores do lojista). */
type ItemPublicado = { id: string; base: Attribute; texto: string; icone: ImageValue };

/**
 * O ECO da lista: mesma ordem, mesmas ocultas, mesmas cópias e mesmos valores da primeira
 * sequência, só que lido do documento, SEM registrar ponto editável. É o que mantém as
 * metades do marquee do mesmo tamanho depois que o lojista mexe na lista.
 */
function useItensPublicados(items: Attribute[]): ItemPublicado[] {
  const ctx = useEditableContext();
  // `Editable.Sections nested` usa o escopo atual como container; o eco lê o mesmo lugar.
  const escopo = ctx.scope.join(".");
  const ids = items.map((_, i) => idDoItem(i));
  const estado = ctx.doc.sections[escopo];
  const { visible } = orderSections(ids, estado);
  const copias = estado?.clones ?? {};
  return visible.flatMap((id) => {
    const base = items[ids.indexOf(copias[id] ?? id)];
    if (!base) return [];
    const prefixo = [escopo, id].filter(Boolean).join(".");
    return [{
      id,
      base,
      texto: resolveValue(ctx.doc, `${prefixo}.${CAMINHO_TEXTO}`, base.label),
      icone: resolveValue<ImageValue>(ctx.doc, `${prefixo}.${CAMINHO_ICONE}`, { src: "", alt: ROTULO_ICONE }),
    }];
  });
}

/** O texto do item já publicado, SEM registrar um segundo ponto: quem registra é o rótulo. */
function useTextoDoItem(fallback: string) {
  const ctx = useEditableContext();
  return resolveValue(ctx.doc, joinPath(ctx.scope, CAMINHO_TEXTO), fallback);
}

/** Sem ícone na receita, o círculo mostra as 3 primeiras letras: derivado, não é copy nova. */
const sigla = (t: string) => t.slice(0, 3).toUpperCase();

function CirculoDoIcone({ slashed, children }: { slashed?: boolean; children: React.ReactNode }) {
  return (
    <span className={CLASSE_CIRCULO}>
      {children}
      {slashed && <span className={CLASSE_RISCO} />}
    </span>
  );
}

/** Ícone da linha editável. A `className` do ícone vai para o primitivo (regra do `Editable.Icon`). */
function IconeEditavel({ item }: { item: Attribute }) {
  const Icon = item.icon ? ICONS[item.icon] : undefined;
  const texto = useTextoDoItem(item.label);
  if (!Icon) return <span className={CLASSE_SIGLA}>{sigla(item.text ?? texto)}</span>;
  return (
    <Editable.Icon path={CAMINHO_ICONE} label={ROTULO_ICONE} size={TAMANHO_ICONE} className={CLASSE_ICONE}>
      <Icon weight="bold" />
    </Editable.Icon>
  );
}

/** Espelho do `Editable.Icon` para as cópias da faixa: mesmo `<span>`/`<img>`, sem registro. */
function IconeEco({ item }: { item: ItemPublicado }) {
  const Icon = item.base.icon ? ICONS[item.base.icon] : undefined;
  if (!Icon) return <span className={CLASSE_SIGLA}>{sigla(item.base.text ?? item.texto)}</span>;
  if (item.icone.src) {
    // eslint-disable-next-line @next/next/no-img-element -- espelho do <img> que o Editable.Icon rende
    return <img src={item.icone.src} alt={item.icone.alt ?? ROTULO_ICONE} width={TAMANHO_ICONE} height={TAMANHO_ICONE} className={CLASSE_ICONE} style={{ display: "inline-block", objectFit: "contain" }} />;
  }
  return (
    <span className={CLASSE_ICONE} style={{ display: "inline-flex", lineHeight: 0 }}>
      <Icon weight="bold" />
    </span>
  );
}

// Cada item carrega a própria margem à direita (em vez de gap no pai): a largura de um "set"
// já inclui o espaço até o próximo e a duplicata encaixa exata com translateX(-50%).
function BadgeRowEditavel({ items }: { items: Attribute[] }) {
  return (
    <Editable.Sections nested>
      {items.map((a, i) => (
        <Editable.Section key={idDoItem(i)} item id={idDoItem(i)} label={`Atributo ${i + 1}`}>
          <span className="mr-6 flex shrink-0 items-center gap-3">
            <CirculoDoIcone slashed={a.slashed}>
              <IconeEditavel item={a} />
            </CirculoDoIcone>
            <Editable.Text path={CAMINHO_TEXTO} fallback={a.label} label="Texto do atributo" className={CLASSE_PILULA} />
          </span>
        </Editable.Section>
      ))}
    </Editable.Sections>
  );
}

function BadgeRowEco({ itens }: { itens: ItemPublicado[] }) {
  return (
    <>
      {itens.map((it) => (
        <span key={it.id} className="mr-6 flex shrink-0 items-center gap-3">
          <CirculoDoIcone slashed={it.base.slashed}>
            <IconeEco item={it} />
          </CirculoDoIcone>
          <span className={CLASSE_PILULA}>{it.texto}</span>
        </span>
      ))}
    </>
  );
}

export function AttributesMarqueeSection({ sectionProps = {} }: SectionComponentProps) {
  const items = ((sectionProps.items as Attribute[] | undefined) ?? []).filter((a) => a?.label);
  const publicados = useItensPublicados(items);
  if (items.length === 0) return null;
  return (
    // Dentro do container (--container-max), como as demais seções: uma faixa que sangrava
    // de ponta a ponta enquanto hero e trust-bar ficam recuados lê como erro de layout.
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[18px] sm:px-6">
      <div className="overflow-hidden rounded-2xl border border-[var(--store-primary,#18181B)]/10 bg-[var(--store-surface)] py-3">
        {/* 4 cópias, não 2: com frases curtas, duas cópias dão ~700px por metade e a partir de
            ~1400px de viewport abria um vão antes do loop fechar. A animação anda -50% (duas
            cópias) em 44s — o dobro do tempo de antes, para a velocidade não mudar.
            A 1ª é a lista editável; as outras três ecoam o documento. */}
        <div className="flex w-max animate-marquee [animation-duration:44s]">
          <div className="flex shrink-0 items-center"><BadgeRowEditavel items={items} /></div>
          <div className="flex shrink-0 items-center" aria-hidden="true"><BadgeRowEco itens={publicados} /></div>
          <div className="flex shrink-0 items-center" aria-hidden="true"><BadgeRowEco itens={publicados} /></div>
          <div className="flex shrink-0 items-center" aria-hidden="true"><BadgeRowEco itens={publicados} /></div>
        </div>
      </div>
    </div>
  );
}
