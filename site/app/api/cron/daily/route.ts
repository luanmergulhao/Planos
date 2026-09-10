import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeDigest } from "@/lib/digest";
import { computeEditaisDigest, ACTIVE_FASES } from "@/lib/editais";
import { searchResultados, type ResultadoFinding } from "@/lib/ai/resultados";
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

function whenLabel(daysBefore: number) {
  return daysBefore === 0 ? "vence hoje" : `vence em ${daysBefore} dia${daysBefore > 1 ? "s" : ""}`;
}

async function scanPlanoDeadlines(admin: ReturnType<typeof createAdminClient>) {
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

      await admin.from("notifications").insert({
        user_id: plano.owner_id,
        type: "deadline_reminder",
        title: `Prazo: ${texto}`,
        body: `"${texto}" ${whenLabel(daysBefore)}, no Plano "${plano.title}".`,
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

// Editais são compartilhadas (não têm dono) — o lembrete vai pro time
// todo, não só pra quem criou o registro.
async function scanEditalDeadlines(admin: ReturnType<typeof createAdminClient>) {
  const sentOn = todayISO();
  let notified = 0;

  const { data: teamProfiles } = await admin.from("profiles").select("id");
  if (!teamProfiles || teamProfiles.length === 0) return 0;

  for (const daysBefore of DEADLINE_REMINDER_OFFSETS_DAYS) {
    const targetDate = addDaysISO(daysBefore);

    const { data: editaisDue } = await admin
      .from("editais")
      .select("id, titulo")
      .eq("deadline_at", targetDate)
      .in("fase", ACTIVE_FASES);

    for (const edital of editaisDue ?? []) {
      const { data: alreadySent } = await admin
        .from("edital_deadline_notifications_log")
        .select("edital_id")
        .eq("edital_id", edital.id)
        .eq("days_before", daysBefore)
        .eq("sent_on", sentOn)
        .maybeSingle();

      if (alreadySent) continue;

      await admin.from("notifications").insert(
        teamProfiles.map((profile) => ({
          user_id: profile.id,
          type: "deadline_reminder" as const,
          title: `Edital: ${edital.titulo}`,
          body: `"${edital.titulo}" ${whenLabel(daysBefore)}.`,
          link_path: `/editais?item=${edital.id}`,
        }))
      );

      await admin.from("edital_deadline_notifications_log").insert({
        edital_id: edital.id,
        days_before: daysBefore,
        sent_on: sentOn,
      });

      notified++;
    }
  }

  return notified;
}

async function sendDailyDigests(admin: ReturnType<typeof createAdminClient>) {
  const editaisDigest = await computeEditaisDigest(admin);

  const { data: users } = await admin
    .from("notification_preferences")
    .select("user_id")
    .eq("digest_enabled", true);

  let sent = 0;

  for (const { user_id } of users ?? []) {
    const digest = await computeDigest(admin, user_id);
    const total =
      digest.overdue.length + digest.priority.length + editaisDigest.overdue.length + editaisDigest.week.length;
    if (total === 0) continue;

    const parts = [
      digest.overdue.length > 0 ? `${digest.overdue.length} tarefa(s) atrasada(s)` : null,
      digest.priority.length > 0 ? `${digest.priority.length} prioridade` : null,
      editaisDigest.overdue.length > 0 ? `${editaisDigest.overdue.length} edital(is) atrasado(s)` : null,
      editaisDigest.week.length > 0 ? `${editaisDigest.week.length} edital(is) vencendo essa semana` : null,
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

// Prompt "R" do manual, rodando sozinho 1x/dia: procura resultado de
// editais já enviados (D/DP) e avisa o time só quando acha algo novo
// (compara com o que já tinha salvo, pra não notificar repetido todo
// dia a mesma publicação).
async function searchAndNotifyResultados(admin: ReturnType<typeof createAdminClient>) {
  const { data: editais } = await admin
    .from("editais")
    .select("id, titulo, link, resultado_info")
    .in("fase", ["D", "DP"]);

  if (!editais || editais.length === 0) return 0;

  let notified = 0;

  try {
    const findings = await searchResultados(
      editais.map((e) => ({ id: e.id, titulo: e.titulo, link: e.link }))
    );
    const { data: teamProfiles } = await admin.from("profiles").select("id");

    for (const finding of findings) {
      if (finding.tipo_resultado === "nao_localizado") continue;

      const edital = editais.find((e) => e.id === finding.id);
      if (!edital) continue;

      const previous = edital.resultado_info as ResultadoFinding | null;
      const isNew =
        !previous ||
        previous.publicacao !== finding.publicacao ||
        previous.data_divulgacao !== finding.data_divulgacao;
      if (!isNew) continue;

      await admin.from("editais").update({ resultado_info: finding }).eq("id", edital.id);

      await admin.from("notifications").insert(
        (teamProfiles ?? []).map((profile) => ({
          user_id: profile.id,
          type: "resultado_encontrado" as const,
          title: `Resultado encontrado: ${edital.titulo}`,
          body: finding.detalhamento || finding.publicacao || "Confira o resultado encontrado.",
          link_path: `/editais?item=${edital.id}`,
        }))
      );

      notified++;
    }
  } catch {
    // busca de resultado é best-effort (depende da IA/internet) — se
    // falhar, não derruba o resto do cron
  }

  return notified;
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

  const [planoDeadlinesNotified, editalDeadlinesNotified, digestsSent, sessionsClosed, resultadosEncontrados] =
    await Promise.all([
      scanPlanoDeadlines(admin),
      scanEditalDeadlines(admin),
      sendDailyDigests(admin),
      sweepStaleSessions(admin),
      searchAndNotifyResultados(admin),
    ]);

  return NextResponse.json({
    ok: true,
    planoDeadlinesNotified,
    editalDeadlinesNotified,
    digestsSent,
    sessionsClosed,
    resultadosEncontrados,
  });
}
