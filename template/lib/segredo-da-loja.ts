import "server-only";

// ═══════════════════════════════════════════════════════════════════════════
// O SEGREDO DESTA LOJA, e por que ele mora num arquivo versionado.
//
// Ele assina o cookie que prova "este pedido é seu" (lib/session.ts). Quem compra sem conta é
// mandado para /pedido/<referência> logo depois de pagar, e é esse cookie que faz a tela
// pós-pagamento abrir. Sem segredo, o comprador paga e lê "não foi possível exibir este pedido".
//
// POR QUE NÃO É VARIÁVEL DE AMBIENTE. Era, e a conta não fechava: quem faz o deploy das lojas é a
// Unbox, o dono da loja não tem acesso ao painel de hospedagem, e "lembrar de cadastrar uma
// variável" é um passo que, com muitas lojas, uma hora não acontece. Quando não acontecia, a loja
// caía num valor fixo que estava escrito no código do template — igual em todas e público no
// registro de pacotes, ou seja, uma prova de posse que qualquer pessoa consegue forjar.
//
// Sorteado na criação da loja pelo `create-unbox-store` e versionado junto do código: ele viaja no
// deploy como qualquer outro arquivo, é único por loja, sobrevive a todo deploy, e não existe passo
// manual para esquecer. O repositório da loja é privado; o que este valor protege é qual convidado
// vê o próprio pedido, não dinheiro.
//
// A variável de ambiente continua valendo e VENCE este valor (lib/config.ts), que é como se
// rotaciona o segredo sem mexer no código. Trocar derruba os cookies em vigor: quem comprou e ainda
// não abriu a página do pedido passa a precisar entrar na conta.
//
// Vazio aqui é loja gerada antes desta versão: a loja continua vendendo, e a tela pós-pagamento
// manda entrar na conta. Para gerar um, veja `tools/` no repositório do CLI.
// ═══════════════════════════════════════════════════════════════════════════
export const SEGREDO_DA_LOJA = "";
