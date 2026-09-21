"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanoAbaRow } from "@/components/plano/types";

function Aba({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px max-w-56 truncate border-b-2 px-3 py-2 text-sm transition-colors",
        ativa ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// Abas do Plano: a primeira ("Plano") é a tabela do dia; as outras são
// blocos de notas criados por quem edita o Plano.
export function BarraDeAbas({
  abas,
  ativa,
  canEdit,
  criando,
  onSelecionar,
  onCriar,
}: {
  abas: PlanoAbaRow[];
  ativa: string | null;
  canEdit: boolean;
  criando: boolean;
  onSelecionar: (id: string | null) => void;
  onCriar: () => void;
}) {
  // quem só visualiza e não tem aba nenhuma não precisa ver a barra
  if (abas.length === 0 && !canEdit) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b">
      <Aba ativa={ativa === null} onClick={() => onSelecionar(null)}>
        Plano
      </Aba>
      {abas.map((aba) => (
        <Aba key={aba.id} ativa={ativa === aba.id} onClick={() => onSelecionar(aba.id)}>
          {aba.titulo}
        </Aba>
      ))}
      {canEdit && (
        <Button variant="ghost" size="icon" className="size-8" title="Nova aba" disabled={criando} onClick={onCriar}>
          <Plus className="size-4" />
        </Button>
      )}
    </div>
  );
}
