import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeDigest } from "@/lib/digest";
import { HEARTBEAT_TIMEOUT_MINUTES } from "@/lib/time/session";

export const maxDuration = 60;

const DEADLINE_REMINDER_OFFSETS_DAYS = [7, 3, 1, 0];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function scanDeadlines(admin: ReturnType<typeof createAdminClient>) {
  const sentOn = todayISO();
  let notified = 0;

  for (const daysBefore of DEADLINE_REMINDER_OFFSETS_DAYS) {
    const targetDate = addDaysISO(daysBefore);

    const { data: items } = await admin
      .from("plano_items")
      .select("id, content, plano_id, planos(owner_id, title)")
      .eq("deadline_at", targetDate)
      .neq("status", "concluido");

    for (const item of items ?? []) {
      const { data: alreadySent } = await admin
        .from("deadline_notifications_log")
        .select("plano_item_id")
        .eq("plano_item_id", item.id)
        .eq("days_before", daysBefore)
        .eq("sent_on", sentOn)
        .maybeSingle();

      if (alreadySent) continue;

      const plano = Array.isArray(item.planos) ? item.planos[0] : item.planos;
      if (!plano) continue;

      const texto = (item.content as { texto?: string })?.texto ?? "uma tarefa";
      const when = daysBefore === 0 ? "vence hoje" : `vence em ${daysBefore} dia${daysBefore > 1 ? "s" : ""}`;

      await admin.from("notifications").insert({
        user_id: plano.owner_id,
        type: "deadline_reminder",
        title: `Prazo: ${texto}`,
        body: `"${texto}" ${when}, no Plano "${plano.title}".`,
        link_path: `/planos/${item.plano_id}?item=${item.id}`,
        source_plano_item_id: item.id,
      });

      await admin.from("deadline_notifications_log").insert({
        plano_item_id: item.id,
        days_before: daysBefore,
        sent_on: sentOn,
      });

      notified++;
    }
  }

  return notified;
}

async function sendDailyDigests(admin: ReturnType<typeof createAdminClient>) {
  const { data: users } = await admin
    .from("notification_preferences")
    .select("user_id")
    .eq("digest_enabled", true);

  let sent = 0;

  for (const { user_id } of users ?? []) {
    const digest = await computeDigest(admin, user_id);
    const total = digest.overdue.length + digest.dueWeek.length + digest.priority.length;
    if (total === 0) continue;

    const parts = [
      digest.overdue.length > 0 ? `${digest.overdue.length} atrasado(s)` : null,
      digest.dueWeek.length > 0 ? `${digest.dueWeek.length} vencendo essa semana` : null,
      digest.priority.length > 0 ? `${digest.priority.length} prioridade` : null,
    ].filter(Boolean);

    await admin.from("notifications").insert({
      user_id,
      type: "daily_digest",
      title: "Resumo diário do Planos",
      body: parts.join(", ") + ".",
      link_path: "/",
    });
    sent++;
  }

  return sent;
}

async function sweepStaleSessions(admin: ReturnType<typeof createAdminClient>) {
  const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MINUTES * 60 * 1000).toISOString();

  const { data: stale } = await admin
    .from("time_logs")
    .update({ end_reason: "timeout" })
    .is("clock_out_at", null)
    .lt("last_seen_at", cutoff)
    .select("id, last_seen_at");

  // clock_out_at é escrito à parte, igual ao last_seen_at daquele
  // momento, pra cada linha — update em massa não consegue copiar
  // coluna->coluna com valor por linha então fazemos 1 update por id.
  for (const row of stale ?? []) {
    await admin.from("time_logs").update({ clock_out_at: row.last_seen_at }).eq("id", row.id);
  }

  return stale?.length ?? 0;
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const [deadlinesNotified, digestsSent, sessionsClosed] = await Promise.all([
    scanDeadlines(admin),
    sendDailyDigests(admin),
    sweepStaleSessions(admin),
  ]);

  return NextResponse.json({ ok: true, deadlinesNotified, digestsSent, sessionsClosed });
}
