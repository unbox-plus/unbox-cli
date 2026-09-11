import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <h1 className="mt-3">Página não encontrada</h1>
      {/* A frase cobre os três 404 da loja: produto fora do catálogo, endereço digitado errado e
          página do lojista que saiu do ar (oculta, agendada ou excluída). Antes dizia só "produto",
          e quem chegava aqui por um link de artigo lia uma explicação que não era a dele. */}
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        A página pode ter saído do ar, o produto pode ter saído do catálogo, ou o endereço está incorreto.
      </p>
      <div className="mt-6 flex gap-2">
        <Button nativeButton={false} render={<Link href="/" />}>Voltar ao início</Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/produtos" />}>Ver produtos</Button>
      </div>
    </div>
  );
}
