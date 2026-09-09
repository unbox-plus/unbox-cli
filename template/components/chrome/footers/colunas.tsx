// RODAPÉ "colunas" — trust strip + 4 colunas (marca, catálogo, ajuda, pagamento).
// É o rodapé de loja completa: cobre navegação secundária e reforço de confiança.
//
// A barra inferior (© + selo Powered by Unbox) NÃO está aqui: ela é da casca
// (components/site-footer.tsx), porque é contrato da plataforma e não pode variar.
import Link from "next/link";
import { Truck, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { PaymentChips } from "@/components/product/pdp/payment-chips";
import type { ChromeVariantProps } from "../registry";

// Âncoras de confiança: só o que a foundation PODE afirmar (SSL e o prazo do CDC). Prazo de
// entrega, garantia e atendimento são promessas do lojista: entram pelo briefing, com lastro.
const TRUST = [
  { icon: ShieldCheck, text: "Compra segura (SSL)" },
  { icon: Truck, text: "Troca em 7 dias · CDC" },
];

export function FooterColunas({ data }: ChromeVariantProps) {
  const { shopName } = data;

  return (
    <>
      {/* trust */}
      <div className="mx-auto grid max-w-[var(--container-max,1240px)] grid-cols-2 gap-x-6 border-b border-[var(--store-chrome-line,rgba(255,255,255,.1))] px-6 py-8 ">
        {TRUST.map((t) => (
          <div key={t.text} className="flex items-center gap-3.5 py-1.5">
            <t.icon className="text-[28px] text-[var(--store-cta,#D97706)]" />
            <div className="text-[13px] leading-snug text-[var(--store-chrome-muted)]">{t.text}</div>
          </div>
        ))}
      </div>

      {/* colunas */}
      <div className="mx-auto grid max-w-[var(--container-max,1240px)] gap-8 px-6 py-9 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          {/* logo-chrome.svg = versão do logo legível sobre o chrome (o CLI troca conforme o
              estilo: chrome escuro usa o logo branco, chrome claro usa o logo normal). */}
          {/* eslint-disable-next-line @next/next/no-img-element -- logo do chrome: SVG de poucos KB. O next/image marcaria lazy num elemento que aparece em toda página (o preload scanner perde o recurso) e o reencode come o traço fino do lettering. Otimizar poucos KB não paga essas duas contas. */}
          <img src="/brand/logo-chrome.svg" alt={shopName} className="mb-3.5 h-16 w-auto" />
          {/* TODO: tagline da marca */}
        </div>
        <FooterCol title="Catálogo" links={[
          { label: "Todos os produtos", href: "/produtos" },
          { label: "Buscar", href: "/busca" },
          { label: "Kits & Combos", href: "/produtos" },
          { label: "Ofertas", href: "/produtos" },
        ]} />
        <FooterCol title="Ajuda" links={[
          { label: "Acompanhar pedido", href: "/conta/entrar" },
          { label: "Trocas e devoluções", href: "/devolucoes" },
          { label: "Termos", href: "/termos" },
          { label: "Minha conta", href: "/conta" },
        ]} />
        <div>
          <div className="font-display mb-3 text-sm font-bold">Pague com</div>
          <PaymentChips />
        </div>
      </div>
    </>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <div className="font-display mb-3 text-sm font-bold">{title}</div>
      <div className="flex flex-col gap-2.5 text-[13px] text-[var(--store-chrome-muted)]">
        {links.map((l) => (
          <Link key={l.label} href={l.href} className="no-underline hover:text-[var(--store-chrome-text,#ffffff)]">{l.label}</Link>
        ))}
      </div>
    </div>
  );
}
