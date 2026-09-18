"use client";

import { useMemo, useState } from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { NovoEditalDialog } from "@/components/editais/NovoEditalDialog";
import { TriagemIADialog } from "@/components/editais/TriagemIADialog";
import { BuscarResultadosDialog } from "@/components/editais/BuscarResultadosDialog";
import { EditalCommentSheet } from "@/components/editais/EditalCommentSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FASE_LABEL, ACTIVE_FASES } from "@/lib/editais";
import type { ResultadoFinding } from "@/lib/ai/resultados";
import type { EditalRow } from "@/components/editais/types";
import type { EditalFase } from "@/lib/supabase/types";
import type { TeamProfile } from "@/components/plano/types";

type Respostas = Record<string, string | null>;

// As colunas na mesma ordem da planilha que a equipe já usa. O que a
// triagem com IA responde fica em `respostas`; título, link, deadline e
// comentários são campos próprios do edital.
type Coluna = {
  id: string;
  label: string;
  largura: string;
  ler: (e: EditalRow) => string;
  salvar: (valor: string, e: EditalRow) => Partial<EditalRow>;
};

function resp(e: EditalRow): Respostas {
  return (e.respostas ?? {}) as Respostas;
}

function comResposta(e: EditalRow, campo: string, valor: string): Partial<EditalRow> {
  return { respostas: { ...resp(e), [campo]: valor } };
}

function colunaResposta(id: string, label: string, largura = "min-w-48"): Coluna {
  return {
    id,
    label,
    largura,
    ler: (e) => resp(e)[id] ?? "",
    salvar: (valor, e) => comResposta(e, id, valor),
  };
}

const COLUNAS: Coluna[] = [
  {
    id: "titulo",
    label: "Nome edital",
    largura: "min-w-56",
    ler: (e) => e.titulo,
    salvar: (valor) => ({ titulo: valor }),
  },
  colunaResposta("tamanho_documento", "Tamanho do Edital", "min-w-32"),
  {
    id: "observacoes",
    label: "Comentários",
    largura: "min-w-48",
    ler: (e) => e.observacoes ?? "",
    salvar: (valor) => ({ observacoes: valor }),
  },
  colunaResposta("deadline_texto", "Data, hora e fuso do deadline"),
  colunaResposta("proponente", "Proponente (quem pode se candidatar)", "min-w-64"),
  colunaResposta("documentos_necessarios", "Documentos necessários", "min-w-56"),
  {
    id: "link",
    label: "Link principal do edital",
    largura: "min-w-48",
    ler: (e) => e.link ?? "",
    salvar: (valor) => ({ link: valor }),
  },
  colunaResposta("resumo_produto", "Resumo / Produto", "min-w-64"),
  colunaResposta("categorias_tematica", "Categoria / Temática"),
  colunaResposta("local", "Onde / Cidade / País"),
  colunaResposta("periodo_execucao", "Quando vai ser realizado"),
  colunaResposta("custo_inscricao", "Custo para inscrever (fee)"),
  colunaResposta("remuneracao", "Remuneração"),
  colunaResposta("num_selecionados", "Nº selecionados", "min-w-32"),
  colunaResposta("envio_obra", "EXPO: como envia/instala a obra"),
  colunaResposta("carta_convite", "EXPO: precisa de carta-convite?"),
  colunaResposta("plano_expositivo", "EXPO: precisa de plano expositivo?"),
  colunaResposta("exposicao_online", "Dá pra apresentar online?"),
];

function Celula({
  valor,
  onSalvar,
}: {
  valor: string;
  onSalvar: (novo: string) => void;
}) {
  const [texto, setTexto] = useState(valor);

  return (
    <Textarea
      value={texto}
      className="min-h-16 resize-y border-0 bg-transparent text-xs shadow-none focus-visible:bg-background"
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        if (texto !== valor) onSalvar(texto);
      }}
    />
  );
}

