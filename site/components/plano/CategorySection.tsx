"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanoItemRow } from "@/components/plano/PlanoItemRow";
import { DeadlinesPanel } from "@/components/plano/DeadlinesPanel";
import { CategoriaInfoPopover } from "@/components/plano/CategoriaInfoPopover";
import { AtualizarDeadlinesButton } from "@/components/plano/AtualizarDeadlinesButton";
import { RodarEmailsCBButton } from "@/components/plano/RodarEmailsCBButton";
import { CELULA, LINHA, ROTULO } from "@/components/plano/grid";
import { CATEGORY_META, categoryLabel } from "@/lib/planos/categories";
import { cn } from "@/lib/utils";
import type { CategoryRow, ItemRow } from "@/components/plano/types";
import type { DeadlinesComRevisao } from "@/lib/planos/deadlines";

export function CategorySection({
  category,
  items,
  canEdit,
  isManager,
  deadlines,
  planoId,
  onRecarregarItens,
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
  planoId: string;
  onRecarregarItens: () => void;
  onAddItem: () => void;
  onUpdateItem: (itemId: string, patch: Partial<ItemRow>) => void;
  onDeleteItem: (itemId: string) => void;
  onToggleRiscado: (itemId: string, riscado: boolean) => void;
  onOpenComments: (itemId: string) => void;
}) {
  const meta = CATEGORY_META[category.code];

  return (
    <>
      <div className={LINHA}>
        <div className={cn(CELULA, "flex flex-col items-start gap-1.5")}>
          <div className="flex w-full items-start justify-between gap-1">
            <span className={cn(ROTULO, "text-sm")}>{categoryLabel(category.code, category.label)}</span>
            {meta && <CategoriaInfoPopover meta={meta} />}
          </div>
          {category.code === "A" && <AtualizarDeadlinesButton />}
          {category.code === "C" && canEdit && (
            <RodarEmailsCBButton planoId={planoId} onAdicionados={onRecarregarItens} />
          )}
        </div>

        <div className={CELULA}>
          {deadlines && <DeadlinesPanel deadlines={deadlines} />}
          {canEdit && (
            <Button variant="ghost" size="sm" className="-ml-1 mt-1 h-7 text-xs text-muted-foreground" onClick={onAddItem}>
              <Plus className="size-3.5" />
              Nova tarefa
            </Button>
          )}
        </div>
      </div>

      {items.map((item) => (
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
      ))}
    </>
  );
}
