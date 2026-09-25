"use client";

import { useEffect, useState } from "react";
import { Mail, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Caixa = {
  id: string;
  email: string;
  remetentes: string[];
  ultima_leitura_at: string | null;
  ultimo_erro: string | null;
};

// os dois e-mails da CB (interno e externo)
const REMETENTES_PADRAO = "candida.dnarchiveproject@gmail.com\ncandida@transeuntismundi.com";

// Linha C: quais contas do Google esse Plano lê, e de quem. Cada Plano
// tem as suas; o botão "Rodar prompt" e a rotina diária leem todas.
export function CaixasEmailDialog({ planoId }: { planoId: string }) {
  const [aberto, setAberto] = useState(false);
  const [caixas, setCaixas] = useState<Caixa[] | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [remetentes, setRemetentes] = useState(REMETENTES_PADRAO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    fetch(`/api/emails-cb/caixas?planoId=${planoId}`)
      .then((res) => res.json())
      .then((data) => setCaixas(data.caixas ?? []))
      .catch(() => setCaixas([]));
  }, [aberto, planoId]);

  async function handleConectar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const res = await fetch("/api/emails-cb/caixas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planoId, email, senha, remetentes: remetentes.split(/[\n,;]+/) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Não conectou: " + (data.error ?? res.status));
        return;
      }
      setCaixas((prev) => [...(prev ?? []).filter((c) => c.id !== data.caixa.id), data.caixa]);
      setEmail("");
      setSenha("");
      toast.success(`${data.caixa.email} conectado.`);
    } finally {
      setSalvando(false);
    }
  }

  async function handleRemover(caixa: Caixa) {
    if (!confirm(`Desconectar ${caixa.email} deste Plano?`)) return;
    const res = await fetch("/api/emails-cb/caixas", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planoId, id: caixa.id }),
    });
    if (!res.ok) {
      toast.error("Não desconectou.");
      return;
    }
    setCaixas((prev) => (prev ?? []).filter((c) => c.id !== caixa.id));
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground">
            <Mail className="size-3.5" />
            Contas de e-mail
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Contas de e-mail deste Plano</DialogTitle>
          <DialogDescription>
            O &quot;Rodar prompt&quot; da linha C lê essas caixas e traz o que os remetentes da lista mandaram.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {caixas === null && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {caixas?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta conectada ainda.</p>}
          {caixas?.map((caixa) => (
            <div key={caixa.id} className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{caixa.email}</p>
                <p className="truncate text-xs text-muted-foreground">de: {caixa.remetentes.join(", ")}</p>
                {caixa.ultimo_erro ? (
                  <p className="text-xs text-destructive">Erro na última leitura: {caixa.ultimo_erro}</p>
                ) : (
                  caixa.ultima_leitura_at && (
                    <p className="text-xs text-muted-foreground">
                      lida em {new Date(caixa.ultima_leitura_at).toLocaleString("pt-BR")}
                    </p>
                  )
                )}
              </div>
              <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => handleRemover(caixa)}>
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <form onSubmit={handleConectar} className="flex flex-col gap-3 border-t pt-4">
          <p className="text-sm font-medium">Conectar outra conta</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="caixa-email">E-mail da conta do Google</Label>
            <Input id="caixa-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="caixa-senha">Senha de app (16 letras)</Label>
            <Input
              id="caixa-senha"
              type="password"
              autoComplete="off"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Não é a senha normal. Gere em{" "}
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline">
                myaccount.google.com/apppasswords
              </a>{" "}
              logado nessa conta (precisa da verificação em duas etapas ligada).
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="caixa-remetentes">Ler só e-mails de (um por linha)</Label>
            <Textarea
              id="caixa-remetentes"
              rows={2}
              value={remetentes}
              onChange={(e) => setRemetentes(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={salvando}>
            {salvando ? "Testando a conta..." : "Conectar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
