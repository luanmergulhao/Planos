"use client";

import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { diaDoEmail } from "@/lib/planos/email-itens";
import { cn } from "@/lib/utils";
import type { ItemRow } from "@/components/plano/types";
import type { PlanoItemContent } from "@/lib/supabase/types";

// Linha C no formato da linha A: uma lista dos e-mails da CB com a tarefa
// de cada um. Marcar como feito risca o e-mail no dia; na cópia do dia
// seguinte ele já não vem.
export function EmailsPanel({
  items,
  canEdit,
  onUpdateItem,
  onDeleteItem,
}: {
  items: ItemRow[];
  canEdit: boolean;
  onUpdateItem: (itemId: string, patch: Partial<ItemRow>) => void;
  onDeleteItem: (itemId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm">E-MAILS DA CB</h3>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum e-mail com tarefa.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => {
            const content = item.content as PlanoItemContent;
            const feito = !!content.feito;
            const dia = diaDoEmail(content);

            return (
              <li key={item.id} className="group flex items-start gap-1.5 text-sm">
                <Button
                  variant={feito ? "secondary" : "outline"}
                  size="icon"
                  className="mt-0.5 size-5 shrink-0"
                  disabled={!canEdit}
                  title={feito ? "Desmarcar" : "Marcar como feito (risca e não vai pra amanhã)"}
                  onClick={() => onUpdateItem(item.id, { content: { ...content, feito: !feito } })}
                >
                  {feito && <Check className="size-3" />}
                </Button>
                <span className={cn("flex-1", feito && "text-muted-foreground line-through")}>
                  {dia && <span className="text-muted-foreground">{dia} · </span>}
                  <span className="font-medium">{content.titulo}</span>
                  {content.tarefa && <> — {content.tarefa}</>}
                </span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100"
                    title="Apagar (não era tarefa)"
                    onClick={() => onDeleteItem(item.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
