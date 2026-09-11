// ═══════════════════════════════════════════════════════════════════════════
// A DATA DE UM ARTIGO: UMA SÓ, PARA A TELA E PARA O DADO ESTRUTURADO.
//
// O `BlogPosting` que a rota emite e a linha de meta que a casca mostra saem daqui, do mesmo cálculo.
// Duas contas separadas divergem no primeiro fuso: o Google compara a data do dado estruturado com a
// que aparece na página e desconfia das duas quando não batem, e quem lê vê uma data e o buscador
// mostra outra.
//
// A DATA MARCADA, NÃO A DE HOJE: `publicadoEm` é o que o lojista escolheu; sem ele vale `criadoEm`,
// porque um artigo sem data marcada é do dia em que nasceu (é assim que a foundation também os
// ordena na listagem). `atualizadoEm` é outra coisa, e vai só no `dateModified`.
//
// O DIA É O QUE ESTÁ ESCRITO NO REGISTRO. A data chega em ISO com fuso ("2026-09-09T21:00:00-03:00"),
// e converter para o fuso do servidor mostraria o dia 10 para quem marcou o dia 9. Então o dia sai
// dos dez primeiros caracteres, que são o calendário como o lojista o escreveu, e o resultado é o
// mesmo no servidor e no navegador (a formatação por fuso da máquina daria hidratação divergente).
// ═══════════════════════════════════════════════════════════════════════════
import type { PaginaDoLojista } from "@/lib/editable/document";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export interface DataDoArtigo {
  /** o valor cru do registro, como vai para `datetime`, `publishedTime` e `datePublished` */
  iso: string;
  /** "9 de setembro de 2026", para a linha de meta */
  porExtenso: string;
}

/** o dia por extenso a partir de uma data ISO, ou `null` quando ela não se lê */
function porExtenso(iso: string): string | null {
  const calendario = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (calendario) {
    const mes = MESES[Number(calendario[2]) - 1];
    if (mes) return `${Number(calendario[3])} de ${mes} de ${calendario[1]}`;
  }
  // formato que a régua aceitou e o recorte acima não lê: vale o instante, em UTC (determinístico
  // nos dois lados) em vez de não mostrar data nenhuma
  const quando = Date.parse(iso);
  if (!Number.isFinite(quando)) return null;
  const d = new Date(quando);
  const mes = MESES[d.getUTCMonth()];
  return mes ? `${d.getUTCDate()} de ${mes} de ${d.getUTCFullYear()}` : null;
}

/** a data de publicação do artigo (marcada, senão a de criação), ou `null` quando nenhuma das duas se lê */
export function dataDoArtigo(registro: Pick<PaginaDoLojista, "publicadoEm" | "criadoEm">): DataDoArtigo | null {
  const iso = registro.publicadoEm || registro.criadoEm;
  if (!iso) return null;
  const texto = porExtenso(iso);
  return texto ? { iso, porExtenso: texto } : null;
}
