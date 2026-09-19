import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revisarUmDeadline } from "@/lib/planos/revisao-deadlines";

export const maxDuration = 60;

// Botão "Conferir" ao lado de cada deadline da linha A.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { titulo, dia } = await request.json().catch(() => ({}));
  if (typeof titulo !== "string" || typeof dia !== "string") {
    return NextResponse.json({ error: "titulo e dia obrigatórios" }, { status: 400 });
  }

  try {
    const { revisao, ia } = await revisarUmDeadline(createAdminClient(), { titulo, dia });
    return NextResponse.json({ ok: true, revisao, ia });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
