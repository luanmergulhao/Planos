import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/current-user";
import { PlanoEditor } from "@/components/plano/PlanoEditor";

export default async function PlanoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireProfile();

  const { data: plano } = await supabase.from("planos").select("*").eq("id", id).maybeSingle();
  if (!plano) notFound();

  const isOwner = plano.owner_id === user.id;

  let canEdit = isOwner;
  if (!isOwner) {
    const { data: share } = await supabase
      .from("plano_shares")
      .select("permission")
      .eq("plano_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!share) notFound(); // RLS já bloquearia a query acima, isso é defesa extra
    canEdit = share.permission === "edit";
  }

  const { data: categories } = await supabase
    .from("plano_categories")
    .select("*")
    .eq("plano_id", id)
    .order("sort_order");

  const { data: items } = await supabase
    .from("plano_items")
    .select("*")
    .eq("plano_id", id)
    .order("item_number");

  const { data: shares } = isOwner
    ? await supabase
        .from("plano_shares")
        .select("id, permission, profiles(id, full_name, email)")
        .eq("plano_id", id)
    : { data: null };

  const { data: teamProfiles } = await supabase.from("profiles").select("id, full_name, email");

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", plano.owner_id)
    .single();

  const { data: updatedByProfile } = plano.updated_by
    ? await supabase.from("profiles").select("full_name, email").eq("id", plano.updated_by).single()
    : { data: null };

  return (
    <PlanoEditor
      plano={plano}
      categories={categories ?? []}
      items={items ?? []}
      shares={
        (shares ?? []).map((s) => ({
          id: s.id,
          permission: s.permission,
          profile: Array.isArray(s.profiles) ? s.profiles[0] : s.profiles,
        })) as { id: string; permission: "view" | "edit"; profile: { id: string; full_name: string | null; email: string } }[]
      }
      teamProfiles={teamProfiles ?? []}
      currentUserId={user.id}
      isOwner={isOwner}
      canEdit={canEdit}
      ownerLabel={ownerProfile?.full_name ?? ownerProfile?.email ?? "?"}
      updatedByLabel={updatedByProfile?.full_name ?? updatedByProfile?.email ?? null}
    />
  );
}
