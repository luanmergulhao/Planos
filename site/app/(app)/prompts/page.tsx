import { requireProfile } from "@/lib/auth/current-user";
import { ensurePromptsSeeded } from "@/lib/ai/prompts";
import { PromptsEditor } from "@/components/prompts/PromptsEditor";

export default async function PromptsPage() {
  const { supabase, user } = await requireProfile();

  // primeira visita: copia os padrões do código pro banco, sem tocar
  // nos que a equipe já editou
  await ensurePromptsSeeded();

  const { data: prompts } = await supabase.from("prompts").select("*").order("nome");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Prompts</h1>
        <p className="text-muted-foreground">
          O texto que a IA usa em cada automação (triagem, resultados, GUIA, TP...). Edite aqui — não precisa mexer em código.
        </p>
      </div>
      <PromptsEditor prompts={prompts ?? []} currentUserId={user.id} />
    </div>
  );
}
