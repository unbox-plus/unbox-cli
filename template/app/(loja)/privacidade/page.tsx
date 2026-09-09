import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  robots: { index: true, follow: true },
  alternates: { canonical: "/privacidade" },
};

// TODO [JURÍDICO]: revisar e completar este texto antes do lançamento.
// Este é um placeholder estruturado para LGPD (Lei 13.709/2018).
// Substituir [NOME DA LOJA], [CNPJ], [ENDEREÇO], [EMAIL DPO] pelos dados reais.

export default function PrivacidadePage() {
  return (
    <article className="richtext mx-auto max-w-2xl py-8 px-4">
      <h1>Política de Privacidade</h1>
      <p className="text-sm text-muted-foreground">Última atualização: preencher data</p>

      <h2>1. Quem somos</h2>
      <p>
        <strong>[NOME DA LOJA]</strong>, inscrita no CNPJ sob o nº <strong>[CNPJ]</strong>,
        com sede em <strong>[ENDEREÇO COMPLETO]</strong>, é a controladora dos dados pessoais
        tratados neste site, nos termos da Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).
      </p>

      <h2>2. Dados coletados</h2>
      <p>Coletamos os seguintes dados para operar a loja:</p>
      <ul>
        <li><strong>Cadastro e compra:</strong> nome, e-mail, CPF, telefone, endereço de entrega</li>
        <li><strong>Pagamento:</strong> os dados de cartão são processados diretamente pela UnboxPay, e não armazenamos número de cartão</li>
        <li><strong>Navegação:</strong> endereço IP, cookies de sessão, preferências de carrinho</li>
        <li><strong>Analytics:</strong> eventos de navegação e compra (via Google Analytics / Meta Pixel)</li>
      </ul>

      <h2>3. Finalidade do tratamento</h2>
      <ul>
        <li>Processar pedidos e pagamentos</li>
        <li>Enviar confirmações de pedido e atualizações de entrega por e-mail</li>
        <li>Gerir assinaturas recorrentes, se aplicável</li>
        <li>Personalizar a experiência de navegação</li>
        <li>Cumprir obrigações legais (nota fiscal, CDC)</li>
        <li>Melhorar nossos produtos e serviços com base em dados agregados</li>
      </ul>

      <h2>4. Base legal</h2>
      <p>
        O tratamento é baseado em: (a) execução de contrato, para processar seus pedidos;
        (b) obrigação legal, para emissão de nota fiscal e cumprimento do CDC;
        (c) legítimo interesse, para analytics e segurança; (d) consentimento, para envio de
        ofertas por e-mail (você pode revogar a qualquer momento).
      </p>

      <h2>5. Compartilhamento</h2>
      <p>Seus dados podem ser compartilhados com:</p>
      <ul>
        <li><strong>Unbox:</strong> plataforma de e-commerce que opera o back-end da loja</li>
        <li><strong>Transportadoras:</strong> nome e endereço de entrega para despacho do pedido</li>
        <li><strong>Gateway de pagamento (UnboxPay):</strong> dados de cobrança</li>
        <li><strong>Google e Meta:</strong> dados de analytics e conversão (pseudonimizados)</li>
      </ul>
      <p>Não vendemos seus dados a terceiros.</p>

      <h2>6. Cookies</h2>
      <p>
        Utilizamos cookies essenciais (sessão, carrinho) e opcionais de analytics (GA4, Meta Pixel).
        Você pode gerenciar suas preferências a qualquer momento pelo banner de cookies ou nas
        configurações do seu navegador.
      </p>

      <h2>7. Seus direitos (LGPD, art. 18)</h2>
      <p>Você tem direito a:</p>
      <ul>
        <li>Confirmar a existência de tratamento dos seus dados</li>
        <li>Acessar, corrigir ou atualizar seus dados</li>
        <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários</li>
        <li>Solicitar portabilidade dos seus dados</li>
        <li>Revogar o consentimento para comunicações de marketing</li>
        <li>Opor-se ao tratamento baseado em legítimo interesse</li>
      </ul>
      <p>
        Para exercer seus direitos, entre em contato com nosso Encarregado de Proteção de Dados (DPO)
        pelo e-mail <strong>[EMAIL DPO]</strong>.
      </p>

      <h2>8. Retenção dos dados</h2>
      <p>
        Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas acima e
        obrigações legais (ex: registros fiscais por 5 anos). Após esse prazo, os dados são
        eliminados ou anonimizados.
      </p>

      <h2>9. Segurança</h2>
      <p>
        Utilizamos HTTPS em todas as comunicações. Senhas de conta não são armazenadas em texto
        puro. Dados de pagamento trafegam diretamente pela UnboxPay, certificada PCI-DSS.
      </p>

      <h2>10. Alterações nesta política</h2>
      <p>
        Podemos atualizar esta política periodicamente. A data de “última atualização” no topo da
        página indica quando ocorreu a revisão mais recente. Alterações relevantes serão
        comunicadas por e-mail ou banner no site.
      </p>

      <h2>11. Contato e DPO</h2>
      <p>
        Dúvidas, solicitações ou reclamações: <strong>[EMAIL DPO]</strong><br />
        Você também pode registrar queixas na Autoridade Nacional de Proteção de Dados (ANPD):
        <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer">www.gov.br/anpd</a>
      </p>
    </article>
  );
}
