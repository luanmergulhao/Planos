// Conferência de prorrogação dos deadlines D/DP da linha A: pergunta à
// IA se o prazo foi prorrogado, mantido ou encerrado, lendo a página
// oficial do edital. Roda de dois jeitos — sozinha uma vez por dia pelo
// cron, e na hora pelo botão ao lado de cada deadline.

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkProrrogacao, type ProrrogacaoResult } from "@/lib/ai/prorrogacao";
import { getDeadlinesLinhaA, type DeadlineEntry, type RevisaoResumo } from "@/lib/planos/deadlines";
import { chaveEvento } from "@/lib/planos/chave-evento";
import { todaySaoPaulo } from "@/lib/planos/day";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

// Só os desta semana: deadline da próxima semana ainda não precisa ser
// vigiado contra prorrogação — quando virar semana atual, entra sozinho.
export async function deadlinesParaRevisar(hoje = todaySaoPaulo()): Promise<DeadlineEntry[]> {
  const { semana } = await getDeadlinesLinhaA(hoje);
  return semana;
}

/** Links já salvos, indexados pela chave do evento. */
export async function getLinksSalvos(
  client: Client,
  deadlines: DeadlineEntry[]
): Promise<Record<string, string>> {
  if (deadlines.length === 0) return {};

  const { data } = await client
    .from("deadline_links")
    .select("chave_evento, link")
    .in("chave_evento", deadlines.map((d) => chaveEvento(d.titulo)));

  return Object.fromEntries((data ?? []).map((l) => [l.chave_evento, l.link]));
}

/** Última revisão de cada deadline, indexada por `${titulo}|${dia}`. */
export async function getRevisoesRecentes(
  client: Client,
  deadlines: DeadlineEntry[]
): Promise<Record<string, RevisaoResumo>> {
  if (deadlines.length === 0) return {};

  const { data } = await client
    .from("deadline_revisoes")
    .select("titulo_evento, deadline_agenda, status, novo_deadline, novo_deadline_texto, evidencia, fonte_link, revisado_em")
    .in("chave_evento", deadlines.map((d) => chaveEvento(d.titulo)))
    .order("revisado_em", { ascending: false });

  const porDeadline: Record<string, RevisaoResumo> = {};
  for (const r of data ?? []) {
    // vem da mais recente pra mais antiga: a primeira de cada deadline
    // é a última revisão feita
    porDeadline[`${r.titulo_evento}|${r.deadline_agenda}`] ??= {
      status: r.status,
      novo_deadline: r.novo_deadline,
      novo_deadline_texto: r.novo_deadline_texto,
      evidencia: r.evidencia,
      fonte_link: r.fonte_link,
      revisado_em: r.revisado_em,
    };
  }
  return porDeadline;
}

async function gravarRevisao(
  admin: Client,
  { titulo, dia, link, resultado, hoje }: {
    titulo: string;
    dia: string;
    link: string | null;
    resultado: ProrrogacaoResult;
    hoje: string;
  }
): Promise<RevisaoResumo> {
  const revisadoEm = new Date().toISOString();

  await admin.from("deadline_revisoes").upsert(
    {
      chave_evento: chaveEvento(titulo),
      titulo_evento: titulo,
      deadline_agenda: dia,
      link_consultado: link,
      status: resultado.status,
      novo_deadline: resultado.novo_deadline_iso,
      novo_deadline_texto: resultado.novo_deadline_texto,
      evidencia: resultado.evidencia,
      fonte_link: resultado.fonte_link,
      revisado_em: revisadoEm,
      revisado_dia: hoje,
    },
    { onConflict: "chave_evento,deadline_agenda,revisado_dia" }
  );

  return {
    status: resultado.status,
    novo_deadline: resultado.novo_deadline_iso,
    novo_deadline_texto: resultado.novo_deadline_texto,
    evidencia: resultado.evidencia,
    fonte_link: resultado.fonte_link,
    revisado_em: revisadoEm,
  };
}

/** Conferência de um deadline só — é o que o botão da linha A chama. */
export async function revisarUmDeadline(
  admin: Client,
  { titulo, dia }: { titulo: string; dia: string }
): Promise<RevisaoResumo> {
  const { data: linkRow } = await admin
    .from("deadline_links")
    .select("link")
    .eq("chave_evento", chaveEvento(titulo))
    .maybeSingle();

  const link = linkRow?.link ?? null;
  if (!link) {
    throw new Error("Cole o link do edital antes de conferir.");
  }

  const resultado = await checkProrrogacao({ titulo, deadline: dia, link });
  return gravarRevisao(admin, { titulo, dia, link, resultado, hoje: todaySaoPaulo() });
}

/** Varredura diária de todos os deadlines da linha A que já têm link. */
export async function runRevisaoDeadlines(
  admin: Client,
  { hoje = todaySaoPaulo(), refazerHoje = false }: { hoje?: string; refazerHoje?: boolean } = {}
) {
  const deadlines = await deadlinesParaRevisar(hoje);
  if (deadlines.length === 0) return { revisados: 0, prorrogados: 0, semLink: 0 };

  const [links, { data: jaRevisados }] = await Promise.all([
    getLinksSalvos(admin, deadlines),
    admin.from("deadline_revisoes").select("chave_evento, deadline_agenda").eq("revisado_dia", hoje),
  ]);

  const feitosHoje = new Set((jaRevisados ?? []).map((r) => `${r.chave_evento}|${r.deadline_agenda}`));
  const pendentes = deadlines.filter(
    (d) => refazerHoje || !feitosHoje.has(`${chaveEvento(d.titulo)}|${d.dia}`)
  );

  const semLink = pendentes.filter((d) => !links[chaveEvento(d.titulo)]).length;

  const resultados = await Promise.all(
    pendentes
      .filter((d) => links[chaveEvento(d.titulo)])
      .map(async (d) => {
        const link = links[chaveEvento(d.titulo)];

        let resultado: ProrrogacaoResult;
        try {
          resultado = await checkProrrogacao({ titulo: d.titulo, deadline: d.dia, link });
        } catch (err) {
          const detalhe = err instanceof Error ? err.message.slice(0, 160) : "erro desconhecido";
          resultado = {
            status: "nao_confirmado",
            novo_deadline_iso: null,
            novo_deadline_texto: null,
            evidencia: `Não deu pra consultar a página do edital (${detalhe}).`,
            fonte_link: null,
          };
        }

        // grava assim que esta conferência termina: se a execução for
        // cortada pelo tempo limite, o que já foi conferido não se perde
        await gravarRevisao(admin, { titulo: d.titulo, dia: d.dia, link, resultado, hoje });
        return resultado.status;
      })
  );

  return {
    revisados: resultados.length,
    prorrogados: resultados.filter((s) => s === "prorrogado").length,
    semLink,
  };
}
