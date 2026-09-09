"use client";

// Benefícios em grid 2+foto+2 (lista esquerda / imagem central / lista direita).
// Portado de uma loja Unbox real em produção e genericizado. Conteúdo via receita; defaults
// neutros SEM claims inventados (nada de estatística ou promessa de resultado fake).
//
// EDITOR: título, subtítulo e a foto do meio são caminhos da seção; cada coluna é uma LISTA
// editável própria (`esquerda.beneficio-N` e `direita.beneficio-N`): o lojista troca texto,
// reordena, oculta e duplica dentro da coluna. São duas listas, e não uma, porque cada coluna é um
// `flex` diferente e uma lista só não renderiza em dois pais. Os caminhos são RELATIVOS à seção:
// a mesma seção pode entrar na home e na landing sem que as duas disputem a mesma caixa.
// A foto continua passando pelo `Foto` (otimizador do Next quando o host permite): o `Editable.Slot`
// só lhe entrega o src/alt do lojista e os atributos de seleção.
import { Editable, EditableScope } from "@/lib/editable";
import type { SectionComponentProps } from "./registry";
import { Foto } from "@/components/ui/foto";

type Benefit = { title: string; text: string };

const DEFAULT_LEFT: Benefit[] = [
  { title: "Seleção com critério", text: "Cada item do catálogo passa por curadoria de verdade antes de entrar na loja." },
  { title: "Qualidade que se percebe", text: "Materiais escolhidos pra durar e entregar o que prometem." },
];
const DEFAULT_RIGHT: Benefit[] = [
  { title: "Entrega bem cuidada", text: "Embalagem pensada pra chegar inteiro, bonito e pronto pra usar." },
  { title: "Suporte de gente", text: "Ficou com dúvida? A gente responde rápido e resolve junto." },
];

function Item({ b }: { b: Benefit }) {
  return (
    <div>
      <Editable.Text as="div" path="titulo" fallback={b.title} label="Título do benefício" className="font-display text-[17px] font-bold text-[var(--store-primary,#18181B)]" />
      <Editable.Text as="p" path="texto" fallback={b.text} label="Texto do benefício" multiline className="mt-1.5 text-[14px] leading-[1.55] text-[var(--store-muted)]" />
    </div>
  );
}

/** Uma coluna de benefícios: lista editável com escopo próprio (`esquerda` / `direita`). */
function Coluna({ lado, nome, itens }: { lado: "esquerda" | "direita"; nome: string; itens: Benefit[] }) {
  return (
    <div className="flex flex-col gap-7">
      <EditableScope path={lado}>
        <Editable.Sections nested>
          {itens.map((b, i) => (
            <Editable.Section key={b.title} item id={`beneficio-${i + 1}`} label={`Benefício ${i + 1} (${nome})`}>
              <Item b={b} />
            </Editable.Section>
          ))}
        </Editable.Sections>
      </EditableScope>
    </div>
  );
}

export function BenefitsSection({ sectionProps = {} }: SectionComponentProps) {
  const {
    title = "Por que escolher a gente",
    subtitle = "O essencial, bem feito, do jeito que você espera.",
    image = "/brand/ph/photo-a.svg",
  } = sectionProps as Record<string, string>;
  const left = (sectionProps.left as Benefit[] | undefined) ?? DEFAULT_LEFT;
  const right = (sectionProps.right as Benefit[] | undefined) ?? DEFAULT_RIGHT;

  return (
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[var(--section-gap,52px)] sm:px-6">
      <div className="mx-auto max-w-[620px] text-center">
        <Editable.Text as="h2" path="titulo" fallback={title} label="Título" className="font-display text-[28px] font-extrabold leading-[1.15]" />
        <Editable.Text as="p" path="subtitulo" fallback={subtitle} label="Subtítulo" className="mt-2 text-[15px] text-[var(--store-muted)]" />
      </div>
      <div className="mt-9 grid items-center gap-8 md:grid-cols-[1fr_minmax(240px,340px)_1fr]">
        <Coluna lado="esquerda" nome="coluna da esquerda" itens={left} />
        {/* TODO: trocar por foto real do produto/marca (o agente de branding cuida disso). alt="" de propósito: é decorativa, quem fala é o texto. */}
        <Editable.Slot path="imagem" type="image" fallback={{ src: image, alt: "" }} label="Foto do meio">
          {(v, attrs, ref) => <Foto ref={ref} attrs={attrs} src={v.src} alt={v.alt ?? ""} width={680} height={680} sizes="340px" className="mx-auto w-full max-w-[340px] rounded-2xl object-cover" />}
        </Editable.Slot>
        <Coluna lado="direita" nome="coluna da direita" itens={right} />
      </div>
    </div>
  );
}
