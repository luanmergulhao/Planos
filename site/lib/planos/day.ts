// Data de "hoje" sempre no fuso de São Paulo, formato YYYY-MM-DD —
// usado tanto no servidor quanto no cliente pra decidir qual dia do
// Plano mostrar por padrão.
export function todaySaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function formatDayLabel(day: string): string {
  return new Date(day + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function shiftDay(day: string, deltaDays: number): string {
  const d = new Date(day + "T00:00:00");
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}
