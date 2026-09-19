import { requireProfile } from "@/lib/auth/current-user";
import { ensurePromptsSeeded } from "@/lib/ai/prompts";
import { PROMPTS_PADRAO } from "@/lib/ai/prompts-padrao";
import { PromptsEditor } from "@/components/prompts/PromptsEditor";

export default async function PromptsPage() {
  const { supabase, user } = await requireProfile();

  // garante que os padrões estão no banco antes de listar, pra a página
  // nunca aparecer vazia na primeira visita
  await ensurePromptsSeeded();

  const { data: prompts } = await supabase.from("prompts").select("*").order("nome");

  const padroes = Object.fromEntries(PROMPTS_PADRAO.map((p) => [p.id, p.conteudo]));

  return <PromptsEditor prompts={prompts ?? []} padroes={padroes} currentUserId={user.id} />;
}
