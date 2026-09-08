import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// profiles.role só é alterável por código de servidor (a RLS de
// profiles restringe update de coluna a full_name/avatar_url pro
// próprio usuário) — daqui usamos a service role pra contornar isso
// depois de confirmar que quem está pedindo já é manager.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "manager") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { user_id, role } = await request.json().catch(() => ({}));
  if (!user_id || (role !== "member" && role !== "manager")) {
    return NextResponse.json({ error: "parâmetros inválidos" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
