import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalog, getProductBySlug, getShopData } from "@/lib/queries";
import { sanitize } from "@/lib/sanitize";
import { resolveProductPrice, resolveVariantPrice } from "@/lib/format";
import { RELATED_GROUPS } from "@/lib/store-config";
import { getEnrichmentForProduct, getEnrichmentByName, parseSize, reviewStats, type ProductEnrichment } from "@/lib/enrichment";
import { DataLayerReady } from "@/components/analytics/data-layer-ready";
import type { PdpVariant, PdpSizeOption, PdpRelatedOption, PdpBenefit } from "@/components/product/pdp/buy-box";
import type { CatalogItem } from "@/components/product/pdp/catalog-grid";
// A PDP é um MOLDE: a view recebe tudo por prop (components/product/pdp/pdp-view.tsx) e é ela que
// declara o container `produto` e as seções. Aqui só se busca e se prepara o dado.
import { PdpView } from "@/components/product/pdp/pdp-view";
import { faqNaTela } from "@/components/product/pdp/faq-modelo";
import { mockupOr } from "@/lib/mockup";
import { hasUnboxCredentials } from "@/lib/config";
import { ldJson } from "@/lib/json-ld";
// EDITOR: o documento publicado, para o FAQPage dizer o que o accordion mostra (ver `faqNaTela`)
import { getPublishedContent } from "@/lib/editable/server";

// DADO AUSENTE NA FICHA. Era um travessão, que na tela é um sinal e não uma informação, e a casa
// proibiu travessão em texto de tela. "não informado" diz o que aconteceu: o cadastro não trouxe o dado.
const NAO_INFORMADO = "não informado";

export const revalidate = 300;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
// Mesmo literal do app/layout.tsx: o create-unbox-store reescreve "Minha Loja" nos dois
// arquivos com o nome real da loja.
const SITE_NAME = "Minha Loja";

export async function generateStaticParams() {
  // Aqui (e só aqui) a falha NÃO relança: sem a lista, as PDPs saem sob demanda via ISR em vez
  // de derrubar o build inteiro. Com credenciais, fica registrado no log do build.
  const catalog = await getCatalog({ first: 100 }).catch((e) => {
    if (hasUnboxCredentials) console.error("[unbox] generateStaticParams(produto): catálogo indisponível, PDPs serão geradas sob demanda:", e?.message ?? e);
    return { nodes: [] as any[] };
  });
  return (catalog.nodes ?? [])
    .map((n: any) => ({ productSlug: (n.product?.slug ?? n.slug) as string | undefined }))
    .filter((p): p is { productSlug: string } => !!p.productSlug);
}

export async function generateMetadata({ params }: { params: Promise<{ productSlug: string }> }): Promise<Metadata> {
  const { productSlug } = await params;
  const wrapper = await mockupOr(getProductBySlug(decodeURIComponent(productSlug)), null, "produto/getProductBySlug");
  const p = wrapper?.product;
  if (!p) return { title: "Produto não encontrado", robots: { index: false } };
  // Canonical é SEMPRE a URL desta loja. `publishedUrl` vem do painel e pode apontar pro
  // domínio antigo/hospedado: canonical cruzado entrega o ranking da PDP pra outro site.
  const canonical = `/produto/${encodeURIComponent(productSlug)}`;
  return {
    title: p.pageTitle || p.title,
    description: p.metaDescription || wrapper.shortDescription || undefined,
    alternates: { canonical },
    robots: { index: p.isVisible !== false },
    // Metadata do App Router substitui o objeto openGraph INTEIRO do layout pai, não
    // faz merge profundo: declarar só title/description/images aqui apagava siteName e
    // locale, e a loja publicava card social sem identificação. Os campos do layout
    // precisam ser repetidos.
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: SITE_NAME,
      title: p.pageTitle || p.title,
      description: p.metaDescription || wrapper.shortDescription || undefined,
      images: p.imageUrls?.length ? [p.imageUrls[0]] : undefined,
    },
  };
}

function freqNote(periodicity?: string, interval?: number): string {
  const n = interval ?? 1;
  const unit = { DAY: "dia", WEEK: "semana", MONTH: "mês", YEAR: "ano" }[periodicity ?? "MONTH"] ?? "mês";
  if (periodicity === "WEEK") return `A cada ${n * 7} dias`;
  return `A cada ${n} ${unit}${n > 1 && unit !== "mês" ? "s" : ""}`;
}

const NUTRI_LABELS: Record<string, string> = {
  valor_energetico_kcal: "Valor energético", carboidratos_g: "Carboidratos",
  acucares_totais_g: "Açúcares totais", acucares_adicionados_g: "Açúcares adicionados",
  proteinas_g: "Proteínas", gorduras_totais_g: "Gorduras totais",
  gorduras_saturadas_g: "Gorduras saturadas", gorduras_trans_g: "Gorduras trans",
  fibras_alimentares_g: "Fibras alimentares", sodio_mg: "Sódio",
};
const fmtNum = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);

