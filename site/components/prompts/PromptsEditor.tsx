"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/lib/supabase/types";

type PromptRow = Database["public"]["Tables"]["prompts"]["Row"];

function Prompt({
  prompt,
  padrao,
  currentUserId,
}: {
  prompt: PromptRow;
  padrao: string | undefined;
  currentUserId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [texto, setTexto] = useState(prompt.conteudo);
  const [salvo, setSalvo] = useState(prompt.conteudo);
  const [salvando, setSalvando] = useState(false);

  const mudou = texto !== salvo;

  async function salvar(novo: string) {
    setSalvando(true);
    const { error } = await supabase
      .from("prompts")
      .update({ conteudo: novo, updated_by: currentUserId, updated_at: new Date().toISOString() })
      .eq("id", prompt.id);
    setSalvando(false);

    if (error) {
      toast.error("Não salvou: " + error.message);
      return;
    }
    setTexto(novo);
    setSalvo(novo);
    toast.success("Prompt salvo. Vale a partir da próxima vez que a IA rodar.");
  }

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">{prompt.nome}</CardTitle>
        {prompt.descricao && <p className="text-sm text-muted-foreground">{prompt.descricao}</p>}
        {prompt.variaveis.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground">
              Escreva assim no texto e o site troca pelo valor de verdade:
            </span>
            {prompt.variaveis.map((v) => (
              <Badge key={v} variant="secondary" className="font-mono text-xs">
                {`{{${v}}}`}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        <Textarea
          value={texto}
          className="min-h-72 font-mono text-xs"
          onChange={(e) => setTexto(e.target.value)}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={!mudou || salvando} onClick={() => salvar(texto)}>
            <Save className="size-4" />
            {salvando ? "Salvando..." : "Salvar"}
          </Button>

          {padrao && padrao !== salvo && (
            <Button size="sm" variant="outline" disabled={salvando} onClick={() => salvar(padrao)}>
              <RotateCcw className="size-4" />
              Restaurar o original
            </Button>
          )}

          {mudou && <span className="text-xs text-amber-700 dark:text-amber-400">alterações não salvas</span>}

          <span className="ml-auto text-xs text-muted-foreground">
            última edição em {new Date(prompt.updated_at).toLocaleDateString("pt-BR")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function PromptsEditor({
  prompts,
  padroes,
  currentUserId,
}: {
  prompts: PromptRow[];
  padroes: Record<string, string>;
  currentUserId: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Prompts</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          As instruções que o site dá pra IA. Pode editar à vontade: vale a partir da próxima vez que
          aquela automação rodar, sem precisar de ninguém da programação. Se der errado, o botão
          &quot;Restaurar o original&quot; traz de volta o texto de fábrica.
        </p>
      </div>

      {prompts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum prompt cadastrado ainda — recarregue a página pra o site criar os padrões.
        </p>
      ) : (
        prompts.map((prompt) => (
          <Prompt
            key={prompt.id}
            prompt={prompt}
            padrao={padroes[prompt.id]}
            currentUserId={currentUserId}
          />
        ))
      )}
    </div>
  );
}
