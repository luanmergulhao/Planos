import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/current-user";
import { PlanoEditor } from "@/components/plano/PlanoEditor";
import { todaySaoPaulo } from "@/lib/planos/day";
import { getDeadlinesLinhaA } from "@/lib/planos/deadlines";
import { getLinksSalvos, getRevisoesRecentes } from "@/lib/planos/revisao-deadlines";

export default async function PlanoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dia?: string }>;
}) {
  const { id } = await params;
  const { dia } = await searchParams;
  const day = dia ?? todaySaoPaulo();
  const { supabase, user, profile } = await requireProfile();

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
    .eq("day", day)
    .order("item_number");

  const { data: planoDay } = await supabase
    .from("plano_days")
    .select("*")
    .eq("plano_id", id)
    .eq("day", day)
    .maybeSingle();

  // dia mais recente ANTES do selecionado que já teve conteúdo — pra
  // oferecer "começar o dia copiando de lá" quando o dia atual tá vazio
  let previousDayWithItems: string | null = null;
  if (!items || items.length === 0) {
    const { data: previous } = await supabase
      .from("plano_items")
      .select("day")
      .eq("plano_id", id)
      .lt("day", day)
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle();
    previousDayWithItems = previous?.day ?? null;
  }

  const { data: shares } = isOwner
    ? await supabase
        .from("plano_shares")
        .select("id, permission, profiles!plano_shares_user_id_fkey(id, full_name, email)")
        .eq("plano_id", id)
    : { data: null };

  const { data: teamProfiles } = await supabase.from("profiles").select("id, full_name, email");

  const deadlinesLinhaA = await getDeadlinesLinhaA();
  const entradasLinhaA = [...deadlinesLinhaA.semana, ...deadlinesLinhaA.proximaSemana];
  const [revisoes, links] = await Promise.all([
    getRevisoesRecentes(supabase, entradasLinhaA),
    getLinksSalvos(supabase, entradasLinhaA),
  ]);
  const deadlines = { ...deadlinesLinhaA, revisoes, links };

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
      day={day}
      planoDay={planoDay ?? null}
      previousDayWithItems={previousDayWithItems}
      deadlines={deadlines}
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
      isManager={profile.role === "manager"}
      ownerLabel={ownerProfile?.full_name ?? ownerProfile?.email ?? "?"}
      updatedByLabel={updatedByProfile?.full_name ?? updatedByProfile?.email ?? null}
    />
  );
}
