"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanoItemRow } from "@/components/plano/PlanoItemRow";
import { DeadlinesPanel } from "@/components/plano/DeadlinesPanel";
import { TriagemPanel } from "@/components/plano/TriagemPanel";
import type { CategoryRow, ItemRow } from "@/components/plano/types";
import type { DeadlinesComRevisao } from "@/lib/planos/deadlines";
import type { TriagensLinhaE } from "@/lib/planos/triagens";

export function CategorySection({
  category,
  items,
  canEdit,
  isManager,
  deadlines,
  triagens,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onToggleRiscado,
  onOpenComments,
}: {
  category: CategoryRow;
  items: ItemRow[];
  canEdit: boolean;
  isManager: boolean;
  deadlines: DeadlinesComRevisao | null;
  triagens: TriagensLinhaE | null;
  onAddItem: () => void;
  onUpdateItem: (itemId: string, patch: Partial<ItemRow>) => void;
  onDeleteItem: (itemId: string) => void;
  onToggleRiscado: (itemId: string, riscado: boolean) => void;
  onOpenComments: (itemId: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {category.code}. {category.label}
        </CardTitle>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={onAddItem}>
            <Plus className="size-4" />
            Nova tarefa
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {deadlines && <DeadlinesPanel deadlines={deadlines} />}
        {triagens && <TriagemPanel triagens={triagens} />}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa ainda nessa categoria.</p>
        ) : (
          items.map((item) => (
            <PlanoItemRow
              key={item.id}
              item={item}
              categoryCode={category.code}
              canEdit={canEdit}
              isManager={isManager}
              onUpdate={(patch) => onUpdateItem(item.id, patch)}
              onDelete={() => onDeleteItem(item.id)}
              onToggleRiscado={(riscado) => onToggleRiscado(item.id, riscado)}
              onOpenComments={() => onOpenComments(item.id)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
