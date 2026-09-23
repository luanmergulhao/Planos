import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { criarEventoTriagem } from "@/lib/calendar/write";

// Cria o evento "T ..." na Agenda do Google a partir do botão de triagem —
// qualquer pessoa logada pode (é o mesmo tanto faz de quem faz a triagem
// hoje, criando o evento direto na agenda).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { nome, dia } = await request.json().catch(() => ({}));
  if (!nome || typeof nome !== "string" || !nome.trim()) {
    return NextResponse.json({ error: "nome do edital obrigatório" }, { status: 400 });
  }
  if (!dia || typeof dia !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
    return NextResponse.json({ error: "prazo (data) obrigatório" }, { status: 400 });
  }

  const nomeLimpo = nome.trim();
  const titulo = /^T\s/.test(nomeLimpo) ? nomeLimpo : `T ${nomeLimpo}`;

  try {
    await criarEventoTriagem({ titulo, dia });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "erro" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
