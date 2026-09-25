// Coluna C do Plano — EMAIL DE/PARA CB.
// Lê as caixas de e-mail conectadas a cada Plano (tabela
// plano_caixas_email), resume o que os remetentes da lista mandaram — por
// padrão a CB — e coloca cada e-mail como uma linha da coluna C daquele
// Plano. Cada e-mail entra uma vez só por Plano, mesmo que a rotina rode
// de novo ou que o mesmo e-mail tenha chegado em duas contas.

import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarEmailsDaCB, caixaDoEnv, mensagemDeErro, type Caixa } from "@/lib/email/imap";
import { decifrar } from "@/lib/email/cripto";
import { resumirEmailsDaCB, type EmailBruto } from "@/lib/ai/resumo-email";
import { todaySaoPaulo } from "@/lib/planos/day";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

const CATEGORIA_EMAIL = "C";
const DIAS_PARA_TRAS = 3;

export type ResultadoEmails = {
  lidos: number;
  adicionados: number;
  /** contas que falharam; as outras seguem normalmente */
  erros: { email: string; erro: string }[];
  motivo?: string;
};

function dataBR(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

async function caixasDoPlano(admin: Client, planoId: string) {
  const { data } = await admin.from("plano_caixas_email").select("*").eq("plano_id", planoId);
  return data ?? [];
}

async function processar(
  admin: Client,
  { planoId, autorId, caixas, desdeDias }: { planoId: string; autorId: string; caixas: (Caixa & { id?: string })[]; desdeDias: number }
): Promise<ResultadoEmails> {
  const { data: categoria } = await admin
    .from("plano_categories")
    .select("id")
    .eq("plano_id", planoId)
    .eq("code", CATEGORIA_EMAIL)
    .maybeSingle();
  if (!categoria) return { lidos: 0, adicionados: 0, erros: [], motivo: `o Plano não tem a categoria ${CATEGORIA_EMAIL}` };

  // o mesmo e-mail pode ter chegado em mais de uma conta
  const porId = new Map<string, EmailBruto>();
  const erros: ResultadoEmails["erros"] = [];

  for (const caixa of caixas) {
    try {
      for (const email of await buscarEmailsDaCB(caixa, { desdeDias })) porId.set(email.id, email);
      if (caixa.id) {
        await admin
          .from("plano_caixas_email")
          .update({ ultima_leitura_at: new Date().toISOString(), ultimo_erro: null })
          .eq("id", caixa.id);
      }
    } catch (err) {
      const erro = mensagemDeErro(err);
      erros.push({ email: caixa.email, erro });
      if (caixa.id) await admin.from("plano_caixas_email").update({ ultimo_erro: erro }).eq("id", caixa.id);
    }
  }

  const emails = [...porId.values()];
  if (emails.length === 0) return { lidos: 0, adicionados: 0, erros };

  // linhas de antes da migração 0020 não têm plano_id: contam pra todos
  const { data: jaResumidos } = await admin
    .from("email_resumos")
    .select("message_id")
    .in("message_id", emails.map((e) => e.id))
    .or(`plano_id.eq.${planoId},plano_id.is.null`);

  const conhecidos = new Set((jaResumidos ?? []).map((r) => r.message_id));
  const novos = emails.filter((e) => !conhecidos.has(e.id));
  if (novos.length === 0) return { lidos: emails.length, adicionados: 0, erros };

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
        plano_id: planoId,
        category_id: categoria.id,
        day: hoje,
        content: {
          titulo: resumo.titulo,
          tarefa: resumo.tem_tarefa ? resumo.tarefa_solicitada : "(sem tarefa — e-mail informativo)",
          links: `E-mail da CB recebido em ${dataBR(resumo.data)}`,
        },
        created_by: autorId,
        updated_by: autorId,
      })
      .select("id")
      .single();

    await admin.from("email_resumos").insert({
      message_id: resumo.id,
      plano_id: planoId,
      plano_item_id: item?.id ?? null,
      assunto: resumo.titulo,
      data_email: resumo.data,
      tarefa: resumo.tem_tarefa ? resumo.tarefa_solicitada : null,
    });

    adicionados++;
  }

  return { lidos: emails.length, adicionados, erros };
}

// Botão "Rodar prompt" da linha C: só as contas do Plano aberto, e as
// linhas entram em nome de quem clicou.
export async function resumirEmailsDoPlano(
  admin: Client,
  { planoId, autorId, desdeDias = DIAS_PARA_TRAS }: { planoId: string; autorId: string; desdeDias?: number }
): Promise<ResultadoEmails> {
  const linhas = await caixasDoPlano(admin, planoId);
  if (linhas.length === 0) {
    return {
      lidos: 0,
      adicionados: 0,
      erros: [],
      motivo: "nenhuma conta de e-mail conectada a esse Plano — conecte em \"Contas de e-mail\" na linha C",
    };
  }
  const caixas = linhas.map((c) => ({ id: c.id, email: c.email, senha: decifrar(c.senha_cifrada), remetentes: c.remetentes }));
  return processar(admin, { planoId, autorId, caixas, desdeDias });
}

// Cron diário: todo Plano com conta conectada, em nome do dono do Plano.
// A caixa antiga do .env (EMAIL_CAIXA...) continua valendo pro Plano de
// EMAIL_PLANO_DESTINO enquanto ele não tiver conta conectada pela tela.
export async function resumirEmailsDeTodosOsPlanos(admin: Client) {
  const { data: linhas } = await admin.from("plano_caixas_email").select("plano_id");
  const planoIds = new Set((linhas ?? []).map((l) => l.plano_id));
  let adicionados = 0;

  for (const planoId of planoIds) {
    const { data: plano } = await admin.from("planos").select("owner_id").eq("id", planoId).maybeSingle();
    if (!plano) continue;
    try {
      const r = await resumirEmailsDoPlano(admin, { planoId, autorId: plano.owner_id });
      adicionados += r.adicionados;
    } catch {
      // um Plano com problema não trava os outros
    }
  }

  const caixaAntiga = caixaDoEnv();
  const destino = process.env.EMAIL_PLANO_DESTINO ?? process.env.EMAIL_CAIXA;
  if (caixaAntiga && destino) {
    const { data: perfil } = await admin.from("profiles").select("id").eq("email", destino).maybeSingle();
    const { data: plano } = perfil
      ? await admin.from("planos").select("id").eq("owner_id", perfil.id).maybeSingle()
      : { data: null };
    if (perfil && plano && !planoIds.has(plano.id)) {
      const r = await processar(admin, {
        planoId: plano.id,
        autorId: perfil.id,
        caixas: [caixaAntiga],
        desdeDias: DIAS_PARA_TRAS,
      });
      adicionados += r.adicionados;
    }
  }

  return { adicionados };
}
