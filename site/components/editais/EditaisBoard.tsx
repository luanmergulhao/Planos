"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EditalCard } from "@/components/editais/EditalCard";
import { NovoEditalDialog } from "@/components/editais/NovoEditalDialog";
import { TriagemIADialog } from "@/components/editais/TriagemIADialog";
import { BuscarResultadosDialog } from "@/components/editais/BuscarResultadosDialog";
import { EditalCommentSheet } from "@/components/editais/EditalCommentSheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ACTIVE_FASES } from "@/lib/editais";
import type { ResultadoFinding } from "@/lib/ai/resultados";
import type { EditalRow } from "@/components/editais/types";
import type { TeamProfile } from "@/components/plano/types";

function sortByDeadline(a: EditalRow, b: EditalRow) {
  if (!a.deadline_at && !b.deadline_at) return 0;
  if (!a.deadline_at) return 1;
  if (!b.deadline_at) return -1;
  return a.deadline_at.localeCompare(b.deadline_at);
}

export function EditaisBoard({
  editais: initialEditais,
  teamProfiles,
  currentUserId,
  isManager,
}: {
  editais: EditalRow[];
  teamProfiles: TeamProfile[];
  currentUserId: string;
  isManager: boolean;
}) {
  const [editais, setEditais] = useState(initialEditais);
  const [showFinished, setShowFinished] = useState(false);
  const [activeCommentEditalId, setActiveCommentEditalId] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const active = editais.filter((e) => ACTIVE_FASES.includes(e.fase)).sort(sortByDeadline);
  const finished = editais.filter((e) => !ACTIVE_FASES.includes(e.fase)).sort(sortByDeadline);

  async function handleCreate(input: Partial<EditalRow> & { titulo: string }) {
    const { data, error } = await supabase
      .from("editais")
      .insert({ ...input, created_by: currentUserId, updated_by: currentUserId })
      .select("*")
      .single();
    if (!error && data) setEditais((prev) => [...prev, data]);
    if (error) toast.error("Não deu pra criar: " + error.message);
  }

  async function handleUpdate(id: string, patch: Partial<EditalRow>) {
    setEditais((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    await supabase
      .from("editais")
      .update({ ...patch, updated_by: currentUserId })
      .eq("id", id);
  }

  async function handleDelete(id: string) {
    setEditais((prev) => prev.filter((e) => e.id !== id));
    await supabase.from("editais").delete().eq("id", id);
  }

  async function handleSaveResultado(editalId: string, resultadoInfo: ResultadoFinding, markConcluded: boolean) {
    const patch: Partial<EditalRow> = { resultado_info: resultadoInfo };
    if (markConcluded) patch.fase = "CONCLUIDO";
    await handleUpdate(editalId, patch);
  }

  const aguardandoResultado = editais.filter((e) => e.fase === "D" || e.fase === "DP").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Triagem de Editais</h1>
          <p className="text-muted-foreground">Quadro compartilhado — a equipe toda vê e edita junto.</p>
        </div>
        <div className="flex gap-2">
          <BuscarResultadosDialog disabled={aguardandoResultado === 0} onSave={handleSaveResultado} />
          <TriagemIADialog onCreate={handleCreate} />
          <NovoEditalDialog onCreate={handleCreate} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Em andamento</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum edital em triagem no momento.</p>
          ) : (
            active.map((edital) => (
              <EditalCard
                key={edital.id}
                edital={edital}
                canDelete={isManager || edital.created_by === currentUserId}
                onUpdate={(patch) => handleUpdate(edital.id, patch)}
                onDelete={() => handleDelete(edital.id)}
                onOpenComments={() => setActiveCommentEditalId(edital.id)}
              />
            ))
          )}
        </CardContent>
      </Card>

      <div>
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setShowFinished((v) => !v)}
        >
          {showFinished ? "Esconder" : "Mostrar"} concluídos e descartados ({finished.length})
        </button>
        {showFinished && (
          <Card className="mt-2">
            <CardContent className="flex flex-col gap-2 pt-4">
              {finished.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>
              ) : (
                finished.map((edital) => (
                  <EditalCard
                    key={edital.id}
                    edital={edital}
                    canDelete={isManager || edital.created_by === currentUserId}
                    onUpdate={(patch) => handleUpdate(edital.id, patch)}
                    onDelete={() => handleDelete(edital.id)}
                    onOpenComments={() => setActiveCommentEditalId(edital.id)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {activeCommentEditalId && (
        <EditalCommentSheet
          editalId={activeCommentEditalId}
          teamProfiles={teamProfiles}
          currentUserId={currentUserId}
          isManager={isManager}
          onClose={() => setActiveCommentEditalId(null)}
        />
      )}
    </div>
  );
}
