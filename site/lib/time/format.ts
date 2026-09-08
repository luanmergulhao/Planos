// O Postgres/PostgREST devolve `interval` como texto no formato padrão
// dele, ex: "04:15:00" ou "1 day 04:15:00" ou "-00:30:00". Convertemos
// pra horas (float) pra exibir e somar no front.
export function parseIntervalToHours(value: unknown): number {
  if (value == null) return 0;
  const text = String(value);

  const dayMatch = text.match(/(-?\d+)\s+days?/);
  const days = dayMatch ? parseInt(dayMatch[1], 10) : 0;

  const timeMatch = text.match(/(-?\d{1,3}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  const isNegative = text.trim().startsWith("-") || (timeMatch?.[1] ?? "").startsWith("-");

  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (timeMatch) {
    hours = Math.abs(parseInt(timeMatch[1], 10));
    minutes = parseInt(timeMatch[2], 10);
    seconds = parseFloat(timeMatch[3]);
  }

  const totalHours = days * 24 + hours + minutes / 60 + seconds / 3600;
  return isNegative ? -totalHours : totalHours;
}

export function formatHours(totalHours: number): string {
  const sign = totalHours < 0 ? "-" : "";
  const abs = Math.abs(totalHours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `${sign}${h}h${m.toString().padStart(2, "0")}`;
}
