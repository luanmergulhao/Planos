"use client";

import { useState } from "react";
import { MessageSquare, Strikethrough, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { itemCode } from "@/lib/planos/categories";
import { getDeadlineUrgency, URGENCY_LABEL } from "@/lib/time/urgency";
import { cn } from "@/lib/utils";
import type { ItemRow } from "@/components/plano/types";
import type { PlanoItemContent } from "@/lib/supabase/types";

export function PlanoItemRow({
  item,
  categoryCode,
  canEdit,
  isManager,
  onUpdate,
  onDelete,
  onToggleRiscado,
  onOpenComments,
}: {
  item: ItemRow;
  categoryCode: string;
  canEdit: boolean;
  isManager: boolean;
  onUpdate: (patch: Partial<ItemRow>) => void;
  onDelete: () => void;
  onToggleRiscado: (riscado: boolean) => void;
  onOpenComments: () => void;
}) {
  const content = item.content as PlanoItemContent;
  const [titulo, setTitulo] = useState(content.titulo ?? "");
  const [tarefa, setTarefa] = useState(content.tarefa ?? "");
  const [links, setLinks] = useState(content.links ?? "");

  function commitContent(patch: Partial<PlanoItemContent>) {
    onUpdate({ content: { ...content, ...patch } });
  }

  // Riscado (só manager) é o único jeito de tirar a tarefa da cópia do
  // próximo dia — não é derivado de status nenhum.
  const urgency = item.riscado ? null : getDeadlineUrgency(item.deadline_at);

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-[auto_1.2fr_1.4fr_1fr_auto]",
        item.riscado && "bg-muted/40"
      )}
    >
      <div className="flex items-center gap-2 md:flex-col md:items-start">
        <Badge variant="outline" className="shrink-0">
          {itemCode(categoryCode, item.item_number)}
        </Badge>
        {isManager && (
          <Button
            variant={item.riscado ? "secondary" : "ghost"}
            size="icon"
            className="size-7"
            title={item.riscado ? "Desriscar" : "Riscar (não entra na cópia de amanhã)"}
            onClick={() => onToggleRiscado(!item.riscado)}
          >
            <Strikethrough className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Título</span>
        <Textarea
          value={titulo}
          disabled={!canEdit}
          placeholder="Título"
          className={cn("min-h-9 resize-none", item.riscado && "line-through opacity-60")}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={() => commitContent({ titulo })}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={item.deadline_at ?? ""}
            disabled={!canEdit}
            className="h-7 w-36 text-xs"
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
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Tarefa pedida</span>
        <Textarea
          value={tarefa}
          disabled={!canEdit}
          placeholder="O que precisa ser feito..."
          className={cn("min-h-9 flex-1 resize-none", item.riscado && "line-through opacity-60")}
          onChange={(e) => setTarefa(e.target.value)}
          onBlur={() => commitContent({ tarefa })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Links/informações</span>
        <Textarea
          value={links}
          disabled={!canEdit}
          placeholder="Links, informações..."
          className={cn("min-h-9 flex-1 resize-none", item.riscado && "line-through opacity-60")}
          onChange={(e) => setLinks(e.target.value)}
          onBlur={() => commitContent({ links })}
        />
      </div>

      <div className="flex shrink-0 items-start gap-1">
        <Button variant="ghost" size="icon" onClick={onOpenComments}>
          <MessageSquare className="size-4" />
        </Button>
        {canEdit && (
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
