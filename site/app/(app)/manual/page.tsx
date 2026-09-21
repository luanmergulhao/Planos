import { requireProfile } from "@/lib/auth/current-user";
import { montarHtmlDoManual } from "@/lib/manual";
import { ManualLeitor } from "@/components/manual/ManualLeitor";

// Manual da equipe, somente leitura. O conteúdo vem do .docx do Google Docs
// (scripts/importar-manual.mjs) e as senhas só aparecem pra quem tem
// profiles.pode_ver_segredos.
export default async function ManualPage({ searchParams }: { searchParams: Promise<{ secao?: string }> }) {
  const { secao } = await searchParams;
  const { supabase } = await requireProfile();

  const { data: indice, error } = await supabase
    .from("manual_secoes")
    .select("id, ordem, grupo, titulo, em_revisao")
    .order("ordem");

  if (error || !indice || indice.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Manual</h1>
        <p className="text-sm text-muted-foreground">O manual ainda não foi importado.</p>
      </div>
    );
  }

  const atual = indice.find((s) => s.id === secao) ?? indice[0];

  const { data: conteudo } = await supabase.from("manual_secoes").select("html").eq("id", atual.id).single();
  // quem não pode ver senhas recebe zero linhas aqui (política do banco)
  const { data: segredos } = await supabase.from("manual_segredos").select("id, valor").eq("secao_id", atual.id);

  const html = montarHtmlDoManual(conteudo?.html ?? "", new Map((segredos ?? []).map((s) => [s.id, s.valor])));

  return <ManualLeitor indice={indice} atual={atual} html={html} />;
}
