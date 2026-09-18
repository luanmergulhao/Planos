// Linha E do Plano — TRIAGEM.
// No Plano fica só o resumo: nome do edital e quando a triagem foi feita.
// Todas as respostas da triagem moram na aba Triagem, em forma de
// planilha — aqui é só pra saber o que está no radar da semana e do mês.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ACTIVE_FASES } from "@/lib/editais";
import { getDeadlineUrgency } from "@/lib/time/urgency";
import type { Database } from "@/lib/supabase/types";

export type TriagemEntry = {
  id: string;
  titulo: string;
  /** data em que a triagem foi feita (AAAA-MM-DD) */
  triadoEm: string;
  deadline: string;
};

export type TriagensLinhaE = {
  semana: TriagemEntry[];
  mes: TriagemEntry[];
};

export async function getTriagensLinhaE(
  client: SupabaseClient<Database>
): Promise<TriagensLinhaE> {
  const { data } = await client
    .from("editais")
    .select("id, titulo, deadline_at, created_at, fase")
    .in("fase", ACTIVE_FASES)
    .not("deadline_at", "is", null)
    .order("deadline_at", { ascending: true });

  const semana: TriagemEntry[] = [];
  const mes: TriagemEntry[] = [];

  for (const edital of data ?? []) {
    if (!edital.deadline_at) continue;

    const entrada: TriagemEntry = {
      id: edital.id,
      titulo: edital.titulo,
      triadoEm: edital.created_at.slice(0, 10),
      deadline: edital.deadline_at,
    };

    // vencido não entra: a linha E é o radar do que ainda dá pra fazer
    switch (getDeadlineUrgency(edital.deadline_at)) {
      case "week":
        semana.push(entrada);
        break;
      case "month":
        mes.push(entrada);
        break;
    }
  }

  return { semana, mes };
}
