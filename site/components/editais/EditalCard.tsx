"use client";

import { useState } from "react";
import { ExternalLink, MessageSquare, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDeadlineUrgency, URGENCY_LABEL } from "@/lib/time/urgency";
import { FASE_LABEL } from "@/lib/editais";
import { TRIAGEM_FIELDS } from "@/lib/ai/triagem";
import type { EditalFase, EditalRow } from "@/components/editais/types";

export function EditalCard({
  edital,
  canDelete,
  onUpdate,
  onDelete,
  onOpenComments,
}: {
  edital: EditalRow;
  canDelete: boolean;
  onUpdate: (patch: Partial<EditalRow>) => void;
  onDelete: () => void;
  onOpenComments: () => void;
}) {
  const [titulo, setTitulo] = useState(edital.titulo);
  const [link, setLink] = useState(edital.link ?? "");
  const [observacoes, setObservacoes] = useState(edital.observacoes ?? "");
  const [showTriagem, setShowTriagem] = useState(false);

  const respostas = edital.respostas as Record<string, string> | null;
  const hasTriagem = respostas && Object.keys(respostas).length > 0;

  const urgency =
    edital.fase === "CONCLUIDO" || edital.fase === "DESCARTADO" ? null : getDeadlineUrgency(edital.deadline_at);

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-start gap-3">
        <Select value={edital.fase} onValueChange={(value) => onUpdate({ fase: value as EditalFase })}>
          <SelectTrigger className="mt-0.5 w-36 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FASE_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={titulo}
          className="flex-1 font-medium"
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={() => onUpdate({ titulo })}
        />
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onOpenComments}>
            <MessageSquare className="size-4" />
          </Button>
          {canDelete && (
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-[9.5rem] text-sm">
        <Input
          type="date"
          value={edital.deadline_at ?? ""}
          className="w-40"
          onChange={(e) => onUpdate({ deadline_at: e.target.value || null })}
        />
        {urgency && (
          <Badge
            variant={urgency === "overdue" ? "destructive" : "outline"}
            className={urgency === "week" ? "border-amber-500/50 text-amber-600 dark:text-amber-400" : undefined}
          >
            {URGENCY_LABEL[urgency]}
          </Badge>
        )}
        <Input
          placeholder="Link do edital"
          value={link}
          className="min-w-48 flex-1"
          onChange={(e) => setLink(e.target.value)}
          onBlur={() => onUpdate({ link: link || null })}
        />
        {edital.link && (
          <Button variant="ghost" size="icon" render={<a href={edital.link} target="_blank" rel="noreferrer" />}>
            <ExternalLink className="size-4" />
          </Button>
        )}
      </div>

      <Textarea
        placeholder="Observações..."
        value={observacoes}
        className="ml-[9.5rem] min-h-9 resize-none text-sm"
        onChange={(e) => setObservacoes(e.target.value)}
        onBlur={() => onUpdate({ observacoes: observacoes || null })}
      />

      {hasTriagem && (
        <div className="ml-[9.5rem]">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowTriagem((v) => !v)}
          >
            <Sparkles className="size-3.5" />
            {showTriagem ? "Esconder" : "Ver"} respostas da triagem
          </button>
          {showTriagem && (
            <dl className="mt-2 flex flex-col gap-2 rounded-md bg-muted/50 p-3 text-sm">
              {TRIAGEM_FIELDS.map((field) => {
                const value = respostas?.[field.key];
                if (!value) return null;
                return (
                  <div key={field.key}>
                    <dt className="text-xs font-medium text-muted-foreground">{field.label}</dt>
                    <dd className="whitespace-pre-wrap">{value}</dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
