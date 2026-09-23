"use client";

import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LinkedText } from "@/components/plano/EditableCell";
import { cn } from "@/lib/utils";
import type { CategoryMeta } from "@/lib/planos/categories";

// Linhas fixas de instrução que pedem "DATAR/ DEADLINE" saem em vermelho
// no original, junto com a marca MANUAL/PROMPT.
const EM_VERMELHO = /^DATAR/;

// Instruções da categoria (PROMPT/MANUAL) — texto fixo, igual pra todo
// mundo todo dia. Fica num ícone em vez de ocupar a coluna toda sempre.
export function CategoriaInfoPopover({ meta }: { meta: CategoryMeta }) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        render={
          <Button type="button" variant="ghost" size="icon" className="size-7" title={`Ver instruções (${meta.modo})`}>
            <Info className="size-4 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent className="w-80">
        <div className="flex flex-col gap-1 text-sm">
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
