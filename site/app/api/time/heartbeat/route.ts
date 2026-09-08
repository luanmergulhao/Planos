import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { time_log_id } = await request.json().catch(() => ({ time_log_id: null }));
  if (!time_log_id) {
    return NextResponse.json({ error: "missing_time_log_id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("time_logs")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", time_log_id)
    .eq("user_id", user.id)
    .is("clock_out_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
