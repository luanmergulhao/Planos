import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Convite fica atrás de rota de servidor (não client-side direto) porque
// precisa da service role key pra chamar a Admin API do Supabase Auth —
// essa chave nunca pode chegar no navegador.
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

  const { email, full_name } = await request.json().catch(() => ({}));
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email obrigatório" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: full_name || undefined },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, user_id: data.user?.id });
}
