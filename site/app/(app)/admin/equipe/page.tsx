import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/current-user";
import { TeamManagement } from "@/components/admin/TeamManagement";

export default async function EquipePage() {
  const { supabase, user, profile } = await requireProfile();
  if (profile.role !== "manager") redirect("/");

  const { data: members } = await supabase.from("profiles").select("id, full_name, email, role").order("full_name");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Equipe</h1>
        <p className="text-muted-foreground">Convide pessoas novas e gerencie quem é manager.</p>
      </div>
      <TeamManagement members={members ?? []} currentUserId={user.id} />
    </div>
  );
}
