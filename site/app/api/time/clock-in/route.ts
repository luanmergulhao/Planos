import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HEARTBEAT_TIMEOUT_MINUTES } from "@/lib/time/session";

// Chamado pelo cliente logo após o login. Reaproveita uma sessão já
// aberta e viva (evita contar 2x se a pessoa abrir 2 abas); se a única
// sessão aberta estiver "morta" (sem heartbeat recente), fecha ela como
// timeout e abre uma nova.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { data: openSession } = await supabase
    .from("time_logs")
    .select("id, last_seen_at")
    .eq("user_id", user.id)
    .is("clock_out_at", null)
    .maybeSingle();

  if (openSession) {
    const staleSince = Date.now() - new Date(openSession.last_seen_at).getTime();
    const isStale = staleSince > HEARTBEAT_TIMEOUT_MINUTES * 60 * 1000;

    if (!isStale) {
      return NextResponse.json({ time_log_id: openSession.id });
    }

    await supabase
      .from("time_logs")
      .update({ clock_out_at: openSession.last_seen_at, end_reason: "timeout" })
      .eq("id", openSession.id);
  }

  const { data: created, error } = await supabase
    .from("time_logs")
    .insert({ user_id: user.id })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ time_log_id: created.id });
}
