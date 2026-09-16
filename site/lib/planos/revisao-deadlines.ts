// Revisão diária de prorrogação: pega os deadlines D/DP da linha A
// (desta semana e da próxima), pergunta à IA se cada um foi prorrogado,
// e grava o resultado com a data da revisão. Roda sozinha pelo cron —
// não tem tela nem botão, o resultado aparece na própria linha A.

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkProrrogacao, type ProrrogacaoResult } from "@/lib/ai/prorrogacao";
import { getDeadlinesLinhaA, type DeadlineEntry, type RevisaoResumo } from "@/lib/planos/deadlines";
import { todaySaoPaulo } from "@/lib/planos/day";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

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

/** Última revisão de cada deadline, pra mostrar dentro da linha A. */
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

  const porChave: Record<string, RevisaoResumo> = {};
  for (const r of data ?? []) {
    // vem da mais recente pra mais antiga: a primeira de cada deadline
    // é a última revisão feita
    const k = `${r.titulo_evento}|${r.deadline_agenda}`;
    porChave[k] ??= {
      status: r.status,
      novo_deadline: r.novo_deadline,
      novo_deadline_texto: r.novo_deadline_texto,
      evidencia: r.evidencia,
      fonte_link: r.fonte_link,
      revisado_em: r.revisado_em,
    };
  }
  return porChave;
}

// O link vem do cache ou do quadro de Editais, onde a Triagem já
// cadastra o link de cada edital. Nada é digitado à mão pra isso.
async function resolverLinks(client: Client, chaves: string[]): Promise<Map<string, string>> {
  const [{ data: cache }, { data: editais }] = await Promise.all([
    client.from("deadline_links").select("chave_evento, link").in("chave_evento", chaves),
    client.from("editais").select("titulo, link").not("link", "is", null),
  ]);

  const porChave = new Map((cache ?? []).map((l) => [l.chave_evento, l.link]));
  const descobertos: { chave_evento: string; link: string }[] = [];

  for (const edital of editais ?? []) {
    const chaveEdital = chaveEvento(edital.titulo);
    // chave curta demais casaria com qualquer coisa
    if (chaveEdital.length < 8 || !edital.link) continue;

    for (const chave of chaves) {
      if (porChave.has(chave)) continue;
      if (chave === chaveEdital || chave.includes(chaveEdital) || chaveEdital.includes(chave)) {
        porChave.set(chave, edital.link);
        descobertos.push({ chave_evento: chave, link: edital.link });
      }
    }
  }

  if (descobertos.length > 0) {
    await client.from("deadline_links").upsert(descobertos, { onConflict: "chave_evento" });
  }

  return porChave;
}

export async function runRevisaoDeadlines(
  admin: Client,
  { hoje = todaySaoPaulo(), refazerHoje = false }: { hoje?: string; refazerHoje?: boolean } = {}
) {
  const deadlines = await deadlinesParaRevisar(hoje);
  if (deadlines.length === 0) return { revisados: 0, prorrogados: 0, semLink: 0 };

  const chaves = deadlines.map((d) => chaveEvento(d.titulo));
  const [linkPorChave, { data: jaRevisados }] = await Promise.all([
    resolverLinks(admin, chaves),
    admin.from("deadline_revisoes").select("chave_evento, deadline_agenda").eq("revisado_dia", hoje),
  ]);

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
            : `Esse edital não está no quadro de Editais com link, então não há página oficial pra conferir (${detalhe}).`,
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

      return { status: resultado.status, temLink: link !== null };
    })
  );

  return {
    revisados: resultados.length,
    prorrogados: resultados.filter((r) => r.status === "prorrogado").length,
    semLink: resultados.filter((r) => !r.temLink).length,
  };
}
