import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cifrar } from "@/lib/email/cripto";
import { mensagemDeErro, testarCaixa } from "@/lib/email/imap";
import { podeEditarPlano } from "@/lib/planos/permissao";

export const maxDuration = 30;

// Contas de e-mail de um Plano (linha C). A tabela não tem policy: tudo
// passa por aqui, com o client admin, depois de conferir que quem pediu
// pode editar o Plano. A senha nunca volta pra tela.

async function autorizar(planoId: string | null | undefined) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: "not_authenticated" }, { status: 401 }) };
  if (!planoId) return { erro: NextResponse.json({ error: "planoId obrigatório" }, { status: 400 }) };
  if (!(await podeEditarPlano(supabase, user.id, planoId))) {
    return { erro: NextResponse.json({ error: "sem permissão pra editar esse Plano" }, { status: 403 }) };
  }
  return { user };
}

const COLUNAS_PUBLICAS = "id, email, remetentes, ultima_leitura_at, ultimo_erro, created_at";

export async function GET(request: Request) {
  const planoId = new URL(request.url).searchParams.get("planoId");
  const { erro } = await autorizar(planoId);
  if (erro) return erro;

  const { data, error } = await createAdminClient()
    .from("plano_caixas_email")
    .select(COLUNAS_PUBLICAS)
    .eq("plano_id", planoId!)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ caixas: data });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    planoId?: string;
    email?: string;
    senha?: string;
    remetentes?: string[];
  };
  const { user, erro } = await autorizar(body.planoId);
  if (erro) return erro;

  const email = body.email?.trim().toLowerCase();
  const senha = body.senha?.replace(/\s+/g, "");
  const remetentes = (body.remetentes ?? []).map((r) => r.trim().toLowerCase()).filter(Boolean);
  if (!email || !senha) return NextResponse.json({ error: "preencha o e-mail e a senha de app" }, { status: 400 });
  if (remetentes.length === 0) return NextResponse.json({ error: "coloque pelo menos um remetente" }, { status: 400 });

  // testa antes de salvar, pra senha errada aparecer agora e não só no
  // dia seguinte
  try {
    await testarCaixa({ email, senha });
  } catch (err) {
    return NextResponse.json({ error: mensagemDeErro(err) }, { status: 400 });
  }

  const { data, error } = await createAdminClient()
    .from("plano_caixas_email")
    .upsert(
      { plano_id: body.planoId!, email, senha_cifrada: cifrar(senha), remetentes, ultimo_erro: null, created_by: user.id },
      { onConflict: "plano_id,email" }
    )
    .select(COLUNAS_PUBLICAS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ caixa: data });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { planoId?: string; id?: string };
  const { erro } = await autorizar(body.planoId);
  if (erro) return erro;
  if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const { error } = await createAdminClient()
    .from("plano_caixas_email")
    .delete()
    .eq("id", body.id)
    .eq("plano_id", body.planoId!);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
