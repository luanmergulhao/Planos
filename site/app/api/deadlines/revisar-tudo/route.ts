import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runRevisaoDeadlines } from "@/lib/planos/revisao-deadlines";

export const maxDuration = 60;

// Botão "Rodar prompt" da linha A: confere de novo todo deadline com
// link salvo, mesmo os que já foram conferidos hoje (refazerHoje) —
// diferente do cron, que pula o que já rodou hoje.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const resultado = await runRevisaoDeadlines(createAdminClient(), { refazerHoje: true });
    return NextResponse.json({ ok: true, ...resultado });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "erro desconhecido" }, { status: 502 });
  }
}
