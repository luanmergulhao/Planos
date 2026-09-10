"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EditalCard } from "@/components/editais/EditalCard";
import { NovoEditalDialog } from "@/components/editais/NovoEditalDialog";
import { EditalCommentSheet } from "@/components/editais/EditalCommentSheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACTIVE_FASES } from "@/lib/editais";
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

  async function handleCreate(input: { titulo: string; link: string | null; deadline_at: string | null }) {
    const { data, error } = await supabase
      .from("editais")
      .insert({ ...input, created_by: currentUserId, updated_by: currentUserId })
      .select("*")
      .single();
    if (!error && data) setEditais((prev) => [...prev, data]);
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Triagem de Editais</h1>
          <p className="text-muted-foreground">Quadro compartilhado — a equipe toda vê e edita junto.</p>
        </div>
        <NovoEditalDialog onCreate={handleCreate} />
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
          onClose={() => setActiveCommentEditalId(null)}
        />
      )}
    </div>
  );
}
