// ═══════════════════════════════════════════════════════════════════════════
// OS DADOS DA LOJA (foundation 17): a empresa, as redes sociais, o favicon e a verificação do Google, que o
// lojista preenche no editor (Configurações gerais e aba SEO), e os redirecionamentos manuais.
//
// Quem mostra cada coisa:
// · rodapé (components/site-footer.tsx): razão social, CNPJ, endereço e contato;
// · termos e privacidade: os mesmos dados no lugar dos marcadores. Sem o dado, o marcador continua, e o
//   gate de publicação (`npm run unbox:placeholder`) cobra: dado que a loja não tem não é inventado;
// · dado estruturado da empresa (lib/paginas-seo.ts, `jsonLdDaLoja`): nome empresarial, CNPJ, endereço,
//   contato e os perfis (`sameAs`);
// · app/layout.tsx: `verification` e `icons` (este só quando há ícone enviado; sem ele, vale app/icon.svg);
// · produto e categoria: o redirecionamento antes do 404 (as páginas do lojista já conferiam).
//
// `DECLARACAO_DOS_DADOS_DA_LOJA` é o que o layout declara ao editor. Parte nova só entra nela junto com quem a
// mostra: declarada sem leitura, o lojista preencheria e nada mudaria na loja.
// ═══════════════════════════════════════════════════════════════════════════
import "server-only";
import { cache } from "react";
import type { Metadata } from "next";
import { getPublishedContent } from "@/lib/editable/server";
import {
  dadosDaLoja,
  formatarCnpj,
  formatarTelefone,
  REDES_SOCIAIS,
  type DadosDaLoja,
  type EmpresaDaLoja,
  type EnderecoDaEmpresa,
  type ManifestDadosDaLoja,
  type SeoDaLoja,
} from "@/lib/editable/document";

export const DECLARACAO_DOS_DADOS_DA_LOJA: ManifestDadosDaLoja = { partes: ["empresa", "redes", "seo"], redirecionamentos: true };

/** os dados publicados, só com os campos na forma certa (ver `dadosDaLoja`); um fetch por requisição */
export const lerDadosDaLoja = cache(async (): Promise<DadosDaLoja> => dadosDaLoja(await getPublishedContent()));

export function cepFormatado(cep: string): string {
  return cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep;
}

/** "Rua do Exemplo, 100, Sala 2 · Centro · São Paulo/SP · CEP 01000-000" */
export function enderecoEmUmaLinha(e: EnderecoDaEmpresa): string {
  const rua = [e.logradouro, e.numero, e.complemento].filter(Boolean).join(", ");
  return [rua, e.bairro, `${e.cidade}/${e.uf}`, `CEP ${cepFormatado(e.cep)}`].join(" · ");
}

/** a linha do rodapé: quem vende, e como falar com ela; `null` quando não há nada cadastrado */
export function linhasDaEmpresa(e: EmpresaDaLoja | undefined): { quem: string | null; contato: string | null } {
  if (!e) return { quem: null, contato: null };
  const quem = [e.razaoSocial, e.cnpj ? `CNPJ ${formatarCnpj(e.cnpj)}` : null, e.endereco ? enderecoEmUmaLinha(e.endereco) : null].filter(Boolean).join(" · ");
  const contato = [e.email, e.telefone ? formatarTelefone(e.telefone) : null].filter(Boolean).join(" · ");
  return { quem: quem || null, contato: contato || null };
}

/**
 * O FAVICON QUE O LOJISTA ENVIOU, no formato do metadata. Declarar `icons` no layout faz o Next deixar de
 * emitir o `app/icon.svg` (medido no HTML servido), então: sem ícone enviado, `undefined` e vale o arquivo
 * da loja; com o ícone do iPhone mas sem favicon, o `app/icon.svg` entra à mão na lista, senão a aba do
 * navegador ficaria sem ícone.
 */
export function iconesDaLoja(seo: SeoDaLoja | undefined): Metadata["icons"] | undefined {
  if (!seo?.favicon32 && !seo?.favicon48 && !seo?.iconeApple) return undefined;
  const icon = [
    ...(seo.favicon32 ? [{ url: seo.favicon32, sizes: "32x32", type: "image/png" }] : []),
    ...(seo.favicon48 ? [{ url: seo.favicon48, sizes: "48x48", type: "image/png" }] : []),
  ];
  return {
    icon: icon.length ? icon : [{ url: "/icon.svg", type: "image/svg+xml" }],
    ...(seo.iconeApple ? { apple: [{ url: seo.iconeApple, sizes: "180x180", type: "image/png" }] } : {}),
  };
}

/** o que a empresa acrescenta ao `Organization` do dado estruturado */
export function empresaNoDadoEstruturado(dados: DadosDaLoja): Record<string, unknown> {
  const e = dados.empresa;
  const telefone = e?.telefone ? `+55${e.telefone}` : undefined;
  const sameAs = REDES_SOCIAIS.map((r) => dados.redes?.[r]).filter((v): v is string => Boolean(v));
  return {
    ...(e?.razaoSocial ? { legalName: e.razaoSocial } : {}),
    ...(e?.cnpj ? { taxID: formatarCnpj(e.cnpj) } : {}),
    ...(e?.endereco
      ? { address: { "@type": "PostalAddress", streetAddress: [e.endereco.logradouro, e.endereco.numero, e.endereco.complemento].filter(Boolean).join(", "), addressLocality: e.endereco.cidade, addressRegion: e.endereco.uf, postalCode: cepFormatado(e.endereco.cep), addressCountry: "BR" } }
      : {}),
    ...(e?.email ? { email: e.email } : {}),
    ...(telefone ? { telephone: telefone } : {}),
    ...(e?.email || telefone ? { contactPoint: { "@type": "ContactPoint", contactType: "customer service", areaServed: "BR", availableLanguage: "pt-BR", ...(e?.email ? { email: e.email } : {}), ...(telefone ? { telephone: telefone } : {}) } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}