export function TriagemPlanilha({
  editais: initialEditais,
  teamProfiles,
  currentUserId,
  isManager,
}: {
  editais: EditalRow[];
  teamProfiles: TeamProfile[];
  currentUserId: string;
  isManager: boolean;
}) {
  const [editais, setEditais] = useState(initialEditais);
  const [mostrarEncerrados, setMostrarEncerrados] = useState(false);
  const [comentandoId, setComentandoId] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // "EM ORDEM CRESC. DE DATA", como está na planilha de vocês
  const linhas = useMemo(() => {
    const visiveis = mostrarEncerrados ? editais : editais.filter((e) => ACTIVE_FASES.includes(e.fase));
    return [...visiveis].sort((a, b) => {
      if (!a.deadline_at) return 1;
      if (!b.deadline_at) return -1;
      return a.deadline_at.localeCompare(b.deadline_at);
    });
  }, [editais, mostrarEncerrados]);

  async function handleCreate(input: Partial<EditalRow> & { titulo: string }) {
    const { data, error } = await supabase
      .from("editais")
      .insert({ ...input, created_by: currentUserId, updated_by: currentUserId })
      .select("*")
      .single();
    if (error) {
      toast.error("Não deu pra criar: " + error.message);
      return;
    }
    if (data) setEditais((prev) => [...prev, data]);
  }

  async function handleUpdate(id: string, patch: Partial<EditalRow>) {
    setEditais((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    const { error } = await supabase
      .from("editais")
      .update({ ...patch, updated_by: currentUserId })
      .eq("id", id);
    if (error) toast.error("Não salvou: " + error.message);
  }

  async function handleDelete(id: string) {
    setEditais((prev) => prev.filter((e) => e.id !== id));
    await supabase.from("editais").delete().eq("id", id);
  }

  async function handleSaveResultado(editalId: string, resultadoInfo: ResultadoFinding, markConcluded: boolean) {
    const patch: Partial<EditalRow> = { resultado_info: resultadoInfo };
    if (markConcluded) patch.fase = "CONCLUIDO";
    await handleUpdate(editalId, patch);
  }

  const aguardandoResultado = editais.filter((e) => e.fase === "D" || e.fase === "DP").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Triagem</h1>
          <p className="text-sm text-muted-foreground">
            Todas as respostas da triagem, em ordem crescente de deadline. A equipe toda vê e edita junto.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BuscarResultadosDialog disabled={aguardandoResultado === 0} onSave={handleSaveResultado} />
          <TriagemIADialog onCreate={handleCreate} />
          <NovoEditalDialog onCreate={handleCreate} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-max border-collapse text-xs">
          <thead className="bg-muted/60">
            <tr>
              <th className="sticky left-0 z-10 w-20 border-r bg-muted/60 p-2 text-left font-medium">Fase</th>
              {COLUNAS.map((coluna) => (
                <th key={coluna.id} className={`${coluna.largura} border-r p-2 text-left font-medium`}>
                  {coluna.label}
                </th>
              ))}
              <th className="min-w-28 border-r p-2 text-left font-medium">Prazo (data)</th>
              <th className="min-w-24 border-r p-2 text-left font-medium">Triado em</th>
              <th className="w-20 p-2 text-left font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={COLUNAS.length + 4} className="p-4 text-center text-muted-foreground">
                  Nenhum edital em triagem. Use o botão &quot;Triagem com IA&quot; pra começar.
                </td>
              </tr>
            ) : (
              linhas.map((edital) => (
                <tr key={edital.id} className="border-t align-top hover:bg-muted/30">
                  <td className="sticky left-0 z-10 border-r bg-background p-1">
                    <select
                      value={edital.fase}
                      className="h-7 w-full rounded border bg-transparent px-1 text-xs"
                      onChange={(e) => handleUpdate(edital.id, { fase: e.target.value as EditalFase })}
                    >
                      {Object.entries(FASE_LABEL).map(([valor, rotulo]) => (
                        <option key={valor} value={valor}>
                          {rotulo}
                        </option>
                      ))}
                    </select>
                  </td>

                  {COLUNAS.map((coluna) => (
                    <td key={coluna.id} className="border-r p-0">
                      <Celula
                        valor={coluna.ler(edital)}
                        onSalvar={(novo) => handleUpdate(edital.id, coluna.salvar(novo, edital))}
                      />
                    </td>
                  ))}

                  <td className="border-r p-1">
                    <Input
                      type="date"
                      value={edital.deadline_at ?? ""}
                      className="h-7 text-xs"
                      onChange={(e) => handleUpdate(edital.id, { deadline_at: e.target.value || null })}
                    />
                  </td>

                  <td className="border-r p-2 text-muted-foreground">
                    {new Date(edital.created_at).toLocaleDateString("pt-BR")}
                  </td>

                  <td className="p-1">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => setComentandoId(edital.id)}>
                        <MessageSquare className="size-3.5" />
                      </Button>
                      {(isManager || edital.created_by === currentUserId) && (
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => handleDelete(edital.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="self-start text-sm text-muted-foreground hover:text-foreground"
        onClick={() => setMostrarEncerrados((v) => !v)}
      >
        {mostrarEncerrados ? "Esconder" : "Mostrar"} concluídos e descartados
      </button>

      {comentandoId && (
        <EditalCommentSheet
          editalId={comentandoId}
          teamProfiles={teamProfiles}
          currentUserId={currentUserId}
          isManager={isManager}
          onClose={() => setComentandoId(null)}
        />
      )}
    </div>
  );
}
