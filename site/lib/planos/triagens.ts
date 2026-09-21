// Linha E do Plano — TRIAGEM (FEITAS).
// Vem da agenda do Google (eventos "T ..."), do mesmo jeito que a linha A
// vem dos eventos "D ..." e "DP ...". As respostas completas de cada
// triagem moram na aba Triagem.

import { fetchCalendarEvents } from "@/lib/calendar/ics";
import { janelaDaSemana } from "@/lib/planos/deadlines";
import { shiftDay, todaySaoPaulo } from "@/lib/planos/day";
import { MONTH_DAYS } from "@/lib/time/urgency";
import { separarTriagensDaAgenda, type TriagensLinhaE } from "@/lib/planos/triagens-agenda";

export type { TriagemEntry, TriagensLinhaE } from "@/lib/planos/triagens-agenda";

export async function getTriagensLinhaE(hoje = todaySaoPaulo()): Promise<TriagensLinhaE> {
  const { inicioSemana, fimSemana } = janelaDaSemana(hoje);
  const eventos = await fetchCalendarEvents();

  return separarTriagensDaAgenda(eventos, {
    inicioSemana,
    fimSemana,
    limiteMes: shiftDay(hoje, MONTH_DAYS),
  });
}
