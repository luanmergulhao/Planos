// Selo de urgência calculado a partir do prazo — nunca sobrescreve o
// `status` que a equipe controla manualmente (pendente/em_andamento/
// concluído/urgente). É só um indicador visual derivado, recalculado
// toda vez que a página carrega.

export const WEEK_DAYS = 7;
export const MONTH_DAYS = 30;

export type DeadlineUrgency = "overdue" | "week" | "month" | null;

export function getDeadlineUrgency(deadlineAt: string | null, today = new Date()): DeadlineUrgency {
  if (!deadlineAt) return null;

  const todayStr = today.toISOString().slice(0, 10);
  if (deadlineAt < todayStr) return "overdue";

  const diffDays = Math.round(
    (new Date(deadlineAt + "T00:00:00").getTime() - new Date(todayStr + "T00:00:00").getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (diffDays <= WEEK_DAYS) return "week";
  if (diffDays <= MONTH_DAYS) return "month";
  return null;
}

export const URGENCY_LABEL: Record<Exclude<DeadlineUrgency, null>, string> = {
  overdue: "Atrasado",
  week: "Vence essa semana",
  month: "Vence esse mês",
};
