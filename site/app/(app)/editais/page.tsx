import { requireProfile } from "@/lib/auth/current-user";
import { EditaisBoard } from "@/components/editais/EditaisBoard";

export default async function EditaisPage() {
  const { supabase, user, profile } = await requireProfile();

  const { data: editais } = await supabase.from("editais").select("*").order("created_at", { ascending: true });
  const { data: teamProfiles } = await supabase.from("profiles").select("id, full_name, email");

  return (
    <EditaisBoard
      editais={editais ?? []}
      teamProfiles={teamProfiles ?? []}
      currentUserId={user.id}
      isManager={profile.role === "manager"}
    />
  );
}
