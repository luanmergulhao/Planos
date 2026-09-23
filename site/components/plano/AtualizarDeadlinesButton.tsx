"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Botão da linha A: roda de uma vez a conferência de prorrogação (prompt
// PRORROGAÇÃO) em todo deadline D/DP com link salvo, desta semana até ~2
// meses à frente — mesma lógica do cron diário, só que na hora.
export function AtualizarDeadlinesButton() {
  const router = useRouter();
  const [rodando, setRodando] = useState(false);

  async function handleClick() {
    setRodando(true);
    try {
      const res = await fetch("/api/deadlines/revisar-tudo", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Não deu pra atualizar: " + (data.error ?? res.status));
        return;
      }
      const partes = [`${data.revisados} conferido(s)`];
      if (data.prorrogados > 0) partes.push(`${data.prorrogados} prorrogado(s)`);
      if (data.semLink > 0) partes.push(`${data.semLink} sem link pra conferir`);
      toast.success(partes.join(", ") + ".");
      router.refresh();
    } finally {
      setRodando(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 gap-1 text-xs"
      disabled={rodando}
      onClick={handleClick}
      title="Roda o prompt de prorrogação em todo deadline com link salvo, desta semana até ~2 meses à frente"
    >
      <RefreshCw className={rodando ? "size-3.5 animate-spin" : "size-3.5"} />
      {rodando ? "Rodando..." : "Rodar prompt"}
    </Button>
  );
}
