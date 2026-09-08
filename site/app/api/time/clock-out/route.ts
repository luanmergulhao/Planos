import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function closeOpenSession(request: Request, endReason: "logout" | "timeout") {
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
    .update({ clock_out_at: new Date().toISOString(), end_reason: endReason })
    .eq("user_id", user.id)
    .is("clock_out_at", null);

  if (time_log_id) query = query.eq("id", time_log_id);

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Logout explícito: chamado antes de supabase.auth.signOut().
export async function POST(request: Request) {
  return closeOpenSession(request, "logout");
}
