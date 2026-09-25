// Coluna C do Plano — EMAIL DE/PARA CB.
// Todo dia: lê a caixa de e-mail, resume o que a CB mandou e coloca cada
// e-mail como uma linha da coluna C do Plano de quem recebeu. Cada e-mail
// entra uma vez só, mesmo que a rotina rode de novo.

import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarEmailsDaCB } from "@/lib/email/imap";
import { resumirEmailsDaCB } from "@/lib/ai/resumo-email";
import { todaySaoPaulo } from "@/lib/planos/day";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

const CATEGORIA_EMAIL = "C";
const DIAS_PARA_TRAS = 3;

function dataBR(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

type Destino = { planoId: string; autorId: string };

// Sem destino explícito (o cron): o Plano de EMAIL_PLANO_DESTINO.
async function destinoPadrao(admin: Client): Promise<Destino | { motivo: string }> {
  // A caixa de e-mail do trabalho e o login do site costumam ser contas
  // diferentes, então quem recebe as tarefas é configurado à parte.
  const destino = process.env.EMAIL_PLANO_DESTINO ?? process.env.EMAIL_CAIXA;
  if (!destino) return { motivo: "EMAIL_PLANO_DESTINO não configurado" };

  const { data: perfil } = await admin.from("profiles").select("id").eq("email", destino).maybeSingle();
  if (!perfil) return { motivo: `nenhum usuário do site tem o e-mail ${destino}` };

  const { data: plano } = await admin.from("planos").select("id").eq("owner_id", perfil.id).maybeSingle();
  if (!plano) return { motivo: `${destino} não tem Plano` };

  return { planoId: plano.id, autorId: perfil.id };
}

// `destino` vem do botão "Rodar prompt" da linha C: os e-mails caem no
// Plano que está aberto na tela, em nome de quem clicou.
export async function resumirEmailsNoPlano(
  admin: Client,
  { destino, desdeDias = DIAS_PARA_TRAS }: { destino?: Destino; desdeDias?: number } = {}
) {
  const alvo = destino ?? (await destinoPadrao(admin));
  if ("motivo" in alvo) return { lidos: 0, adicionados: 0, motivo: alvo.motivo };
  const plano = { id: alvo.planoId };
  const perfil = { id: alvo.autorId };

  const { data: categoria } = await admin
    .from("plano_categories")
    .select("id")
    .eq("plano_id", plano.id)
    .eq("code", CATEGORIA_EMAIL)
    .maybeSingle();
  if (!categoria) return { lidos: 0, adicionados: 0, motivo: `o Plano não tem a categoria ${CATEGORIA_EMAIL}` };

  const emails = await buscarEmailsDaCB({ desdeDias });
  if (emails.length === 0) return { lidos: 0, adicionados: 0 };

  const { data: jaResumidos } = await admin
    .from("email_resumos")
    .select("message_id")
    .in("message_id", emails.map((e) => e.id));

  const conhecidos = new Set((jaResumidos ?? []).map((r) => r.message_id));
  const novos = emails.filter((e) => !conhecidos.has(e.id));
  if (novos.length === 0) return { lidos: emails.length, adicionados: 0 };

  const resumos = await resumirEmailsDaCB(novos);
  const hoje = todaySaoPaulo();
  let adicionados = 0;

  for (const resumo of resumos) {
    // notificação de comentário não vira tarefa: comentário já tem lugar
    // próprio no Plano
    if (resumo.eh_comentario) continue;

    const { data: item } = await admin
      .from("plano_items")
      .insert({
        plano_id: plano.id,
        category_id: categoria.id,
        day: hoje,
        content: {
          titulo: resumo.titulo,
          tarefa: resumo.tem_tarefa ? resumo.tarefa_solicitada : "(sem tarefa — e-mail informativo)",
          links: `E-mail da CB recebido em ${dataBR(resumo.data)}`,
        },
        created_by: perfil.id,
        updated_by: perfil.id,
      })
      .select("id")
      .single();

    await admin.from("email_resumos").insert({
      message_id: resumo.id,
      plano_item_id: item?.id ?? null,
      assunto: resumo.titulo,
      data_email: resumo.data,
      tarefa: resumo.tem_tarefa ? resumo.tarefa_solicitada : null,
    });

    adicionados++;
  }

  return { lidos: emails.length, adicionados };
}
