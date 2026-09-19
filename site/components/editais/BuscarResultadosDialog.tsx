"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TIPO_RESULTADO_LABEL, type ResultadoFinding } from "@/lib/ai/resultados-tipos";

type Finding = ResultadoFinding & { titulo: string };

type Step = "idle" | "loading" | "done" | "error";

export function BuscarResultadosDialog({
  disabled,
  onSave,
}: {
  disabled: boolean;
  onSave: (
    editalId: string,
    resultadoInfo: ResultadoFinding,
    markConcluded: boolean
  ) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  async function handleSearch() {
    setStep("loading");
    try {
      const res = await fetch("/api/editais/resultados", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "erro desconhecido");
      setFindings(data.findings ?? []);
      setStep("done");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "erro desconhecido");
      setStep("error");
    }
  }

  async function handleSave(finding: Finding, markConcluded: boolean) {
    await onSave(finding.id, finding, markConcluded);
    setSavedIds((prev) => new Set(prev).add(finding.id));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setStep("idle");
          setFindings([]);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" disabled={disabled}>
            <Search className="size-4" />
            Buscar resultados
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buscar resultados</DialogTitle>
          <DialogDescription>
            A IA pesquisa na internet pelos editais em Deadline/Deadline prorrogado, procurando resultados,
            homologações e afins.
          </DialogDescription>
        </DialogHeader>

        {step === "idle" && (
          <Button onClick={handleSearch}>
            <Search className="size-4" />
            Pesquisar agora
          </Button>
        )}

        {step === "loading" && <p className="text-sm text-muted-foreground">Pesquisando... pode levar um minuto.</p>}

        {step === "error" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-destructive">Não deu: {errorMessage}</p>
            <Button variant="outline" onClick={() => setStep("idle")}>
              Tentar de novo
            </Button>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col gap-4">
            {findings.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum edital em Deadline/Deadline prorrogado pra pesquisar no momento.
              </p>
            )}
            {findings.map((finding) => (
              <div key={finding.id} className="flex flex-col gap-2 rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{finding.titulo}</span>
                  <Badge variant={finding.tipo_resultado === "nao_localizado" ? "secondary" : "default"}>
                    {TIPO_RESULTADO_LABEL[finding.tipo_resultado]}
                  </Badge>
                </div>
                {finding.data_divulgacao && (
                  <p className="text-xs text-muted-foreground">Divulgado em {finding.data_divulgacao}</p>
                )}
                {finding.publicacao && <p className="text-sm">{finding.publicacao}</p>}
                {finding.detalhamento && <p className="text-sm text-muted-foreground">{finding.detalhamento}</p>}
                {finding.link && (
                  <a
                    href={finding.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    Ver publicação
                  </a>
                )}

                {finding.tipo_resultado !== "nao_localizado" && (
                  <div className="flex gap-2 pt-1">
                    {savedIds.has(finding.id) ? (
                      <Badge variant="secondary">Salvo</Badge>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleSave(finding, false)}>
                          Salvar informação
                        </Button>
                        <Button size="sm" onClick={() => handleSave(finding, true)}>
                          Marcar como concluído
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
