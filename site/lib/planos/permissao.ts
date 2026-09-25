import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Mesma regra da página do Plano: dono, ou compartilhado com edição.
// Usa o client do usuário, então o RLS também vale aqui.
export async function podeEditarPlano(supabase: SupabaseClient<Database>, userId: string, planoId: string) {
  const { data: plano } = await supabase.from("planos").select("owner_id").eq("id", planoId).maybeSingle();
  if (!plano) return false;
  if (plano.owner_id === userId) return true;

  const { data: share } = await supabase
    .from("plano_shares")
    .select("permission")
    .eq("plano_id", planoId)
    .eq("user_id", userId)
    .maybeSingle();
  return share?.permission === "edit";
}
