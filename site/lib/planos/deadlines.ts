// Linha A do Plano — PRÓX. DEADLINES.
//
// Monta os dois blocos (semana / próxima semana) a partir dos eventos de
// dia inteiro da agenda. Regra da equipe: só entram os eventos cujo
// título começa com "D " ou "DP " (deadline de envio). "T " é triagem e
// "R " é resultado — esses ficam de fora. Qualquer evento com "FC" no
// título é ignorado.
//
// É tudo filtro determinístico, sem IA de propósito: a lista precisa ser
// exata e não pode depender de cota de API.

import { fetchCalendarEvents, type CalendarEvent } from "@/lib/calendar/ics";
import { shiftDay, todaySaoPaulo } from "@/lib/planos/day";

export type DeadlineEntry = {
  titulo: string;
  dia: string;
  /** Preenchido quando a data escrita no título não bate com o fim do
   *  evento — quase sempre é a barra da agenda arrastada errado. */
  divergencia: string | null;
};

export type DeadlinesLinhaA = {
  semana: DeadlineEntry[];
  proximaSemana: DeadlineEntry[];
  inicioSemana: string;
  fimSemana: string;
  fimProximaSemana: string;
};

// "D " ou "DP " seguidos de espaço. O espaço é essencial: sem ele
// "DIL" e "Diligência" entrariam como se fossem deadline.
const PREFIXO_DEADLINE = /^(D|DP)\s/i;
const TEM_FC = /\bFC\b/i;

function entradasDe(eventos: CalendarEvent[], de: string, ate: string): DeadlineEntry[] {
  return eventos
    .filter(
      (e) =>
        e.ultimoDia >= de &&
        e.ultimoDia <= ate &&
        PREFIXO_DEADLINE.test(e.titulo) &&
        !TEM_FC.test(e.titulo)
    )
    .map((e) => ({
      titulo: e.titulo,
      dia: e.ultimoDia,
      divergencia: e.dataNoTitulo && e.dataNoTitulo !== e.ultimoDia ? e.dataNoTitulo : null,
    }))
    .sort((a, b) => a.dia.localeCompare(b.dia) || a.titulo.localeCompare(b.titulo));
}

/** Segunda-feira da semana em que `dia` cai. */
function segundaDaSemana(dia: string): string {
  const d = new Date(dia + "T00:00:00Z");
  const diaDaSemana = d.getUTCDay(); // 0=domingo
  return shiftDay(dia, diaDaSemana === 0 ? -6 : 1 - diaDaSemana);
}

export async function getDeadlinesLinhaA(hoje = todaySaoPaulo()): Promise<DeadlinesLinhaA> {
  const segunda = segundaDaSemana(hoje);

  // A janela da semana começa na sexta anterior porque deadline que caiu
  // no fim de semana só é tratado na segunda seguinte.
  const inicioSemana = shiftDay(segunda, -3);
  const fimSemana = shiftDay(segunda, 7);
  const fimProximaSemana = shiftDay(segunda, 14);

  const eventos = await fetchCalendarEvents();
  const semana = entradasDe(eventos, inicioSemana, fimSemana);

  // O dia de virada pertence às duas janelas pela regra escrita; fica só
  // na semana atual, que é a mais urgente.
  const jaNaSemana = new Set(semana.map((e) => e.titulo + e.dia));
  const proximaSemana = entradasDe(eventos, fimSemana, fimProximaSemana).filter(
    (e) => !jaNaSemana.has(e.titulo + e.dia)
  );

  return { semana, proximaSemana, inicioSemana, fimSemana, fimProximaSemana };
}
