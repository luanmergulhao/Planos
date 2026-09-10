import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { itemCode } from "@/lib/planos/categories";
import { getDeadlineUrgency, MONTH_DAYS } from "@/lib/time/urgency";

export type DigestItem = {
  id: string;
  code: string;
  texto: string;
  deadline_at: string | null;
  status: string;
  plano_id: string;
  plano_title: string;
};

export type Digest = {
  overdue: DigestItem[];
  dueWeek: DigestItem[];
  dueMonth: DigestItem[];
  priority: DigestItem[];
};

// Usado tanto pelo painel (Server Component, na hora) quanto pelo cron
// diário (push de notificação/email) — mesma lógica, duas chamadas.
export async function computeDigest(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<Digest> {
  const { data: ownPlanos } = await supabase.from("planos").select("id").eq("owner_id", userId);
  const { data: sharedPlanos } = await supabase.from("plano_shares").select("plano_id").eq("user_id", userId);

  const planoIds = [
    ...(ownPlanos ?? []).map((p) => p.id),
    ...(sharedPlanos ?? []).map((s) => s.plano_id),
  ];

  if (planoIds.length === 0) {
    return { overdue: [], dueWeek: [], dueMonth: [], priority: [] };
  }

  const today = new Date();
  const monthAheadDate = new Date(today);
  monthAheadDate.setDate(monthAheadDate.getDate() + MONTH_DAYS);
  const monthAheadStr = monthAheadDate.toISOString().slice(0, 10);

  const { data: items } = await supabase
    .from("plano_items")
    .select(
      "id, item_number, content, deadline_at, status, plano_id, planos(title), plano_categories(code)"
    )
    .in("plano_id", planoIds)
    .neq("status", "concluido")
    .or(`deadline_at.lte.${monthAheadStr},status.eq.urgente`)
    .order("deadline_at", { ascending: true });

  const overdue: DigestItem[] = [];
  const dueWeek: DigestItem[] = [];
  const dueMonth: DigestItem[] = [];
  const priority: DigestItem[] = [];

  for (const raw of items ?? []) {
    const category = Array.isArray(raw.plano_categories) ? raw.plano_categories[0] : raw.plano_categories;
    const plano = Array.isArray(raw.planos) ? raw.planos[0] : raw.planos;
    const entry: DigestItem = {
      id: raw.id,
      code: itemCode(category?.code ?? "?", raw.item_number),
      texto: (raw.content as { texto?: string })?.texto ?? "(sem título)",
      deadline_at: raw.deadline_at,
      status: raw.status,
      plano_id: raw.plano_id,
      plano_title: plano?.title ?? "Plano",
    };

    if (raw.status === "urgente") {
      priority.push(entry);
      continue;
    }

    switch (getDeadlineUrgency(raw.deadline_at, today)) {
      case "overdue":
        overdue.push(entry);
        break;
      case "week":
        dueWeek.push(entry);
        break;
      case "month":
        dueMonth.push(entry);
        break;
    }
  }

  return { overdue, dueWeek, dueMonth, priority };
}
