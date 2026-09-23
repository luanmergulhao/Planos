// Leitura das agendas do Google pelo endereço secreto em formato iCal.
// É só leitura: o site nunca escreve na agenda.

export type CalendarEvent = {
  titulo: string;
  /** Último dia real do evento (YYYY-MM-DD). */
  ultimoDia: string;
  /** Data que aparece escrita no próprio título, quando dá pra ler. */
  dataNoTitulo: string | null;
};

// Linhas longas no iCal são quebradas e continuadas com um espaço no
// começo da linha seguinte — juntar de volta antes de qualquer parse.
function unfold(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function shiftDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function unescapeIcs(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

// Lê uma data escrita no título ("25/09/2026 18H", "17/09 22H BR").
// Sem ano, assume o ano do fim do evento. Devolve null se não for uma
// data plausível — o título tem hora, número de edital e muito ruído.
function readDateFromTitle(titulo: string, fallbackYear: string): string | null {
  const m = titulo.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (!m) return null;

  const day = Number(m[1]);
  const month = Number(m[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  let year = fallbackYear;
  if (m[3]) year = m[3].length === 2 ? `20${m[3]}` : m[3];

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseIcs(ics: string): CalendarEvent[] {
  return unfold(ics)
    .split("BEGIN:VEVENT")
    .slice(1)
    .flatMap((block) => {
      // DTEND;VALUE=DATE só existe em evento de dia inteiro, que é o
      // único tipo que interessa aqui.
      const end = block.match(/\nDTEND;VALUE=DATE:(\d{8})/)?.[1];
      const summary = block.match(/\nSUMMARY:(.*)/)?.[1];
      if (!end || !summary) return [];

      // No iCal o DTEND de evento de dia inteiro é exclusivo: aponta pro
      // dia seguinte ao último dia real. Sem esse -1 todo deadline cai um
      // dia adiantado.
      const ultimoDia = shiftDays(
        `${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6, 8)}`,
        -1
      );
      const titulo = unescapeIcs(summary);

      return [{ titulo, ultimoDia, dataNoTitulo: readDateFromTitle(titulo, ultimoDia.slice(0, 4)) }];
    });
}

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  const urls = (process.env.GOOGLE_CALENDAR_ICS_URLS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  if (urls.length === 0) return [];

  const results = await Promise.all(
    urls.map(async (url) => {
      // O Google atualiza o iCal a cada algumas horas, então cachear 1h
      // não atrasa nada e evita baixar as agendas a cada carregamento.
      // Tag "calendar": lib/calendar/write.ts invalida na hora quando o
      // site cria um evento novo, pra não esperar a hora toda.
      const res = await fetch(url, { next: { revalidate: 3600, tags: ["calendar"] } });
      if (!res.ok) return [];
      return parseIcs(await res.text());
    })
  );

  return results.flat();
}
