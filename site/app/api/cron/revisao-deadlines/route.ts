import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runRevisaoDeadlines } from "@/lib/planos/revisao-deadlines";
import { ehDiaDeAgente } from "@/lib/planos/day";

export const maxDuration = 60;

// Rota própria em vez de mais um passo no cron diário: cada conferência
// chama a IA lendo páginas de edital, e somado ao resto da rotina diária
// estouraria o limite de 60s de uma execução.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // agente de prorrogação: um dia sim, um dia não (o botão roda a qualquer hora)
  if (!ehDiaDeAgente()) return NextResponse.json({ ok: true, diaDeAgente: false });

  const resultado = await runRevisaoDeadlines(createAdminClient());
  return NextResponse.json({ ok: true, ...resultado });
}
