import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Best-effort: disparado via navigator.sendBeacon no pagehide/beforeunload
// quando a pessoa fecha a aba sem clicar em sair. Não é garantido chegar —
// a rede de segurança de verdade é o heartbeat + limiar de 6min (ver
// supabase/migrations/0003_time_logs.sql e app/api/cron/daily).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { time_log_id } = await request.json().catch(() => ({ time_log_id: null }));

  let query = supabase
    .from("time_logs")
    .update({ clock_out_at: new Date().toISOString(), end_reason: "timeout" as const })
    .eq("user_id", user.id)
    .is("clock_out_at", null);

  if (time_log_id) query = query.eq("id", time_log_id);

  await query;

  return NextResponse.json({ ok: true });
}
