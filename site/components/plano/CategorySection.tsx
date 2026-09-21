"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanoItemRow } from "@/components/plano/PlanoItemRow";
import { DeadlinesPanel } from "@/components/plano/DeadlinesPanel";
import { TriagemPanel } from "@/components/plano/TriagemPanel";
import { LinkedText } from "@/components/plano/EditableCell";
import { CELULA, LINHA, ROTULO } from "@/components/plano/grid";
import { CATEGORY_META, categoryLabel } from "@/lib/planos/categories";
import { cn } from "@/lib/utils";
import type { CategoryRow, ItemRow } from "@/components/plano/types";
import type { DeadlinesComRevisao } from "@/lib/planos/deadlines";
import type { TriagensLinhaE } from "@/lib/planos/triagens";

// Linhas fixas de instrução que pedem "DATAR/ DEADLINE" saem em vermelho
// no original, junto com a marca MANUAL/PROMPT.
const EM_VERMELHO = /^DATAR/;

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
  const meta = CATEGORY_META[category.code];

  return (
    <>
      <div className={LINHA}>
        <div className={cn(CELULA, ROTULO, "text-sm")}>{categoryLabel(category.code, category.label)}</div>

        <div className={CELULA}>
          {deadlines && <DeadlinesPanel deadlines={deadlines} />}
          {triagens && <TriagemPanel triagens={triagens} />}
          {canEdit && (
            <Button variant="ghost" size="sm" className="-ml-1 mt-1 h-7 text-xs text-muted-foreground" onClick={onAddItem}>
              <Plus className="size-3.5" />
              Nova tarefa
            </Button>
          )}
        </div>

        <div className={cn(CELULA, "flex flex-col gap-1 text-sm")}>
          {meta && (
            <>
              <span className="font-bold text-red-600 dark:text-red-400">{meta.modo}</span>
              {meta.instrucoes.map((linha, i) => (
                <p
                  key={i}
                  className={cn(
                    "whitespace-pre-wrap",
                    (meta.destaque || EM_VERMELHO.test(linha)) && "text-red-600 dark:text-red-400"
                  )}
                >
                  <LinkedText text={linha} />
                </p>
              ))}
            </>
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
