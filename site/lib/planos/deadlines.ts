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
import type { RevisaoStatus } from "@/lib/supabase/types";

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

/** Última conferência de prorrogação feita pra um deadline. */
export type RevisaoResumo = {
  status: RevisaoStatus;
  novo_deadline: string | null;
  novo_deadline_texto: string | null;
  evidencia: string | null;
  fonte_link: string | null;
  revisado_em: string;
};

export type DeadlinesComRevisao = DeadlinesLinhaA & {
  /** Indexado por `${titulo do evento}|${dia}`. */
  revisoes: Record<string, RevisaoResumo>;
  /** Link do edital salvo, indexado pela chave do evento. */
  links: Record<string, string>;
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

// Deadline de mentira, só pra demonstrar a tela (gravação de vídeo).
// Formato: "AAAA-MM-DD|Título do evento", vários separados por ";".
// Sem a variável de ambiente, nada é injetado — então isso não vaza pro
// ar sem alguém configurar de propósito.
function deadlinesDeTeste(): CalendarEvent[] {
  return (process.env.DEADLINES_TESTE ?? "")
    .split(";")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .flatMap((linha) => {
      const [dia, ...resto] = linha.split("|");
      const titulo = resto.join("|").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dia.trim()) || !titulo) return [];
      return [{ titulo, ultimoDia: dia.trim(), dataNoTitulo: null }];
    });
}

/** Segunda-feira da semana em que `dia` cai. */
function segundaDaSemana(dia: string): string {
  const d = new Date(dia + "T00:00:00Z");
  const diaDaSemana = d.getUTCDay(); // 0=domingo
  return shiftDay(dia, diaDaSemana === 0 ? -6 : 1 - diaDaSemana);
}

/**
 * Janela da "semana" do Plano: começa na sexta anterior (deadline que caiu
 * no fim de semana só é tratado na segunda seguinte) e vai até a segunda
 * seguinte. Usada pelas linhas A (deadlines) e E (triagens).
 */
export function janelaDaSemana(hoje = todaySaoPaulo()) {
  const segunda = segundaDaSemana(hoje);
  return {
    inicioSemana: shiftDay(segunda, -3),
    fimSemana: shiftDay(segunda, 7),
    fimProximaSemana: shiftDay(segunda, 14),
  };
}

const DIAS_CONFERENCIA = 60;

/**
 * Todo D/DP desta semana até ~2 meses à frente — janela usada pela
 * conferência de prorrogação em massa (cron diário e botão "Rodar
 * prompt" da linha A), mais ampla que os dois blocos que a tela mostra.
 */
export async function getDeadlinesParaConferencia(hoje = todaySaoPaulo()): Promise<DeadlineEntry[]> {
  const { inicioSemana } = janelaDaSemana(hoje);
  const eventos = [...(await fetchCalendarEvents()), ...deadlinesDeTeste()];
  return entradasDe(eventos, inicioSemana, shiftDay(hoje, DIAS_CONFERENCIA));
}

export async function getDeadlinesLinhaA(hoje = todaySaoPaulo()): Promise<DeadlinesLinhaA> {
  const { inicioSemana, fimSemana, fimProximaSemana } = janelaDaSemana(hoje);

  const eventos = [...(await fetchCalendarEvents()), ...deadlinesDeTeste()];
  const semana = entradasDe(eventos, inicioSemana, fimSemana);

  // O dia de virada pertence às duas janelas pela regra escrita; fica só
  // na semana atual, que é a mais urgente.
  const jaNaSemana = new Set(semana.map((e) => e.titulo + e.dia));
  const proximaSemana = entradasDe(eventos, fimSemana, fimProximaSemana).filter(
    (e) => !jaNaSemana.has(e.titulo + e.dia)
  );

  return { semana, proximaSemana, inicioSemana, fimSemana, fimProximaSemana };
}
