"use client";

import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EditableCell } from "@/components/plano/EditableCell";
import { cn } from "@/lib/utils";

// A terceira coluna do Plano (detalhes/links) fica só com um ícone: passar
// o mouse ou clicar abre o conteúdo, em vez de mostrar tudo por extenso na
// linha. O ícone muda de cor quando já tem alguma coisa escrita.
export function DetalhesPopover({
  value,
  canEdit,
  riscado,
  onCommit,
}: {
  value: string;
  canEdit: boolean;
  riscado?: boolean;
  onCommit: (texto: string) => void;
}) {
  const temConteudo = value.trim().length > 0;

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            title={temConteudo ? "Ver detalhes" : "Adicionar detalhes"}
          >
            <Info className={cn("size-4", temConteudo ? "text-foreground" : "text-muted-foreground")} />
          </Button>
        }
      />
      <PopoverContent className="w-80">
        <EditableCell value={value} canEdit={canEdit} placeholder="detalhes, links" riscado={riscado} onCommit={onCommit} />
      </PopoverContent>
    </Popover>
  );
}