// Bandeira (emoji) do país de origem, p/ encaixar no selo "Importado". Usa o país de
// processamento/importação quando o texto cita "Estados Unidos".
function originFlag(origin?: string): string | undefined {
  const o = (origin ?? "").toLowerCase();
  if (/estados unidos|united states|unites states|\beua\b|u\.?s\.?a/.test(o)) return "🇺🇸";
  if (/brasil|brazil/.test(o)) return "🇧🇷";
  if (/m[eé]xico/.test(o)) return "🇲🇽";
  if (/[ií]ndia/.test(o)) return "🇮🇳";
  if (/vietn[aã]/.test(o)) return "🇻🇳";
  return undefined;
}

// Tabela nutricional SÓ com dado real do enriquecimento. Sem dado, devolve vazio e a aba nem
// existe — antes renderizava "Valor energético —, Sódio —..." em loja de qualquer ramo.
function buildNutriItems(enr: ProductEnrichment | null): { k: string; v: string }[] {
  const nutr = enr?.nutrition?.nutrientes;
  if (nutr && Object.keys(nutr).length) {
    const base = enr?.nutrition?.base ? [{ k: "Base", v: enr.nutrition.base }] : [];
    return [
      ...base,
      ...Object.entries(nutr).map(([key, val]) => {
        const unit = key.endsWith("_kcal") ? "kcal" : key.endsWith("_mg") ? "mg" : key.endsWith("_g") ? "g" : "";
        const label = NUTRI_LABELS[key] || key.replace(/_(g|mg|kcal)$/, "").replace(/_/g, " ");
        return { k: label, v: `${fmtNum(Number(val))} ${unit}`.trim() };
      }),
    ];
  }
  return [];
}

