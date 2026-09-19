"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TRIAGEM_FIELDS, type TriagemResult } from "@/lib/ai/triagem-campos";

type Step = "link" | "loading" | "review" | "error";

export function TriagemIADialog({
  onCreate,
}: {
  onCreate: (input: {
    titulo: string;
    link: string | null;
    deadline_at: string | null;
    respostas: TriagemResult;
  }) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("link");
  const [link, setLink] = useState("");
  const [result, setResult] = useState<TriagemResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setStep("link");
    setLink("");
    setResult(null);
    setErrorMessage("");
  }

  async function handleAnalyze() {
    if (!link.trim()) return;
    setStep("loading");
    try {
      const res = await fetch("/api/editais/triagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: link.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "erro desconhecido");
      setResult(data.result);
      setStep("review");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "erro desconhecido");
      setStep("error");
    }
  }

  function updateField(key: keyof TriagemResult, value: string) {
    setResult((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleConfirm() {
    if (!result) return;
    setSaving(true);
    await onCreate({
      titulo: result.nome_edital || link,
      link: result.link_principal || link,
      deadline_at: result.deadline_iso_date || null,
      respostas: result,
    });
    setSaving(false);
    setOpen(false);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Sparkles className="size-4" />
            Triagem com IA
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Triagem com IA</DialogTitle>
          <DialogDescription>
            Cola o link do edital — a IA lê e responde as perguntas da triagem. Revise antes de criar.
          </DialogDescription>
        </DialogHeader>

        {(step === "link" || step === "loading" || step === "error") && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="triagem-link">Link do edital</Label>
              <Input
                id="triagem-link"
                placeholder="https://..."
                value={link}
                disabled={step === "loading"}
                onChange={(e) => setLink(e.target.value)}
              />
            </div>
            {step === "error" && <p className="text-sm text-destructive">Não deu: {errorMessage}</p>}
            <Button onClick={handleAnalyze} disabled={!link.trim() || step === "loading"}>
              {step === "loading" ? "Analisando..." : "Analisar"}
            </Button>
          </div>
        )}

        {step === "review" && result && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Confira as respostas abaixo — pode corrigir qualquer campo antes de criar o edital.
            </p>
            {TRIAGEM_FIELDS.map((field) => (
              <div key={field.key} className="flex flex-col gap-1">
                <Label htmlFor={`triagem-${field.key}`}>{field.label}</Label>
                <Textarea
                  id={`triagem-${field.key}`}
                  value={result[field.key] ?? ""}
                  className="min-h-9 text-sm"
                  onChange={(e) => updateField(field.key, e.target.value)}
                />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <Label htmlFor="triagem-deadline-iso">Prazo (data, pro sistema controlar)</Label>
              <Input
                id="triagem-deadline-iso"
                type="date"
                value={result.deadline_iso_date ?? ""}
                onChange={(e) => updateField("deadline_iso_date", e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("link")}>
                Voltar
              </Button>
              <Button onClick={handleConfirm} disabled={saving} className="flex-1">
                {saving ? "Criando..." : "Criar edital com essas respostas"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
