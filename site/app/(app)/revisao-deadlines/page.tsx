import { requireProfile } from "@/lib/auth/current-user";
import { RevisaoDeadlinesBoard, type LinhaRevisao } from "@/components/revisao/RevisaoDeadlinesBoard";
import { chaveEvento, deadlinesParaRevisar } from "@/lib/planos/revisao-deadlines";
import type { Database } from "@/lib/supabase/types";

type RevisaoRow = Database["public"]["Tables"]["deadline_revisoes"]["Row"];

export default async function RevisaoDeadlinesPage() {
  const { supabase, user } = await requireProfile();

  const [deadlines, { data: revisoes }, { data: links }] = await Promise.all([
    deadlinesParaRevisar(),
    supabase.from("deadline_revisoes").select("*").order("revisado_em", { ascending: false }).limit(500),
    supabase.from("deadline_links").select("chave_evento, link"),
  ]);

  const linkPorChave = new Map((links ?? []).map((l) => [l.chave_evento, l.link]));

  // vem da mais recente pra mais antiga: a primeira de cada edital é a
  // última revisão feita
  const ultimaRevisao = new Map<string, RevisaoRow>();
  for (const r of revisoes ?? []) {
    const k = `${r.chave_evento}|${r.deadline_agenda}`;
    if (!ultimaRevisao.has(k)) ultimaRevisao.set(k, r);
  }

  const naJanela: LinhaRevisao[] = deadlines.map((d) => {
    const chave = chaveEvento(d.titulo);
    return {
      chave,
      titulo: d.titulo,
      deadlineAgenda: d.dia,
      link: linkPorChave.get(chave) ?? null,
      revisao: ultimaRevisao.get(`${chave}|${d.dia}`) ?? null,
    };
  });

  const chavesNaJanela = new Set(naJanela.map((l) => `${l.chave}|${l.deadlineAgenda}`));
  const anteriores: LinhaRevisao[] = [...ultimaRevisao.entries()]
    .filter(([k]) => !chavesNaJanela.has(k))
    .map(([, r]) => ({
      chave: r.chave_evento,
      titulo: r.titulo_evento,
      deadlineAgenda: r.deadline_agenda,
      link: linkPorChave.get(r.chave_evento) ?? null,
      revisao: r,
    }));

  return <RevisaoDeadlinesBoard naJanela={naJanela} anteriores={anteriores} currentUserId={user.id} />;
}
