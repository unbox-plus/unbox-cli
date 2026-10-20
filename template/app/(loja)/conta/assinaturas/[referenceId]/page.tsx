import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { getCustomerClient, lerDaConta } from "@/lib/customer-session";
import { formatarData, formatBRL } from "@/lib/format";
import { Foto } from "@/components/ui/foto";
import { withStoreClient } from "@/lib/unbox";
import { getShopData } from "@/lib/queries";
import { subscriptionStatusLabel } from "@unbox-plus/sdk";
import { AccountShell } from "@/components/account/account-shell";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/order-status";
import { SubscriptionActions } from "@/components/account/subscription-actions";
import { SubscriptionItemsSection, type ItemDetalhe } from "@/components/account/subscription-items-section";
import { InlineAlert } from "@/components/account/subscription-editor/inline-alert";
import { nameKey } from "@/lib/subscription-items";
import type { KitComponent } from "@/components/account/subscription-editor/kit-picks-builder";
import type { CatalogProduct, KitOption } from "@/components/account/subscription-editor/catalog-product-card";
import { mockupOr } from "@/lib/mockup";

export const metadata: Metadata = { title: "Assinatura", robots: { index: false } };

export default async function AssinaturaDetalhePage({ params }: { params: Promise<{ referenceId: string }> }) {
  const me = await getCustomerClient();
  if (!me) redirect("/conta/entrar");
  const { referenceId } = await params;

  const [leitura, shop] = await Promise.all([
    lerDaConta("/conta/assinaturas/[referenceId]", me.subscription(referenceId)),
    getShopData().catch(() => null),
  ]);
  const sub = leitura.ok ? leitura.valor : null;

  if (!sub) {
    // "não encontrada" só quando a API respondeu que não existe; falha na leitura diz o que é
    return (
      <AccountShell title="Assinatura">
        {leitura.ok ? (
          <EmptyState title="Assinatura não encontrada" />
        ) : (
          <EmptyState title="Não conseguimos carregar esta assinatura" description="Ela continua como estava. Tente de novo em instantes." />
        )}
      </AccountShell>
    );
  }

  // a assinatura só traz ids; nome do produto e da variação vêm do SDK. Cosmético: sem nome, cai no código.
  const produtos = await withStoreClient((c) => c.getProductsByIds((sub.items ?? []).map((it: any) => it.productId))).catch(() => []);
  const detalhes: Record<string, ItemDetalhe> = {};
  const linhas = (sub.items ?? []).map((it: any) => {
    const p = produtos.find((x) => x.productId === it.productId || x._id === it.productId);
    const v = p?.variants?.find((x) => x._id === it.variantId);
    const variacao = p?.productType === "KIT" ? (p.relatedInfo?.title ?? null) : v?.title && v.title !== p?.title ? v.title : null;
    const unit = v?.pricingOnRecurrence?.[0]?.price ?? v?.pricing?.[0]?.price ?? null;
    const avulso = v?.pricing?.[0]?.price ?? null;
    const titulo = p?.title ?? it.productERPCode ?? it.productId;
    const d: ItemDetalhe = { titulo, variacao, foto: p?.imageUrls?.[0], unit, riscado: unit != null && avulso != null && avulso > unit ? avulso : null };
    // todas as variações do produto ganham nome e preço: a troca de variação no modal precisa deles
    const variantes = (p?.variants ?? []).map((x: any) => ({ id: x._id, label: x.title, esgotado: !!x.isSoldOut }));
    for (const x of p?.variants ?? []) {
      const u = x.pricingOnRecurrence?.[0]?.price ?? x.pricing?.[0]?.price ?? null;
      const av = x.pricing?.[0]?.price ?? null;
      detalhes[nameKey({ productId: it.productId, variantId: x._id })] = {
        titulo, variacao: p?.productType === "KIT" ? (p.relatedInfo?.title ?? null) : x.title && x.title !== p?.title ? x.title : null, foto: p?.imageUrls?.[0], unit: u,
        riscado: u != null && av != null && av > u ? av : null, variantes: variantes.length > 1 ? variantes : undefined,
      };
    }
    detalhes[nameKey(it)] ??= d;
    return { it, ...d };
  });
  const actions = shop?.recurringOrdersPolicy?.customerActions ?? {};
  // catálogo do "Adicionar produto": só com a flag ligada; já filtrado por recurrenceAllowed pelo SDK
  const catalogo: CatalogProduct[] = [];
  const kitIds = new Set<string>(); // produtos de kit do catálogo
  if (actions.canAddProducts) {
    const assinaveis = await mockupOr(withStoreClient((c) => c.getSubscribableCatalog()), [], "assinatura/getSubscribableCatalog");
    for (const p of assinaveis) {
      if (p.isVisible === false || !p.variants?.length) continue;
      const preco = (x: any) => {
        const unit = x.pricingOnRecurrence?.[0]?.price ?? x.pricing?.[0]?.price ?? null;
        const avulso = x.pricing?.[0]?.price ?? null;
        return { unit, riscado: unit != null && avulso != null && avulso > unit ? avulso : null };
      };
      const [v0] = p.variants;
      const { unit, riscado } = preco(v0);
      if (unit == null) continue;
      const isKit = p.productType === "KIT"; // kit tem uma variante só; o que o cliente escolhe são os componentes
      if (isKit) kitIds.add(p.productId);
      const multiplas = !isKit && p.variants.length > 1;
      // títulos no formato "Moagem: Em grãos": o prefixo comum vira a legenda dos chips e sai do rótulo
      const prefixos = new Set(p.variants.map((x: any) => (x.title?.includes(":") ? x.title.split(":")[0].trim() : "")));
      const legenda = prefixos.size === 1 ? [...prefixos][0] : "";
      const rotulo = (x: any) => (legenda ? x.title.slice(x.title.indexOf(":") + 1).trim() : x.title);
      catalogo.push({
        productId: p.productId, title: p.title, imageUrl: p.imageUrls?.[0], price: unit, compareAtPrice: riscado,
        categories: p.categories.map((c) => c.name), soldOut: p.isSoldOut,
        variantId: multiplas ? null : v0._id,
        variantsLegend: legenda || undefined,
        variants: multiplas ? p.variants.map((x: any) => ({ id: x._id, label: rotulo(x), soldOut: !!x.isSoldOut })) : undefined,
      });
      // o modal desenha a linha do item novo a partir de `detalhes`, então toda variante do catálogo entra nele
      for (const x of p.variants as any[]) {
        const u = preco(x);
        detalhes[nameKey({ productId: p.productId, variantId: x._id })] ??= {
          titulo: p.title, variacao: !isKit && x.title && x.title !== p.title ? x.title : null, foto: p.imageUrls?.[0], unit: u.unit, riscado: u.riscado,
          variantes: multiplas ? p.variants.map((y: any) => ({ id: y._id, label: y.title, esgotado: !!y.isSoldOut })) : undefined,
        };
      }
    }
  }
  // Kits: os componentes e a cota vêm de getProductKit. Servem tanto ao card de "Adicionar" quanto ao nome dos itens
  // já escolhidos nos kits da assinatura.
  const kitsDaAssinatura = (sub.items ?? []).filter((it: any) => it.productKitId).map((it: any) => it.productKitId as string);
  const kitInfo = new Map<string, any>();
  await Promise.all(
    [...new Set([...kitIds, ...kitsDaAssinatura])].map(async (id) => {
      const k = await mockupOr(withStoreClient((c) => c.getProductKit(id)), null, "assinatura/getProductKit");
      if (k) kitInfo.set(id, k);
    }),
  );
  const componentes = (k: any) => ((k?.kitComponents ?? []) as any[]).filter((c) => c.productId && c.productVariantId);
  // `kitLabelImage` é uma imagem opcional do kit e quase sempre vem vazia: sem ela, vale a foto do próprio produto do item.
  const semImagemDoKit = new Set<string>();
  for (const k of kitInfo.values()) for (const c of componentes(k)) if (!c.kitLabelImage) semImagemDoKit.add(c.productId);
  const fotoDoProduto = new Map<string, string>();
  if (semImagemDoKit.size) {
    const itens = await mockupOr(withStoreClient((c) => c.getProductsByIds([...semImagemDoKit])), [], "assinatura/getProductsByIds(itens do kit)");
    for (const p of itens) if (p.imageUrls?.[0]) fotoDoProduto.set(p.productId, p.imageUrls[0]);
  }
  // os itens que se pode escolher no kit, no formato do construtor
  const itensDoKit = (k: any): KitComponent[] =>
    componentes(k).map((c) => ({
      productId: c.productId, variantId: c.productVariantId, title: c.productTitle ?? c.label ?? "Item",
      subtitle: c.label && c.label !== c.productTitle ? c.label : null, imageUrl: c.kitLabelImage ?? fotoDoProduto.get(c.productId),
    }));
  // Na loja cada tamanho de kit ("2 Box", "3 Box"...) é um produto de kit à parte. Para o cliente é UM kit com
  // opções: os produtos de kit de mesmo título viram um cartão só, com uma opção por produto.
  const resultado: CatalogProduct[] = [];
  const porTitulo = new Map<string, CatalogProduct>();
  for (const e of catalogo) {
    if (!kitIds.has(e.productId)) {
      resultado.push(e);
      continue;
    }
    const k = kitInfo.get(e.productId);
    const comps = componentes(k);
    if (!k || !(k.requiredPicksPerGroup > 0) || !comps.length || !e.variantId) continue; // sem cota ou sem componentes não dá para montar o kit
    const opcao: KitOption = {
      productId: e.productId, variantId: e.variantId, requiredPicks: k.requiredPicksPerGroup,
      label: k.relatedInfo?.title || `${k.requiredPicksPerGroup} ${k.requiredPicksPerGroup === 1 ? "item" : "itens"}`,
      price: e.price, compareAtPrice: e.compareAtPrice, highlight: k.relatedInfo?.highlightLabel || null, soldOut: e.soldOut,
      components: itensDoKit(k),
    };
    const dk = detalhes[nameKey({ productId: e.productId, variantId: e.variantId })];
    if (dk) {
      dk.kit = { cap: opcao.requiredPicks, options: opcao.components }; // o modal nomeia e edita os itens a partir daqui
      dk.variacao = opcao.label; // e a linha do kit diz qual opção é
    }
    const chave = e.title.trim().toLowerCase();
    const grupo = porTitulo.get(chave);
    if (grupo?.kit) {
      grupo.kit.options.push(opcao);
      grupo.price = Math.min(grupo.price, e.price);
      grupo.categories = [...new Set([...(grupo.categories ?? []), ...(e.categories ?? [])])];
    } else {
      e.kit = { options: [opcao] };
      porTitulo.set(chave, e);
      resultado.push(e);
    }
  }
  for (const g of porTitulo.values()) {
    g.kit!.options.sort((x, y) => x.requiredPicks - y.requiredPicks);
    g.soldOut = g.kit!.options.every((o) => o.soldOut);
  }
  catalogo.splice(0, catalogo.length, ...resultado);
  for (const it of sub.items ?? []) {
    const d = it.productKitId && detalhes[nameKey(it)];
    const k = d ? kitInfo.get(it.productKitId) : null;
    if (d && k?.requiredPicksPerGroup > 0) d.kit = { cap: k.requiredPicksPerGroup, options: itensDoKit(k) };
  }
  const totalItens = linhas.every((l: any) => l.unit != null) ? linhas.reduce((t: number, l: any) => t + l.unit * l.it.quantity, 0) : null;
  const comDesconto = linhas.some((l: any) => l.riscado != null);

  const ciclos = await lerDaConta("/conta/assinaturas/[referenceId]/ciclos", me.subscriptionCycles(sub._id, 12));
  const cycles = ciclos.ok ? ciclos.valor : { nodes: [] };
  const status = sub.status?.value ?? "ACTIVE";
  const card = sub.unboxPayCustomerCreditCard;
  const addr = sub.shippingAddressBook;
  const tone = status === "CANCELED" ? "bad" : status === "PAUSED" ? "warn" : "ok";

  return (
    <AccountShell title={`Assinatura #${sub.referenceId}`}>
      {status === "ERROR" && (
        <InlineAlert variant="error" title="Atualize a forma de pagamento." action={{ label: "Trocar cartão", href: "#gerenciar" }} className="mb-4">
          Há um problema com o pagamento desta assinatura. Troque o cartão para ela voltar ao normal.
        </InlineAlert>
      )}
      <div className="rounded-xl border border-[var(--store-line)] bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12.5px] font-semibold text-[var(--store-muted)]">Frequência</p>
            <p className="font-display text-[18px] font-extrabold text-[var(--store-ink)]">{sub.frequency?.title ?? "—"}</p>
          </div>
          <StatusBadge label={subscriptionStatusLabel(status)} tone={tone} />
        </div>

        <div className="my-4 border-t border-[var(--store-surface-2)]" />
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {sub.totalAmount?.displayAmount && <Info label="Valor por ciclo" value={sub.totalAmount.displayAmount} />}
          {sub.cyclesInformation?.nextCycleDate && (
            <Info label="Próxima cobrança" value={formatarData(sub.cyclesInformation.nextCycleDate)} />
          )}
          {card && <Info label="Cartão" value={`•••• ${card.last4Digits} (${card.expirationMonth}/${card.expirationYear})`} />}
          {addr && <Info label="Entrega" value={`${addr.address1}, ${addr.number ?? ""} · ${addr.city}/${addr.region}`} />}
          {sub.pricingPolicy?.type === "PERCENTAGE_OFF" && <Info label="Desconto" value={`${sub.pricingPolicy.value}%`} />}
        </dl>

        {sub.items?.length > 0 && (
          <>
            <div className="my-4 border-t border-[var(--store-surface-2)]" />
            <SubscriptionItemsSection
              recurringOrderId={sub._id}
              status={status}
              actions={actions}
              savedItems={(sub.items ?? []).map((it: any) => ({
                productId: it.productId, variantId: it.variantId, quantity: it.quantity,
                // o que o cliente já escolheu no kit tem de voltar no salvar; sem isso o kit perderia os itens
                ...(it.productKitId ? { kit: { productKitId: it.productKitId, picks: (it.productKitItemsConfigurations ?? []).map((c: any) => ({ productId: c.productId, productVariantId: c.productVariantId, quantity: c.quantity })) } } : {}),
              }))}
              details={detalhes}
              catalog={catalogo}
              nextDeliveryDate={sub.cyclesInformation?.nextCycleDate ? formatarData(sub.cyclesInformation.nextCycleDate) : undefined}
            >
            <ul className="flex flex-col divide-y divide-[var(--store-surface-2)]">
              {linhas.map((l: any, i: number) => (
                <li key={i} className="flex items-start gap-3 py-3.5 first:pt-0">
                  <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-[var(--store-surface-2)]">
                    {l.foto && <Foto src={l.foto} alt="" width={56} height={56} sizes="56px" className="size-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-bold text-[var(--store-ink)]">{l.titulo}</p>
                    {l.variacao && <p className="text-[var(--store-muted)]">{l.variacao}</p>}
                    <p className="text-[13px] text-[var(--store-muted)]">
                      Qtd.: {l.it.quantity}
                      {l.unit != null && <> · {formatBRL(l.unit)} cada</>}
                      {l.riscado != null && <> <s>{formatBRL(l.riscado)}</s></>}
                    </p>
                  </div>
                  {l.unit != null && <p className="font-display whitespace-nowrap font-extrabold tabular-nums text-[var(--store-ink)]">{formatBRL(l.unit * l.it.quantity)}</p>}
                </li>
              ))}
            </ul>
            {totalItens != null && (
              <div className="mt-2 border-t border-[var(--store-surface-2)] pt-3.5">
                <div className="flex items-baseline justify-between font-bold text-[var(--store-ink)]">
                  <span>Total dos produtos</span>
                  <span className="font-display text-[17px] font-extrabold tabular-nums">{formatBRL(totalItens)}</span>
                </div>
                {comDesconto && <p className="text-[13px] text-[var(--store-muted)]">Já com desconto de assinatura</p>}
              </div>
            )}
            </SubscriptionItemsSection>
          </>
        )}
      </div>

      <SubscriptionActions
        recurringOrderId={sub._id}
        status={status}
        actions={actions}
        canEditItems={!!(actions.canChangeProductQuantity || actions.canRemoveProducts || (actions.canAddProducts && catalogo.length > 0) || Object.values(detalhes).some((d) => d.variantes && d.variantes.length > 1))}
      />

      {cycles.nodes?.length > 0 && (
        <div className="mt-6">
          <h4 className="font-display mb-2.5 text-[var(--store-ink)]">Histórico de ciclos</h4>
          <ul className="flex flex-col divide-y divide-[var(--store-surface-2)] rounded-lg border border-[var(--store-line)] bg-white text-sm">
            {cycles.nodes.map((c: any) => (
              <li key={c._id} className="flex items-center justify-between p-3.5">
                <span className="font-semibold text-[var(--store-ink-2)]">Ciclo #{c.cycleIndex}</span>
                <span className="text-[var(--store-muted)]">
                  {c.skipped ? "Pulado" : c.completedAt ? `Concluído em ${formatarData(c.completedAt)}` : "Pendente"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link href="/conta/assinaturas" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl border-[1.5px] border-[var(--store-line-2)] bg-white px-4 text-[14px] font-bold text-[var(--store-ink-2)] no-underline transition-colors hover:border-[var(--store-primary,#18181B)] hover:text-[var(--store-primary,#18181B)]">
        <ArrowLeft weight="bold" /> Voltar
      </Link>
    </AccountShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--store-muted)]">{label}</dt>
      <dd className="font-semibold text-[var(--store-ink)]">{value}</dd>
    </div>
  );
}
