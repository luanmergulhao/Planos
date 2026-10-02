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

/**
 * Os agentes (prompts que rodam sozinhos) rodam um dia sim, um dia não.
 * Conta os dias desde uma data fixa em vez de olhar o dia do mês, pra
 * alternância não quebrar na virada de mês (31 → 1). Os botões de cada
 * agente continuam rodando na hora, em qualquer dia.
 */
export function ehDiaDeAgente(dia = todaySaoPaulo()): boolean {
  const dias = Math.round(Date.parse(dia + "T00:00:00Z") / 86_400_000);
  return dias % 2 === 0;
}
