"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1>Algo deu errado</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Tivemos um problema ao carregar esta página. Tente novamente em instantes.
      </p>
      <Button className="mt-6" onClick={() => reset()}>Tentar novamente</Button>
    </div>
  );
}
