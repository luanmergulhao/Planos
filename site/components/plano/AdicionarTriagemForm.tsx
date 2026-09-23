"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdicionarTriagemForm() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [dia, setDia] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const res = await fetch("/api/triagem/adicionar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nome, dia }),
    });
    const data = await res.json().catch(() => ({}));
    setEnviando(false);
    if (!res.ok) {
      toast.error("Não deu pra adicionar na agenda: " + (data.error ?? "erro"));
      return;
    }
    toast.success("Evento criado na agenda.");
    setNome("");
    setDia("");
    setAberto(false);
    router.refresh();
  }

  if (!aberto) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setAberto(true)}>
        + Adicionar triagem
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-md border p-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="triagem-nome" className="text-xs text-muted-foreground">
          Nome do edital
        </Label>
        <Input id="triagem-nome" value={nome} onChange={(e) => setNome(e.target.value)} required className="h-8 w-56" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="triagem-dia" className="text-xs text-muted-foreground">
          Prazo
        </Label>
        <Input id="triagem-dia" type="date" value={dia} onChange={(e) => setDia(e.target.value)} required className="h-8" />
      </div>
      <Button type="submit" size="sm" disabled={enviando}>
        Salvar
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>
        Cancelar
      </Button>
    </form>
  );
}
