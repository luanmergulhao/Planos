// Escrita de eventos "T ..." na Agenda do Google, pelo botão de triagem do
// site. Usa uma conta de serviço (Google Cloud) com a agenda compartilhada
// pra ela com permissão de edição — nunca a conta pessoal de ninguém.

import { revalidateTag } from "next/cache";
import { JWT } from "google-auth-library";
import { shiftDay } from "@/lib/planos/day";

function getClient(): JWT | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) return null;
  return new JWT({ email, key, scopes: ["https://www.googleapis.com/auth/calendar.events"] });
}

export async function criarEventoTriagem({ titulo, dia }: { titulo: string; dia: string }): Promise<void> {
  const calendarId = process.env.GOOGLE_CALENDAR_WRITE_ID;
  const client = getClient();
  if (!client || !calendarId) {
    throw new Error(
      "Escrita na agenda ainda não configurada (faltam GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ou GOOGLE_CALENDAR_WRITE_ID)."
    );
  }

  const { token } = await client.authorize().then((t) => ({ token: t.access_token }));
  if (!token) throw new Error("Não consegui autenticar com a conta de serviço do Google.");

  // Evento de dia inteiro: DTEND é exclusivo (aponta pro dia seguinte),
  // mesma convenção usada na leitura em lib/calendar/ics.ts.
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        summary: titulo,
        start: { date: dia },
        end: { date: shiftDay(dia, 1) },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Google Calendar respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  // A leitura (fetchCalendarEvents) cacheia 1h por tag "calendar" — invalida
  // na hora (expire: 0) pra a triagem recém-criada já aparecer no Plano.
  revalidateTag("calendar", { expire: 0 });
}
