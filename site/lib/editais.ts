import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EditalFase } from "@/lib/supabase/types";
import { getDeadlineUrgency, MONTH_DAYS } from "@/lib/time/urgency";
import type { DigestItem } from "@/lib/digest";

export const FASE_LABEL: Record<EditalFase, string> = {
  T: "Triagem",
  D: "Deadline",
  DP: "Deadline prorrogado",
  CONCLUIDO: "Concluído",
  DESCARTADO: "Descartado",
};

export const ACTIVE_FASES: EditalFase[] = ["T", "D", "DP"];

export type EditaisDigest = {
  overdue: DigestItem[];
  week: DigestItem[];
  month: DigestItem[];
};

// Resumo das editais (quadro compartilhado, não é por pessoa) — usado
// pelo painel principal e pelo cron diário.
export async function computeEditaisDigest(supabase: SupabaseClient<Database>): Promise<EditaisDigest> {
  const today = new Date();
  const monthAheadDate = new Date(today);
  monthAheadDate.setDate(monthAheadDate.getDate() + MONTH_DAYS);
  const monthAheadStr = monthAheadDate.toISOString().slice(0, 10);

  const { data: editais } = await supabase
    .from("editais")
    .select("id, titulo, deadline_at, fase")
    .in("fase", ACTIVE_FASES)
    .lte("deadline_at", monthAheadStr)
    .not("deadline_at", "is", null)
    .order("deadline_at", { ascending: true });

  const overdue: DigestItem[] = [];
  const week: DigestItem[] = [];
  const month: DigestItem[] = [];

  for (const edital of editais ?? []) {
    const entry: DigestItem = {
      id: edital.id,
      code: edital.fase,
      texto: edital.titulo,
      deadline_at: edital.deadline_at,
      href: `/editais?item=${edital.id}`,
      sourceLabel: "Edital",
    };

    switch (getDeadlineUrgency(edital.deadline_at, today)) {
      case "overdue":
        overdue.push(entry);
        break;
      case "week":
        week.push(entry);
        break;
      case "month":
        month.push(entry);
        break;
    }
  }

  return { overdue, week, month };
}
