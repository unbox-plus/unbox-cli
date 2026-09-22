import type { Metadata } from "next";
import { lerDadosDaLoja, enderecoEmUmaLinha } from "@/lib/dados-da-loja";
import { formatarCnpj } from "@/lib/editable/document";
import { getPublishedContent } from "@/lib/editable/server";
import { LojaPadrao } from "@/components/personalizacao/loja-padrao";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  robots: { index: true, follow: true },
  alternates: { canonical: "/privacidade" },
};

// TODO [JURÍDICO]: revisar e completar este texto antes do lançamento.
// Este é um placeholder estruturado para LGPD (Lei 13.709/2018).
// Nome empresarial, CNPJ, endereço e o e-mail de privacidade vêm dos Dados da empresa, no editor
// (lib/dados-da-loja.ts). Sem o dado, o marcador entre colchetes continua e o gate de publicação cobra.

export default async function PrivacidadePage() {
  const { empresa } = await lerDadosDaLoja();
  // os sinais que ESTA loja usa para escolher a versão da home (foundation 18); sem público, a seção não sai
  const publicos = Object.values((await getPublishedContent())?.publicos ?? {});
  const usa = (sinal: "utm" | "site" | "regiao" | "cliente") => publicos.some((p) => Boolean(p.entrada?.[sinal]?.length));
  const nome = empresa?.razaoSocial ?? "[NOME DA LOJA]";
  const cnpj = empresa?.cnpj ? formatarCnpj(empresa.cnpj) : "[CNPJ]";
  const endereco = empresa?.endereco ? enderecoEmUmaLinha(empresa.endereco) : "[ENDEREÇO COMPLETO]";
  // sem e-mail próprio para dados pessoais, vale o de atendimento: é para lá que a pessoa escreveria
  const emailDePrivacidade = empresa?.emailDePrivacidade ?? empresa?.email ?? "[EMAIL DPO]";
  return (
    <article className="texto-rico mx-auto max-w-2xl py-8 px-4">
      <h1>Política de Privacidade</h1>
      <p className="text-sm text-muted-foreground">Última atualização: preencher data</p>

      <h2>1. Quem somos</h2>
      <p>
        <strong>{nome}</strong>, inscrita no CNPJ sob o nº <strong>{cnpj}</strong>,
        com sede em <strong>{endereco}</strong>, é a controladora dos dados pessoais
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

      {publicos.length ? (
        <>
          <h3>Versões da loja por interesse</h3>
          <p>
            A página inicial pode aparecer em versões diferentes conforme o interesse de quem visita. Para escolher
            a sua, usamos:
          </p>
          <ul>
            <li>o link do anúncio que trouxe você{usa("utm") ? ", e a campanha dele" : ""};</li>
            {usa("site") ? <li>o site de onde você veio (por exemplo, uma rede social);</li> : null}
            {usa("regiao") ? <li>a região aproximada da sua conexão (estado e cidade), sem guardar o seu IP;</li> : null}
            <li>as respostas que você der em testes ou quizzes da loja, quando houver;</li>
            {usa("cliente") ? <li>se você entrar na sua conta: os produtos que comprou aqui, se tem assinatura ativa e o estado do seu endereço.</li> : null}
          </ul>
          <p>
            A escolha fica guardada no cookie <code>unbox_publico</code> por até 90 dias. Parte de quem visita vê a
            versão padrão, para medirmos o resultado. Essa informação fica nesta loja e nas ferramentas de análise dela,
            e não é enviada a redes de anúncio. Base legal: legítimo interesse, com o seu direito de oposição a qualquer
            momento:
          </p>
          <LojaPadrao />
        </>
      ) : null}

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
        pelo e-mail <strong>{emailDePrivacidade}</strong>.
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
        Dúvidas, solicitações ou reclamações: <strong>{emailDePrivacidade}</strong><br />
        Você também pode registrar queixas na Autoridade Nacional de Proteção de Dados (ANPD):
        <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer">www.gov.br/anpd</a>
      </p>
    </article>
  );
}
