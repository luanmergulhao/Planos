"use client";

import { MessageSquare, Strikethrough, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditableCell } from "@/components/plano/EditableCell";
import { CELULA, LINHA, ROTULO } from "@/components/plano/grid";
import { itemCode } from "@/lib/planos/categories";
import { getDeadlineUrgency, URGENCY_LABEL } from "@/lib/time/urgency";
import { cn } from "@/lib/utils";
import type { ItemRow } from "@/components/plano/types";
import type { PlanoItemContent } from "@/lib/supabase/types";

// No Google não há botões nem campo de data em cada linha; aqui eles só
// aparecem com o mouse em cima (no celular ficam sempre visíveis).
const REVELAR_NO_HOVER =
  "md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-within:opacity-100";

// Uma tarefa numerada (D1, G2...) — as colunas seguem o Plano do Google:
// 1) código e título, 2) o que está sendo feito, 3) detalhes e links.
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

  function commitContent(patch: Partial<PlanoItemContent>) {
    onUpdate({ content: { ...content, ...patch } });
  }

  // Riscado (só manager) é o único jeito de tirar a tarefa da cópia do
  // próximo dia — não é derivado de status nenhum.
  const urgency = item.riscado ? null : getDeadlineUrgency(item.deadline_at);

  return (
    <div className={cn(LINHA, "group", item.riscado && "bg-muted/40")}>
      <div className={CELULA}>
        <div className="flex items-start gap-1">
          <span className={cn(ROTULO, "shrink-0 py-1 text-sm", item.riscado && "line-through opacity-60")}>
            {itemCode(categoryCode, item.item_number)}.
          </span>
          <EditableCell
            value={content.titulo ?? ""}
            canEdit={canEdit}
            placeholder="Título"
            riscado={item.riscado}
            className={cn(ROTULO, "flex-1")}
            onCommit={(titulo) => commitContent({ titulo })}
          />
        </div>
        <div className={cn("mt-1 flex items-center gap-0.5", REVELAR_NO_HOVER)}>
          <Button variant="ghost" size="icon" className="size-7" title="Comentários" onClick={onOpenComments}>
            <MessageSquare className="size-3.5" />
          </Button>
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
          {canEdit && (
            <Button variant="ghost" size="icon" className="size-7" title="Apagar tarefa" onClick={onDelete}>
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className={CELULA}>
        <EditableCell
          value={content.tarefa ?? ""}
          canEdit={canEdit}
          placeholder="dd/mm - o que está sendo feito"
          riscado={item.riscado}
          onCommit={(tarefa) => commitContent({ tarefa })}
        />
        {(canEdit || item.deadline_at) && (
          <div className={cn("mt-1 flex flex-wrap items-center gap-2 px-1.5", !item.deadline_at && REVELAR_NO_HOVER)}>
            <Input
              type="date"
              value={item.deadline_at ?? ""}
              disabled={!canEdit}
              title="Prazo (gera os avisos de vencimento)"
              className="h-6 w-32 px-1.5 text-xs"
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
        )}
      </div>

      <div className={CELULA}>
        <EditableCell
          value={content.links ?? ""}
          canEdit={canEdit}
          placeholder="detalhes, links"
          riscado={item.riscado}
          onCommit={(links) => commitContent({ links })}
        />
      </div>
    </div>
  );
}
