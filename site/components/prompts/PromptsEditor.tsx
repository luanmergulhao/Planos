"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PromptRow = {
  id: string;
  nome: string;
  descricao: string | null;
  conteudo: string;
  variaveis: string[];
  updated_at: string;
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

function PromptCard({
  prompt,
  currentUserId,
  onSaved,
}: {
  prompt: PromptRow;
  currentUserId: string;
  onSaved: (row: PromptRow) => void;
}) {
  const [texto, setTexto] = useState(prompt.conteudo);
  const [saving, setSaving] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const alterado = texto !== prompt.conteudo;

  async function handleSalvar() {
    setSaving(true);
    const { data, error } = await supabase
      .from("prompts")
      .update({ conteudo: texto, updated_by: currentUserId })
      .eq("id", prompt.id)
      .select("*")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error("Não salvou: " + (error?.message ?? "erro desconhecido"));
      return;
    }
    toast.success("Prompt salvo.");
    onSaved(data);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          {prompt.nome}
          <span className="text-xs font-normal text-muted-foreground">atualizado {timeAgo(prompt.updated_at)}</span>
        </CardTitle>
        {prompt.descricao && <p className="text-sm text-muted-foreground">{prompt.descricao}</p>}
        {prompt.variaveis.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {prompt.variaveis.map((v) => (
              <Badge key={v} variant="outline" className="font-mono text-xs">
                {`{{${v}}}`}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="min-h-48 font-mono text-sm"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSalvar} disabled={!alterado || saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
          {alterado && (
            <Button size="sm" variant="ghost" onClick={() => setTexto(prompt.conteudo)}>
              Descartar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PromptsEditor({ prompts: initialPrompts, currentUserId }: { prompts: PromptRow[]; currentUserId: string }) {
  const [prompts, setPrompts] = useState(initialPrompts);

  return (
    <div className="flex flex-col gap-4">
      {prompts.map((prompt) => (
        <PromptCard
          key={prompt.id}
          prompt={prompt}
          currentUserId={currentUserId}
          onSaved={(row) => setPrompts((prev) => prev.map((p) => (p.id === row.id ? row : p)))}
        />
      ))}
    </div>
  );
}
