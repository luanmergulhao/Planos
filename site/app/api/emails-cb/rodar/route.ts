import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resumirEmailsNoPlano } from "@/lib/planos/emails-cb";

export const maxDuration = 60;

// Botão "Rodar prompt" da linha C: lê a caixa de e-mail na hora (mesmo
// prompt do cron diário) e coloca o que a CB pediu no Plano aberto na
// tela. Olha uma semana pra trás em vez dos 3 dias do cron; e-mail que já
// virou linha antes não entra de novo.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { planoId } = (await request.json().catch(() => ({}))) as { planoId?: string };
  if (!planoId) {
    return NextResponse.json({ error: "planoId obrigatório" }, { status: 400 });
  }

  // mesma regra da página do Plano: dono ou compartilhado com edição
  const { data: plano } = await supabase.from("planos").select("owner_id").eq("id", planoId).maybeSingle();
  let podeEditar = plano?.owner_id === user.id;
  if (plano && !podeEditar) {
    const { data: share } = await supabase
      .from("plano_shares")
      .select("permission")
      .eq("plano_id", planoId)
      .eq("user_id", user.id)
      .maybeSingle();
    podeEditar = share?.permission === "edit";
  }
  if (!podeEditar) {
    return NextResponse.json({ error: "sem permissão pra editar esse Plano" }, { status: 403 });
  }

  try {
    const resultado = await resumirEmailsNoPlano(createAdminClient(), {
      destino: { planoId, autorId: user.id },
      desdeDias: 7,
    });
    if (resultado.motivo) {
      return NextResponse.json({ error: resultado.motivo }, { status: 502 });
    }
    return NextResponse.json({ ok: true, ...resultado });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "erro desconhecido" }, { status: 502 });
  }
}