export default async function ProductPage({ params }: { params: Promise<{ productSlug: string }> }) {
  const { productSlug } = await params;
  const [wrapper, shop, catalog] = await Promise.all([
    mockupOr(getProductBySlug(decodeURIComponent(productSlug)), null, "produto/getProductBySlug"),
    mockupOr(getShopData(), null, "produto/getShopData"),
    mockupOr(getCatalog({ first: 100 }), ({ nodes: [] as any[] }), "produto/getCatalog"),
  ]);
  const p = wrapper?.product;
  if (!p || p.isVisible === false) notFound();

  // Enriquecimento: tudo que não vem da Unbox — composição, medidas, FAQ, reviews, SEO, e tabela
  // nutricional quando o produto for alimento ou suplemento.
  const enr = getEnrichmentForProduct(p);

  const price = resolveProductPrice(p);
  const policy = shop?.recurringOrdersPolicy;
  const subscribable =
    p.recurrenceAllowed && policy?.enabled && (policy.allowedFrequencies?.length ?? 0) > 0;

  // Descrição: prioriza a descrição SEO da planilha; senão a da Unbox.
  const shortDescription = enr?.seo.shortDescription || enr?.description || wrapper.shortDescription;
  const descHtml = sanitize(enr?.seo.longDescriptionHtml || p.description);
  const infoHtml = sanitize(p.additionalInformation);
  const rstats = reviewStats(enr);

  // ----- Variantes para a buy box -----
  const variants: PdpVariant[] = (p.variants ?? []).map((v: any) => {
    const rp = resolveVariantPrice(v);
    const pr = Array.isArray(v?.pricing) ? v.pricing[0] : v?.pricing;
    return {
      id: v._id,
      label: v.title || p.title,
      price: rp.price,
      displayPrice: rp.displayPrice,
      oldPrice: pr?.compareAtPrice?.amount ?? null,
    };
  });

  // ----- Tamanhos da MESMA família (products.json) -----
  // Cada tamanho é um produto Unbox próprio; agrupamos pelo familyCode da planilha (resolvido por
  // nome, que ignora o tamanho). O peso vem do título do produto.
  const familyCode = enr?.familyCode ?? null;
  const fmtWeight = (w: { value: number; unit: string } | null): string => {
    if (!w) return NAO_INFORMADO;
    const v = Number.isInteger(w.value) ? String(w.value) : String(w.value).replace(".", ",");
    return `${v} ${w.unit}`;
  };
  const allCatalogProducts = (catalog.nodes ?? []).map((n: any) => n.product ?? n).filter((x: any) => x?.slug);
  const sizeOptions: PdpSizeOption[] = familyCode
    ? allCatalogProducts
        .map((cp: any) => {
          const e = getEnrichmentByName(cp.title);
          if (!e || e.familyCode !== familyCode) return null;
          const size = parseSize(cp.title) ?? e.weight;
          const rp = resolveProductPrice(cp);
          return {
            option: {
              slug: cp.slug,
              label: fmtWeight(size),
              displayPrice: rp.displayPrice,
              isSoldOut: !!cp.isSoldOut,
              isCurrent: cp.slug === p.slug,
            } satisfies PdpSizeOption,
            weight: size?.value ?? 0,
          };
        })
        .filter((x: any): x is { option: PdpSizeOption; weight: number } => !!x)
        .sort((a, b) => a.weight - b.weight)
        .map((x) => x.option)
    : [];

  // ----- Relacionados por CATEGORIA quando não há variação de tamanho -----
  // Produtos DISTINTOS de uma mesma linha (famílias diferentes, não tamanhos), listados 1 por
  // família para navegar entre eles. Quais linhas e com que título: lib/store-config.ts
  // (RELATED_GROUPS). Default vazio — a loja decide.
  const labelPt = (name: string) => name.split("(")[0].trim().replace(/\s+/g, " ") || name.trim();
  const relatedGroup = enr ? RELATED_GROUPS.find((g) => enr.tags?.includes(g.tag)) : undefined;
  const relatedByFamily = new Map<string, { option: PdpRelatedOption; name: string }>();
  if (relatedGroup) {
    for (const cp of allCatalogProducts) {
      const e = getEnrichmentByName(cp.title);
      if (!e || !e.tags?.includes(relatedGroup.tag)) continue;
      if (relatedByFamily.has(e.familyCode)) continue; // 1 produto por família
      const rp = resolveProductPrice(cp);
      relatedByFamily.set(e.familyCode, {
        name: labelPt(e.name),
        option: {
          slug: cp.slug,
          label: labelPt(e.name),
          sublabel: fmtWeight(parseSize(cp.title) ?? e.weight),
          displayPrice: rp.displayPrice,
          imageUrl: cp.imageUrls?.[0] ?? null,
          isSoldOut: !!cp.isSoldOut,
          isCurrent: cp.slug === p.slug,
        },
      });
    }
  }
  const relatedOptions: PdpRelatedOption[] = [...relatedByFamily.values()]
    .map((x) => x.option)
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  const relatedTitle = relatedGroup?.title;

  // ----- Selos (benefícios) a partir dos atributos do enriquecimento — só positivos, máx. 4 -----
  const benefits: PdpBenefit[] | undefined = enr
    ? (() => {
        const b: PdpBenefit[] = [];
        if (enr.containsGluten === false) b.push({ icon: "no-gluten", label: "Sem glúten" });
        if (enr.vegan === true) b.push({ icon: "vegan", label: "Vegano" });
        // "Sem MSG" é afirmação de ALIMENTO. Só entra quando o produto tem tabela nutricional (é
        // alimento/suplemento) — antes, qualquer composição sem a palavra "glutamato" ganhava o
        // selo, inclusive INCI de cosmético e lista de materiais de roupa.
        if (enr.nutrition && enr.ingredients && !/glutamato|\bmsg\b|realçador|realcador/i.test(enr.ingredients)) b.push({ icon: "no-msg", label: "Sem MSG" });
        if (enr.origin) b.push({ icon: "imported", label: "Importado", flag: originFlag(enr.origin) });
        return b.slice(0, 4);
      })()
    : undefined;

  const subscription = subscribable
    ? {
        percentOff: policy.pricingPolicy?.type === "PERCENTAGE_OFF" ? policy.pricingPolicy.value : null,
        frequencies: (policy.allowedFrequencies ?? []).map((f: any) => ({
          id: f._id,
          title: f.title,
          note: freqNote(f.periodicity, f.interval),
        })),
      }
    : null;

  // ----- Desconto exibido nos badges da galeria -----
  const v0 = variants[0];
  const discountPct =
    v0?.price != null && v0.oldPrice && v0.oldPrice > v0.price
      ? Math.round((1 - v0.price / v0.oldPrice) * 100)
      : null;

  // ----- Ficha técnica: SÓ as linhas que têm dado -----
  // Sem enriquecimento não há ficha, e a aba não existe. Antes a foundation exibia "Glúten —",
  // "Vegano —", "Ingredientes —" em loja de qualquer ramo: era o esqueleto de um produto de
  // alimentação aparecendo como característica de roupa, cosmético ou eletrônico.
  const specItems: { k: string; v: string }[] = [];
  if (enr) {
    if (enr.weight) specItems.push({ k: "Peso", v: `${String(enr.weight.value).replace(".", ",")} ${enr.weight.unit}` });
    if (enr.origin) specItems.push({ k: "Origem", v: enr.origin });
    if (enr.ingredients) specItems.push({ k: "Composição", v: enr.ingredients });
    if (enr.containsGluten != null) specItems.push({ k: "Glúten", v: enr.containsGluten ? "Contém" : "Não contém" });
    if (enr.vegan != null) specItems.push({ k: "Vegano", v: enr.vegan ? "Sim" : "Não" });
    if (enr.allergens?.mayContain && !/não especificado/i.test(enr.allergens.mayContain)) specItems.push({ k: "Pode conter", v: enr.allergens.mayContain });
    if (enr.ean) specItems.push({ k: "EAN", v: enr.ean });
  }
  const nutriItems = buildNutriItems(enr);

  // FAQ do PRODUTO: as perguntas do enriquecimento (dado). As perguntas MODELO do molde (o prazo de
  // arrependimento do CDC e a regra de frete grátis, se configurada) moram em faq-modelo.ts: a FaqList
  // as renderiza como lista editável, e o FAQPage abaixo as lê do documento publicado.
  const faq = enr?.faq ?? [];

  // ----- Catálogo relacionado (produtos reais) -----
  const recItems: CatalogItem[] = (catalog.nodes ?? [])
    .map((n: any) => n.product ?? n)
    .filter((rp: any) => rp?.slug && rp.slug !== p.slug)
    .slice(0, 9)
    .map((rp: any): CatalogItem => {
      const rprice = resolveProductPrice(rp);
      const rv0 = rp.variants?.[0];
      return {
        slug: rp.slug,
        title: rp.title,
        displayPrice: rprice.displayPrice,
        imageUrl: rp.imageUrls?.[0] ?? null,
        weight: rv0?.title ?? null,
        productId: rp.productId,
        variantId: rv0?._id ?? null,
        price: rv0?.pricing?.[0]?.price ?? null,
        badge: rp.isSoldOut
          ? { label: "ESGOTADO", bg: "var(--store-surface-2)", fg: "var(--store-muted)" }
          : rprice.compareAt
            ? { label: "OFERTA", bg: "var(--store-sale-soft)", fg: "var(--store-sale)" }
            : rp.isLowQuantity
              ? { label: "ÚLTIMAS", bg: "var(--store-cta-soft)", fg: "var(--store-cta-fg)" }
              : null,
      };
    });
  const catalogItems: CatalogItem[] = recItems.slice(0, 5);

  // FAQPage a partir da MESMA lista que o accordion renderiza: se o bloco some da tela, some
  // do dado estruturado junto. Pergunta que a loja não responde não vira schema. Com o editor, o que
  // o accordion renderiza depende do publicado (seção oculta, pergunta reordenada, reescrita ou
  // duplicada), então a lista é lida do documento, do mesmo jeito que os primitivos a leem.
  const faqPublicado = faqNaTela(await getPublishedContent(), faq);
  const faqJsonLd = faqPublicado.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqPublicado.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  } : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    image: p.imageUrls ?? [],
    description: (p.metaDescription || wrapper.shortDescription || p.title) as string,
    sku: p.sku ?? undefined,
    // aggregateRating SÓ com avaliações reais (rstats): nota fabricada em dado ESTRUTURADO é o
    // pior lugar possível pra mentir — vai direto pro Google (rich results) em nome da loja.
    ...(rstats ? { aggregateRating: { "@type": "AggregateRating", ratingValue: String(rstats.average), reviewCount: String(rstats.count) } } : {}),
    offers: {
      "@type": "Offer",
      price: price.price ?? undefined,
      priceCurrency: "BRL",
      availability: p.isSoldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      url: wrapper.publishedUrl || `${siteUrl}/produto/${productSlug}`,
    },
  };

  return (
    <>
      {/* dataLayerReady: o gatilho de tipo de página do container central da Unbox (não renderiza nada) */}
      <DataLayerReady pageType="product" products={[{ id: p.productId ?? p._id, name: p.title, price: price.price ?? undefined }]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(jsonLd) }} />
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(faqJsonLd) }} />}
      <PdpView
        produto={{
          id: p.productId,
          titulo: p.title,
          imagens: p.imageUrls ?? [],
          videos: p.videoUrls ?? [],
          descontoPct: discountPct,
          descricaoCurta: shortDescription,
          esgotado: !!p.isSoldOut,
          minQty: p.minOrderQuantity ?? 1,
          maxQty: p.maxOrderQuantity ?? null,
        }}
        compra={{
          variants,
          benefits,
          sizeOptions,
          relatedTitle,
          relatedOptions,
          subscription,
          ratingAverage: rstats ? Number(rstats.average) : undefined,
          ratingCount: rstats ? Number(rstats.count) : undefined,
        }}
        detalhes={{ descHtml, infoHtml, specItems, nutriItems, nutriBase: enr?.nutrition?.base, usageSteps: enr?.usage }}
        avaliacoes={rstats && enr?.reviews?.length ? { ratingCount: Number(rstats.count), average: Number(rstats.average), reviews: enr.reviews } : null}
        faq={faq}
        catalogo={catalogItems}
      />
    </>
  );
}
