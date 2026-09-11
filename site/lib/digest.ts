import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { itemCode } from "@/lib/planos/categories";
import { getDeadlineUrgency } from "@/lib/time/urgency";

export type DigestItem = {
  id: string;
  code: string;
  texto: string;
  deadline_at: string | null;
  href: string;
  sourceLabel: string;
};

export type Digest = {
  overdue: DigestItem[];
  priority: DigestItem[];
};

// Categoria D (Incêndio) É a prioridade — não existe um status
// separado de "urgente", é a própria categoria que já indica isso.
const PRIORITY_CATEGORY_CODE = "D";

function todayStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// Resumo pessoal (tarefas dentro dos Planos) — usado tanto pelo painel
// (Server Component, na hora) quanto pelo cron diário (push de
// notificação/email) — mesma lógica, duas chamadas. As editais
// compartilhadas têm resumo próprio, ver lib/editais.ts. Só olha o dia
// de hoje de cada Plano (dias passados não entram no resumo do dia).
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
    return { overdue: [], priority: [] };
  }

  const today = new Date();
  const day = todayStr();

  const { data: items } = await supabase
    .from("plano_items")
    .select(
      "id, item_number, content, deadline_at, riscado, plano_id, planos(title), plano_categories(code)"
    )
    .in("plano_id", planoIds)
    .eq("day", day)
    .eq("riscado", false)
    .order("deadline_at", { ascending: true });

  const overdue: DigestItem[] = [];
  const priority: DigestItem[] = [];

  for (const raw of items ?? []) {
    const category = Array.isArray(raw.plano_categories) ? raw.plano_categories[0] : raw.plano_categories;
    const plano = Array.isArray(raw.planos) ? raw.planos[0] : raw.planos;
    const entry: DigestItem = {
      id: raw.id,
      code: itemCode(category?.code ?? "?", raw.item_number),
      texto: (raw.content as { texto?: string })?.texto ?? "(sem título)",
      deadline_at: raw.deadline_at,
      href: `/planos/${raw.plano_id}?item=${raw.id}`,
      sourceLabel: plano?.title ?? "Plano",
    };

    if (category?.code === PRIORITY_CATEGORY_CODE) {
      priority.push(entry);
    } else if (getDeadlineUrgency(raw.deadline_at, today) === "overdue") {
      overdue.push(entry);
    }
  }

  return { overdue, priority };
}
