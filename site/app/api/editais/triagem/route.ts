import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractTriagemFromLink } from "@/lib/ai/triagem";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { link } = await request.json().catch(() => ({}));
  if (!link || typeof link !== "string") {
    return NextResponse.json({ error: "link obrigatório" }, { status: 400 });
  }

  try {
    const result = await extractTriagemFromLink(link);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
