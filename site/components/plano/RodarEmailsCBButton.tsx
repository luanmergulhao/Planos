"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Botão da linha C: lê a caixa de e-mail na hora e coloca no Plano o que
// a CB pediu (prompt "Resumo dos e-mails da CB") — o mesmo que o cron
// diário faz, só que sem esperar o dia seguinte.
export function RodarEmailsCBButton({ planoId, onAdicionados }: { planoId: string; onAdicionados: () => void }) {
  const [rodando, setRodando] = useState(false);

  async function handleClick() {
    setRodando(true);
    try {
      const res = await fetch("/api/emails-cb/rodar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planoId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Não deu pra ler os e-mails: " + (data.error ?? res.status));
        return;
      }
      if (data.lidos === 0) toast.success("Nenhum e-mail da CB nos últimos 7 dias.");
      else if (data.adicionados === 0) toast.success(`${data.lidos} e-mail(s) lido(s), nenhum novo.`);
      else toast.success(`${data.adicionados} e-mail(s) novo(s) no Plano.`);
      if (data.adicionados > 0) onAdicionados();
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
      title="Lê os e-mails da CB dos últimos 7 dias e coloca aqui o que ela pediu"
    >
      <RefreshCw className={rodando ? "size-3.5 animate-spin" : "size-3.5"} />
      {rodando ? "Rodando..." : "Rodar prompt"}
    </Button>
  );
}
