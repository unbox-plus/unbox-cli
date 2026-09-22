"use client";
// A LOJA PADRÃO na página de privacidade: o direito de oposição à personalização por público (LGPD, art. 18).
// Quem pede vê a versão de Todos, e nenhum sinal automático o tira de lá (`useLojaPadrao`).
import { Button } from "@/components/ui/button";
import { useLojaPadrao } from "@/lib/editable/publico";

export function LojaPadrao() {
  const { recusou, recusar, voltar } = useLojaPadrao();
  // antes de ler o cookie o botão não diz nada: a página é a mesma para todo mundo (cache), e a primeira pintura
  // não sabe de que lado a pessoa está. A altura fica reservada para nada pular quando ele aparece.
  if (recusou === null) return <div className="h-8" aria-hidden />;
  // os dois estados com o MESMO botão: o de voltar é tão importante quanto o de sair, e link solto no meio do
  // texto jurídico não parece clicável
  return recusou ? (
    <div className="flex flex-col items-start gap-2">
      <p className="m-0">Você está vendo a loja padrão, sem personalização.</p>
      <Button variant="outline" onClick={voltar}>
        Voltar a ver as versões por interesse
      </Button>
    </div>
  ) : (
    <Button variant="outline" onClick={recusar}>
      Ver a loja padrão, sem personalização
    </Button>
  );
}
