import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Uso",
  robots: { index: true, follow: true },
  alternates: { canonical: "/termos" },
};

// TODO [JURÍDICO]: revisar e completar antes do lançamento.
// Substituir [NOME DA LOJA], [CNPJ], [ENDEREÇO], [EMAIL ATENDIMENTO] pelos dados reais.

export default function TermosPage() {
  return (
    <article className="texto-rico mx-auto max-w-2xl py-8 px-4">
      <h1>Termos de Uso</h1>
      <p className="text-sm text-muted-foreground">Última atualização: preencher data</p>

      <h2>1. Aceitação dos termos</h2>
      <p>
        Ao acessar e utilizar este site, você concorda com estes Termos de Uso e com nossa{" "}
        <Link href="/privacidade" className="text-primary underline">Política de Privacidade</Link>.
        Se não concordar, não utilize o site.
      </p>

      <h2>2. Sobre a loja</h2>
      <p>
        <strong>[NOME DA LOJA]</strong>, inscrita no CNPJ nº <strong>[CNPJ]</strong>,
        com sede em <strong>[ENDEREÇO COMPLETO]</strong>, opera esta loja com tecnologia
        headless da plataforma Unbox (unbox.com.br).
      </p>

      <h2>3. Preços e disponibilidade</h2>
      <p>
        Os preços, estoque e condições são atualizados em tempo real e podem mudar sem aviso prévio.
        O preço válido é o exibido no momento da finalização do pedido.
      </p>

      <h2>4. Pagamentos</h2>
      <ul>
        <li><strong>Pix:</strong> pedidos são confirmados após a compensação do pagamento (geralmente instantânea).</li>
        <li><strong>Cartão de crédito:</strong> a cobrança é realizada no momento da compra. Parcelamento conforme condições exibidas no checkout.</li>
        <li>Os dados do cartão são processados diretamente pela <strong>UnboxPay</strong>, e não armazenamos dados de pagamento.</li>
      </ul>

      <h2>5. Frete e entrega</h2>
      <p>
        Os prazos e valores de frete são calculados no checkout com base no CEP informado.
        O prazo começa a contar após a confirmação do pagamento. Atrasos causados por
        eventos externos (força maior, greves, etc.) estão fora de nossa responsabilidade.
      </p>

      <h2>6. Assinatura recorrente</h2>
      <ul>
        <li>Produtos assináveis são cobrados automaticamente na frequência escolhida (mensal, bimestral etc.).</li>
        <li>Você pode pausar, pular ciclos ou cancelar a qualquer momento na{" "}
          <Link href="/conta/assinaturas" className="text-primary underline">área da conta</Link>.
        </li>
        <li>Assinantes têm acesso a descontos exclusivos e, em algumas campanhas, a lançamentos antecipados.</li>
        <li>O cancelamento encerra as cobranças futuras; pedidos já processados seguem normalmente.</li>
      </ul>

      <h2>7. Trocas e devoluções</h2>
      <p>
        Consulte nossa{" "}
        <Link href="/devolucoes" className="text-primary underline">Política de Trocas e Devoluções</Link>{" "}
        para informações sobre direito de arrependimento (CDC, art. 49) e como solicitar reembolso.
      </p>

      <h2>8. Propriedade intelectual</h2>
      <p>
        Todo o conteúdo deste site (textos, imagens, logotipos, layouts) é propriedade de
        <strong> [NOME DA LOJA]</strong> ou de seus fornecedores e está protegido pelas leis de
        direitos autorais. É proibida a reprodução sem autorização prévia por escrito.
      </p>

      <h2>9. Limitação de responsabilidade</h2>
      <p>
        Não nos responsabilizamos por danos indiretos, incidentais ou consequentes decorrentes
        do uso do site ou dos produtos, exceto nos casos previstos no Código de Defesa do
        Consumidor (Lei 8.078/1990).
      </p>

      <h2>10. Privacidade e LGPD</h2>
      <p>
        O tratamento de dados pessoais segue nossa{" "}
        <Link href="/privacidade" className="text-primary underline">Política de Privacidade</Link>,
        em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018).
      </p>

      <h2>11. Foro</h2>
      <p>
        Fica eleito o foro da comarca de <strong>[CIDADE/ESTADO]</strong> para dirimir
        eventuais litígios decorrentes destes Termos, com renúncia a qualquer outro,
        por mais privilegiado que seja.
      </p>

      <h2>12. Contato</h2>
      <p>
        Dúvidas sobre estes termos: <strong>[EMAIL ATENDIMENTO]</strong>
      </p>
    </article>
  );
}
