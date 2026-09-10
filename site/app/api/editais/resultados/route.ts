import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchResultados } from "@/lib/ai/resultados";

export const maxDuration = 60;

// Busca manual (disparada pelo botão) — só editais em D/DP (já enviados,
// esperando resultado; T ainda nem foi enviado, não tem o que buscar).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { editalIds } = await request.json().catch(() => ({ editalIds: undefined }));

  let query = supabase.from("editais").select("id, titulo, link, fase").in("fase", ["D", "DP"]);
  if (Array.isArray(editalIds) && editalIds.length > 0) {
    query = query.in("id", editalIds);
  }

  const { data: editais } = await query;
  if (!editais || editais.length === 0) {
    return NextResponse.json({ ok: true, findings: [] });
  }

  try {
    const findings = await searchResultados(editais);
    const withTitulo = findings.map((f) => ({
      ...f,
      titulo: editais.find((e) => e.id === f.id)?.titulo ?? "?",
    }));
    return NextResponse.json({ ok: true, findings: withTitulo });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
