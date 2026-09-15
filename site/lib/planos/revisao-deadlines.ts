// Revisão diária de prorrogação: pega os deadlines D/DP da linha A
// (desta semana e da próxima), pergunta à IA se cada um foi prorrogado,
// e grava o resultado com a data da revisão.

import type { createAdminClient } from "@/lib/supabase/admin";
import { checkProrrogacao, type ProrrogacaoResult } from "@/lib/ai/prorrogacao";
import { getDeadlinesLinhaA, type DeadlineEntry } from "@/lib/planos/deadlines";
import { todaySaoPaulo } from "@/lib/planos/day";

type Admin = ReturnType<typeof createAdminClient>;

/** Título sem prefixo D/DP, datas e horários — continua igual quando a
 *  equipe renomeia o evento de D pra DP ou atualiza a data no título. */
export function chaveEvento(titulo: string): string {
  return titulo
    .toLowerCase()
    .replace(/^(dp|d)\s+/, "")
    .replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, " ")
    .replace(/\b\d{1,2}(:\d{2}|h\d{0,2})\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export async function deadlinesParaRevisar(hoje = todaySaoPaulo()): Promise<DeadlineEntry[]> {
  const { semana, proximaSemana } = await getDeadlinesLinhaA(hoje);
  return [...semana, ...proximaSemana];
}

export async function runRevisaoDeadlines(
  admin: Admin,
  { hoje = todaySaoPaulo(), refazerHoje = false }: { hoje?: string; refazerHoje?: boolean } = {}
) {
  const deadlines = await deadlinesParaRevisar(hoje);
  if (deadlines.length === 0) return { revisados: 0, prorrogados: 0 };

  const chaves = deadlines.map((d) => chaveEvento(d.titulo));
  const [{ data: links }, { data: jaRevisados }] = await Promise.all([
    admin.from("deadline_links").select("chave_evento, link").in("chave_evento", chaves),
    admin.from("deadline_revisoes").select("chave_evento, deadline_agenda").eq("revisado_dia", hoje),
  ]);

  const linkPorChave = new Map((links ?? []).map((l) => [l.chave_evento, l.link]));
  const feitosHoje = new Set((jaRevisados ?? []).map((r) => `${r.chave_evento}|${r.deadline_agenda}`));

  const pendentes = deadlines.filter(
    (d) => refazerHoje || !feitosHoje.has(`${chaveEvento(d.titulo)}|${d.dia}`)
  );

  const resultados = await Promise.all(
    pendentes.map(async (d) => {
      const chave = chaveEvento(d.titulo);
      const link = linkPorChave.get(chave) ?? null;

      let resultado: ProrrogacaoResult;
      try {
        resultado = await checkProrrogacao({ titulo: d.titulo, deadline: d.dia, link });
      } catch (err) {
        const detalhe = err instanceof Error ? err.message.slice(0, 160) : "erro desconhecido";
        resultado = {
          status: "nao_confirmado",
          novo_deadline_iso: null,
          novo_deadline_texto: null,
          evidencia: link
            ? `Não deu pra consultar a página do edital (${detalhe}).`
            : `Sem link cadastrado — cadastre o link do edital nesta aba. A busca automática no Google exige faturamento ativo no Gemini (${detalhe}).`,
          fonte_link: null,
        };
      }

      // Grava assim que essa conferência termina, sem esperar as outras:
      // se a execução for cortada pelo tempo limite, o que já foi
      // conferido não se perde.
      await admin.from("deadline_revisoes").upsert(
        {
          chave_evento: chave,
          titulo_evento: d.titulo,
          deadline_agenda: d.dia,
          link_consultado: link,
          status: resultado.status,
          novo_deadline: resultado.novo_deadline_iso,
          novo_deadline_texto: resultado.novo_deadline_texto,
          evidencia: resultado.evidencia,
          fonte_link: resultado.fonte_link,
          revisado_em: new Date().toISOString(),
          revisado_dia: hoje,
        },
        { onConflict: "chave_evento,deadline_agenda,revisado_dia" }
      );

      return resultado.status;
    })
  );

  return {
    revisados: resultados.length,
    prorrogados: resultados.filter((status) => status === "prorrogado").length,
  };
}
