import { requireProfile } from "@/lib/auth/current-user";
import { TriagemPlanilha } from "@/components/editais/TriagemPlanilha";

export default async function EditaisPage() {
  const { supabase, user, profile } = await requireProfile();

  const { data: editais } = await supabase.from("editais").select("*").order("created_at", { ascending: true });
  const { data: teamProfiles } = await supabase.from("profiles").select("id, full_name, email");

  return (
    <TriagemPlanilha
      editais={editais ?? []}
      teamProfiles={teamProfiles ?? []}
      currentUserId={user.id}
      isManager={profile.role === "manager"}
    />
  );
}
